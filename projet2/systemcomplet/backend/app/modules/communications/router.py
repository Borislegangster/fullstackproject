"""API Messagerie & appels (§12, V4-CALL-17/18/19) : conversations, messages temps réel, pièces jointes, présence,
appels audio/vidéo (signalisation WebSocket), partage d'écran, enregistrement avec consentement."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, Forbidden, NotFound
from app.core.events import emit
from app.core.files import store_private, validate_upload
from app.core.utils import jsonable, utcnow
from app.modules.communications import service
from app.modules.communications.models import (
    Call,
    CallParticipant,
    Conversation,
    ConversationMember,
    Message,
    MessageAttachment,
    Presence,
)
from app.modules.identity.models import User
from app.modules.system.models import StoredFile
from app.websocket.hub import hub, publish_room, publish_user

router = APIRouter(tags=["Messagerie & appels"])


def _conversation_out(db: Session, conversation: Conversation, user_id: uuid.UUID, unread: int = 0) -> dict[str, Any]:
    members = []
    for member in conversation.members:
        user = db.get(User, member.user_id)
        if user is not None:
            members.append(
                {
                    "user_id": user.id,
                    "name": user.full_name,
                    "role": member.role,
                    "online": hub.is_online(str(user.id)),
                    "last_read_at": member.last_read_at,
                }
            )
    title = conversation.title
    if conversation.kind == "direct":
        other = next((m for m in members if m["user_id"] != user_id), None)
        title = other["name"] if other else "Conversation"
    last = db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id, Message.deleted_at.is_(None))
        .order_by(Message.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    return jsonable(
        {
            **serialize(conversation),
            "title": title,
            "members": members,
            "unread": unread,
            "last_message": {
                "body": (last.body or "")[:160],
                "at": last.created_at,
                "sender_id": last.sender_id,
                "kind": last.kind,
            }
            if last
            else None,
        }
    )


@router.get("/conversations")
def my_conversations(
    project_id: uuid.UUID | None = None,
    kind: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("chat:use")
    stmt = (
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(ConversationMember.user_id == access.p.id, Conversation.is_archived.is_(False))
    )
    if project_id:
        # Messagerie d'un projet (espace client, application terrain) : ses fils, plus les échanges directs et
        # groupes hors projet de l'utilisateur — sinon une conversation directe « disparaît » à chaque visite.
        stmt = stmt.where(or_(Conversation.project_id == project_id, Conversation.project_id.is_(None)))
    if kind:
        stmt = stmt.where(Conversation.kind == kind)
    conversations = (
        db.execute(stmt.order_by(Conversation.last_message_at.desc().nulls_last()).limit(300)).scalars().all()
    )
    unread = service.unread_counts(db, access.p.id, [c.id for c in conversations])
    return [_conversation_out(db, c, access.p.id, unread.get(c.id, 0)) for c in conversations]


class DirectIn(BaseModel):
    user_id: uuid.UUID


@router.post("/conversations/direct")
def open_direct(data: DirectIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("chat:use")
    other = db.get(User, data.user_id)
    if other is None:
        raise NotFound("Utilisateur introuvable")
    conversation = service.direct_conversation(db, access.p.user, other)
    db.commit()
    return _conversation_out(db, conversation, access.p.id)


class GroupIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    member_ids: list[uuid.UUID] = Field(min_length=1, max_length=200)
    project_id: uuid.UUID | None = None


@router.post("/conversations", status_code=201)
def create_group(data: GroupIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("chat:use")
    if data.project_id:
        access.require_project(data.project_id)
    conversation = service.group_conversation(
        db, access.p.user, title=data.title, member_ids=data.member_ids, project_id=data.project_id
    )
    db.commit()
    return _conversation_out(db, conversation, access.p.id)


class ChannelIn(BaseModel):
    project_id: uuid.UUID
    trade: str | None = Field(default=None, max_length=60)
    client_channel: bool = False


@router.post("/conversations/project-channel")
def project_channel(
    data: ChannelIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Canal d'équipe projet, canal par corps d'état ou canal client (synchronise les membres du projet)."""
    access.require("chat:use")
    access.require_project(data.project_id)
    if not access.p.is_internal:
        raise Forbidden("Création de canal réservée à l'équipe interne", code="PERMISSION_DENIED")
    conversation = service.project_channel(
        db, access.p.user, data.project_id, trade=data.trade, client_channel=data.client_channel
    )
    db.commit()
    return _conversation_out(db, conversation, access.p.id)


