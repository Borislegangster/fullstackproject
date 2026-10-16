"""Sous-traitance : qualification, consultation multi-lots (RFQ), offres, négociation, attribution, contrat,
mobilisation, situations de travaux, factures, retenues/avances, réclamations, litiges, notation (§9)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, Numeric, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    Quantity,
    SoftDelete,
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
from app.core.security import EncryptedString
from app.core.utils import utcnow

DISPUTE_STATUSES = ("OUVERT", "EN_ANALYSE", "EN_NEGOCIATION", "DECISION", "RESOLU", "ESCALADE")


class Subcontractor(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "subcontractors"

    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    code: Mapped[str] = str_col(30, nullable=False, unique=True)
    legal_name: Mapped[str] = str_col(250, nullable=False, index=True)
    trade_name: Mapped[str | None] = str_col(250)
    trades: Mapped[list[Any]] = json_col(list)  # gros_oeuvre, electricite, plomberie, menuiserie…
    zones: Mapped[list[Any]] = json_col(list)
    tax_id: Mapped[str | None] = str_col(60)
    trade_register: Mapped[str | None] = str_col(80)
    email: Mapped[str | None] = str_col(254)
    phone: Mapped[str | None] = str_col(40)
    whatsapp: Mapped[str | None] = str_col(40)
    address: Mapped[str | None] = text_col()
    city: Mapped[str | None] = str_col(120)
    workforce_size: Mapped[int] = int_col(0)
    insurance_rc_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    insurance_decennale_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    bank_account: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    mobile_money_number: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    status: Mapped[str] = str_col(
        20, nullable=False, default="prospect", index=True
    )  # prospect / qualified / approved / suspended / blacklisted
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0")
    on_time_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    dispute_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    notes: Mapped[str | None] = text_col()


class SubcontractorQualification(UUIDPk, Timestamps, Base):
    __tablename__ = "subcontractor_qualifications"

    subcontractor_id: Mapped[uuid.UUID] = fk("subcontractors.id", nullable=False, ondelete="CASCADE")
    trade: Mapped[str] = str_col(60, nullable=False)
    criteria: Mapped[dict[str, Any]] = json_col(dict)  # références, capacité, sécurité, finances…
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    document_file_ids: Mapped[list[Any]] = json_col(list)
    references: Mapped[list[Any]] = json_col(list)
    decision: Mapped[str] = str_col(20, nullable=False, default="pending")  # pending / approved / rejected
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    comment: Mapped[str | None] = text_col()


class Tender(UUIDPk, Timestamps, SoftDelete, Base):
    """Consultation / appel d'offres multi-lots."""

    __tablename__ = "tenders"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    technical_spec: Mapped[str | None] = text_col()  # cahier technique
    document_version_ids: Mapped[list[Any]] = json_col(list)  # plans et versions exactes
    deadline: Mapped[datetime] = mapped_column(nullable=False)
    start_date_target: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration_days_target: Mapped[int | None] = mapped_column(nullable=True)
    quality_criteria: Mapped[list[Any]] = json_col(list)  # [{"key": "prix", "weight": 50}, …]
    variants_allowed: Mapped[bool] = bool_col(False)
    exclusions: Mapped[str | None] = text_col()
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft", index=True
    )  # draft / published / closed / awarded / cancelled
    published_at: Mapped[datetime | None] = dt_col()
    closed_at: Mapped[datetime | None] = dt_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)

    lots: Mapped[list[TenderLot]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class TenderLot(UUIDPk, Base):
    __tablename__ = "tender_lots"

    tender_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenders.id", ondelete="CASCADE"), index=True)
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    code: Mapped[str] = str_col(30, nullable=False)
    name: Mapped[str] = str_col(200, nullable=False)
    description: Mapped[str | None] = text_col()
    estimated_amount: Mapped[Decimal] = money_col()
    items: Mapped[list[TenderItem]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="TenderItem.sort_order"
    )


class TenderItem(UUIDPk, Base):
    """Ligne de métré / quantitatif."""

    __tablename__ = "tender_items"

    tender_lot_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tender_lots.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = int_col(0)
    code: Mapped[str | None] = str_col(30)
    designation: Mapped[str] = str_col(300, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))


