"""Messagerie & appels (§12) : conversations directes / groupe / projet / corps d'état / issue, messages avec pièces
jointes (fichier, version GED, point de vue BIM), accusés de lecture, appels audio/vidéo WebRTC (signalisation via
WebSocket, serveurs STUN/TURN à identifiants temporaires), partage d'écran, enregistrement soumis au consentement."""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.utils import utcnow
from app.modules.communications.models import (
    Call,
    CallParticipant,
    Conversation,
    ConversationMember,
    Message,
    MessageAttachment,
)
from app.modules.identity.models import User

MESH_LIMIT = 4
EDIT_WINDOW = timedelta(minutes=15)
RECORDING_RETENTION_DAYS = 90


# ============================================================================ règles de mise en relation
def _kind_of(user: User) -> str:
    org = user.organization
    return org.kind if org else "internal"


def _project_ids(db: Session, user: User) -> set[uuid.UUID]:
    from app.modules.projects.models import Project, ProjectMember

    ids = set(db.execute(select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)).scalars())
    if user.organization_id and _kind_of(user) == "client":
        ids |= set(
            db.execute(select(Project.id).where(Project.client_organization_id == user.organization_id)).scalars()
        )
    return ids


def can_contact(db: Session, a: User, b: User) -> bool:
    """Interne ↔ tous ; client ↔ équipe interne de ses projets ; partenaire ↔ interne ; jamais client ↔ partenaire."""
    if a.id == b.id or not a.is_active or not b.is_active:
        return False
    ka, kb = _kind_of(a), _kind_of(b)
    if ka == "internal" and kb == "internal":
        return True
    if "internal" not in (ka, kb):
        return a.organization_id is not None and a.organization_id == b.organization_id
    external, internal = (a, b) if ka != "internal" else (b, a)
    if _kind_of(external) == "client":
        from app.modules.projects.models import ProjectMember

        projects = _project_ids(db, external)
        global_scope = any(r.global_scope for r in internal.roles)
        if global_scope:
            return True
        return bool(
            projects
            and db.execute(
                select(ProjectMember.id).where(
                    ProjectMember.user_id == internal.id, ProjectMember.project_id.in_(projects)
                )
            ).first()
        )
    return True


def _member(db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID) -> ConversationMember | None:
    return db.execute(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id, ConversationMember.user_id == user_id
        )
    ).scalar_one_or_none()


def require_member(
    db: Session, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Conversation, ConversationMember]:
    conversation = db.get(Conversation, conversation_id)
    member = _member(db, conversation_id, user_id) if conversation else None
    if conversation is None or member is None:
        raise NotFound("Conversation introuvable")
    return conversation, member


# ============================================================================ conversations
def direct_conversation(db: Session, me: User, other: User) -> Conversation:
    if not can_contact(db, me, other):
        raise Forbidden("Mise en relation non autorisée", code="CONTACT_FORBIDDEN")
    key = ":".join(sorted([str(me.id), str(other.id)]))
    conversation = db.execute(select(Conversation).where(Conversation.direct_key == key)).scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(kind="direct", direct_key=key, created_by_id=me.id)
        conversation.members.extend(
            [ConversationMember(user_id=me.id, role="owner"), ConversationMember(user_id=other.id)]
        )
        db.add(conversation)
        db.flush()
    return conversation


def group_conversation(
    db: Session,
    me: User,
    *,
    title: str,
    member_ids: list[uuid.UUID],
    kind: str = "group",
    project_id: uuid.UUID | None = None,
    trade: str | None = None,
    issue_id: uuid.UUID | None = None,
) -> Conversation:
    conversation = Conversation(
        kind=kind, title=title, project_id=project_id, trade=trade, issue_id=issue_id, created_by_id=me.id
    )
    conversation.members.append(ConversationMember(user_id=me.id, role="owner"))
    for uid in {m for m in member_ids if m != me.id}:
        user = db.get(User, uid)
        if user is None:
            raise NotFound("Utilisateur introuvable")
        if not can_contact(db, me, user):
            raise Forbidden(f"Mise en relation non autorisée avec {user.full_name}", code="CONTACT_FORBIDDEN")
        conversation.members.append(ConversationMember(user_id=uid))
    db.add(conversation)
    db.flush()
    return conversation