@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("chat:use")
    conversation, _ = service.require_member(db, conversation_id, access.p.id)
    return _conversation_out(db, conversation, access.p.id)


class MembersIn(BaseModel):
    add: list[uuid.UUID] = Field(default_factory=list, max_length=200)
    remove: list[uuid.UUID] = Field(default_factory=list, max_length=200)


@router.post("/conversations/{conversation_id}/members")
def update_members(
    conversation_id: uuid.UUID, data: MembersIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("chat:use")
    conversation, member = service.require_member(db, conversation_id, access.p.id)
    if conversation.kind == "direct":
        raise BusinessRuleError("Conversation directe : membres figés")
    if member.role != "owner" and not access.has("users:write"):
        raise Forbidden("Réservé au créateur de la conversation")
    existing = {m.user_id: m for m in conversation.members}
    for uid in data.add:
        user = db.get(User, uid)
        if user is None:
            raise NotFound("Utilisateur introuvable")
        if uid not in existing:
            if not service.can_contact(db, access.p.user, user):
                raise Forbidden(f"Mise en relation non autorisée avec {user.full_name}", code="CONTACT_FORBIDDEN")
            conversation.members.append(ConversationMember(user_id=uid))
    for uid in data.remove:
        if uid in existing and uid != access.p.id:
            conversation.members.remove(existing[uid])
    db.commit()
    publish_room(f"conversation:{conversation.id}", "conversation.members", {"conversation_id": conversation.id})
    return _conversation_out(db, conversation, access.p.id)


class MuteIn(BaseModel):
    muted: bool


@router.post("/conversations/{conversation_id}/mute")
def mute(
    conversation_id: uuid.UUID, data: MuteIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("chat:use")
    _, member = service.require_member(db, conversation_id, access.p.id)
    member.muted = data.muted
    db.commit()
    return {"muted": member.muted}


class ConversationReadIn(BaseModel):
    message_id: uuid.UUID | None = None


@router.post("/conversations/{conversation_id}/read")
def mark_conversation_read(
    conversation_id: uuid.UUID,
    data: ConversationReadIn | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Accusé de lecture (équivalent REST de l'événement WebSocket « read », utile hors ligne)."""
    access.require("chat:use")
    _, member = service.require_member(db, conversation_id, access.p.id)
    member.last_read_at = utcnow()
    if data and data.message_id:
        member.last_read_message_id = data.message_id
    db.commit()
    publish_room(
        f"conversation:{conversation_id}",
        "read",
        {
            "conversation_id": conversation_id,
            "user_id": access.p.id,
            "message_id": data.message_id if data else None,
            "at": member.last_read_at,
        },
    )
    return {"conversation_id": str(conversation_id), "read_at": member.last_read_at.isoformat()}


@router.get("/conversations/{conversation_id}/messages")
def list_messages(
    conversation_id: uuid.UUID,
    before: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("chat:use")
    service.require_member(db, conversation_id, access.p.id)
    stmt = select(Message).where(Message.conversation_id == conversation_id)
    if before:
        stmt = stmt.where(Message.created_at < before)
    rows = db.execute(stmt.order_by(Message.created_at.desc()).limit(limit + 1)).scalars().all()
    has_more = len(rows) > limit
    messages = list(reversed(rows[:limit]))
    return {
        "items": [service.message_payload(db, m) for m in messages],
        "has_more": has_more,
        "next_before": messages[0].created_at.isoformat() if has_more and messages else None,
    }


class AttachmentIn(BaseModel):
    file_id: uuid.UUID | None = None
    document_version_id: uuid.UUID | None = None
    bim_viewpoint_id: uuid.UUID | None = None


class MessageIn(BaseModel):
    body: str | None = Field(default=None, max_length=8000)
    kind: str = Field(default="text", pattern="^(text|file|image|plan|document)$")
    reply_to_id: uuid.UUID | None = None
    attachments: list[AttachmentIn] = Field(default_factory=list, max_length=10)
    client_message_id: str | None = Field(default=None, max_length=80)


def _resolve_attachments(
    db: Session, access: Access, conversation: Conversation, items: list[AttachmentIn]
) -> list[dict[str, Any]]:
    from app.modules.documents.models import Document, DocumentVersion
    from app.modules.documents.service import can_read

    out = []
    for item in items:
        if item.file_id:
            stored = db.get(StoredFile, item.file_id)
            if stored is None or stored.uploaded_by_id != access.p.id or stored.purpose != "chat":
                raise BusinessRuleError("Pièce jointe inconnue")
            out.append(
                {
                    "file_id": stored.id,
                    "name": stored.original_name,
                    "mime_type": stored.mime_type,
                    "size_bytes": stored.size_bytes,
                }
            )
        elif item.document_version_id:
            version = db.get(DocumentVersion, item.document_version_id)
            document = db.get(Document, version.document_id) if version else None
            if document is None or not can_read(access, db, document):
                raise Forbidden("Document non accessible", code="DOCUMENT_ACCESS_DENIED")
            out.append(
                {
                    "document_version_id": version.id,
                    "name": f"{document.title} v{version.version_major}.{version.version_minor}",
                    "mime_type": version.mime_type,
                    "size_bytes": version.size_bytes,
                }
            )
        elif item.bim_viewpoint_id:
            from app.modules.bim.models import Viewpoint

            viewpoint = db.get(Viewpoint, item.bim_viewpoint_id)
            if viewpoint is None:
                raise NotFound("Point de vue BIM introuvable")
            out.append({"bim_viewpoint_id": viewpoint.id, "name": viewpoint.name})
    return out


@router.post("/conversations/{conversation_id}/messages", status_code=201)
def send(
    conversation_id: uuid.UUID, data: MessageIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("chat:use")
    conversation, _ = service.require_member(db, conversation_id, access.p.id)
    attachments = _resolve_attachments(db, access, conversation, data.attachments)
    message, created = service.send_message(
        db,
        conversation,
        access.p.user,
        body=data.body,
        kind=data.kind,
        reply_to_id=data.reply_to_id,
        attachments=attachments,
        client_message_id=data.client_message_id,
    )
    payload = service.message_payload(db, message)
    if created:
        offline = service.offline_members(db, conversation, access.p.id)
        if offline:
            emit(
                db,
                "message.new",
                {
                    "conversation": conversation.title or access.p.user.full_name,
                    "sender": access.p.user.full_name,
                    "preview": (message.body or "📎")[:120],
                    "link": f"/messagerie/{conversation.id}",
                    "offline_user_ids": offline,
                },
                aggregate_type="conversation",
                aggregate_id=conversation.id,
                project_id=conversation.project_id,
            )
    db.commit()
    if created:
        publish_room(f"conversation:{conversation.id}", "message.new", payload)
        for member in conversation.members:
            if member.user_id != access.p.id:
                publish_user(member.user_id, "conversation.updated", {"conversation_id": conversation.id})
    return payload


class EditIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)


@router.patch("/messages/{message_id}")
def edit(
    message_id: uuid.UUID, data: EditIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("chat:use")
    message = db.get(Message, message_id)
    if message is None:
        raise NotFound("Message introuvable")
    service.require_member(db, message.conversation_id, access.p.id)
    service.edit_message(db, message, access.p.user, data.body)
    db.commit()
    payload = service.message_payload(db, message)
    publish_room(f"conversation:{message.conversation_id}", "message.updated", payload)
    return payload


@router.delete("/messages/{message_id}")
def delete(
    message_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("chat:use")
    message = db.get(Message, message_id)
    if message is None:
        raise NotFound("Message introuvable")
    service.require_member(db, message.conversation_id, access.p.id)
    service.delete_message(db, message, access.p.user, moderator=access.has("users:write"))
    db.commit()
    publish_room(
        f"conversation:{message.conversation_id}",
        "message.deleted",
        {"id": message.id, "conversation_id": message.conversation_id},
    )
    return {"status": "deleted"}


@router.post("/chat/files", status_code=201)
async def upload_chat_file(
    file: UploadFile = File(...), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("chat:use")
    upload = validate_upload(file.filename or "fichier", await file.read(), category="any", allow_bim=True)
    stored = store_private(db, upload, purpose="chat", classification="internal", uploaded_by_id=access.p.id)
    db.commit()
    return jsonable(
        {
            "file_id": stored.id,
            "name": stored.original_name,
            "mime_type": stored.mime_type,
            "size_bytes": stored.size_bytes,
        }
    )


@router.get("/chat/attachments/{attachment_id}")
def download_attachment(
    attachment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("chat:use")
    attachment = db.get(MessageAttachment, attachment_id)
    message = db.get(Message, attachment.message_id) if attachment else None
    if attachment is None or message is None or message.deleted_at is not None:
        raise NotFound("Pièce jointe introuvable")
    service.require_member(db, message.conversation_id, access.p.id)
    if attachment.file_id:
        return file_response(db.get(StoredFile, attachment.file_id))
    if attachment.document_version_id:
        from app.modules.documents.models import Document, DocumentVersion
        from app.modules.documents.service import can_read

        version = db.get(DocumentVersion, attachment.document_version_id)
        document = db.get(Document, version.document_id) if version else None
        if document is None or not can_read(access, db, document):
            raise Forbidden("Document non accessible", code="DOCUMENT_ACCESS_DENIED")
        return file_response(db.get(StoredFile, version.file_id))
    raise NotFound("Pièce jointe sans fichier")


@router.get("/chat/search")
def search(
    q: str = Query(min_length=2, max_length=200), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("chat:use")
    mine = select(ConversationMember.conversation_id).where(ConversationMember.user_id == access.p.id)
    rows = db.execute(
        select(Message)
        .where(Message.conversation_id.in_(mine), Message.deleted_at.is_(None), Message.body.ilike(f"%{q}%"))
        .order_by(Message.created_at.desc())
        .limit(50)
    ).scalars()
    return [service.message_payload(db, m) for m in rows]


@router.get("/presence")
def presence(
    user_ids: list[uuid.UUID] = Query(default_factory=list),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("chat:use")
    out = []
    for uid in user_ids[:200]:
        row = db.get(Presence, uid)
        online = hub.is_online(str(uid))
        out.append(
            {
                "user_id": uid,
                "status": "online" if online else (row.status if row else "offline"),
                "last_seen_at": row.last_seen_at if row else None,
            }
        )
    return jsonable(out)


@router.get("/contacts")
def contacts(
    q: str | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    """Annuaire des personnes joignables selon les règles de mise en relation."""
    access.require("chat:use")
    stmt = select(User).where(User.is_active.is_(True), User.id != access.p.id)
    if q:
        stmt = stmt.where((User.first_name + " " + User.last_name).ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    out = []
    for user in db.execute(stmt.order_by(User.last_name).limit(200)).scalars():
        if service.can_contact(db, access.p.user, user):
            out.append(
                {
                    "id": user.id,
                    "name": user.full_name,
                    "job_title": user.job_title,
                    "organization": user.organization.name if user.organization else None,
                    "online": hub.is_online(str(user.id)),
                }
            )
    return jsonable(out)


# ============================================================================ appels
@router.get("/calls/ice-servers")
def ice(access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("calls:use")
    return service.ice_servers(access.p.id)


class CallIn(BaseModel):
    kind: str = Field(default="audio", pattern="^(audio|video)$")
    participant_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    conversation_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    issue_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=200)
    scheduled_at: datetime | None = None


def _call_out(db: Session, call: Call) -> dict[str, Any]:
    participants = []
    for p in call.participants:
        user = db.get(User, p.user_id)
        participants.append({**serialize(p), "name": user.full_name if user else ""})
    return jsonable(
        {**serialize(call), "participants": participants, "recording_allowed": service.recording_allowed(call)}
    )


def _call(db: Session, access: Access, call_id: uuid.UUID) -> Call:
    call = db.get(Call, call_id)
    if call is None or not any(p.user_id == access.p.id for p in call.participants):
        raise NotFound("Appel introuvable")
    return call


@router.post("/calls", status_code=201)
def start_call(data: CallIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("calls:use")
    if data.project_id:
        access.require_project(data.project_id)
    call = service.start_call(
        db,
        access.p.user,
        kind=data.kind,
        participant_ids=data.participant_ids,
        conversation_id=data.conversation_id,
        project_id=data.project_id,
        issue_id=data.issue_id,
        title=data.title,
        scheduled_at=data.scheduled_at,
    )
    if call.status == "ringing":
        from app.modules.notifications.service import notify_users

        ringing = [p.user_id for p in call.participants if p.status == "ringing"]
        notify_users(
            db,
            [u for u in ringing if not hub.is_online(str(u))],
            category="calls",
            title=f"Appel {'vidéo' if call.kind == 'video' else 'audio'} de {access.p.user.full_name}",
            link=f"/appels/{call.id}",
            priority="high",
            channels=("push",),
            entity_type="call",
            entity_id=str(call.id),
            event_type="call.ringing",
        )
    db.commit()
    payload = _call_out(db, call)
    if call.status == "ringing":
        for p in call.participants:
            if p.user_id != access.p.id:
                publish_user(
                    p.user_id,
                    "call.incoming",
                    {
                        "call_id": call.id,
                        "kind": call.kind,
                        "title": call.title,
                        "from": {"id": access.p.id, "name": access.p.user.full_name},
                        "topology": call.topology,
                    },
                )
    return payload


@router.get("/calls")
def call_history(
    limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("calls:use")
    mine = select(CallParticipant.call_id).where(CallParticipant.user_id == access.p.id)
    rows = db.execute(select(Call).where(Call.id.in_(mine)).order_by(Call.created_at.desc()).limit(limit)).scalars()
    return [_call_out(db, c) for c in rows]


@router.get("/calls/{call_id}")
def get_call(call_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("calls:use")
    return _call_out(db, _call(db, access, call_id))


class JoinIn(BaseModel):
    video: bool = False


def _broadcast(call: Call, event: str, data: dict[str, Any]) -> None:
    for p in call.participants:
        publish_user(p.user_id, event, {"call_id": call.id, **data})


@router.post("/calls/{call_id}/join")
def join(
    call_id: uuid.UUID, data: JoinIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("calls:use")
    call = service.join_call(db, _call(db, access, call_id), access.p.user, video=data.video)
    db.commit()
    _broadcast(
        call, "call.participant_joined", {"user_id": access.p.id, "name": access.p.user.full_name, "video": data.video}
    )
    return _call_out(db, call)


@router.post("/calls/{call_id}/decline")
def decline(call_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("calls:use")
    call = service.decline_call(db, _call(db, access, call_id), access.p.user)
    db.commit()
    _broadcast(call, "call.declined", {"user_id": access.p.id, "status": call.status})
    return _call_out(db, call)


@router.post("/calls/{call_id}/leave")
def leave(call_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("calls:use")
    call = service.leave_call(db, _call(db, access, call_id), access.p.user)
    db.commit()
    _broadcast(call, "call.participant_left", {"user_id": access.p.id, "status": call.status})
    return _call_out(db, call)


@router.post("/calls/{call_id}/end")
def end(call_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("calls:use")
    call = _call(db, access, call_id)
    if call.initiator_id != access.p.id:
        raise Forbidden("Seul l'organisateur peut terminer l'appel pour tous")
    service.end_call(db, call)
    db.commit()
    _broadcast(call, "call.ended", {"status": call.status, "duration_seconds": call.duration_seconds})
    return _call_out(db, call)


class ScreenIn(BaseModel):
    active: bool


@router.post("/calls/{call_id}/screen-share")
def screen_share(
    call_id: uuid.UUID, data: ScreenIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("calls:use")
    call = service.set_screen_share(_call(db, access, call_id), access.p.user, data.active)
    db.commit()
    _broadcast(call, "call.screen_share", {"user_id": access.p.id, "active": data.active})
    return _call_out(db, call)


class ConsentIn(BaseModel):
    consent: bool


@router.post("/calls/{call_id}/recording/consent")
def recording_consent(
    call_id: uuid.UUID, data: ConsentIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("calls:use")
    call = _call(db, access, call_id)
    call.recording_requested = True
    service.consent_recording(db, call, access.p.user, consent=data.consent)
    db.commit()
    _broadcast(
        call,
        "call.recording_consent",
        {"user_id": access.p.id, "consent": data.consent, "recording_allowed": service.recording_allowed(call)},
    )
    return _call_out(db, call)


@router.post("/calls/{call_id}/recording", status_code=201)
async def upload_recording(
    call_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("calls:record")
    call = _call(db, access, call_id)
    if not service.recording_allowed(call):
        raise BusinessRuleError(
            "Enregistrement refusé : consentement de tous les participants requis", code="RECORDING_CONSENT_REQUIRED"
        )
    upload = validate_upload(file.filename or "enregistrement.webm", await file.read(), category="any", max_mb=2048)
    stored = store_private(
        db, upload, purpose="call_recordings", classification="confidential", uploaded_by_id=access.p.id
    )
    call.recording_file_id = stored.id
    call.recording_retention_until = utcnow() + timedelta(days=service.RECORDING_RETENTION_DAYS)
    audit.record(
        db,
        family="security",
        module="calls",
        action="RECORDING_STORED",
        resource_type="call",
        resource_id=call.id,
        diff={"consents": list(call.recording_consents.keys())},
        criticality="MEDIUM",
    )
    db.commit()
    return _call_out(db, call)


@router.get("/calls/{call_id}/recording")
def download_recording(
    call_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("calls:use")
    call = _call(db, access, call_id)
    if not call.recording_file_id:
        raise NotFound("Aucun enregistrement")
    audit.record(
        db, family="security", module="calls", action="RECORDING_ACCESS", resource_type="call", resource_id=call.id
    )
    db.commit()
    return file_response(db.get(StoredFile, call.recording_file_id))
