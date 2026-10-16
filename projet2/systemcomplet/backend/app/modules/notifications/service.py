"""Moteur de notifications : règles → audience → canaux (in-app, push, e-mail, WhatsApp, SMS) selon
préférences ; envoi asynchrone par le worker (outbox) avec traces de livraison (V4-NOTIF-39)."""

from __future__ import annotations

import logging
import uuid
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import metrics
from app.core.config import settings
from app.core.events import emit
from app.core.utils import utcnow
from app.modules.identity.models import Role, User, UserRole
from app.modules.notifications.defaults import DEFAULT_RULES, default_templates
from app.modules.notifications.models import (
    CHANNELS,
    Notification,
    NotificationDelivery,
    NotificationPreference,
    NotificationRule,
    NotificationTemplate,
    PushSubscription,
)
from app.modules.system.models import OutboxEvent

log = logging.getLogger("globus.notifications")
TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "templates"
MANDATORY_CATEGORIES = {"security", "system"}


# ---------------------------------------------------------------------------- rendu
def _fmt_money(value: Any, currency: str = "XAF") -> str:
    try:
        amount = Decimal(str(value or 0))
    except Exception:  # noqa: BLE001
        return str(value)
    text = f"{amount:,.0f}".replace(",", " ") if currency in ("XAF", "XOF") else f"{amount:,.2f}".replace(",", " ")
    return f"{text} {'FCFA' if currency in ('XAF', 'XOF') else currency}"


def _fmt_date(value: Any) -> str:
    if not value:
        return "—"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return value
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _fmt_datetime(value: Any) -> str:
    if not value:
        return "—"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return value
    if isinstance(value, datetime):
        try:
            from zoneinfo import ZoneInfo

            value = value.astimezone(ZoneInfo(settings.TIMEZONE))
        except Exception:  # noqa: BLE001
            pass
        return value.strftime("%d/%m/%Y %H:%M")
    return str(value)


_sandbox = SandboxedEnvironment(autoescape=False)
_sandbox_html = SandboxedEnvironment(autoescape=True)
for env in (_sandbox, _sandbox_html):
    env.filters.update(money=_fmt_money, d=_fmt_date, dt=_fmt_datetime)

_layout_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=select_autoescape(["html"]))
_layout_env.filters.update(money=_fmt_money, d=_fmt_date, dt=_fmt_datetime)


def render(source: str, context: dict[str, Any], *, html: bool = False) -> str:
    env = _sandbox_html if html else _sandbox
    try:
        return env.from_string(source).render(**context)
    except Exception as exc:  # noqa: BLE001
        log.warning("template_render_failed", extra={"error": str(exc)[:200]})
        return source


def render_email_layout(
    subject: str,
    inner_html: str,
    *,
    marketing: bool = False,
    unsubscribe_url: str | None = None,
    preheader: str | None = None,
) -> str:
    template = _layout_env.get_template("email/base.html")
    return template.render(
        subject=subject,
        content=inner_html,
        marketing=marketing,
        unsubscribe_url=unsubscribe_url,
        preheader=preheader,
        base_url=settings.PUBLIC_BASE_URL.rstrip("/"),
        year=utcnow().year,
    )


def absolute(link: str | None) -> str | None:
    if not link:
        return None
    if link.startswith("http://") or link.startswith("https://"):
        return link
    return settings.PUBLIC_BASE_URL.rstrip("/") + "/" + link.lstrip("/")


