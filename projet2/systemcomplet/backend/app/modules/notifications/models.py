"""Notifications : in-app, push (Web Push / FCM), e-mail, WhatsApp, SMS selon règles et préférences (§6, V4-NOTIF-39)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, int_col, json_col, str_col, text_col
from app.core.utils import utcnow

CHANNELS = ("in_app", "push", "email", "whatsapp", "sms")


class Notification(UUIDPk, Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_unread", "user_id", "read_at"),)

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE", index=False)
    category: Mapped[str] = str_col(40, nullable=False, default="general")
    event_type: Mapped[str | None] = str_col(100)
    title: Mapped[str] = str_col(250, nullable=False)
    body: Mapped[str | None] = text_col()
    link: Mapped[str | None] = str_col(500)
    priority: Mapped[str] = str_col(10, nullable=False, default="normal")  # low / normal / high / critical
    entity_type: Mapped[str | None] = str_col(60)
    entity_id: Mapped[str | None] = str_col(80)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")
    data: Mapped[dict[str, Any]] = json_col(dict)
    read_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), index=True)


class NotificationDelivery(UUIDPk, Base):
    __tablename__ = "notification_deliveries"

    notification_id: Mapped[uuid.UUID | None] = fk("notifications.id", ondelete="CASCADE")
    user_id: Mapped[uuid.UUID | None] = fk("users.id", ondelete="CASCADE")
    recipient: Mapped[str | None] = str_col(254)
    channel: Mapped[str] = str_col(20, nullable=False)
    status: Mapped[str] = str_col(
        20, nullable=False, default="queued", index=True
    )  # queued / sent / delivered / read / failed / skipped
    provider: Mapped[str | None] = str_col(40)
    provider_message_id: Mapped[str | None] = str_col(200, index=True)
    error: Mapped[str | None] = text_col()
    attempts: Mapped[int] = int_col(0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    sent_at: Mapped[datetime | None] = dt_col()
    delivered_at: Mapped[datetime | None] = dt_col()


class NotificationTemplate(UUIDPk, Timestamps, Base):
    __tablename__ = "notification_templates"
    __table_args__ = (UniqueConstraint("code", "channel", "locale"),)

    code: Mapped[str] = str_col(100, nullable=False)
    channel: Mapped[str] = str_col(20, nullable=False)
    locale: Mapped[str] = str_col(10, nullable=False, default="fr")
    subject: Mapped[str | None] = str_col(250)
    body: Mapped[str] = mapped_column(Text, nullable=False)  # Jinja2 (environnement sandboxé)
    whatsapp_template: Mapped[str | None] = str_col(120)  # modèle approuvé Meta
    version: Mapped[int] = int_col(1)
    is_active: Mapped[bool] = bool_col(True)
    is_system: Mapped[bool] = bool_col(True)


class NotificationRule(UUIDPk, Timestamps, Base):
    """Règle : événement métier → audience → canaux → modèle."""

    __tablename__ = "notification_rules"

    event_type: Mapped[str] = str_col(100, nullable=False, index=True)
    name: Mapped[str] = str_col(200, nullable=False)
    audience: Mapped[dict[str, Any]] = json_col(
        dict
    )  # {"roles": [...], "project_roles": [...], "payload_users": ["requested_by_id"], "client": true}
    channels: Mapped[list[Any]] = json_col(lambda: ["in_app"])
    template_code: Mapped[str] = str_col(100, nullable=False)
    category: Mapped[str] = str_col(40, nullable=False, default="general")
    priority: Mapped[str] = str_col(10, nullable=False, default="normal")
    conditions: Mapped[dict[str, Any]] = json_col(dict)  # {"payload.severity": ["high", "critical"]}
    is_active: Mapped[bool] = bool_col(True)
    is_system: Mapped[bool] = bool_col(True)


class NotificationPreference(UUIDPk, Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", "category", "channel"),)

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    category: Mapped[str] = str_col(40, nullable=False)
    channel: Mapped[str] = str_col(20, nullable=False)
    enabled: Mapped[bool] = bool_col(True)


class PushSubscription(UUIDPk, Base):
    """Abonnement Web Push (VAPID) ou jeton mobile (FCM)."""

    __tablename__ = "push_subscriptions"

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(10, nullable=False, default="webpush")  # webpush / fcm
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)  # URL Web Push ou jeton FCM
    p256dh: Mapped[str | None] = str_col(200)
    auth: Mapped[str | None] = str_col(100)
    application: Mapped[str | None] = str_col(40)
    device_name: Mapped[str | None] = str_col(150)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    last_success_at: Mapped[datetime | None] = dt_col()
    failure_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


__all__ = [
    "CHANNELS",
    "Notification",
    "NotificationDelivery",
    "NotificationPreference",
    "NotificationRule",
    "NotificationTemplate",
    "PushSubscription",
]