def project_channel(
    db: Session, me: User, project_id: uuid.UUID, *, trade: str | None = None, client_channel: bool = False
) -> Conversation:
    """Canal projet (équipe interne + partenaires), canal par corps d'état, ou canal client (équipe ↔ client)."""
    from app.modules.projects.models import Project, ProjectMember

    project = db.get(Project, project_id)
    if project is None:
        raise NotFound("Projet introuvable")
    kind = "client" if client_channel else ("trade" if trade else "project")
    conversation = (
        db.execute(
            select(Conversation).where(
                Conversation.project_id == project_id,
                Conversation.kind == kind,
                Conversation.trade.is_(None) if trade is None else Conversation.trade == trade,
            )
        )
        .scalars()
        .first()
    )
    from app.modules.subcontracting.trades import ensure_person_trade, trade_label

    title = {"client": f"{project.name} — échanges client", "trade": f"{project.name} — {trade_label(trade)}"}.get(
        kind, f"{project.name} — équipe"
    )
    if conversation is None:
        ensure_person_trade(trade)  # un canal existant (code historique) reste accessible
        conversation = Conversation(kind=kind, title=title, project_id=project_id, trade=trade, created_by_id=me.id)
        db.add(conversation)
        db.flush()
    wanted: set[uuid.UUID] = set()
    for member in db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id)).scalars():
        user = db.get(User, member.user_id)
        if user is None or not user.is_active:
            continue
        if kind == "trade" and member.disciplines and trade not in member.disciplines and _kind_of(user) != "internal":
            continue
        if kind != "client" and _kind_of(user) == "client":
            continue
        wanted.add(user.id)
    if kind == "client" and project.client_organization_id:
        wanted |= set(
            db.execute(
                select(User.id).where(User.organization_id == project.client_organization_id, User.is_active.is_(True))
            ).scalars()
        )
    wanted.add(me.id)
    existing = {m.user_id for m in conversation.members}
    for uid in wanted - existing:
        conversation.members.append(ConversationMember(user_id=uid))
    db.flush()
    return conversation


def unread_counts(db: Session, user_id: uuid.UUID, conversation_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not conversation_ids:
        return {}
    rows = db.execute(
        select(Message.conversation_id, func.count(Message.id))
        .join(
            ConversationMember,
            and_(ConversationMember.conversation_id == Message.conversation_id, ConversationMember.user_id == user_id),
        )
        .where(
            Message.conversation_id.in_(conversation_ids),
            Message.deleted_at.is_(None),
            or_(Message.sender_id.is_(None), Message.sender_id != user_id),
            or_(ConversationMember.last_read_at.is_(None), Message.created_at > ConversationMember.last_read_at),
        )
        .group_by(Message.conversation_id)
    ).all()
    return {cid: count for cid, count in rows}


# ============================================================================ messages
def send_message(
    db: Session,
    conversation: Conversation,
    sender: User,
    *,
    body: str | None,
    kind: str = "text",
    reply_to_id: uuid.UUID | None,
    attachments: list[dict[str, Any]],
    client_message_id: str | None,
    meta: dict[str, Any] | None = None,
) -> tuple[Message, bool]:
    if client_message_id:
        existing = db.execute(
            select(Message).where(Message.client_message_id == client_message_id)
        ).scalar_one_or_none()
        if existing is not None:
            if existing.conversation_id != conversation.id or existing.sender_id != sender.id:
                raise Conflict("Identifiant client de message déjà utilisé")
            return existing, False
    if conversation.is_archived:
        raise BusinessRuleError("Conversation archivée")
    if not (body or "").strip() and not attachments:
        raise BusinessRuleError("Message vide")
    if reply_to_id:
        parent = db.get(Message, reply_to_id)
        if parent is None or parent.conversation_id != conversation.id:
            raise BusinessRuleError("Réponse à un message d'une autre conversation")
    message = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        kind=kind,
        body=(body or "").strip() or None,
        reply_to_id=reply_to_id,
        meta=meta or {},
        client_message_id=client_message_id,
    )
    for att in attachments:
        message.attachments.append(MessageAttachment(**att))
    db.add(message)
    conversation.last_message_at = utcnow()
    member = _member(db, conversation.id, sender.id)
    if member is not None:
        member.last_read_at = utcnow()
    db.flush()
    return message, True