class TenderInvitation(UUIDPk, Base):
    __tablename__ = "tender_invitations"
    __table_args__ = (UniqueConstraint("tender_id", "subcontractor_id"),)

    tender_id: Mapped[uuid.UUID] = fk("tenders.id", nullable=False, ondelete="CASCADE")
    subcontractor_id: Mapped[uuid.UUID] = fk("subcontractors.id", nullable=False, ondelete="CASCADE")
    status: Mapped[str] = str_col(20, nullable=False, default="invited")  # invited / viewed / declined / submitted
    invited_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    viewed_at: Mapped[datetime | None] = dt_col()
    responded_at: Mapped[datetime | None] = dt_col()


class Bid(UUIDPk, Timestamps, Base):
    """Offre (devis) d'un sous-traitant pour un lot."""

    __tablename__ = "bids"
    __table_args__ = (Index("ix_bids_tender_lot", "tender_id", "tender_lot_id"),)

    tender_id: Mapped[uuid.UUID] = fk("tenders.id", nullable=False, ondelete="CASCADE")
    tender_lot_id: Mapped[uuid.UUID] = fk("tender_lots.id", nullable=False, ondelete="CASCADE")
    subcontractor_id: Mapped[uuid.UUID] = fk("subcontractors.id", nullable=False)
    amount: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    duration_days: Mapped[int | None] = mapped_column(nullable=True)
    is_variant: Mapped[bool] = bool_col(False)
    variant_description: Mapped[str | None] = text_col()
    exclusions: Mapped[str | None] = text_col()
    technical_memo_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft"
    )  # draft / submitted / withdrawn / shortlisted / rejected / awarded
    submitted_at: Mapped[datetime | None] = dt_col()
    technical_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    total_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    evaluation: Mapped[dict[str, Any]] = json_col(dict)
    final_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    lines: Mapped[list[BidLine]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class BidLine(UUIDPk, Base):
    __tablename__ = "bid_lines"

    bid_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("bids.id", ondelete="CASCADE"), index=True)
    tender_item_id: Mapped[uuid.UUID | None] = fk("tender_items.id")
    designation: Mapped[str] = str_col(300, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    unit_price: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()


class BidNegotiation(UUIDPk, Base):
    __tablename__ = "bid_negotiations"

    bid_id: Mapped[uuid.UUID] = fk("bids.id", nullable=False, ondelete="CASCADE")
    round: Mapped[int] = int_col(1)
    proposed_by: Mapped[str] = str_col(20, nullable=False)  # globus / subcontractor
    amount: Mapped[Decimal] = money_col()
    duration_days: Mapped[int | None] = mapped_column(nullable=True)
    comment: Mapped[str | None] = text_col()
    author_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    status: Mapped[str] = str_col(20, nullable=False, default="proposed")  # proposed / accepted / rejected / countered


class Subcontract(UUIDPk, Timestamps, SoftDelete, Base):
    """Marché / contrat de sous-traitance."""

    __tablename__ = "subcontracts"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    tender_id: Mapped[uuid.UUID | None] = fk("tenders.id")
    bid_id: Mapped[uuid.UUID | None] = fk("bids.id")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    subcontractor_id: Mapped[uuid.UUID] = fk("subcontractors.id", nullable=False)
    title: Mapped[str] = str_col(250, nullable=False)
    amount: Mapped[Decimal] = money_col()  # HT
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    retention_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("5"), server_default="5"
    )
    advance_amount: Mapped[Decimal] = money_col()
    advance_recovery_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    penalty_per_day: Mapped[Decimal] = money_col()
    penalty_cap_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("10"), server_default="10"
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft", index=True
    )  # draft / sent / signed / mobilized / in_progress / completed / closed / terminated
    signed_at: Mapped[datetime | None] = dt_col()
    signed_by_name: Mapped[str | None] = str_col(200)
    document_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    terms: Mapped[str | None] = text_col()
    closed_at: Mapped[datetime | None] = dt_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)

    items: Mapped[list[SubcontractItem]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="SubcontractItem.sort_order"
    )


