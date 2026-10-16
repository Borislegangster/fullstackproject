"""Paiement par jalon sous séquestre (innovation R1) : compte de séquestre du projet chez un partenaire agréé,
appels de fonds rattachés aux jalons, libération sur preuves (PV, photos certifiées, accord du client par code)
et double validation interne ; registre des mouvements."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, dt_col, fk, int_col, json_col, money_col, str_col, text_col
from app.core.utils import utcnow


class EscrowAccount(UUIDPk, Timestamps, Base):
    __tablename__ = "escrow_accounts"
    __table_args__ = (UniqueConstraint("project_id"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE", index=False)
    partner_name: Mapped[str] = str_col(200, nullable=False)
    partner_reference: Mapped[str | None] = str_col(120)  # n° du compte / de la convention de séquestre
    provider: Mapped[str] = str_col(20, nullable=False, default="manual")  # manual (ordre de virement) / api
    status: Mapped[str] = str_col(20, nullable=False, default="pending_partner")  # pending_partner / active / closed
    terms: Mapped[str | None] = text_col()
    review_days: Mapped[int] = int_col(10)  # délai laissé au client pour valider ou contester
    balance_held: Mapped[Decimal] = money_col()
    balance_released: Mapped[Decimal] = money_col()
    balance_refunded: Mapped[Decimal] = money_col()
    activated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    activated_at: Mapped[datetime | None] = dt_col()


class EscrowItem(UUIDPk, Timestamps, Base):
    __tablename__ = "escrow_items"
    __table_args__ = (UniqueConstraint("funds_call_id"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    account_id: Mapped[uuid.UUID] = fk("escrow_accounts.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    funds_call_id: Mapped[uuid.UUID] = fk("funds_calls.id", nullable=False, index=False)
    milestone_id: Mapped[uuid.UUID] = fk("milestones.id", nullable=False)
    amount: Mapped[Decimal] = money_col()
    held_amount: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(
        20, nullable=False, default="awaiting_payment", index=True
    )  # awaiting_payment / held / release_requested / approved / released / disputed / refunded
    evidence: Mapped[dict[str, Any]] = json_col(dict)
    requested_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    requested_at: Mapped[datetime | None] = dt_col()
    client_decision: Mapped[dict[str, Any]] = json_col(dict)
    dispute_reason: Mapped[str | None] = text_col()
    approvals: Mapped[list[Any]] = json_col(list)  # double validation : [{user_id, name, role, at}]
    released_at: Mapped[datetime | None] = dt_col()
    release_reference: Mapped[str | None] = str_col(120)
    resolution_note: Mapped[str | None] = text_col()


class EscrowMovement(UUIDPk, Base):
    __tablename__ = "escrow_movements"

    account_id: Mapped[uuid.UUID] = fk("escrow_accounts.id", nullable=False, ondelete="CASCADE")
    item_id: Mapped[uuid.UUID | None] = fk("escrow_items.id", ondelete="CASCADE")
    kind: Mapped[str] = str_col(20, nullable=False)  # deposit / release / refund
    amount: Mapped[Decimal] = money_col()
    reference: Mapped[str | None] = str_col(120)
    payment_id: Mapped[uuid.UUID | None] = fk("payments.id")
    actor_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


__all__ = ["EscrowAccount", "EscrowItem", "EscrowMovement"]
