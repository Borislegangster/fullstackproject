"""Assistant WhatsApp bidirectionnel (innovation A1) — même moteur que le widget de la vitrine.

• Numéro reconnu (client) : avancement du chantier, indice de confiance, montant à régler avec lien de paiement,
  dernier reçu (document), demande de rendez-vous, passage à son chef de projet.
• Numéro inconnu (prospect) : réponses sourcées dans le CMS (Claude si configuré, sinon règles) ; le rappel par un
  conseiller n'est créé qu'après un « OUI » explicite (consentement tracé) → lead « whatsapp ».
• Un conseiller peut reprendre la main depuis l'ERP : l'assistant se tait pendant la reprise.

Le traitement est asynchrone (événement outbox) : le webhook Meta répond immédiatement, la réponse part du worker.
Les numéros sont chiffrés au repos ; la recherche se fait par empreinte.
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.events import emit
from app.core.utils import clean_phone, utcnow
from app.modules.assistant.models import AssistantConversation
from app.modules.assistant.service import _ai_reply, _norm, _rules_reply, intent_of, knowledge

log = logging.getLogger("globus.assistant.whatsapp")

SESSION_HOURS = 24  # fenêtre de service client WhatsApp
MAX_PER_HOUR = 30
HUMAN_TAKEOVER_HOURS = 12
YES = ("oui", "ok", "d'accord", "dacord", "daccord", "yes", "volontiers", "ouais", "oui svp", "oui merci")

CLIENT_MENU = (
    "Que souhaitez-vous ?\n"
    "1️⃣ Avancement de mon chantier\n"
    "2️⃣ Montant à régler (lien de paiement)\n"
    "3️⃣ Mon dernier reçu\n"
    "4️⃣ Prendre rendez-vous\n"
    "5️⃣ Parler à mon chef de projet\n"
    "Répondez par le chiffre ou en quelques mots."
)

_CLIENT_INTENTS: list[tuple[str, tuple[str, ...]]] = [
    ("menu", ("menu", "aide", "help", "bonjour", "bonsoir", "salut", "hello", "0")),
    ("progress", ("1", "avancement", "chantier", "progression", "ou en est", "ou en sommes", "etat")),
    ("pay", ("2", "payer", "paiement", "solde", "reste", "montant", "facture", "appel de fonds", "regler", "doit")),
    ("receipt", ("3", "recu", "quittance", "justificatif")),
    ("meeting", ("4", "rendez-vous", "rendez vous", "rdv", "visite", "rencontrer", "rencontre")),
    ("human", ("5", "conseiller", "chef de projet", "humain", "parler", "appeler", "rappel", "rappeler")),
    ("projects", ("projets", "mes projets", "changer de projet")),
]


def contact_hash(phone: str) -> str:
    return hashlib.sha256(("wa:" + phone).encode()).hexdigest()


def _absolute(path: str) -> str:
    return path if path.startswith("http") else settings.PUBLIC_BASE_URL.rstrip("/") + "/" + path.lstrip("/")


def _mask(phone: str | None) -> str | None:
    return f"{phone[:4]}•••{phone[-3:]}" if phone and len(phone) > 7 else phone


# ---------------------------------------------------------------------------- identification
def find_client(db: Session, phone: str) -> Any:
    """Utilisateur actif du portail client dont le WhatsApp (ou le téléphone) correspond au numéro."""
    from app.modules.identity.models import User

    last9 = re.sub(r"\D", "", phone)[-9:]
    if len(last9) < 9:
        return None
    candidates = db.execute(
        select(User).where(
            User.is_active.is_(True),
            User.deleted_at.is_(None),
            or_(User.whatsapp.ilike(f"%{last9}"), User.phone.ilike(f"%{last9}")),
        )
    ).scalars()
    for user in candidates:
        if phone in (clean_phone(user.whatsapp), clean_phone(user.phone)) and "client:portal" in _permissions(db, user):
            return user
    return None


def _permissions(db: Session, user: Any) -> set[str]:
    from app.modules.identity.service import permissions_of

    return permissions_of(user)


def client_projects(db: Session, user: Any) -> list[Any]:
    from app.modules.identity.models import Organization
    from app.modules.projects.models import Project, ProjectMember

    ids = set(
        db.execute(
            select(ProjectMember.project_id).where(
                ProjectMember.user_id == user.id, ProjectMember.project_role == "client"
            )
        ).scalars()
    )
    org = db.get(Organization, user.organization_id) if user.organization_id else None
    if org is not None and org.kind == "client":
        ids |= set(
            db.execute(
                select(Project.id).where(Project.client_organization_id == org.id, Project.deleted_at.is_(None))
            ).scalars()
        )
    if not ids:
        return []
    return list(
        db.execute(
            select(Project)
            .where(Project.id.in_(ids), Project.deleted_at.is_(None), Project.client_visible.is_(True))
            .order_by(Project.created_at.desc())
        ).scalars()
    )


# ---------------------------------------------------------------------------- conversation
def _conversation(db: Session, phone: str, name: str | None) -> AssistantConversation:
    digest = contact_hash(phone)
    conversation = (
        db.execute(
            select(AssistantConversation)
            .where(
                AssistantConversation.channel == "whatsapp",
                AssistantConversation.contact_hash == digest,
                AssistantConversation.status != "closed",
            )
            .order_by(AssistantConversation.last_message_at.desc().nulls_last())
        )
        .scalars()
        .first()
    )
    if conversation is None:
        conversation = AssistantConversation(
            channel="whatsapp", messages=[], contact_hash=digest, contact_phone=phone, contact_name=name, state={}
        )
        db.add(conversation)
        db.flush()
    elif name and not conversation.contact_name:
        conversation.contact_name = name
    return conversation


def _append(conversation: AssistantConversation, role: str, content: str, **extra: Any) -> None:
    conversation.messages = [
        *conversation.messages[-199:],
        {"role": role, "content": content[:4000], "at": utcnow().isoformat(), **extra},
    ]
    conversation.last_message_at = utcnow()


def _recent_user_messages(conversation: AssistantConversation) -> int:
    since = (utcnow() - timedelta(hours=1)).isoformat()
    return sum(1 for m in conversation.messages if m.get("role") == "user" and m.get("at", "") >= since)


def send(db: Session, conversation: AssistantConversation, text: str, *, role: str = "assistant", **extra: Any) -> None:
    from app.providers.base import ProviderError
    from app.providers.messaging import get_whatsapp_provider

    _append(conversation, role, text, **extra)
    try:
        get_whatsapp_provider().send_text(conversation.contact_phone or "", text)
    except ProviderError as exc:
        log.warning("whatsapp_reply_failed", extra={"conversation": str(conversation.id), "error": str(exc)[:200]})
        conversation.messages = [*conversation.messages[:-1], {**conversation.messages[-1], "failed": True}]


# ---------------------------------------------------------------------------- client
def _client_intent(text: str) -> str:
    norm = _norm(text).strip()
    if re.fullmatch(r"p\d{1,2}", norm):
        return "choose_project"
    for intent, words in _CLIENT_INTENTS:
        for w in words:
            if (w.isdigit() and norm == w) or (not w.isdigit() and w in norm):
                return intent
    return "other"


def _current_project(conversation: AssistantConversation, projects: list[Any]) -> Any:
    wanted = (conversation.state or {}).get("project_id")
    return next((p for p in projects if str(p.id) == wanted), projects[0] if projects else None)


def _progress_text(db: Session, project: Any) -> str:
    from app.modules.projects.models import Milestone
    from app.modules.projects.trust import compute_trust

    upcoming = (
        db.execute(
            select(Milestone)
            .where(
                Milestone.project_id == project.id,
                Milestone.client_visible.is_(True),
                Milestone.status.in_(["planned", "late"]),
            )
            .order_by(Milestone.due_date)
        )
        .scalars()
        .first()
    )
    trust = compute_trust(db, project)
    lines = [f"🏗️ *{project.name}*", f"Avancement global : *{Decimal(project.progress_pct or 0):.0f} %*"]
    if upcoming is not None:
        lines.append(f"Prochaine étape : {upcoming.name} (prévue le {upcoming.due_date:%d/%m/%Y})")
    if trust["score"] is not None:
        lines.append(f"Indice de confiance : {trust['score']:.0f}/100 ({trust['level']})")
    lines.append(f"Photos, documents et planning : {_absolute('/espace-client/dashboard')}")
    return "\n".join(lines)


def _dues(db: Session, project: Any) -> list[tuple[str, Any, Decimal]]:
    from app.modules.billing.models import ClientInvoice
    from app.modules.finance.models import FundsCall
    from app.modules.finance.payments import outstanding

    rows: list[tuple[str, Any, Decimal]] = []
    calls = db.execute(
        select(FundsCall).where(
            FundsCall.project_id == project.id, FundsCall.status.in_(["issued", "partially_paid", "overdue"])
        )
    ).scalars()
    linked = set()
    for call in calls:
        rows.append(("funds_call", call, outstanding(call)))
        if call.client_invoice_id:
            linked.add(call.client_invoice_id)
    invoices = db.execute(
        select(ClientInvoice).where(
            ClientInvoice.project_id == project.id,
            ClientInvoice.status.in_(["sent", "partially_paid", "overdue"]),
            ClientInvoice.deleted_at.is_(None),
        )
    ).scalars()
    rows += [("client_invoice", i, outstanding(i)) for i in invoices if i.id not in linked]
    return [r for r in rows if r[2] > 0]


def _pay_text(db: Session, project: Any) -> str:
    from app.core.pdf import fmt_money
    from app.modules.billing.collections import create_pay_link

    dues = _dues(db, project)
    if not dues:
        return f"✅ Rien à régler pour le moment sur *{project.name}*. Merci !"
    lines = [f"💳 *{project.name}* — montants à régler :"]
    for kind, obj, amount in dues[:5]:
        _, url = create_pay_link(db, target_type=kind, target_id=obj.id, channel="whatsapp")
        label = getattr(obj, "label", None) or getattr(obj, "title", None) or obj.number
        due = f", échéance {obj.due_date:%d/%m/%Y}" if getattr(obj, "due_date", None) else ""
        lines.append(f"• {obj.number} — {label} : *{fmt_money(amount, obj.currency)}*{due}\n  Payer : {url}")
    lines.append("Paiement sécurisé MTN MoMo, Orange Money ou carte. Reçu immédiat.")
    return "\n".join(lines)


def _receipt(db: Session, conversation: AssistantConversation, project: Any) -> str | None:
    """Envoie le dernier reçu en document (lien signé temporaire) ; renvoie le texte d'accompagnement."""
    from app.core.downloads import signed_url
    from app.modules.finance.models import Payment
    from app.providers.base import ProviderError
    from app.providers.messaging import get_whatsapp_provider

    payment = (
        db.execute(
            select(Payment)
            .where(
                Payment.project_id == project.id,
                Payment.direction == "in",
                Payment.status == "succeeded",
                Payment.receipt_file_id.is_not(None),
            )
            .order_by(Payment.paid_at.desc())
        )
        .scalars()
        .first()
    )
    if payment is None:
        return "Aucun reçu disponible pour l'instant sur ce projet."
    link = _absolute(signed_url(payment.receipt_file_id, user_id=conversation.user_id, ttl=3600))
    try:
        get_whatsapp_provider().send_document(
            conversation.contact_phone or "", link, f"recu-{payment.number}.pdf", caption=f"Reçu {payment.number}"
        )
    except ProviderError as exc:
        log.warning("whatsapp_receipt_failed", extra={"error": str(exc)[:200]})
        return "Le reçu n'a pas pu être envoyé : il reste disponible dans votre espace client, rubrique Finances."
    _append(conversation, "assistant", f"[document] Reçu {payment.number}")
    return f"📄 Voici votre dernier reçu ({payment.number}, payé le {payment.paid_at:%d/%m/%Y})."


