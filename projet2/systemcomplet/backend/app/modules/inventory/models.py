"""Stocks : Warehouse, StockItem, StockLevel, StockMovement, Allocation, MaterialBatch, inventaires (§19)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Numeric, UniqueConstraint, Uuid, func
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
    str_col,
    text_col,
)
from app.core.utils import utcnow


class Warehouse(UUIDPk, Timestamps, Base):
    __tablename__ = "warehouses"

    code: Mapped[str] = str_col(30, nullable=False, unique=True)
    name: Mapped[str] = str_col(200, nullable=False)
    kind: Mapped[str] = str_col(20, nullable=False, default="central")  # central / site
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    address: Mapped[str | None] = text_col()
    manager_id: Mapped[uuid.UUID | None] = fk("users.id")
    is_active: Mapped[bool] = bool_col(True)


class StockLocation(UUIDPk, Base):
    __tablename__ = "stock_locations"
    __table_args__ = (UniqueConstraint("warehouse_id", "code"),)

    warehouse_id: Mapped[uuid.UUID] = fk("warehouses.id", nullable=False, ondelete="CASCADE")
    code: Mapped[str] = str_col(40, nullable=False)
    label: Mapped[str | None] = str_col(150)


class StockItem(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "stock_items"

    sku: Mapped[str] = str_col(60, nullable=False, unique=True)
    name: Mapped[str] = str_col(250, nullable=False, index=True)
    category: Mapped[str | None] = str_col(80, index=True)
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    min_threshold: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"), server_default="0")
    reorder_quantity: Mapped[Decimal] = mapped_column(
        Quantity, nullable=False, default=Decimal("0"), server_default="0"
    )
    average_cost: Mapped[Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, default=Decimal("0"), server_default="0"
    )  # CMUP
    preferred_supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    is_consumable: Mapped[bool] = bool_col(True)
    is_active: Mapped[bool] = bool_col(True)
    barcode: Mapped[str | None] = str_col(80, index=True)
    description: Mapped[str | None] = text_col()


class StockLevel(UUIDPk, Base):
    __tablename__ = "stock_levels"
    __table_args__ = (UniqueConstraint("item_id", "warehouse_id", "location_id", "batch_id"),)

    item_id: Mapped[uuid.UUID] = fk("stock_items.id", nullable=False, ondelete="CASCADE")
    warehouse_id: Mapped[uuid.UUID] = fk("warehouses.id", nullable=False, ondelete="CASCADE")
    location_id: Mapped[uuid.UUID | None] = fk("stock_locations.id")
    batch_id: Mapped[uuid.UUID | None] = fk("material_batches.id")
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"), server_default="0")
    reserved: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"), server_default="0")
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now(), onupdate=utcnow)


class MaterialBatch(UUIDPk, Base):
    __tablename__ = "material_batches"

    item_id: Mapped[uuid.UUID] = fk("stock_items.id", nullable=False, ondelete="CASCADE")
    batch_number: Mapped[str] = str_col(80, nullable=False, index=True)
    supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    goods_receipt_id: Mapped[uuid.UUID | None] = fk("goods_receipts.id")
    received_at: Mapped[datetime | None] = dt_col()
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    quantity_initial: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    certificate_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class StockMovement(UUIDPk, Base):
    """Grand livre des mouvements (entrées, sorties, transferts, ajustements, affectations, retours)."""

    __tablename__ = "stock_movements"
    __table_args__ = (Index("ix_stock_movements_item_date", "item_id", "created_at"),)

    item_id: Mapped[uuid.UUID] = fk("stock_items.id", nullable=False)
    kind: Mapped[str] = str_col(20, nullable=False)  # in / out / transfer / adjustment / allocation / return
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    from_warehouse_id: Mapped[uuid.UUID | None] = fk("warehouses.id")
    to_warehouse_id: Mapped[uuid.UUID | None] = fk("warehouses.id")
    location_id: Mapped[uuid.UUID | None] = fk("stock_locations.id")
    batch_id: Mapped[uuid.UUID | None] = fk("material_batches.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    task_id: Mapped[uuid.UUID | None] = fk("tasks.id")
    reference_type: Mapped[str | None] = str_col(40)  # goods_receipt / allocation / inventory_count / return / manual
    reference_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    reason: Mapped[str | None] = text_col()
    performed_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    client_mutation_id: Mapped[str | None] = str_col(80, unique=True)


class StockAllocation(UUIDPk, Timestamps, Base):
    """Affectation d'articles à un chantier / lot / tâche (réservée → sortie → consommée/retournée)."""

    __tablename__ = "stock_allocations"

    item_id: Mapped[uuid.UUID] = fk("stock_items.id", nullable=False)
    warehouse_id: Mapped[uuid.UUID | None] = fk("warehouses.id")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    task_id: Mapped[uuid.UUID | None] = fk("tasks.id")
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False)
    quantity_issued: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"), server_default="0")
    quantity_returned: Mapped[Decimal] = mapped_column(
        Quantity, nullable=False, default=Decimal("0"), server_default="0"
    )
    status: Mapped[str] = str_col(
        20, nullable=False, default="reserved"
    )  # reserved / issued / consumed / returned / cancelled
    goods_receipt_id: Mapped[uuid.UUID | None] = fk("goods_receipts.id")  # affectation directe à la réception
    requested_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))


class InventoryCount(UUIDPk, Timestamps, Base):
    __tablename__ = "inventory_counts"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    warehouse_id: Mapped[uuid.UUID] = fk("warehouses.id", nullable=False)
    status: Mapped[str] = str_col(20, nullable=False, default="in_progress")  # in_progress / validated / cancelled
    counted_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    notes: Mapped[str | None] = text_col()

    lines: Mapped[list[InventoryCountLine]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class InventoryCountLine(UUIDPk, Base):
    __tablename__ = "inventory_count_lines"

    count_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("inventory_counts.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[uuid.UUID] = fk("stock_items.id", nullable=False)
    location_id: Mapped[uuid.UUID | None] = fk("stock_locations.id")
    expected: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("0"))
    counted: Mapped[Decimal | None] = mapped_column(Quantity, nullable=True)
    note: Mapped[str | None] = str_col(250)


__all__ = [
    "InventoryCount",
    "InventoryCountLine",
    "MaterialBatch",
    "StockAllocation",
    "StockItem",
    "StockLevel",
    "StockLocation",
    "StockMovement",
    "Warehouse",
]