class SubcontractItem(UUIDPk, Base):
    __tablename__ = "subcontract_items"

    subcontract_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("subcontracts.id", ondelete="CASCADE"), index=True
    )
    sort_order: Mapped[int] = int_col(0)
    code: Mapped[str | None] = str_col(30)
    designation: Mapped[str] = str_col(300, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    unit_price: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()


class Mobilization(UUIDPk, Timestamps, Base):
    __tablename__ = "subcontract_mobilizations"

    subcontract_id: Mapped[uuid.UUID] = fk("subcontracts.id", nullable=False, ondelete="CASCADE")
    mobilization_date: Mapped[date] = mapped_column(Date, nullable=False)
    team_size: Mapped[int] = int_col(0)
    supervisor_name: Mapped[str | None] = str_col(200)
    equipment: Mapped[str | None] = text_col()
    site_access_granted: Mapped[bool] = bool_col(False)
    safety_induction_done: Mapped[bool] = bool_col(False)
    notes: Mapped[str | None] = text_col()


class Situation(UUIDPk, Timestamps, Versioned, Base):
    """Situation de travaux (état d'avancement facturable)."""

    __tablename__ = "situations"
    __table_args__ = (UniqueConstraint("subcontract_id", "sequence"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    subcontract_id: Mapped[uuid.UUID] = fk("subcontracts.id", nullable=False)
    sequence: Mapped[int] = int_col(1)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft", index=True
    )  # draft / submitted / field_checked / validated / rejected / invoiced / paid / disputed
    cumulative_amount: Mapped[Decimal] = money_col()  # montant brut cumulé
    previous_cumulative_amount: Mapped[Decimal] = money_col()
    gross_amount: Mapped[Decimal] = money_col()  # montant brut de la période
    advance_recovered: Mapped[Decimal] = money_col()
    retention_amount: Mapped[Decimal] = money_col()
    penalties: Mapped[Decimal] = money_col()
    net_amount: Mapped[Decimal] = money_col()
    exceeds_contract: Mapped[bool] = bool_col(False)
    derogation_granted: Mapped[bool] = bool_col(False)
    derogation_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    derogation_reason: Mapped[str | None] = text_col()
    field_check_notes: Mapped[str | None] = text_col()
    field_checked_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    field_checked_at: Mapped[datetime | None] = dt_col()
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    rejection_reason: Mapped[str | None] = text_col()
    photo_file_ids: Mapped[list[Any]] = json_col(list)
    submitted_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    submitted_at: Mapped[datetime | None] = dt_col()

    lines: Mapped[list[SituationLine]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class SituationLine(UUIDPk, Base):
    __tablename__ = "situation_lines"

    situation_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("situations.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[uuid.UUID] = fk("subcontract_items.id", nullable=False)
    previous_quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    period_quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    cumulative_quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    checked_quantity: Mapped[Decimal | None] = mapped_column(Quantity, nullable=True)  # constat terrain
    progress_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("0"))
    amount: Mapped[Decimal] = money_col()  # montant période
    cumulative_amount: Mapped[Decimal] = money_col()
    remaining_quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))


class SubcontractorInvoice(UUIDPk, Timestamps, Base):
    __tablename__ = "subcontractor_invoices"
    __table_args__ = (UniqueConstraint("subcontractor_id", "reference"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    reference: Mapped[str] = str_col(80, nullable=False)
    subcontractor_id: Mapped[uuid.UUID] = fk("subcontractors.id", nullable=False)
    subcontract_id: Mapped[uuid.UUID] = fk("subcontracts.id", nullable=False)
    situation_id: Mapped[uuid.UUID | None] = fk("situations.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    kind: Mapped[str] = str_col(20, nullable=False, default="situation")  # situation / advance / retention_release
    amount_ht: Mapped[Decimal] = money_col()
    tax_amount: Mapped[Decimal] = money_col()
    amount: Mapped[Decimal] = money_col()  # net à payer TTC
    amount_paid: Mapped[Decimal] = money_col()
    amount_credited: Mapped[Decimal] = money_col()  # montant refusé après décision de litige
    amount_frozen: Mapped[Decimal] = money_col()  # gelé par un litige
    status: Mapped[str] = str_col(
        20, nullable=False, default="received", index=True
    )  # received / validated / approved_for_payment / partially_paid / paid / disputed / rejected
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    source: Mapped[str] = str_col(20, nullable=False, default="extranet")  # extranet / manual / system
    rejection_reason: Mapped[str | None] = text_col()
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()


class Retention(UUIDPk, Timestamps, Base):
    """Retenue de garantie par marché."""

    __tablename__ = "retentions"

    subcontract_id: Mapped[uuid.UUID] = fk("subcontracts.id", nullable=False, ondelete="CASCADE", index=True)
    amount_retained: Mapped[Decimal] = money_col()
    amount_released: Mapped[Decimal] = money_col()
    release_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = str_col(20, nullable=False, default="held")  # held / partially_released / released / frozen
    bank_guarantee_ref: Mapped[str | None] = str_col(120)
    notes: Mapped[str | None] = text_col()


class Claim(UUIDPk, Timestamps, Base):
    """Réclamation d'un partenaire (préalable possible à un litige)."""

    __tablename__ = "claims"

    subcontract_id: Mapped[uuid.UUID | None] = fk("subcontracts.id")
    subcontractor_id: Mapped[uuid.UUID | None] = fk("subcontractors.id")
    supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    amount: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(
        20, nullable=False, default="submitted"
    )  # submitted / accepted / rejected / escalated
    response: Mapped[str | None] = text_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class Dispute(UUIDPk, Timestamps, Base):
    """Litige : statut, preuves, chronologie (V4-SUB-16)."""

    __tablename__ = "disputes"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    party_type: Mapped[str] = str_col(20, nullable=False)  # subcontractor / supplier / client
    party_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    party_label: Mapped[str | None] = str_col(250)
    related_type: Mapped[str | None] = str_col(
        40
    )  # situation / subcontractor_invoice / supplier_invoice / purchase_order / goods_receipt / subcontract
    related_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    amount_disputed: Mapped[Decimal] = money_col()
    amount_frozen: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(20, nullable=False, default="OUVERT", index=True)
    owner_id: Mapped[uuid.UUID | None] = fk("users.id")
    escalation_level: Mapped[int] = int_col(0)
    escalated_to: Mapped[str | None] = str_col(40)  # direction / juridique
    decision_summary: Mapped[str | None] = text_col()
    amount_accepted: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    amount_refused: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    resolved_at: Mapped[datetime | None] = dt_col()
    opened_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    opened_by_party: Mapped[bool] = bool_col(False)


class DisputeEvent(UUIDPk, Base):
    """Chronologie : changements de statut, propositions, contre-propositions, accords, preuves."""

    __tablename__ = "dispute_events"

    dispute_id: Mapped[uuid.UUID] = fk("disputes.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(
        20, nullable=False
    )  # status / proposal / counter_proposal / agreement / comment / evidence / decision / escalation
    from_status: Mapped[str | None] = str_col(20)
    to_status: Mapped[str | None] = str_col(20)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    content: Mapped[str | None] = text_col()
    file_ids: Mapped[list[Any]] = json_col(list)
    author_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    author_side: Mapped[str] = str_col(20, nullable=False, default="globus")  # globus / party
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class SubcontractorRating(UUIDPk, Base):
    __tablename__ = "subcontractor_ratings"

    subcontractor_id: Mapped[uuid.UUID] = fk("subcontractors.id", nullable=False, ondelete="CASCADE")
    subcontract_id: Mapped[uuid.UUID | None] = fk("subcontracts.id")
    quality: Mapped[int] = int_col(3)
    delay: Mapped[int] = int_col(3)
    safety: Mapped[int] = int_col(3)
    cleanliness: Mapped[int] = int_col(3)
    compliance: Mapped[int] = int_col(3)
    cooperation: Mapped[int] = int_col(3)
    comment: Mapped[str | None] = text_col()
    rated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())

    @property
    def average(self) -> float:
        values = [self.quality, self.delay, self.safety, self.cleanliness, self.compliance, self.cooperation]
        return round(sum(values) / len(values), 2)


__all__ = [
    "DISPUTE_STATUSES",
    "Bid",
    "BidLine",
    "BidNegotiation",
    "Claim",
    "Dispute",
    "DisputeEvent",
    "Mobilization",
    "Retention",
    "Situation",
    "SituationLine",
    "Subcontract",
    "SubcontractItem",
    "Subcontractor",
    "SubcontractorInvoice",
    "SubcontractorQualification",
    "SubcontractorRating",
    "Tender",
    "TenderInvitation",
    "TenderItem",
    "TenderLot",
]