def _handoff(db: Session, conversation: AssistantConversation, *, reason: str, project: Any, excerpt: str) -> None:
    conversation.status = "handoff"
    emit(
        db,
        "assistant.handoff",
        {
            "conversation_id": conversation.id,
            "reason": reason,
            "name": conversation.contact_name or "Contact WhatsApp",
            "phone": _mask(conversation.contact_phone),
            "project_name": project.name if project else None,
            "manager_id": getattr(project, "manager_id", None),
            "excerpt": excerpt[:200],
            "link": f"/erp/assistant?conversation={conversation.id}",
        },
        aggregate_type="assistant_conversation",
        aggregate_id=conversation.id,
        project_id=project.id if project else None,
    )


def client_reply(db: Session, conversation: AssistantConversation, user: Any, text: str) -> str:
    projects = client_projects(db, user)
    if not projects:
        return (
            f"Bonjour {user.first_name} ! Votre espace projet n'est pas encore ouvert. "
            "Votre chargé d'affaires vous recontacte très vite."
        )
    intent = _client_intent(text)
    if intent == "choose_project":
        index = int(re.sub(r"\D", "", text)) - 1
        if 0 <= index < len(projects):
            conversation.state = {**(conversation.state or {}), "project_id": str(projects[index].id)}
            return f"Projet sélectionné : *{projects[index].name}*.\n\n{CLIENT_MENU}"
        intent = "projects"
    project = _current_project(conversation, projects)
    conversation.project_id = project.id
    chosen = "project_id" in (conversation.state or {})
    if intent == "projects" or (intent == "menu" and len(projects) > 1 and not chosen):
        listing = "\n".join(f"P{i + 1} — {p.name}" for i, p in enumerate(projects))
        return f"Bonjour {user.first_name} ! Vos projets :\n{listing}\nRépondez P1, P2… pour choisir."
    if intent == "menu":
        return f"Bonjour {user.first_name} 👋 Projet : *{project.name}*.\n\n{CLIENT_MENU}"
    if intent == "progress":
        return _progress_text(db, project)
    if intent == "pay":
        return _pay_text(db, project)
    if intent == "receipt":
        return _receipt(db, conversation, project) or CLIENT_MENU
    if intent in ("meeting", "human"):
        reason = "rendez-vous" if intent == "meeting" else "conseiller"
        _handoff(db, conversation, reason=reason, project=project, excerpt=text)
        return (
            "📅 C'est noté : votre chef de projet vous propose un créneau dans la journée (ouvrée)."
            if intent == "meeting"
            else "👷 C'est noté : votre chef de projet vous répond ici même, dans les meilleurs délais."
        )
    answer = _client_ai(db, conversation, project, text)
    return answer or f"Je n'ai pas bien compris. {CLIENT_MENU}"