# ---------------------------------------------------------------------------- données système
def ensure_defaults(db: Session) -> None:
    existing = {(t.code, t.channel, t.locale) for t in db.execute(select(NotificationTemplate)).scalars()}
    for tpl in default_templates():
        key = (tpl["code"], tpl["channel"], "fr")
        if key not in existing:
            db.add(
                NotificationTemplate(
                    code=tpl["code"],
                    channel=tpl["channel"],
                    locale="fr",
                    subject=tpl["subject"],
                    body=tpl["body"],
                    is_system=True,
                )
            )
    rule_keys = {(r.event_type, r.name) for r in db.execute(select(NotificationRule)).scalars()}
    for index, rule in enumerate(DEFAULT_RULES):
        name = f"Règle système {rule['event']} #{index + 1}"
        if (rule["event"], name) in rule_keys:
            continue
        db.add(
            NotificationRule(
                event_type=rule["event"],
                name=name,
                audience=rule["audience"],
                channels=rule["channels"],
                template_code=rule["event"],
                category=rule.get("category", "general"),
                priority=rule.get("priority", "normal"),
                conditions={
                    **rule.get("conditions", {}),
                    **({"email_template": rule["email_template"]} if rule.get("email_template") else {}),
                },
                is_system=True,
            )
        )
    db.flush()


def get_template(db: Session, code: str, channel: str, locale: str = "fr") -> NotificationTemplate | None:
    return db.execute(
        select(NotificationTemplate).where(
            NotificationTemplate.code == code,
            NotificationTemplate.channel == channel,
            NotificationTemplate.locale == locale,
            NotificationTemplate.is_active.is_(True),
        )
    ).scalar_one_or_none()


# ---------------------------------------------------------------------------- préférences
def _disabled_channels(db: Session, user_id: uuid.UUID, category: str) -> set[str]:
    rows = (
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id,
                NotificationPreference.category.in_([category, "*"]),
                NotificationPreference.enabled.is_(False),
            )
        )
        .scalars()
        .all()
    )
    return {r.channel for r in rows}


def _recipient_for(user: User, channel: str) -> str | None:
    if channel == "email":
        return user.email
    if channel == "whatsapp":
        return user.whatsapp or None
    if channel == "sms":
        return user.phone or None
    if channel == "push":
        return str(user.id)
    return None


# ---------------------------------------------------------------------------- création
def notify_users(
    db: Session,
    user_ids: Iterable[uuid.UUID | str],
    *,
    category: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    priority: str = "normal",
    channels: Iterable[str] = ("in_app",),
    entity_type: str | None = None,
    entity_id: Any = None,
    project_id: uuid.UUID | None = None,
    event_type: str | None = None,
    data: dict[str, Any] | None = None,
    email_template: str | None = None,
    template_context: dict[str, Any] | None = None,
) -> list[Notification]:
    """Crée les notifications in-app et met en file les envois externes (traités par le worker)."""
    channels = [c for c in channels if c in CHANNELS]
    created: list[Notification] = []
    delivery_ids: list[str] = []
    unique_ids = []
    for uid in user_ids:
        try:
            u = uuid.UUID(str(uid))
        except ValueError:
            continue
        if u not in unique_ids:
            unique_ids.append(u)
    for uid in unique_ids:
        user = db.get(User, uid)
        if user is None or not user.is_active or user.deleted_at is not None:
            continue
        disabled = (
            set()
            if (priority == "critical" or category in MANDATORY_CATEGORIES)
            else _disabled_channels(db, uid, category)
        )
        notification: Notification | None = None
        if "in_app" in channels and "in_app" not in disabled:
            notification = Notification(
                id=uuid.uuid4(),
                user_id=uid,
                category=category,
                event_type=event_type,
                title=title[:250],
                body=body,
                link=link,
                priority=priority,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id else None,
                project_id=project_id,
                data=data or {},
            )
            db.add(notification)
            created.append(notification)
        for channel in channels:
            if channel == "in_app" or channel in disabled:
                continue
            recipient = _recipient_for(user, channel)
            if not recipient:
                continue
            if (
                channel == "push"
                and not db.execute(select(PushSubscription.id).where(PushSubscription.user_id == uid).limit(1)).first()
            ):
                continue
            delivery = NotificationDelivery(
                id=uuid.uuid4(),
                notification_id=notification.id if notification else None,
                user_id=uid,
                recipient=recipient,
                channel=channel,
                status="queued",
                provider=(email_template or event_type or "generic.notification") if channel == "email" else None,
            )
            db.add(delivery)
            delivery_ids.append(str(delivery.id))
    db.flush()
    if created or delivery_ids:
        emit(
            db,
            "notification.dispatch",
            {
                "notification_ids": [str(n.id) for n in created],
                "delivery_ids": delivery_ids,
                "title": title,
                "body": body,
                "link": link,
                "priority": priority,
                "category": category,
                "email_template": email_template,
                "context": template_context or {},
            },
        )
    return created