def message_payload(db: Session, message: Message) -> dict[str, Any]:
    from app.core.crud import serialize
    from app.core.utils import jsonable

    sender = db.get(User, message.sender_id) if message.sender_id else None
    data = serialize(message)
    if message.deleted_at:
        data["body"] = None
    return jsonable(
        {
            **data,
            "sender": {"id": sender.id, "name": sender.full_name} if sender else None,
            "attachments": [] if message.deleted_at else [serialize(a) for a in message.attachments],
        }
    )


def offline_members(db: Session, conversation: Conversation, exclude: uuid.UUID) -> list[str]:
    from app.websocket.hub import hub

    return [
        str(m.user_id)
        for m in conversation.members
        if m.user_id != exclude and not m.muted and not hub.is_online(str(m.user_id))
    ]


def edit_message(db: Session, message: Message, user: User, body: str) -> Message:
    if message.sender_id != user.id:
        raise Forbidden("Seul l'auteur peut modifier son message")
    if message.deleted_at or utcnow() - message.created_at > EDIT_WINDOW:
        raise BusinessRuleError("Délai de modification dépassé (15 min)")
    message.body = body.strip()
    message.edited_at = utcnow()
    return message


def delete_message(db: Session, message: Message, user: User, *, moderator: bool) -> Message:
    if message.sender_id != user.id and not moderator:
        raise Forbidden("Suppression réservée à l'auteur ou à un modérateur")
    message.deleted_at = utcnow()
    audit.record(
        db,
        family="business",
        module="chat",
        action="MESSAGE_DELETE",
        resource_type="message",
        resource_id=message.id,
        diff={"moderator": moderator and message.sender_id != user.id},
    )
    return message


# ============================================================================ appels
def ice_servers(user_id: uuid.UUID) -> dict[str, Any]:
    """STUN public + TURN (coturn « use-auth-secret ») à identifiants HMAC temporaires."""
    from app.core.secrets import get_secret

    servers: list[dict[str, Any]] = [{"urls": settings.STUN_URLS}] if settings.STUN_URLS else []
    secret = get_secret("TURN_SHARED_SECRET") or settings.TURN_SHARED_SECRET
    if settings.TURN_URLS and secret:
        expiry = int(time.time()) + settings.TURN_TTL_SECONDS
        username = f"{expiry}:{user_id}"
        credential = base64.b64encode(hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()).decode()
        servers.append({"urls": settings.TURN_URLS, "username": username, "credential": credential})
    return {"ice_servers": servers, "ttl": settings.TURN_TTL_SECONDS, "turn": bool(settings.TURN_URLS and secret)}


def start_call(
    db: Session,
    initiator: User,
    *,
    kind: str,
    participant_ids: list[uuid.UUID],
    conversation_id: uuid.UUID | None,
    project_id: uuid.UUID | None,
    issue_id: uuid.UUID | None,
    title: str | None,
    scheduled_at: Any = None,
) -> Call:
    ids = {uid for uid in participant_ids if uid != initiator.id}
    if conversation_id:
        conversation, _ = require_member(db, conversation_id, initiator.id)
        ids |= {m.user_id for m in conversation.members if m.user_id != initiator.id}
    if not ids:
        raise BusinessRuleError("Aucun participant")
    participants = []
    for uid in ids:
        user = db.get(User, uid)
        if user is None:
            raise NotFound("Participant introuvable")
        perms = {code for role in user.roles for code in role.permission_codes}
        if "calls:use" not in perms:
            raise Forbidden(f"{user.full_name} n'est pas autorisé(e) aux appels", code="CALLS_NOT_ALLOWED")
        if not can_contact(db, initiator, user):
            raise Forbidden(f"Mise en relation non autorisée avec {user.full_name}", code="CONTACT_FORBIDDEN")
        participants.append(user)
    call = Call(
        kind=kind,
        conversation_id=conversation_id,
        project_id=project_id,
        issue_id=issue_id,
        title=title,
        initiator_id=initiator.id,
        status="ringing" if scheduled_at is None else "scheduled",
        topology="mesh" if len(participants) + 1 <= MESH_LIMIT else "sfu",
        scheduled_at=scheduled_at,
    )
    call.participants.append(
        CallParticipant(user_id=initiator.id, status="joined", joined_at=utcnow(), used_video=kind == "video")
    )
    for user in participants:
        call.participants.append(CallParticipant(user_id=user.id, status="ringing"))
    db.add(call)
    db.flush()
    audit.record(
        db,
        family="business",
        module="calls",
        action="START",
        resource_type="call",
        resource_id=call.id,
        project_id=project_id,
        actor_id=initiator.id,
        diff={"kind": kind, "participants": len(participants) + 1},
    )
    return call


