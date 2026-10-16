"""Programme ambassadeurs (innovation I6) : clients et partenaires recommandent GLOBUS avec un code personnel ; la
prime est due à la signature du contrat du filleul, validée par la Direction commerciale puis payée (Mobile Money)
par le circuit standard des paiements sortants (approbation, contrôle interne, preuve)."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, dt_col, fk, json_col, money_col, str_col, text_col
from app.core.security import EncryptedString


class Ambassador(UUIDPk, Timestamps, Base):
    __tablename__ = "ambassadors"
    __table_args__ = (UniqueConstraint("user_id"),)

    code: Mapped[str] = str_col(20, nullable=False, unique=True)
    kind: Mapped[str] = str_col(20, nullable=False, default="client")  # client / partner / employee
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    full_name: Mapped[str] = str_col(200, nullable=False)
    email: Mapped[str | None] = str_col(254)
    phone: Mapped[str | None] = str_col(30)
    momo_number: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    momo_operator: Mapped[str | None] = str_col(20)  # mtn / orange
    status: Mapped[str] = str_col(20, nullable=False, default="active")  # active / suspended
    terms_accepted_at: Mapped[datetime | None] = dt_col()
    notes: Mapped[str | None] = text_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class Referral(UUIDPk, Timestamps, Base):
    """Recommandation : du lead capté (code saisi / lien) jusqu'au paiement de la prime."""

    __tablename__ = "referrals"
    __table_args__ = (UniqueConstraint("lead_id"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    ambassador_id: Mapped[uuid.UUID] = fk("ambassadors.id", nullable=False)
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id", index=False)
    referee_name: Mapped[str] = str_col(200, nullable=False)
    captured_via: Mapped[str] = str_col(20, nullable=False, default="link")  # link / form / manual
    status: Mapped[str] = str_col(
        20, nullable=False, default="captured", index=True
    )  # captured / signed / approved / paid / rejected
    contract_id: Mapped[uuid.UUID | None] = fk("contracts.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    contract_amount: Mapped[Decimal] = money_col()
    amount: Mapped[Decimal] = money_col()  # prime due
    amount_paid: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    reward_basis: Mapped[dict[str, Any]] = json_col(dict)  # règle appliquée (instantané de la politique)
    rejection_reason: Mapped[str | None] = text_col()
    signed_at: Mapped[datetime | None] = dt_col()
    approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_at: Mapped[datetime | None] = dt_col()
    paid_at: Mapped[datetime | None] = dt_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


__all__ = ["Ambassador", "Referral"]