def _client_ai(db: Session, conversation: AssistantConversation, project: Any, text: str) -> str | None:
    """Question libre d'un client : réponse IA limitée aux informations publiées de SON projet."""
    ctx = knowledge(db, text)
    ctx["client_project"] = {
        "name": project.name,
        "status": project.status,
        "progress_pct": str(project.progress_pct),
        "start_planned": str(project.start_planned) if project.start_planned else None,
        "end_planned": str(project.end_planned) if project.end_planned else None,
    }
    history = [
        {"role": "user" if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in conversation.messages
        if m.get("role") in ("user", "assistant")
    ]
    answer = _ai_reply(ctx, history[:-1], text)
    if answer is None:
        return None
    links = " ".join(_absolute(a["href"]) for a in answer.get("actions", []) if a.get("type") == "link")
    return (answer["reply"] + (f"\n{links}" if links else "") + "\n\nTapez *menu* pour les options.").strip()


# ---------------------------------------------------------------------------- prospect
def prospect_reply(db: Session, conversation: AssistantConversation, text: str) -> str:
    from app.modules.crm.service import create_lead

    norm = _norm(text).strip(" !.")
    state = dict(conversation.state or {})
    if state.get("awaiting") == "callback_consent":
        state.pop("awaiting", None)
        conversation.state = state
        if norm in YES or norm.startswith("oui"):
            transcript = "\n".join(
                f"{'Contact' if m['role'] == 'user' else 'Assistant'} : {m['content']}"
                for m in conversation.messages[-20:]
            )
            first, _, last = (conversation.contact_name or "Contact WhatsApp").partition(" ")
            lead = create_lead(
                db,
                data={
                    "first_name": first,
                    "last_name": last or None,
                    "phone": conversation.contact_phone,
                    "whatsapp": conversation.contact_phone,
                    "message": f"Demande de rappel via WhatsApp\n\n— Conversation —\n{transcript}"[:4000],
                    "preferred_channel": "whatsapp",
                },
                source="whatsapp",
                form_key="assistant_whatsapp",
                consents={"contact": True, "whatsapp": True},
                ip=None,
                user_agent="whatsapp",
            )
            conversation.lead_id = lead.id
            conversation.status = "lead"
            return (
                f"Merci ! Votre demande est enregistrée (réf. {lead.number}) : "
                "un conseiller vous recontacte ici très vite."
            )
        # pas de « oui » : on traite le message comme une nouvelle question
    intent = intent_of(text)
    ctx = knowledge(db, text)
    history = [
        {"role": "user" if m["role"] == "user" else "assistant", "content": m["content"]}
        for m in conversation.messages
        if m.get("role") in ("user", "assistant")
    ]
    answer = _ai_reply(ctx, history[:-1], text)
    conversation.mode = "ai" if answer else "rules"
    if answer is None:
        answer = _rules_reply(intent, ctx)
    reply = answer["reply"]
    links = [f"{a['label']} : {_absolute(a['href'])}" for a in answer.get("actions", []) if a.get("type") == "link"]
    links = [link for link in links if "wa.me" not in link]  # déjà sur WhatsApp
    if links:
        reply += "\n" + "\n".join(links)
    wants_callback = any(a.get("type") == "lead_form" for a in answer.get("actions", [])) or intent == "human"
    if wants_callback and conversation.lead_id is None:
        conversation.state = {**state, "awaiting": "callback_consent"}
        reply += "\n\nSouhaitez-vous qu'un conseiller vous recontacte sur ce numéro ? Répondez *OUI*."
    return reply


# ---------------------------------------------------------------------------- point d'entrée
def handle_inbound(db: Session, event: dict[str, Any]) -> AssistantConversation | None:
    phone = clean_phone("+" + str(event.get("from") or "").lstrip("+"))
    if not phone:
        return None
    conversation = _conversation(db, phone, event.get("name"))
    text = (event.get("body") or "").strip()
    if conversation.status == "lead" and conversation.lead_id is None:
        conversation.status = "open"
    if _recent_user_messages(conversation) >= MAX_PER_HOUR:
        _append(conversation, "user", text or f"[{event.get('type')}]", ignored=True)
        return conversation  # anti-abus : plus de réponse automatique pendant l'heure
    _append(conversation, "user", text or f"[{event.get('type') or 'média'}]")
    if conversation.human_until and conversation.human_until > utcnow():
        emit(
            db,
            "assistant.message",
            {
                "conversation_id": conversation.id,
                "name": conversation.contact_name or "Contact WhatsApp",
                "excerpt": (text or "[média]")[:200],
                "handled_by_id": conversation.handled_by_id,
                "link": f"/erp/assistant?conversation={conversation.id}",
            },
            aggregate_type="assistant_conversation",
            aggregate_id=conversation.id,
        )
        return conversation
    if not text:
        send(db, conversation, "Je ne lis que les messages écrits. Tapez *menu* ou posez votre question.")
        return conversation
    user = find_client(db, phone)
    if user is not None:
        conversation.user_id = user.id
        conversation.mode = "client"
        reply = client_reply(db, conversation, user, text)
    else:
        reply = prospect_reply(db, conversation, text)
    send(db, conversation, reply)
    return conversation


def agent_reply(db: Session, conversation: AssistantConversation, *, user: Any, text: str) -> None:
    """Réponse d'un conseiller depuis l'ERP (dans la fenêtre de 24 h) : l'assistant se met en retrait."""
    from app.core.errors import BusinessRuleError

    if conversation.channel != "whatsapp":
        raise BusinessRuleError("Réponse directe disponible pour les conversations WhatsApp uniquement")
    last_user = max((m.get("at", "") for m in conversation.messages if m.get("role") == "user"), default="")
    if not last_user or last_user < (utcnow() - timedelta(hours=SESSION_HOURS)).isoformat():
        raise BusinessRuleError(
            "Fenêtre de 24 h expirée : le contact doit d'abord vous réécrire (règle WhatsApp Business)",
            code="WHATSAPP_WINDOW_CLOSED",
        )
    conversation.human_until = utcnow() + timedelta(hours=HUMAN_TAKEOVER_HOURS)
    conversation.handled_by_id = user.id
    conversation.mode = "human"
    send(db, conversation, text.strip()[:4000], role="agent", by=user.full_name)


def conversation_out(conversation: AssistantConversation, *, full: bool, reveal_phone: bool = False) -> dict[str, Any]:
    from app.core.utils import jsonable

    last = next((m for m in reversed(conversation.messages) if m.get("role") in ("user", "assistant", "agent")), None)
    data: dict[str, Any] = {
        "id": conversation.id,
        "channel": conversation.channel,
        "contact_name": conversation.contact_name,
        "contact_phone": (conversation.contact_phone if reveal_phone else _mask(conversation.contact_phone)),
        "user_id": conversation.user_id,
        "project_id": conversation.project_id,
        "lead_id": conversation.lead_id,
        "mode": conversation.mode,
        "status": conversation.status,
        "human_until": conversation.human_until,
        "last_message_at": conversation.last_message_at or conversation.updated_at,
        "last_message": (last or {}).get("content", "")[:160],
        "messages_count": len(conversation.messages),
        "page_path": conversation.page_path,
    }
    if full:
        data["messages"] = conversation.messages
    return jsonable(data)


__all__ = ["agent_reply", "client_reply", "conversation_out", "find_client", "handle_inbound", "prospect_reply"]
