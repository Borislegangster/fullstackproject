"""Facturation : factures clients, avoirs, factures fournisseurs, rapprochement 3 pièces (PO/GRN/facture)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, ForeignKey, Numeric, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    Quantity,
    SoftDelete,
    Timestamps,
    UUIDPk,
    dt_col,
    fk,
    int_col,
    json_col,
    money_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class ClientInvoice(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "client_invoices"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    contract_id: Mapped[uuid.UUID | None] = fk("contracts.id")
    kind: Mapped[str] = str_col(20, nullable=False, default="invoice")  # invoice / deposit / progress / final / studies
    title: Mapped[str] = str_col(250, nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[Decimal] = money_col()
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), nullable=False, default=Decimal("19.25"), server_default="19.25"
    )
    tax_amount: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()
    amount_paid: Mapped[Decimal] = money_col()
    amount_credited: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft", index=True
    )  # draft / validated / sent / partially_paid / paid / overdue / cancelled / credited
    sent_at: Mapped[datetime | None] = dt_col()
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    pdf_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    authenticity_token: Mapped[str | None] = str_col(64, unique=True)
    notes: Mapped[str | None] = text_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)

    lines: Mapped[list[ClientInvoiceLine]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ClientInvoiceLine.sort_order"
    )

    @property
    def balance_due(self) -> Decimal:
        return (
            (self.total or Decimal("0")) - (self.amount_paid or Decimal("0")) - (self.amount_credited or Decimal("0"))
        )


class ClientInvoiceLine(UUIDPk, Base):
    __tablename__ = "client_invoice_lines"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("client_invoices.id", ondelete="CASCADE"), index=True
    )
    sort_order: Mapped[int] = int_col(0)
    designation: Mapped[str] = str_col(300, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()


class CreditNote(UUIDPk, Timestamps, Base):
    """Avoir (client ou fournisseur)."""

    __tablename__ = "credit_notes"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    side: Mapped[str] = str_col(10, nullable=False)  # client / supplier
    client_invoice_id: Mapped[uuid.UUID | None] = fk("client_invoices.id")
    supplier_invoice_id: Mapped[uuid.UUID | None] = fk("supplier_invoices.id")
    supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    supplier_reference: Mapped[str | None] = str_col(80)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    amount: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    reason: Mapped[str] = text_col(nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = str_col(20, nullable=False, default="issued")  # issued / applied / cancelled
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class SupplierInvoice(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "supplier_invoices"
    __table_args__ = (UniqueConstraint("supplier_id", "supplier_reference"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)  # référence interne
    supplier_reference: Mapped[str] = str_col(80, nullable=False)  # n° de facture du fournisseur
    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False)
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    subtotal: Mapped[Decimal] = money_col()
    tax_amount: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()
    amount_paid: Mapped[Decimal] = money_col()
    amount_credited: Mapped[Decimal] = money_col()  # avoirs fournisseur imputés
    amount_frozen: Mapped[Decimal] = money_col()  # gelé par un litige
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    status: Mapped[str] = str_col(
        20, nullable=False, default="received", index=True
    )  # received / matching / matched / exception / validated / approved_for_payment / partially_paid / paid / disputed / rejected
    match_status: Mapped[str | None] = str_col(20)
    match_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    ocr_job_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    notes: Mapped[str | None] = text_col()
    source: Mapped[str] = str_col(20, nullable=False, default="manual")  # manual / extranet / ocr / email

    lines: Mapped[list[SupplierInvoiceLine]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class SupplierInvoiceLine(UUIDPk, Base):
    __tablename__ = "supplier_invoice_lines"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("supplier_invoices.id", ondelete="CASCADE"), index=True
    )
    po_line_id: Mapped[uuid.UUID | None] = fk("purchase_order_lines.id")
    description: Mapped[str] = str_col(300, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()


class InvoiceMatch(UUIDPk, Base):
    """Rapprochement 3 pièces : PO / GRN / facture avec tolérances (V4-SUP-13)."""

    __tablename__ = "invoice_matches"

    supplier_invoice_id: Mapped[uuid.UUID] = fk("supplier_invoices.id", nullable=False, ondelete="CASCADE")
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")
    goods_receipt_ids: Mapped[list[Any]] = json_col(list)
    result: Mapped[str] = str_col(20, nullable=False)  # matched / exception
    tolerance_qty_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=Decimal("0"))
    tolerance_price_pct: Mapped[Decimal] = mapped_column(Numeric(6, 3), nullable=False, default=Decimal("0"))
    line_results: Mapped[list[Any]] = json_col(list)
    exceptions: Mapped[list[Any]] = json_col(list)
    po_total: Mapped[Decimal] = money_col()
    received_total: Mapped[Decimal] = money_col()
    invoice_total: Mapped[Decimal] = money_col()
    performed_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    resolved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    resolved_at: Mapped[datetime | None] = dt_col()
    resolution: Mapped[str | None] = text_col()


class PaymentReminder(UUIDPk, Base):
    """Relance d'échéance envoyée (une par pièce et par palier : idempotence des relances automatiques)."""

    __tablename__ = "payment_reminders"
    __table_args__ = (UniqueConstraint("target_type", "target_id", "stage"),)

    target_type: Mapped[str] = str_col(20, nullable=False)  # client_invoice / funds_call
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    stage: Mapped[str] = str_col(20, nullable=False)  # before_3 / after_1 / after_7 / after_15 / after_30 / manual-…
    amount_due: Mapped[Decimal] = money_col()
    sent_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class PayLink(UUIDPk, Timestamps, Base):
    """Lien de paiement « en un clic » (relances e-mail / WhatsApp) : paie une facture, un appel de fonds ou une
    échéance sans connexion ; jeton stocké haché, expirant, révocable (innovation A6)."""

    __tablename__ = "pay_links"

    token_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    target_type: Mapped[str] = str_col(20, nullable=False)  # client_invoice / funds_call
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    plan_id: Mapped[uuid.UUID | None] = fk("payment_plans.id", ondelete="SET NULL")
    installment_index: Mapped[int | None] = mapped_column(nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)  # vide = solde restant dû
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="SET NULL")
    channel: Mapped[str] = str_col(20, nullable=False, default="manual")  # reminder / email / whatsapp / manual
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    revoked_at: Mapped[datetime | None] = dt_col()
    last_used_at: Mapped[datetime | None] = dt_col()
    uses: Mapped[int] = int_col(0)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class PaymentPlan(UUIDPk, Timestamps, Base):
    """Échelonnement d'une facture / d'un appel de fonds : demandé par le client, validé par la finance, accepté
    par le client avec un code à usage unique ; les relances suivent alors les échéances (innovation A6)."""

    __tablename__ = "payment_plans"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    target_type: Mapped[str] = str_col(20, nullable=False)
    target_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="SET NULL")
    total_amount: Mapped[Decimal] = money_col()
    paid_baseline: Mapped[Decimal] = money_col()  # montant déjà réglé à l'activation
    installments: Mapped[list[Any]] = json_col(list)  # [{"index", "due_date", "amount", "status"}]
    status: Mapped[str] = str_col(
        20, nullable=False, default="requested", index=True
    )  # requested / proposed / active / completed / defaulted / rejected / cancelled
    reason: Mapped[str | None] = text_col()
    requested_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    decision_note: Mapped[str | None] = text_col()
    accepted_at: Mapped[datetime | None] = dt_col()
    acceptance_proof: Mapped[dict[str, Any]] = json_col(dict)


__all__ = [
    "ClientInvoice",
    "ClientInvoiceLine",
    "CreditNote",
    "InvoiceMatch",
    "PayLink",
    "PaymentPlan",
    "PaymentReminder",
    "SupplierInvoice",
    "SupplierInvoiceLine",
]