def _participant(call: Call, user_id: uuid.UUID) -> CallParticipant:
    participant = next((p for p in call.participants if p.user_id == user_id), None)
    if participant is None:
        raise NotFound("Appel introuvable")
    return participant


def join_call(db: Session, call: Call, user: User, *, video: bool) -> Call:
    participant = _participant(call, user.id)
    if call.status in ("ended", "cancelled", "missed", "rejected"):
        raise BusinessRuleError("Appel terminé", code="CALL_ENDED")
    participant.status = "joined"
    participant.joined_at = participant.joined_at or utcnow()
    participant.used_video = participant.used_video or video
    if call.status in ("ringing", "scheduled"):
        call.status = "active"
        call.started_at = utcnow()
    return call


def decline_call(db: Session, call: Call, user: User) -> Call:
    participant = _participant(call, user.id)
    if participant.status not in ("ringing", "invited"):
        raise BusinessRuleError("Appel déjà pris ou terminé")
    participant.status = "declined"
    others = [p for p in call.participants if p.user_id != call.initiator_id]
    if call.status == "ringing" and all(p.status == "declined" for p in others):
        call.status = "rejected"
        call.ended_at = utcnow()
    return call


def leave_call(db: Session, call: Call, user: User) -> Call:
    participant = _participant(call, user.id)
    if participant.status == "joined":
        participant.status = "left"
        participant.left_at = utcnow()
    if user.id == call.initiator_id and call.status == "ringing":
        call.status = "cancelled"
        call.ended_at = utcnow()
        for p in call.participants:
            if p.status == "ringing":
                p.status = "missed"
    elif (
        not any(p.status == "joined" for p in call.participants if p.user_id != user.id)
        or sum(1 for p in call.participants if p.status == "joined") < 2
    ):
        end_call(db, call)
    return call


def end_call(db: Session, call: Call) -> Call:
    if call.status in ("ended", "cancelled", "missed", "rejected"):
        return call
    now = utcnow()
    call.status = "ended" if call.started_at else "missed"
    call.ended_at = now
    if call.started_at:
        call.duration_seconds = int((now - call.started_at).total_seconds())
    for p in call.participants:
        if p.status == "joined":
            p.status = "left"
            p.left_at = now
        elif p.status == "ringing":
            p.status = "missed"
    return call


def set_screen_share(call: Call, user: User, active: bool) -> Call:
    participant = _participant(call, user.id)
    if participant.status != "joined":
        raise BusinessRuleError("Rejoindre l'appel avant de partager l'écran")
    participant.shared_screen = participant.shared_screen or active
    if active:
        call.had_screen_share = True
    return call


def consent_recording(db: Session, call: Call, user: User, *, consent: bool) -> Call:
    _participant(call, user.id)
    consents = dict(call.recording_consents or {})
    if consent:
        consents[str(user.id)] = utcnow().isoformat()
    else:
        consents.pop(str(user.id), None)
    call.recording_consents = consents
    audit.record(
        db,
        family="security",
        module="calls",
        action="RECORDING_CONSENT" if consent else "RECORDING_REFUSAL",
        resource_type="call",
        resource_id=call.id,
        actor_id=user.id,
    )
    return call


def recording_allowed(call: Call) -> bool:
    joined = {str(p.user_id) for p in call.participants if p.status in ("joined", "left") and p.joined_at}
    return bool(joined) and joined <= set((call.recording_consents or {}).keys())


def mark_missed_calls(db: Session) -> dict[str, Any]:
    """Job : appels restés en sonnerie > 60 s → manqués + notification."""
    from app.core.events import emit

    threshold = utcnow() - timedelta(seconds=60)
    count = 0
    for call in db.execute(select(Call).where(Call.status == "ringing", Call.created_at < threshold)).scalars():
        missed = [p.user_id for p in call.participants if p.status == "ringing"]
        end_call(db, call)
        initiator = db.get(User, call.initiator_id) if call.initiator_id else None
        if missed:
            emit(
                db,
                "call.missed",
                {
                    "call_id": call.id,
                    "caller": initiator.full_name if initiator else "",
                    "user_ids": [str(u) for u in missed],
                },
                aggregate_type="call",
                aggregate_id=call.id,
                project_id=call.project_id,
            )
        count += 1
    return {"items": count}
