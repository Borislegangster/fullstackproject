"""Achats : demandes d'achat, matrice d'approbation, approbations, bons de commande, échanges fournisseur,
livraisons, réceptions (GRN), retours (§8.1 workflow complet, §8.2 exceptions)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Float, ForeignKey, Index, Numeric, Uuid, func
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
from app.core.utils import utcnow

PR_STATUSES = ("draft", "submitted", "approved", "rejected", "ordered", "cancelled")
PO_STATUSES = (
    "draft",
    "pending_approval",
    "approved",
    "sent",
    "confirmed",
    "refused",
    "countered",
    "shipped",
    "partially_received",
    "received",
    "invoiced",
    "closed",
    "cancelled",
)


class ApprovalRule(UUIDPk, Timestamps, Base):
    """Matrice d'approbation selon montant, centre de coût, catégorie et rôle."""

    __tablename__ = "approval_rules"

    entity: Mapped[str] = str_col(
        30, nullable=False, default="purchase_request"
    )  # purchase_request / purchase_order / payment / budget
    name: Mapped[str] = str_col(150, nullable=False)
    min_amount: Mapped[Decimal] = money_col()
    max_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    category: Mapped[str | None] = str_col(80)
    cost_center: Mapped[str | None] = str_col(80)
    urgent_only: Mapped[bool] = bool_col(False)
    level: Mapped[int] = int_col(1)
    approver_role: Mapped[str] = str_col(60, nullable=False)
    is_active: Mapped[bool] = bool_col(True)


class Approval(UUIDPk, Base):
    """Étape d'approbation générique (DA, BC, paiement, budget, document…)."""

    __tablename__ = "approvals"
    __table_args__ = (Index("ix_approvals_entity", "entity_type", "entity_id"),)

    entity_type: Mapped[str] = str_col(40, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    level: Mapped[int] = int_col(1)
    approver_role: Mapped[str | None] = str_col(60, index=True)
    approver_id: Mapped[uuid.UUID | None] = fk("users.id")
    status: Mapped[str] = str_col(
        20, nullable=False, default="pending", index=True
    )  # pending / approved / rejected / skipped
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    comment: Mapped[str | None] = text_col()
    amount: Mapped[Decimal] = money_col()
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class PurchaseRequest(UUIDPk, Timestamps, SoftDelete, Versioned, Base):
    __tablename__ = "purchase_requests"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    zone: Mapped[str | None] = str_col(120)
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    requested_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    category: Mapped[str | None] = str_col(80)
    cost_center: Mapped[str | None] = str_col(80)
    urgency: Mapped[str] = str_col(20, nullable=False, default="normal")  # normal / urgent / critical
    justification: Mapped[str | None] = text_col()
    needed_by: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_estimated: Mapped[Decimal] = money_col()
    budget_line_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    status: Mapped[str] = str_col(20, nullable=False, default="draft", index=True)
    submitted_at: Mapped[datetime | None] = dt_col()
    approved_at: Mapped[datetime | None] = dt_col()
    rejected_reason: Mapped[str | None] = text_col()
    source: Mapped[str] = str_col(20, nullable=False, default="web")

    lines: Mapped[list[PurchaseRequestLine]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class PurchaseRequestLine(UUIDPk, Base):
    __tablename__ = "purchase_request_lines"

    request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("purchase_requests.id", ondelete="CASCADE"), index=True
    )
    stock_item_id: Mapped[uuid.UUID | None] = fk("stock_items.id")
    supplier_product_id: Mapped[uuid.UUID | None] = fk("supplier_products.id")
    description: Mapped[str] = str_col(300, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    estimated_unit_price: Mapped[Decimal] = money_col()
    notes: Mapped[str | None] = text_col()


class PurchaseOrder(UUIDPk, Timestamps, SoftDelete, Versioned, Base):
    __tablename__ = "purchase_orders"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    request_id: Mapped[uuid.UUID | None] = fk("purchase_requests.id")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False)
    status: Mapped[str] = str_col(20, nullable=False, default="draft", index=True)
    urgent: Mapped[bool] = bool_col(False)
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    subtotal: Mapped[Decimal] = money_col()
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), nullable=False, default=Decimal("19.25"), server_default="19.25"
    )
    tax_amount: Mapped[Decimal] = money_col()
    total: Mapped[Decimal] = money_col()
    payment_terms: Mapped[str | None] = str_col(120)
    delivery_address: Mapped[str | None] = text_col()
    expected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = text_col()
    selection_reason: Mapped[dict[str, Any]] = json_col(dict)  # score prix/délai/qualité/stock/zone
    sent_channel: Mapped[str | None] = str_col(20)
    sent_at: Mapped[datetime | None] = dt_col()
    supplier_viewed_at: Mapped[datetime | None] = dt_col()
    supplier_confirmed_at: Mapped[datetime | None] = dt_col()
    supplier_response: Mapped[str | None] = str_col(20)  # confirmed / refused / countered
    supplier_response_note: Mapped[str | None] = text_col()
    counter_offer: Mapped[dict[str, Any]] = json_col(dict)
    eta: Mapped[datetime | None] = dt_col()
    carrier: Mapped[str | None] = str_col(150)
    tracking_ref: Mapped[str | None] = str_col(150)
    portal_token_hash: Mapped[str | None] = str_col(64, index=True)
    portal_token_expires_at: Mapped[datetime | None] = dt_col()
    approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_at: Mapped[datetime | None] = dt_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    closed_at: Mapped[datetime | None] = dt_col()
    pdf_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")

    lines: Mapped[list[PurchaseOrderLine]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="PurchaseOrderLine.sort_order"
    )