def queue_external(
    db: Session,
    *,
    channel: str,
    recipient: str,
    template_code: str,
    context: dict[str, Any],
    attachments_file_ids: list[str] | None = None,
) -> NotificationDelivery:
    """Envoi à un destinataire sans compte (prospect, contact fournisseur…)."""
    delivery = NotificationDelivery(
        id=uuid.uuid4(), recipient=recipient, channel=channel, status="queued", provider=template_code
    )
    db.add(delivery)
    db.flush()
    emit(
        db,
        "notification.dispatch",
        {
            "notification_ids": [],
            "delivery_ids": [str(delivery.id)],
            "email_template": template_code,
            "context": context,
            "attachments": attachments_file_ids or [],
            "external": True,
        },
    )
    return delivery


# ---------------------------------------------------------------------------- moteur de règles
def _audience(db: Session, rule: NotificationRule, event: OutboxEvent) -> set[uuid.UUID]:
    from app.modules.projects.models import Project, ProjectMember

    aud = rule.audience or {}
    payload = event.payload or {}
    out: set[uuid.UUID] = set()
    for key in aud.get("payload_users", []):
        value = payload.get(key)
        values = value if isinstance(value, list) else [value]
        for v in values:
            try:
                if v:
                    out.add(uuid.UUID(str(v)))
            except ValueError:
                continue
    roles = aud.get("roles") or []
    if roles:
        rows = (
            db.execute(select(UserRole.user_id).join(Role, Role.id == UserRole.role_id).where(Role.code.in_(roles)))
            .scalars()
            .all()
        )
        candidates = set(rows)
        if event.project_id and aud.get("project_scoped", False):
            members = set(
                db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == event.project_id))
                .scalars()
                .all()
            )
            global_users = set(
                db.execute(
                    select(UserRole.user_id).join(Role, Role.id == UserRole.role_id).where(Role.global_scope.is_(True))
                )
                .scalars()
                .all()
            )
            candidates &= members | global_users
        out |= candidates
    if aud.get("permission"):
        from app.modules.identity.models import RolePermission

        rows = (
            db.execute(
                select(UserRole.user_id)
                .join(RolePermission, RolePermission.role_id == UserRole.role_id)
                .where(RolePermission.permission_code == aud["permission"])
            )
            .scalars()
            .all()
        )
        out |= set(rows)
    if event.project_id and (aud.get("project_roles") or aud.get("project_members")):
        stmt = select(ProjectMember.user_id).where(ProjectMember.project_id == event.project_id)
        if aud.get("project_roles"):
            stmt = stmt.where(ProjectMember.project_role.in_(aud["project_roles"]))
        else:
            stmt = stmt.where(ProjectMember.project_role != "client")
        out |= set(db.execute(stmt).scalars().all())
    if aud.get("client") and event.project_id:
        out |= set(
            db.execute(
                select(ProjectMember.user_id).where(
                    ProjectMember.project_id == event.project_id, ProjectMember.project_role == "client"
                )
            )
            .scalars()
            .all()
        )
        project = db.get(Project, event.project_id)
        if project and project.client_organization_id:
            out |= set(
                db.execute(
                    select(User.id).where(
                        User.organization_id == project.client_organization_id, User.is_active.is_(True)
                    )
                )
                .scalars()
                .all()
            )
    if not aud.get("include_actor") and event.actor_id:
        out.discard(event.actor_id)
    return out


