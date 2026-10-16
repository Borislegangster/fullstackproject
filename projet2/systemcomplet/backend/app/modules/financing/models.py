"""Financement intégré (innovation I5) : établissements partenaires, dossiers de financement du client et
transmission sécurisée aux partenaires (lien d'instruction nominatif, réponse en ligne)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import (
    Base,
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


class FinancingPartner(UUIDPk, Timestamps, Base):
    __tablename__ = "financing_partners"

    name: Mapped[str] = str_col(200, nullable=False)
    kind: Mapped[str] = str_col(20, nullable=False, default="bank")  # bank / microfinance / diaspora
    description: Mapped[str | None] = text_col()
    rate_min: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)  # taux annuel %
    rate_max: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    max_years: Mapped[int] = int_col(15)
    min_down_payment_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("20"))
    max_debt_ratio_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("33"))
    fees_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("1"))
    requirements: Mapped[list[Any]] = json_col(list)
    contact_name: Mapped[str | None] = str_col(150)
    contact_email: Mapped[str | None] = str_col(254)
    active: Mapped[bool] = bool_col(True)
    sort_order: Mapped[int] = int_col(0)


class FinancingApplication(UUIDPk, Timestamps, Base):
    __tablename__ = "financing_applications"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    user_id: Mapped[uuid.UUID | None] = fk("users.id")
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    applicant_name: Mapped[str] = str_col(200, nullable=False)
    applicant_email: Mapped[str | None] = str_col(254)
    applicant_phone: Mapped[str | None] = str_col(40)
    amount: Mapped[Decimal] = money_col()
    down_payment: Mapped[Decimal] = money_col()
    duration_months: Mapped[int] = int_col(120)
    monthly_income: Mapped[Decimal] = money_col()
    other_monthly_debts: Mapped[Decimal] = money_col()
    simulation: Mapped[dict[str, Any]] = json_col(dict)
    documents: Mapped[list[Any]] = json_col(list)  # [{kind, file_id, name, uploaded_at}]
    partner_ids: Mapped[list[Any]] = json_col(list)
    consent_at: Mapped[datetime | None] = dt_col()
    consent_record_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft", index=True
    )  # draft / submitted / offer / accepted / withdrawn / declined
    accepted_offer: Mapped[dict[str, Any]] = json_col(dict)
    submitted_at: Mapped[datetime | None] = dt_col()
    decided_at: Mapped[datetime | None] = dt_col()


class FinancingShare(UUIDPk, Timestamps, Base):
    """Transmission d'un dossier à un partenaire : lien nominatif, expirant, révocable ; réponse du partenaire."""

    __tablename__ = "financing_shares"
    __table_args__ = (UniqueConstraint("application_id", "partner_id"),)

    application_id: Mapped[uuid.UUID] = fk("financing_applications.id", nullable=False, ondelete="CASCADE")
    partner_id: Mapped[uuid.UUID] = fk("financing_partners.id", nullable=False)
    token_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    expires_at: Mapped[datetime] = dt_col(nullable=False)
    viewed_at: Mapped[datetime | None] = dt_col()
    revoked_at: Mapped[datetime | None] = dt_col()
    status: Mapped[str] = str_col(20, nullable=False, default="sent")  # sent / viewed / in_review / offer / declined
    offer: Mapped[dict[str, Any]] = json_col(dict)
    responder_name: Mapped[str | None] = str_col(150)
    responded_at: Mapped[datetime | None] = dt_col()


__all__ = ["FinancingApplication", "FinancingPartner", "FinancingShare"]
