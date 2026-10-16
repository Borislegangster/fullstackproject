"""Fournisseurs : fiche complète, contacts, catalogue, tarifs historisés, documents, notation, incidents (§8)."""

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


class Supplier(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "suppliers"

    organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")  # organisation extranet
    code: Mapped[str] = str_col(30, nullable=False, unique=True)
    legal_name: Mapped[str] = str_col(250, nullable=False, index=True)
    trade_name: Mapped[str | None] = str_col(250)
    legal_form: Mapped[str | None] = str_col(60)
    tax_id: Mapped[str | None] = str_col(60)
    trade_register: Mapped[str | None] = str_col(80)
    address: Mapped[str | None] = mapped_column(nullable=True)
    city: Mapped[str | None] = str_col(120)
    country: Mapped[str | None] = str_col(80, default="Cameroun")
    categories: Mapped[list[Any]] = json_col(list)
    delivery_zones: Mapped[list[Any]] = json_col(list)
    payment_terms: Mapped[str | None] = str_col(120)  # ex. « 30 jours fin de mois »
    payment_terms_days: Mapped[int] = int_col(30)
    min_order_amount: Mapped[Decimal] = money_col()
    lead_time_days: Mapped[int] = int_col(7)
    email: Mapped[str | None] = str_col(254)
    phone: Mapped[str | None] = str_col(40)
    sms_number: Mapped[str | None] = str_col(40)
    whatsapp_number: Mapped[str | None] = str_col(40)
    whatsapp_opt_in: Mapped[bool] = bool_col(False)
    preferred_channel: Mapped[str] = str_col(20, nullable=False, default="whatsapp")  # whatsapp / email / sms
    bank_name: Mapped[str | None] = str_col(150)
    bank_account: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    mobile_money_number: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    status: Mapped[str] = str_col(20, nullable=False, default="active")  # pending / active / suspended / blacklisted
    quality_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    service_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    error_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0")
    on_time_rate: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    avg_delay_days: Mapped[Decimal] = mapped_column(
        Numeric(7, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    notes: Mapped[str | None] = text_col()

    contacts: Mapped[list[SupplierContact]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class SupplierContact(UUIDPk, Base):
    __tablename__ = "supplier_contacts"

    supplier_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("suppliers.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = str_col(20, nullable=False, default="commercial")  # commercial / logistique / facturation
    name: Mapped[str] = str_col(200, nullable=False)
    email: Mapped[str | None] = str_col(254)
    phone: Mapped[str | None] = str_col(40)
    whatsapp: Mapped[str | None] = str_col(40)
    is_primary: Mapped[bool] = bool_col(False)


class SupplierProduct(UUIDPk, Timestamps, Base):
    """Catalogue produit fournisseur (références, unités, tarifs négociés)."""

    __tablename__ = "supplier_products"
    __table_args__ = (UniqueConstraint("supplier_id", "reference"),)

    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False, ondelete="CASCADE")
    stock_item_id: Mapped[uuid.UUID | None] = fk("stock_items.id")
    reference: Mapped[str] = str_col(80, nullable=False)
    name: Mapped[str] = str_col(250, nullable=False, index=True)
    category: Mapped[str | None] = str_col(80)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    unit_price: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    min_quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    lead_time_days: Mapped[int | None] = mapped_column(nullable=True)
    stock_available: Mapped[Decimal | None] = mapped_column(Quantity, nullable=True)
    price_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = bool_col(True)


class SupplierPriceHistory(UUIDPk, Base):
    __tablename__ = "supplier_price_history"

    product_id: Mapped[uuid.UUID] = fk("supplier_products.id", nullable=False, ondelete="CASCADE")
    unit_price: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = str_col(20, nullable=False, default="negotiation")  # negotiation / quote / invoice / po
    reference: Mapped[str | None] = str_col(80)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class SupplierDocument(UUIDPk, Timestamps, Base):
    __tablename__ = "supplier_documents"

    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(40, nullable=False)  # rccm / niu / attestation_fiscale / certification / assurance
    title: Mapped[str] = str_col(250, nullable=False)
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    verified: Mapped[bool] = bool_col(False)
    verified_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class SupplierRating(UUIDPk, Base):
    __tablename__ = "supplier_ratings"

    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False, ondelete="CASCADE")
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")
    goods_receipt_id: Mapped[uuid.UUID | None] = fk("goods_receipts.id")
    quality: Mapped[int] = int_col(3)
    timeliness: Mapped[int] = int_col(3)
    compliance: Mapped[int] = int_col(3)
    communication: Mapped[int] = int_col(3)
    comment: Mapped[str | None] = text_col()
    rated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())

    @property
    def average(self) -> float:
        return round((self.quality + self.timeliness + self.compliance + self.communication) / 4, 2)


class SupplierIncident(UUIDPk, Timestamps, Base):
    __tablename__ = "supplier_incidents"

    supplier_id: Mapped[uuid.UUID] = fk("suppliers.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(
        30, nullable=False
    )  # late / damaged / wrong_product / missing / price / invoice / return
    purchase_order_id: Mapped[uuid.UUID | None] = fk("purchase_orders.id")
    goods_receipt_id: Mapped[uuid.UUID | None] = fk("goods_receipts.id")
    description: Mapped[str | None] = text_col()
    amount_impact: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(20, nullable=False, default="open")
    resolution: Mapped[str | None] = text_col()
    resolved_at: Mapped[datetime | None] = dt_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


__all__ = [
    "Supplier",
    "SupplierContact",
    "SupplierDocument",
    "SupplierIncident",
    "SupplierPriceHistory",
    "SupplierProduct",
    "SupplierRating",
]
