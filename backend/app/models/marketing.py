"""
Marketing Models — Segments, campaigns, automation, newsletter.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
)
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class NewsletterSegment(Base):
    __tablename__ = "newsletter_segments"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    criteria = Column(JSON, default=dict)
    # {source: [], tags: [], location: [], status: []}
    subscriber_count = Column(Integer, default=0)
    is_dynamic = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class NewsletterTemplate(Base):
    __tablename__ = "newsletter_templates"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    subject = Column(String, default="")
    html_content = Column(Text, default="")
    text_content = Column(Text, default="")
    category = Column(String, default="")  # bienvenue, relance, nurturing, rappel, promo
    variables = Column(JSON, default=list)
    thumbnail_url = Column(String, default="")
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    campaign_type = Column(String, default="PONCTUELLE")
    # PONCTUELLE/PROGRAMMEE/AUTOMATISEE

    template_id = Column(String, ForeignKey("newsletter_templates.id"), nullable=True)
    segment_ids = Column(JSON, default=list)

    subject = Column(String, default="")
    from_name = Column(String, default="Globus Engineering")
    reply_to = Column(String, default="")

    status = Column(String, default="BROUILLON", index=True)
    # BROUILLON/PROGRAMMEE/EN_ENVOI/ENVOYEE/ANNULEE

    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    total_recipients = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    bounced_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)
    clicked_count = Column(Integer, default=0)
    unsubscribed_count = Column(Integer, default=0)
    complaint_count = Column(Integer, default=0)

    automation_trigger = Column(String, default="")
    # bienvenue, relance_7j, nurturing, rappel_rdv, reactivation
    automation_delay_hours = Column(Integer, default=0)

    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class CampaignEvent(Base):
    __tablename__ = "campaign_events"

    id = Column(String, primary_key=True, default=_uuid)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=False, index=True)
    subscriber_id = Column(String, ForeignKey("newsletter_subscribers.id"), nullable=True, index=True)
    email = Column(String, default="")
    event_type = Column(String, nullable=False, index=True)
    # SENT/DELIVERED/BOUNCED/OPENED/CLICKED/UNSUBSCRIBED/COMPLAINT
    link_url = Column(String, default="")
    user_agent = Column(String, default="")
    ip_address = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class AutoReplyTemplate(Base):
    __tablename__ = "auto_reply_templates"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    trigger = Column(String, nullable=False)
    # contact_form, newsletter_subscribe, project_inquiry, appointment_request
    channel = Column(String, default="EMAIL")  # EMAIL/WHATSAPP/SMS
    subject = Column(String, default="")
    html_content = Column(Text, default="")
    text_content = Column(Text, default="")
    is_active = Column(Boolean, default=True)
    delay_minutes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FormDefinition(Base):
    """CMS-driven form definitions for public pages."""
    __tablename__ = "form_definitions"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    fields = Column(JSON, default=list)
    # [{name, label, type, required, options, validation, placeholder}]
    success_message = Column(String, default="")
    auto_reply_template_id = Column(String, ForeignKey("auto_reply_templates.id"), nullable=True)
    notification_emails = Column(JSON, default=list)
    is_published = Column(Boolean, default=True)
    submission_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
