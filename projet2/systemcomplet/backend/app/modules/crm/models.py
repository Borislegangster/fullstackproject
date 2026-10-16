"""CRM : Lead, Contact, Opportunity, ProjectBrief, Quote, Contract, activités, affectation, SLA (§18, §4.4)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, Numeric, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    Quantity,
    SoftDelete,
    Timestamps,
    UUIDPk,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    money_col,
    str_col,
    text_col,
)

LEAD_STATUSES = ("new", "contacted", "qualified", "nurturing", "unqualified", "converted", "lost")
OPPORTUNITY_STAGES = ("qualification", "discovery", "proposal", "negotiation", "won", "lost")


class SlaPolicy(UUIDPk, Timestamps, Base):
    __tablename__ = "sla_policies"

    entity: Mapped[str] = str_col(20, nullable=False)  # lead / ticket
    name: Mapped[str] = str_col(150, nullable=False)
    priority: Mapped[str] = str_col(20, nullable=False, default="normal")
    response_minutes: Mapped[int] = int_col(240)
    resolution_minutes: Mapped[int | None] = mapped_column(nullable=True)
    escalation: Mapped[list[Any]] = json_col(list)  # [{"after_minutes": 60, "notify_roles": ["DIRECTION"]}]
    business_hours_only: Mapped[bool] = bool_col(False)
    is_active: Mapped[bool] = bool_col(True)


class AssignmentRule(UUIDPk, Timestamps, Base):
    __tablename__ = "lead_assignment_rules"

    name: Mapped[str] = str_col(150, nullable=False)
    priority: Mapped[int] = int_col(100)
    criteria: Mapped[dict[str, Any]] = json_col(dict)  # universes, cities, countries, diaspora, sources, urgent
    assignee_ids: Mapped[list[Any]] = json_col(list)
    strategy: Mapped[str] = str_col(20, nullable=False, default="round_robin")  # round_robin / least_loaded
    cursor: Mapped[int] = int_col(0)
    is_active: Mapped[bool] = bool_col(True)


class Lead(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "leads"
    __table_args__ = (Index("ix_leads_status_created", "status", "created_at"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    source: Mapped[str] = str_col(30, nullable=False, default="website_form")
    form_key: Mapped[str | None] = str_col(60)
    utm_source: Mapped[str | None] = str_col(120)
    utm_medium: Mapped[str | None] = str_col(120)
    utm_campaign: Mapped[str | None] = str_col(160)
    utm_content: Mapped[str | None] = str_col(160)
    utm_term: Mapped[str | None] = str_col(160)
    landing_page: Mapped[str | None] = str_col(500)
    referrer: Mapped[str | None] = str_col(500)
    analytics_session_id: Mapped[str | None] = str_col(64)
    universe: Mapped[str | None] = str_col(20, index=True)
    offer_slug: Mapped[str | None] = str_col(120)
    service_slug: Mapped[str | None] = str_col(120)
    project_type: Mapped[str | None] = str_col(60)
    first_name: Mapped[str] = str_col(120, nullable=False)
    last_name: Mapped[str | None] = str_col(120)
    company: Mapped[str | None] = str_col(200)
    email: Mapped[str | None] = str_col(254, index=True)
    phone: Mapped[str | None] = str_col(40)
    whatsapp: Mapped[str | None] = str_col(40)
    country: Mapped[str | None] = str_col(80)
    city: Mapped[str | None] = str_col(120)
    is_diaspora: Mapped[bool] = bool_col(False)
    preferred_channel: Mapped[str] = str_col(20, nullable=False, default="email")
    message: Mapped[str | None] = text_col()
    budget_min: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    budget_max: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    budget_currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    timeline: Mapped[str | None] = str_col(30)
    has_land: Mapped[bool | None] = mapped_column(nullable=True)
    land_status: Mapped[str | None] = str_col(30)
    project_location: Mapped[str | None] = str_col(250)
    urgency: Mapped[str] = str_col(20, nullable=False, default="normal")
    status: Mapped[str] = str_col(20, nullable=False, default="new")
    lost_reason: Mapped[str | None] = text_col()
    score: Mapped[int] = int_col(0)
    temperature: Mapped[str] = str_col(10, nullable=False, default="cold")  # hot / warm / cold
    score_details: Mapped[dict[str, Any]] = json_col(dict)
    ai_summary: Mapped[str | None] = text_col()
    ai_qualification: Mapped[dict[str, Any]] = json_col(dict)
    assigned_to_id: Mapped[uuid.UUID | None] = fk("users.id")
    assigned_at: Mapped[datetime | None] = dt_col()
    sla_policy_id: Mapped[uuid.UUID | None] = fk("sla_policies.id")
    response_due_at: Mapped[datetime | None] = dt_col(index=True)
    first_response_at: Mapped[datetime | None] = dt_col()
    escalation_level: Mapped[int] = int_col(0)
    escalated_at: Mapped[datetime | None] = dt_col()
    consent_record_id: Mapped[uuid.UUID | None] = fk("consent_records.id")
    marketing_consent: Mapped[bool] = bool_col(False)
    whatsapp_consent: Mapped[bool] = bool_col(False)
    auto_reply_sent_at: Mapped[datetime | None] = dt_col()
    contact_id: Mapped[uuid.UUID | None] = fk("contacts.id")
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    converted_at: Mapped[datetime | None] = dt_col()
    tags: Mapped[list[Any]] = json_col(list)


class Contact(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "contacts"

    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    user_id: Mapped[uuid.UUID | None] = fk("users.id")
    first_name: Mapped[str] = str_col(120, nullable=False)
    last_name: Mapped[str | None] = str_col(120)
    email: Mapped[str | None] = str_col(254, index=True)
    phone: Mapped[str | None] = str_col(40)
    whatsapp: Mapped[str | None] = str_col(40)
    job_title: Mapped[str | None] = str_col(150)
    city: Mapped[str | None] = str_col(120)
    country: Mapped[str | None] = str_col(80)
    is_diaspora: Mapped[bool] = bool_col(False)
    owner_id: Mapped[uuid.UUID | None] = fk("users.id")
    source_lead_id: Mapped[uuid.UUID | None] = fk("leads.id", use_alter=True)
    notes: Mapped[str | None] = text_col()
    tags: Mapped[list[Any]] = json_col(list)


class Opportunity(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "opportunities"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    title: Mapped[str] = str_col(250, nullable=False)
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    contact_id: Mapped[uuid.UUID | None] = fk("contacts.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    universe: Mapped[str | None] = str_col(20)
    offer_slug: Mapped[str | None] = str_col(120)
    amount_estimated: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    probability: Mapped[int] = int_col(20)
    stage: Mapped[str] = str_col(20, nullable=False, default="qualification", index=True)
    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    owner_id: Mapped[uuid.UUID | None] = fk("users.id")
    lost_reason: Mapped[str | None] = text_col()
    won_at: Mapped[datetime | None] = dt_col()
    lost_at: Mapped[datetime | None] = dt_col()
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    notes: Mapped[str | None] = text_col()


class ProjectBrief(UUIDPk, Timestamps, Base):
    """Questionnaire « Décrire mon projet »."""

    __tablename__ = "project_briefs"

    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    opportunity_id: Mapped[uuid.UUID | None] = fk("opportunities.id")
    universe: Mapped[str | None] = str_col(20)
    project_type: Mapped[str | None] = str_col(60)
    answers: Mapped[dict[str, Any]] = json_col(dict)
    surface_m2: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    levels: Mapped[int | None] = mapped_column(nullable=True)
    style: Mapped[str | None] = str_col(80)
    file_ids: Mapped[list[Any]] = json_col(list)
    completeness: Mapped[int] = int_col(0)
    estimate_min: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    estimate_max: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    submitted_at: Mapped[datetime | None] = dt_col()


class Quote(UUIDPk, Timestamps, SoftDelete, Base):
    """Devis (versionné)."""

    __tablename__ = "quotes"

    number: Mapped[str] = str_col(40, nullable=False, index=True)
    revision: Mapped[int] = int_col(1)
    parent_quote_id: Mapped[uuid.UUID | None] = fk("quotes.id", index=False)
    opportunity_id: Mapped[uuid.UUID | None] = fk("opportunities.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    contact_id: Mapped[uuid.UUID | None] = fk("contacts.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    title: Mapped[str] = str_col(250, nullable=False)
    introduction: Mapped[str | None] = text_col()
    terms: Mapped[str | None] = text_col()
    subtotal: Mapped[Decimal] = money_col()
    discount_amount: Mapped[Decimal] = money_col()
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), nullable=False, default=Decimal("19.25"), server_default="19.25"
    )
    tax_amount: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_schedule: Mapped[list[Any]] = json_col(list)  # [{"label": "Acompte", "pct": 30, "milestone": "..."}]
    status: Mapped[str] = str_col(20, nullable=False, default="draft", index=True)
    sent_at: Mapped[datetime | None] = dt_col()
    viewed_at: Mapped[datetime | None] = dt_col()
    accepted_at: Mapped[datetime | None] = dt_col()
    accepted_by_name: Mapped[str | None] = str_col(200)
    acceptance_proof: Mapped[dict[str, Any]] = json_col(dict)
    rejected_at: Mapped[datetime | None] = dt_col()
    rejected_reason: Mapped[str | None] = text_col()
    public_token_hash: Mapped[str | None] = str_col(64, index=True)
    pdf_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)

    lines: Mapped[list[QuoteLine]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="QuoteLine.sort_order"
    )


class QuoteLine(UUIDPk, Base):
    __tablename__ = "quote_lines"

    quote_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("quotes.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = int_col(0)
    section: Mapped[str | None] = str_col(150)
    lot_code: Mapped[str | None] = str_col(30)
    designation: Mapped[str] = str_col(300, nullable=False)
    description: Mapped[str | None] = text_col()
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = money_col()
    discount_pct: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), nullable=False, default=Decimal("0"), server_default="0"
    )
    total: Mapped[Decimal] = money_col()


class Contract(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "contracts"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    quote_id: Mapped[uuid.UUID | None] = fk("quotes.id")
    opportunity_id: Mapped[uuid.UUID | None] = fk("opportunities.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    contact_id: Mapped[uuid.UUID | None] = fk("contacts.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    title: Mapped[str] = str_col(250, nullable=False)
    amount: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    status: Mapped[str] = str_col(20, nullable=False, default="draft", index=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    terms: Mapped[str | None] = text_col()
    payment_schedule: Mapped[list[Any]] = json_col(list)
    document_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    sent_at: Mapped[datetime | None] = dt_col()
    signed_at: Mapped[datetime | None] = dt_col()
    signed_by_name: Mapped[str | None] = str_col(200)
    signature_proof: Mapped[dict[str, Any]] = json_col(dict)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class CrmActivity(UUIDPk, Timestamps, Base):
    """Activités et relances commerciales."""

    __tablename__ = "crm_activities"

    kind: Mapped[str] = str_col(20, nullable=False)  # call / email / meeting / whatsapp / sms / note / visit / task
    subject: Mapped[str] = str_col(250, nullable=False)
    body: Mapped[str | None] = text_col()
    direction: Mapped[str | None] = str_col(5)  # in / out
    due_at: Mapped[datetime | None] = dt_col(index=True)
    done_at: Mapped[datetime | None] = dt_col()
    status: Mapped[str] = str_col(20, nullable=False, default="planned")
    outcome: Mapped[str | None] = str_col(250)
    owner_id: Mapped[uuid.UUID | None] = fk("users.id")
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    contact_id: Mapped[uuid.UUID | None] = fk("contacts.id")
    opportunity_id: Mapped[uuid.UUID | None] = fk("opportunities.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    automatic: Mapped[bool] = bool_col(False)


__all__ = [
    "LEAD_STATUSES",
    "OPPORTUNITY_STAGES",
    "AssignmentRule",
    "Contact",
    "Contract",
    "CrmActivity",
    "Lead",
    "Opportunity",
    "ProjectBrief",
    "Quote",
    "QuoteLine",
    "SlaPolicy",
]