def _conditions_ok(rule: NotificationRule, payload: dict[str, Any]) -> bool:
    for key, allowed in (rule.conditions or {}).items():
        if key == "email_template":
            continue
        if payload.get(key) not in (allowed if isinstance(allowed, list) else [allowed]):
            return False
    return True


def handle_event(db: Session, event: OutboxEvent) -> int:
    rules = (
        db.execute(
            select(NotificationRule).where(
                NotificationRule.event_type == event.event_type, NotificationRule.is_active.is_(True)
            )
        )
        .scalars()
        .all()
    )
    count = 0
    for rule in rules:
        payload = dict(event.payload or {})
        if not _conditions_ok(rule, payload):
            continue
        users = _audience(db, rule, event)
        if not users:
            continue
        tpl = get_template(db, rule.template_code, "in_app")
        context = {**payload, "base_url": settings.PUBLIC_BASE_URL}
        if tpl:
            title = render(tpl.subject or rule.name, context)
            body_src, _, link_src = tpl.body.partition("\n---\n")
            body = render(body_src, context)
            link = render(link_src, context).strip() or payload.get("link")
        else:
            title, body, link = payload.get("title", rule.name), payload.get("body"), payload.get("link")
        email_template = (rule.conditions or {}).get("email_template")
        notify_users(
            db,
            users,
            category=rule.category,
            title=title,
            body=body,
            link=link,
            priority=rule.priority,
            channels=rule.channels or ["in_app"],
            entity_type=event.aggregate_type,
            entity_id=event.aggregate_id,
            project_id=event.project_id,
            event_type=event.event_type,
            data={k: v for k, v in payload.items() if k in ("id", "number", "project_id", "status")},
            email_template=email_template,
            template_context=context,
        )
        count += len(users)
    return count


# ---------------------------------------------------------------------------- envoi (worker)
def dispatch(db: Session, payload: dict[str, Any]) -> None:
    """Pousse les notifications in-app en temps réel et envoie les livraisons externes."""
    from app.websocket.hub import publish_user

    for nid in payload.get("notification_ids", []):
        notification = db.get(Notification, uuid.UUID(nid))
        if notification:
            publish_user(
                notification.user_id,
                "notification",
                {
                    "id": notification.id,
                    "title": notification.title,
                    "body": notification.body,
                    "link": notification.link,
                    "priority": notification.priority,
                    "category": notification.category,
                    "created_at": notification.created_at,
                },
            )
    errors: list[str] = []
    for did in payload.get("delivery_ids", []):
        delivery = db.get(NotificationDelivery, uuid.UUID(did))
        if delivery is None or delivery.status in ("sent", "delivered", "read", "skipped"):
            continue
        try:
            send_delivery(db, delivery, payload)
        except Exception as exc:  # noqa: BLE001
            from app.providers.base import ProviderError

            delivery.attempts += 1
            delivery.error = str(exc)[:500]
            retryable = getattr(exc, "retryable", True) if isinstance(exc, ProviderError) else True
            delivery.status = "failed" if (not retryable or delivery.attempts >= 5) else "queued"
            metrics.notification_deliveries.labels(delivery.channel, "failed").inc()
            if delivery.status == "queued":
                errors.append(did)
    db.flush()
    if errors:
        raise RuntimeError(f"{len(errors)} envoi(s) à réessayer")


