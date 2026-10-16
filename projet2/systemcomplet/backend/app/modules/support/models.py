"""SAV : Ticket, SLA, TicketMessage, TicketAttachment, interventions, WarrantyClaim, satisfaction (§18.1)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Index, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import (
    Base,
    Timestamps,
    UUIDPk,
    Versioned,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    money_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class Ticket(UUIDPk, Timestamps, Versioned, Base):
    __tablename__ = "tickets"
    __table_args__ = (Index("ix_tickets_status_due", "status", "resolution_due_at"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    requester_id: Mapped[uuid.UUID | None] = fk("users.id")
    requester_name: Mapped[str | None] = str_col(200)
    requester_email: Mapped[str | None] = str_col(254)
    requester_phone: Mapped[str | None] = str_col(40)
    category: Mapped[str] = str_col(
        30, nullable=False, default="autre"
    )  # etancheite / plomberie / electricite / fissure / menuiserie / peinture / equipement / autre
    priority: Mapped[str] = str_col(10, nullable=False, default="normal")  # low / normal / high / urgent
    subject: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    location: Mapped[str | None] = str_col(250)
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    status: Mapped[str] = str_col(
        20, nullable=False, default="new", index=True
    )  # new / assigned / diagnosis / scheduled / in_progress / resolved / closed / reopened / cancelled
    sla_policy_id: Mapped[uuid.UUID | None] = fk("sla_policies.id")
    response_due_at: Mapped[datetime | None] = dt_col()
    resolution_due_at: Mapped[datetime | None] = dt_col()
    first_response_at: Mapped[datetime | None] = dt_col()
    resolved_at: Mapped[datetime | None] = dt_col()
    closed_at: Mapped[datetime | None] = dt_col()
    response_breached: Mapped[bool] = bool_col(False)
    resolution_breached: Mapped[bool] = bool_col(False)
    warranty_id: Mapped[uuid.UUID | None] = fk("warranties.id")
    within_warranty: Mapped[bool | None] = mapped_column(nullable=True)
    assigned_to_id: Mapped[uuid.UUID | None] = fk("users.id")
    diagnosis: Mapped[str | None] = text_col()
    resolution: Mapped[str | None] = text_col()
    total_cost: Mapped[Decimal] = money_col()
    satisfaction_rating: Mapped[int | None] = mapped_column(nullable=True)
    satisfaction_comment: Mapped[str | None] = text_col()
    satisfaction_at: Mapped[datetime | None] = dt_col()
    channel: Mapped[str] = str_col(20, nullable=False, default="portal")  # portal / email / phone / whatsapp / website
    ai_draft_reply: Mapped[str | None] = text_col()


class TicketMessage(UUIDPk, Base):
    __tablename__ = "ticket_messages"

    ticket_id: Mapped[uuid.UUID] = fk("tickets.id", nullable=False, ondelete="CASCADE")
    author_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    body: Mapped[str] = text_col(nullable=False)
    internal: Mapped[bool] = bool_col(False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class TicketAttachment(UUIDPk, Base):
    __tablename__ = "ticket_attachments"

    ticket_id: Mapped[uuid.UUID] = fk("tickets.id", nullable=False, ondelete="CASCADE")
    file_id: Mapped[uuid.UUID] = fk("stored_files.id", nullable=False)
    kind: Mapped[str] = str_col(20, nullable=False, default="photo")  # photo / document / before / after
    uploaded_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Intervention(UUIDPk, Timestamps, Base):
    __tablename__ = "interventions"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    ticket_id: Mapped[uuid.UUID] = fk("tickets.id", nullable=False, ondelete="CASCADE")
    technician_id: Mapped[uuid.UUID | None] = fk("users.id")
    scheduled_at: Mapped[datetime | None] = dt_col()
    started_at: Mapped[datetime | None] = dt_col()
    finished_at: Mapped[datetime | None] = dt_col()
    report: Mapped[str | None] = text_col()
    time_spent_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("0"))
    materials: Mapped[list[Any]] = json_col(list)
    labor_cost: Mapped[Decimal] = money_col()
    material_cost: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(20, nullable=False, default="planned")  # planned / in_progress / done / cancelled
    client_validated: Mapped[bool] = bool_col(False)
    client_validated_at: Mapped[datetime | None] = dt_col()
    proof_file_ids: Mapped[list[Any]] = json_col(list)


class WarrantyClaim(UUIDPk, Timestamps, Base):
    __tablename__ = "warranty_claims"

    ticket_id: Mapped[uuid.UUID] = fk("tickets.id", nullable=False, ondelete="CASCADE")
    warranty_id: Mapped[uuid.UUID | None] = fk("warranties.id")
    decision: Mapped[str] = str_col(20, nullable=False, default="pending")  # pending / covered / not_covered / partial
    reason: Mapped[str | None] = text_col()
    responsible_party: Mapped[str | None] = str_col(40)  # globus / sous_traitant / fournisseur / client
    responsible_party_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    cost_recovered: Mapped[Decimal] = money_col()
    priority_rank: Mapped[int] = int_col(0)


__all__ = ["Intervention", "Ticket", "TicketAttachment", "TicketMessage", "WarrantyClaim"]