class PurchaseOrderLine(UUIDPk, Base):
    __tablename__ = "purchase_order_lines"

    order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True)
    sort_order: Mapped[int] = int_col(0)
    supplier_product_id: Mapped[uuid.UUID | None] = fk("supplier_products.id")
    stock_item_id: Mapped[uuid.UUID | None] = fk("stock_items.id")
    reference: Mapped[str | None] = str_col(80)
    description: Mapped[str] = str_col(300, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    unit_price: Mapped[Decimal] = money_col()
    tax_rate: Mapped[Decimal] = mapped_column(
        Numeric(6, 3), nullable=False, default=Decimal("19.25"), server_default="19.25"
    )
    total: Mapped[Decimal] = money_col()
    quantity_received: Mapped[Decimal] = mapped_column(
        Quantity, nullable=False, default=Decimal("0"), server_default="0"
    )
    quantity_accepted: Mapped[Decimal] = mapped_column(
        Quantity, nullable=False, default=Decimal("0"), server_default="0"
    )
    quantity_invoiced: Mapped[Decimal] = mapped_column(
        Quantity, nullable=False, default=Decimal("0"), server_default="0"
    )
    quantity_returned: Mapped[Decimal] = mapped_column(
        Quantity, nullable=False, default=Decimal("0"), server_default="0"
    )


class SupplierMessage(UUIDPk, Base):
    """Traçabilité des échanges fournisseur (WhatsApp Business / e-mail / SMS) — jamais un téléphone personnel."""

    __tablename__ = "supplier_messages"

    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False, ondelete="CASCADE")
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")
    channel: Mapped[str] = str_col(20, nullable=False)  # whatsapp / email / sms / portal
    direction: Mapped[str] = str_col(5, nullable=False, default="out")
    recipient: Mapped[str | None] = str_col(254)
    content: Mapped[str | None] = text_col()
    template: Mapped[str | None] = str_col(120)
    provider: Mapped[str | None] = str_col(40)
    provider_message_id: Mapped[str | None] = str_col(200, index=True)
    status: Mapped[str] = str_col(20, nullable=False, default="queued")  # queued / sent / delivered / read / failed
    error: Mapped[str | None] = text_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    status_at: Mapped[datetime | None] = dt_col()


