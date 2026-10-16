"""Newsletter & marketing automation : abonnés, segments, modèles versionnés, campagnes, événements,
automatisations (§4.5). Les désabonnés sont exclus automatiquement (V4-MAIL-37)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, ForeignKey, Identity, Index, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    Timestamps,
    UUIDPk,
    bigint_col,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class NewsletterSubscriber(UUIDPk, Timestamps, Base):
    __tablename__ = "newsletter_subscribers"

    email: Mapped[str] = str_col(254, nullable=False, unique=True)
    first_name: Mapped[str | None] = str_col(120)
    last_name: Mapped[str | None] = str_col(120)
    status: Mapped[str] = str_col(
        20, nullable=False, default="pending", index=True
    )  # pending / subscribed / unsubscribed / bounced / complained
    source: Mapped[str] = str_col(40, nullable=False, default="website")
    tags: Mapped[list[Any]] = json_col(list)
    interests: Mapped[list[Any]] = json_col(list)  # univers / thèmes
    preferences: Mapped[dict[str, Any]] = json_col(dict)
    country: Mapped[str | None] = str_col(80)
    is_diaspora: Mapped[bool] = bool_col(False)
    consent_record_id: Mapped[uuid.UUID | None] = fk("consent_records.id")
    token: Mapped[str] = str_col(64, nullable=False, unique=True)  # confirmation / désabonnement
    confirmed_at: Mapped[datetime | None] = dt_col()
    unsubscribed_at: Mapped[datetime | None] = dt_col()
    unsubscribe_reason: Mapped[str | None] = str_col(250)
    bounce_count: Mapped[int] = int_col(0)
    last_engaged_at: Mapped[datetime | None] = dt_col()
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")


class SubscriberEvent(UUIDPk, Base):
    """Historique des modifications de liste (preuve)."""

    __tablename__ = "newsletter_subscriber_events"

    subscriber_id: Mapped[uuid.UUID] = fk("newsletter_subscribers.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(
        30, nullable=False
    )  # subscribed / confirmed / unsubscribed / tag_added / tag_removed / bounced / complained / preferences
    details: Mapped[dict[str, Any]] = json_col(dict)
    actor_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Segment(UUIDPk, Timestamps, Base):
    __tablename__ = "newsletter_segments"

    name: Mapped[str] = str_col(150, nullable=False, unique=True)
    description: Mapped[str | None] = text_col()
    rules: Mapped[dict[str, Any]] = json_col(
        dict
    )  # {"tags_any": [], "tags_all": [], "interests_any": [], "sources": [], "diaspora": null, "countries": []}
    estimated_count: Mapped[int] = int_col(0)


class EmailTemplate(UUIDPk, Timestamps, Base):
    __tablename__ = "email_templates"

    name: Mapped[str] = str_col(150, nullable=False, unique=True)
    kind: Mapped[str] = str_col(20, nullable=False, default="campaign")  # campaign / automation / transactional
    current_version: Mapped[int] = int_col(1)

    versions: Mapped[list[EmailTemplateVersion]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="EmailTemplateVersion.version"
    )


class EmailTemplateVersion(UUIDPk, Base):
    __tablename__ = "email_template_versions"
    __table_args__ = (UniqueConstraint("template_id", "version"),)

    template_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("email_templates.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int] = int_col(1)
    subject: Mapped[str] = str_col(250, nullable=False)
    preheader: Mapped[str | None] = str_col(250)
    html: Mapped[str] = mapped_column(Text, nullable=False)
    text: Mapped[str | None] = text_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Campaign(UUIDPk, Timestamps, Base):
    __tablename__ = "campaigns"

    name: Mapped[str] = str_col(200, nullable=False)
    subject: Mapped[str] = str_col(250, nullable=False)
    template_id: Mapped[uuid.UUID | None] = fk("email_templates.id")
    template_version: Mapped[int | None] = mapped_column(nullable=True)
    segment_ids: Mapped[list[Any]] = json_col(list)  # vide = tous les abonnés confirmés
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft", index=True
    )  # draft / scheduled / sending / sent / cancelled / failed
    scheduled_at: Mapped[datetime | None] = dt_col(index=True)
    sent_at: Mapped[datetime | None] = dt_col()
    utm_campaign: Mapped[str | None] = str_col(160)
    recipients_count: Mapped[int] = int_col(0)
    sent_count: Mapped[int] = int_col(0)
    delivered_count: Mapped[int] = int_col(0)
    bounce_count: Mapped[int] = int_col(0)
    open_count: Mapped[int] = int_col(0)
    unique_open_count: Mapped[int] = int_col(0)
    click_count: Mapped[int] = int_col(0)
    unique_click_count: Mapped[int] = int_col(0)
    unsubscribe_count: Mapped[int] = int_col(0)
    complaint_count: Mapped[int] = int_col(0)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class CampaignRecipient(UUIDPk, Base):
    __tablename__ = "campaign_recipients"
    __table_args__ = (UniqueConstraint("campaign_id", "subscriber_id"),)

    campaign_id: Mapped[uuid.UUID] = fk("campaigns.id", nullable=False, ondelete="CASCADE")
    subscriber_id: Mapped[uuid.UUID] = fk("newsletter_subscribers.id", nullable=False, ondelete="CASCADE")
    status: Mapped[str] = str_col(
        20, nullable=False, default="queued"
    )  # queued / sent / delivered / bounced / failed / skipped
    provider_message_id: Mapped[str | None] = str_col(200, index=True)
    sent_at: Mapped[datetime | None] = dt_col()
    opened_at: Mapped[datetime | None] = dt_col()
    clicked_at: Mapped[datetime | None] = dt_col()
    tracking_token: Mapped[str] = str_col(64, nullable=False, unique=True)


class CampaignEvent(Base):
    __tablename__ = "campaign_events"
    __table_args__ = (Index("ix_campaign_events_campaign_kind", "campaign_id", "kind"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    campaign_id: Mapped[uuid.UUID | None] = fk("campaigns.id", ondelete="CASCADE", index=False)
    recipient_id: Mapped[uuid.UUID | None] = fk("campaign_recipients.id", ondelete="CASCADE", index=False)
    subscriber_id: Mapped[uuid.UUID | None] = fk("newsletter_subscribers.id", ondelete="CASCADE", index=False)
    automation_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    kind: Mapped[str] = str_col(
        20, nullable=False
    )  # sent / delivered / bounce / open / click / unsubscribe / complaint
    url: Mapped[str | None] = str_col(1000)
    meta: Mapped[dict[str, Any]] = json_col(dict)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Automation(UUIDPk, Timestamps, Base):
    """Bienvenue, relance, nurturing, rappel, réactivation."""

    __tablename__ = "marketing_automations"

    name: Mapped[str] = str_col(150, nullable=False)
    kind: Mapped[str] = str_col(20, nullable=False)  # welcome / follow_up / nurturing / reminder / reactivation
    trigger: Mapped[str] = str_col(
        40, nullable=False
    )  # subscriber_confirmed / lead_created / lead_inactive / tag_added / inactive_days
    trigger_config: Mapped[dict[str, Any]] = json_col(dict)
    steps: Mapped[list[Any]] = json_col(list)  # [{"delay_hours": 0, "template_id": "...", "subject": "..."}]
    is_active: Mapped[bool] = bool_col(False)
    enrolled_count: Mapped[int] = bigint_col(0)


class AutomationEnrollment(UUIDPk, Base):
    __tablename__ = "marketing_automation_enrollments"
    __table_args__ = (UniqueConstraint("automation_id", "subscriber_id"),)

    automation_id: Mapped[uuid.UUID] = fk("marketing_automations.id", nullable=False, ondelete="CASCADE")
    subscriber_id: Mapped[uuid.UUID] = fk("newsletter_subscribers.id", nullable=False, ondelete="CASCADE")
    current_step: Mapped[int] = int_col(0)
    next_run_at: Mapped[datetime | None] = dt_col(index=True)
    status: Mapped[str] = str_col(20, nullable=False, default="active")  # active / completed / exited
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


__all__ = [
    "Automation",
    "AutomationEnrollment",
    "Campaign",
    "CampaignEvent",
    "CampaignRecipient",
    "EmailTemplate",
    "EmailTemplateVersion",
    "NewsletterSubscriber",
    "Segment",
    "SubscriberEvent",
]
