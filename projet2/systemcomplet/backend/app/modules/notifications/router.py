"""API Notifications (V4-NOTIF-39) : centre de notifications, préférences par catégorie/canal, abonnements Web Push
(VAPID) et jetons mobiles (FCM), administration des modèles et règles (événement → audience → canaux)."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.config import settings
from app.core.crud import serialize
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable, utcnow
from app.modules.notifications import service
from app.modules.notifications.models import (
    CHANNELS,
    Notification,
    NotificationDelivery,
    NotificationPreference,
    NotificationRule,
    NotificationTemplate,
    PushSubscription,
)

router = APIRouter(tags=["Notifications"])
CATEGORIES = (
    "crm",
    "projects",
    "procurement",
    "deliveries",
    "finance",
    "subcontracting",
    "disputes",
    "documents",
    "bim",
    "decisions",
    "qhse",
    "support",
    "calls",
    "chat",
    "digest",
    "inventory",
    "equipment",
    "tranquillite",
    "security",
    "system",
    "general",
)


@router.get("/notifications")
def list_notifications(
    params: PageParams = Depends(),
    unread: bool = False,
    category: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    stmt = select(Notification).where(Notification.user_id == access.p.id)
    if unread:
        stmt = stmt.where(Notification.read_at.is_(None))
    if category:
        stmt = stmt.where(Notification.category == category)
    page = paginate(
        db, stmt, params, default_sort=Notification.created_at.desc(), transform=lambda n: jsonable(serialize(n))
    )
    page["unread_count"] = db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == access.p.id, Notification.read_at.is_(None))
    ).scalar_one()
    return page


@router.get("/notifications/unread-count")
def unread_count(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, int]:
    count = db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == access.p.id, Notification.read_at.is_(None))
    ).scalar_one()
    return {"unread": count}


class ReadIn(BaseModel):
    ids: list[uuid.UUID] | None = Field(default=None, max_length=500)


@router.post("/notifications/read")
def mark_read(data: ReadIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, int]:
    count = service.mark_read(db, access.p.id, data.ids)
    db.commit()
    return {"updated": count}


@router.get("/notifications/preferences")
def preferences(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    rows = db.execute(select(NotificationPreference).where(NotificationPreference.user_id == access.p.id)).scalars()
    disabled = {(r.category, r.channel) for r in rows if not r.enabled}
    return {
        "categories": list(CATEGORIES),
        "channels": list(CHANNELS),
        "matrix": {cat: {ch: (cat, ch) not in disabled for ch in CHANNELS} for cat in CATEGORIES},
        "mandatory": ["security"],
    }


class PreferenceIn(BaseModel):
    category: str
    channel: str
    enabled: bool


class PreferencesIn(BaseModel):
    items: list[PreferenceIn] = Field(min_length=1, max_length=500)


@router.put("/notifications/preferences")
def set_preferences(
    data: PreferencesIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    for item in data.items:
        if item.category not in CATEGORIES or item.channel not in CHANNELS:
            raise BusinessRuleError(f"Préférence inconnue : {item.category}/{item.channel}")
        if item.category == "security" and not item.enabled and item.channel == "in_app":
            raise BusinessRuleError("Les alertes de sécurité in-app ne peuvent pas être désactivées")
        row = db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == access.p.id,
                NotificationPreference.category == item.category,
                NotificationPreference.channel == item.channel,
            )
        ).scalar_one_or_none()
        if row is None:
            db.add(
                NotificationPreference(
                    user_id=access.p.id, category=item.category, channel=item.channel, enabled=item.enabled
                )
            )
        else:
            row.enabled = item.enabled
    db.commit()
    return preferences(db, access)


# ---------------------------------------------------------------------------- push
@router.get("/push/vapid-public-key")
def vapid_public_key() -> dict[str, str | None]:
    return {"public_key": settings.VAPID_PUBLIC_KEY}


class SubscriptionIn(BaseModel):
    kind: str = Field(default="webpush", pattern="^(webpush|fcm)$")
    endpoint: str = Field(min_length=10, max_length=4000)
    p256dh: str | None = Field(default=None, max_length=200)
    auth: str | None = Field(default=None, max_length=100)
    application: str | None = Field(default=None, max_length=40)
    device_name: str | None = Field(default=None, max_length=150)


@router.post("/push/subscriptions", status_code=201)
def subscribe(
    data: SubscriptionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if data.kind == "webpush" and (not data.endpoint.startswith("https://") or not data.p256dh or not data.auth):
        raise BusinessRuleError("Abonnement Web Push invalide (endpoint HTTPS, clés p256dh et auth requis)")
    row = db.execute(select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)).scalar_one_or_none()
    if row is None:
        row = PushSubscription(user_id=access.p.id, **data.model_dump())
        db.add(row)
    else:
        row.user_id = access.p.id
        row.p256dh, row.auth = data.p256dh, data.auth
        row.application, row.device_name = data.application, data.device_name
        row.failure_count = 0
    db.commit()
    return {"id": str(row.id), "kind": row.kind}


class UnsubscribeIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=4000)


@router.post("/push/unsubscribe")
def unsubscribe(
    data: UnsubscribeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    row = db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint, PushSubscription.user_id == access.p.id
        )
    ).scalar_one_or_none()
    if row is not None:
        db.delete(row)
        db.commit()
    return {"status": "ok"}


@router.post("/push/test")
def push_test(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Envoie une notification de test sur tous les canaux actifs de l'utilisateur (vérification du parcours)."""
    created = service.notify_users(
        db,
        [access.p.id],
        category="system",
        title="Notification de test",
        body="Vos notifications GLOBUS ENGINEERING fonctionnent.",
        link="/notifications",
        channels=("in_app", "push"),
        event_type="system.test",
    )
    db.commit()
    return {"notifications": len(created)}