def send_delivery(db: Session, delivery: NotificationDelivery, payload: dict[str, Any]) -> None:
    from app.providers.email import EmailMessage, get_email_provider
    from app.providers.messaging import get_sms_provider, get_whatsapp_provider
    from app.providers.push import PushPayload, SubscriptionGone, send_fcm, send_webpush

    notification = db.get(Notification, delivery.notification_id) if delivery.notification_id else None
    context = dict(payload.get("context") or {})
    title = notification.title if notification else payload.get("title") or context.get("title") or "GLOBUS ENGINEERING"
    body = notification.body if notification else payload.get("body") or context.get("body") or ""
    link = absolute(notification.link if notification else (payload.get("link") or context.get("link")))
    user = db.get(User, delivery.user_id) if delivery.user_id else None
    if user:
        context.setdefault("first_name", user.first_name)
    context.setdefault("title", title)
    context.setdefault("body", body)
    context["link"] = absolute(context.get("link")) or link

    if delivery.channel == "email":
        code = payload.get("email_template") or delivery.provider or "generic.notification"
        tpl = get_template(db, code, "email") or get_template(db, "generic.notification", "email")
        subject = render(tpl.subject or title, context) if tpl else title
        inner = render(tpl.body, context, html=True) if tpl else f"<p>{body}</p>"
        attachments: list[tuple[str, bytes, str]] = []
        for fid in payload.get("attachments", []) or []:
            from app.core.files import read_private
            from app.modules.system.models import StoredFile

            stored = db.get(StoredFile, uuid.UUID(fid))
            if stored:
                attachments.append((stored.original_name, read_private(stored), stored.mime_type))
        result = get_email_provider().send(
            EmailMessage(
                to=[delivery.recipient or ""],
                subject=subject,
                html=render_email_layout(subject, inner),
                text=f"{title}\n\n{body}\n\n{context.get('link') or ''}",
                attachments=attachments,
                metadata={"delivery_id": str(delivery.id)},
            )
        )
    elif delivery.channel == "whatsapp":
        tpl = get_template(db, payload.get("email_template") or "", "whatsapp")
        text = render(tpl.body, context) if tpl else f"*{title}*\n{body}"
        if context.get("link"):
            text += f"\n{context['link']}"
        result = get_whatsapp_provider().send_text(delivery.recipient or "", text)
    elif delivery.channel == "sms":
        result = get_sms_provider().send(delivery.recipient or "", f"GLOBUS : {title}. {body}"[:600])
    elif delivery.channel == "push":
        subs = db.execute(select(PushSubscription).where(PushSubscription.user_id == delivery.user_id)).scalars().all()
        push = PushPayload(
            title=title,
            body=(body or "")[:240],
            url=link,
            tag=payload.get("category"),
            priority="high" if payload.get("priority") in ("high", "critical") else "normal",
            data={"notification_id": str(delivery.notification_id or "")},
        )
        sent = 0
        result = None
        for sub in subs:
            try:
                if sub.kind == "fcm":
                    result = send_fcm(sub.endpoint, push)
                else:
                    result = send_webpush(sub.endpoint, sub.p256dh or "", sub.auth or "", push)
                sub.last_success_at = utcnow()
                sub.failure_count = 0
                sent += 1
            except SubscriptionGone:
                db.delete(sub)
            except Exception:  # noqa: BLE001
                sub.failure_count += 1
        if not sent:
            delivery.status = "skipped"
            delivery.error = "Aucun abonnement push actif"
            return
    else:
        delivery.status = "skipped"
        return
    delivery.status = "sent"
    delivery.sent_at = utcnow()
    delivery.attempts += 1
    delivery.provider = getattr(result, "provider", delivery.provider)
    delivery.provider_message_id = getattr(result, "message_id", None)
    metrics.notification_deliveries.labels(delivery.channel, "sent").inc()


def mark_read(db: Session, user_id: uuid.UUID, ids: list[uuid.UUID] | None = None) -> int:
    stmt = select(Notification).where(Notification.user_id == user_id, Notification.read_at.is_(None))
    if ids:
        stmt = stmt.where(Notification.id.in_(ids))
    rows = db.execute(stmt).scalars().all()
    now = utcnow()
    for row in rows:
        row.read_at = now
    db.flush()
    return len(rows)