class Delivery(UUIDPk, Timestamps, Base):
    """Expédition annoncée par le fournisseur (ETA, transporteur)."""

    __tablename__ = "deliveries"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")
    supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    status: Mapped[str] = str_col(20, nullable=False, default="announced", index=True)
    shipped_at: Mapped[datetime | None] = dt_col()
    eta: Mapped[datetime | None] = dt_col(index=True)
    arrived_at: Mapped[datetime | None] = dt_col()
    carrier: Mapped[str | None] = str_col(150)
    vehicle_plate: Mapped[str | None] = str_col(30)
    driver_name: Mapped[str | None] = str_col(150)
    driver_phone: Mapped[str | None] = str_col(40)
    tracking_ref: Mapped[str | None] = str_col(150)
    delivery_note_ref: Mapped[str | None] = str_col(80)  # n° BL
    notes: Mapped[str | None] = text_col()
    announced_by: Mapped[str] = str_col(20, nullable=False, default="supplier")  # supplier / internal


class GoodsReceipt(UUIDPk, Timestamps, Versioned, Base):
    """Bon de réception (GRN) : quantités, qualité, lot, photos, BL, livreur, véhicule, heure, géolocalisation."""

    __tablename__ = "goods_receipts"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    delivery_id: Mapped[uuid.UUID | None] = fk("deliveries.id")
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")  # null = livraison sans PO (exception)
    supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    warehouse_id: Mapped[uuid.UUID | None] = fk("warehouses.id")
    destination: Mapped[str] = str_col(20, nullable=False, default="stock")  # stock / site_allocation
    received_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    received_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    driver_name: Mapped[str | None] = str_col(150)
    vehicle_plate: Mapped[str | None] = str_col(30)
    delivery_note_ref: Mapped[str | None] = str_col(80)
    status: Mapped[str] = str_col(20, nullable=False, default="draft", index=True)  # draft / validated / disputed
    has_exceptions: Mapped[bool] = bool_col(False)
    exceptions: Mapped[list[Any]] = json_col(list)
    notes: Mapped[str | None] = text_col()
    photo_file_ids: Mapped[list[Any]] = json_col(list)
    delivery_note_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    invoice_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    signature_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    source: Mapped[str] = str_col(20, nullable=False, default="web")  # web / mobile / offline / qr

    lines: Mapped[list[GoodsReceiptLine]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class GoodsReceiptLine(UUIDPk, Base):
    __tablename__ = "goods_receipt_lines"

    receipt_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("goods_receipts.id", ondelete="CASCADE"), index=True)
    po_line_id: Mapped[uuid.UUID | None] = fk("purchase_order_lines.id")
    stock_item_id: Mapped[uuid.UUID | None] = fk("stock_items.id")
    description: Mapped[str] = str_col(300, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    quantity_ordered: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    quantity_received: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    quantity_accepted: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    quantity_rejected: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    rejection_reason: Mapped[str | None] = str_col(30)  # damaged / different / missing / excess / quality
    condition_notes: Mapped[str | None] = text_col()
    batch_number: Mapped[str | None] = str_col(80)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    unit_price: Mapped[Decimal] = money_col()
    is_substitution: Mapped[bool] = bool_col(False)
    substitution_status: Mapped[str | None] = str_col(20)  # pending / approved / rejected
    substitution_approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class SupplierReturn(UUIDPk, Timestamps, Base):
    __tablename__ = "supplier_returns"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False)
    goods_receipt_id: Mapped[uuid.UUID | None] = fk("goods_receipts.id")
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")
    reason: Mapped[str] = str_col(30, nullable=False)
    lines: Mapped[list[Any]] = json_col(list)
    amount: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(20, nullable=False, default="requested")  # requested / shipped / credited / closed
    credit_note_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


__all__ = [
    "PO_STATUSES",
    "PR_STATUSES",
    "Approval",
    "ApprovalRule",
    "Delivery",
    "GoodsReceipt",
    "GoodsReceiptLine",
    "PurchaseOrder",
    "PurchaseOrderLine",
    "PurchaseRequest",
    "PurchaseRequestLine",
    "SupplierMessage",
    "SupplierReturn",
]