# ---------------------------------------------------------------------------- administration
@router.get("/admin/notification-templates")
def list_templates(
    code: str | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("notifications:manage")
    stmt = select(NotificationTemplate)
    if code:
        stmt = stmt.where(NotificationTemplate.code == code)
    return [
        jsonable(serialize(t))
        for t in db.execute(stmt.order_by(NotificationTemplate.code, NotificationTemplate.channel)).scalars()
    ]


class TemplateIn(BaseModel):
    subject: str | None = Field(default=None, max_length=250)
    body: str = Field(min_length=1, max_length=50000)
    whatsapp_template: str | None = Field(default=None, max_length=120)
    is_active: bool = True


@router.put("/admin/notification-templates/{template_id}")
def update_template(
    template_id: uuid.UUID, data: TemplateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("notifications:manage")
    template = db.get(NotificationTemplate, template_id)
    if template is None:
        raise NotFound("Modèle introuvable")
    try:
        service.render(data.body, {}, html=template.channel == "email")
    except Exception as exc:
        raise BusinessRuleError(f"Modèle invalide : {exc}", code="TEMPLATE_INVALID") from exc
    before = {"subject": template.subject, "body": template.body}
    template.subject = data.subject
    template.body = data.body
    template.whatsapp_template = data.whatsapp_template
    template.is_active = data.is_active
    template.version += 1
    audit.record(
        db,
        family="system",
        module="notifications",
        action="TEMPLATE_UPDATE",
        resource_type="notification_template",
        resource_id=template.id,
        diff=audit.diff_dicts(before, {"subject": data.subject, "body": data.body}),
    )
    db.commit()
    return jsonable(serialize(template))


@router.get("/admin/notification-rules")
def list_rules(
    event_type: str | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("notifications:manage")
    stmt = select(NotificationRule)
    if event_type:
        stmt = stmt.where(NotificationRule.event_type == event_type)
    return [jsonable(serialize(r)) for r in db.execute(stmt.order_by(NotificationRule.event_type)).scalars()]


class RuleIn(BaseModel):
    event_type: str = Field(min_length=3, max_length=100)
    name: str = Field(min_length=3, max_length=200)
    audience: dict[str, Any]
    channels: list[str] = Field(min_length=1, max_length=5)
    template_code: str = Field(min_length=3, max_length=100)
    category: str = Field(default="general", max_length=40)
    priority: str = Field(default="normal", pattern="^(low|normal|high|critical)$")
    conditions: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


def _validate_rule(data: RuleIn) -> None:
    unknown = set(data.channels) - set(CHANNELS)
    if unknown:
        raise BusinessRuleError(f"Canaux inconnus : {sorted(unknown)}")
    allowed = {"roles", "project_roles", "payload_users", "client", "project_members", "permission"}
    if not data.audience or set(data.audience) - allowed:
        raise BusinessRuleError(f"Audience invalide (clés autorisées : {sorted(allowed)})")


@router.post("/admin/notification-rules", status_code=201)
def create_rule(data: RuleIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("notifications:manage")
    _validate_rule(data)
    rule = NotificationRule(**data.model_dump(), is_system=False)
    db.add(rule)
    db.flush()
    audit.record(
        db,
        family="system",
        module="notifications",
        action="RULE_CREATE",
        resource_type="notification_rule",
        resource_id=rule.id,
        diff={"event": data.event_type, "channels": data.channels},
    )
    db.commit()
    return jsonable(serialize(rule))


@router.put("/admin/notification-rules/{rule_id}")
def update_rule(
    rule_id: uuid.UUID, data: RuleIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("notifications:manage")
    rule = db.get(NotificationRule, rule_id)
    if rule is None:
        raise NotFound("Règle introuvable")
    _validate_rule(data)
    for key, value in data.model_dump().items():
        setattr(rule, key, value)
    audit.record(
        db,
        family="system",
        module="notifications",
        action="RULE_UPDATE",
        resource_type="notification_rule",
        resource_id=rule.id,
        diff={"event": data.event_type, "channels": data.channels, "active": data.is_active},
    )
    db.commit()
    return jsonable(serialize(rule))


@router.get("/admin/notification-deliveries")
def deliveries(
    params: PageParams = Depends(),
    status: str | None = None,
    channel: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Journal des envois (traçabilité des canaux : statut, prestataire, erreur) — destinataires masqués."""
    access.require("notifications:manage")
    stmt = select(NotificationDelivery)
    if status:
        stmt = stmt.where(NotificationDelivery.status == status)
    if channel:
        stmt = stmt.where(NotificationDelivery.channel == channel)

    def transform(d: NotificationDelivery) -> dict[str, Any]:
        data = serialize(d)
        recipient = d.recipient or ""
        data["recipient"] = (recipient[:3] + "•••" + recipient[-4:]) if len(recipient) > 8 else recipient
        return jsonable(data)

    return paginate(db, stmt, params, default_sort=NotificationDelivery.created_at.desc(), transform=transform)


@router.get("/admin/notification-stats")
def stats(
    days: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("notifications:manage")
    since = utcnow() - timedelta(days=days)
    rows = db.execute(
        select(NotificationDelivery.channel, NotificationDelivery.status, func.count())
        .where(NotificationDelivery.created_at >= since)
        .group_by(NotificationDelivery.channel, NotificationDelivery.status)
    ).all()
    out: dict[str, dict[str, int]] = {}
    for channel, status, count in rows:
        out.setdefault(channel, {})[status] = count
    return {"days": days, "by_channel": out}
