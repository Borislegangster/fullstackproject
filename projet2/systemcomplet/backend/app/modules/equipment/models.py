"""Matériel : parc, affectation chantier, état, maintenance préventive/corrective, documents, incidents,
coût d'utilisation, localisation selon politique, consommables (§17.2)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Float, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import (
    Base,
    SoftDelete,
    Timestamps,
    UUIDPk,
    bool_col,
    dt_col,
    fk,
    json_col,
    money_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class Equipment(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "equipment"

    code: Mapped[str] = str_col(40, nullable=False, unique=True)
    name: Mapped[str] = str_col(200, nullable=False, index=True)
    category: Mapped[str] = str_col(
        40, nullable=False, default="outillage"
    )  # engin / vehicule / outillage / echafaudage / topographie / informatique
    brand: Mapped[str | None] = str_col(100)
    model: Mapped[str | None] = str_col(100)
    serial_number: Mapped[str | None] = str_col(100)
    registration: Mapped[str | None] = str_col(40)
    acquisition_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    acquisition_cost: Mapped[Decimal] = money_col()
    ownership: Mapped[str] = str_col(20, nullable=False, default="owned")  # owned / rented / leased
    rental_supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    status: Mapped[str] = str_col(
        20, nullable=False, default="available", index=True
    )  # available / assigned / maintenance / broken / retired
    condition: Mapped[str] = str_col(20, nullable=False, default="good")  # new / good / fair / poor
    current_project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    current_site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    hourly_cost: Mapped[Decimal] = money_col()
    daily_cost: Mapped[Decimal] = money_col()
    meter_hours: Mapped[Decimal] = mapped_column(
        Numeric(12, 1), nullable=False, default=Decimal("0"), server_default="0"
    )
    meter_km: Mapped[Decimal] = mapped_column(Numeric(12, 1), nullable=False, default=Decimal("0"), server_default="0")
    tracker_id: Mapped[str | None] = str_col(100)
    location_tracking: Mapped[bool] = bool_col(False)  # selon politique
    last_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_located_at: Mapped[datetime | None] = dt_col()
    insurance_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    inspection_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    qr_token: Mapped[str | None] = str_col(64, unique=True)
    photo_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    document_ids: Mapped[list[Any]] = json_col(list)
    notes: Mapped[str | None] = text_col()


class EquipmentAssignment(UUIDPk, Timestamps, Base):
    __tablename__ = "equipment_assignments"

    equipment_id: Mapped[uuid.UUID] = fk("equipment.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    operator_id: Mapped[uuid.UUID | None] = fk("users.id")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    returned_at: Mapped[datetime | None] = dt_col()
    status: Mapped[str] = str_col(20, nullable=False, default="active")  # planned / active / returned
    assigned_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    notes: Mapped[str | None] = text_col()


class MaintenancePlan(UUIDPk, Timestamps, Base):
    __tablename__ = "maintenance_plans"

    equipment_id: Mapped[uuid.UUID] = fk("equipment.id", nullable=False, ondelete="CASCADE")
    title: Mapped[str] = str_col(200, nullable=False)
    interval_days: Mapped[int | None] = mapped_column(nullable=True)
    interval_hours: Mapped[int | None] = mapped_column(nullable=True)
    last_done_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_done_hours: Mapped[Decimal | None] = mapped_column(Numeric(12, 1), nullable=True)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    is_active: Mapped[bool] = bool_col(True)


class MaintenanceOrder(UUIDPk, Timestamps, Base):
    __tablename__ = "maintenance_orders"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    equipment_id: Mapped[uuid.UUID] = fk("equipment.id", nullable=False, ondelete="CASCADE")
    plan_id: Mapped[uuid.UUID | None] = fk("maintenance_plans.id")
    kind: Mapped[str] = str_col(20, nullable=False, default="preventive")  # preventive / corrective
    description: Mapped[str | None] = text_col()
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    done_at: Mapped[datetime | None] = dt_col()
    cost: Mapped[Decimal] = money_col()
    vendor: Mapped[str | None] = str_col(200)
    technician_id: Mapped[uuid.UUID | None] = fk("users.id")
    status: Mapped[str] = str_col(20, nullable=False, default="planned")  # planned / in_progress / done / cancelled
    downtime_hours: Mapped[Decimal] = mapped_column(
        Numeric(8, 1), nullable=False, default=Decimal("0"), server_default="0"
    )
    report: Mapped[str | None] = text_col()


class EquipmentIncident(UUIDPk, Timestamps, Base):
    __tablename__ = "equipment_incidents"

    equipment_id: Mapped[uuid.UUID] = fk("equipment.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    kind: Mapped[str] = str_col(20, nullable=False, default="breakdown")  # breakdown / damage / theft / accident
    occurred_at: Mapped[datetime] = mapped_column(nullable=False)
    severity: Mapped[str] = str_col(10, nullable=False, default="medium")
    description: Mapped[str | None] = text_col()
    photo_file_ids: Mapped[list[Any]] = json_col(list)
    status: Mapped[str] = str_col(20, nullable=False, default="open")
    reported_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    cost: Mapped[Decimal] = money_col()


class EquipmentUsage(UUIDPk, Base):
    """Relevés d'utilisation → coût d'utilisation imputé au projet."""

    __tablename__ = "equipment_usage"

    equipment_id: Mapped[uuid.UUID] = fk("equipment.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    usage_date: Mapped[date] = mapped_column(Date, nullable=False)
    hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("0"))
    km: Mapped[Decimal] = mapped_column(Numeric(10, 1), nullable=False, default=Decimal("0"))
    fuel_liters: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0"))
    fuel_cost: Mapped[Decimal] = money_col()
    operator_id: Mapped[uuid.UUID | None] = fk("users.id")
    cost: Mapped[Decimal] = money_col()
    notes: Mapped[str | None] = str_col(300)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class EquipmentConsumable(UUIDPk, Base):
    __tablename__ = "equipment_consumables"

    equipment_id: Mapped[uuid.UUID] = fk("equipment.id", nullable=False, ondelete="CASCADE")
    stock_item_id: Mapped[uuid.UUID | None] = fk("stock_items.id")
    name: Mapped[str] = str_col(200, nullable=False)
    replacement_interval_hours: Mapped[int | None] = mapped_column(nullable=True)
    last_replaced_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    quantity_per_replacement: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("1"))
    unit: Mapped[str] = str_col(20, nullable=False, default="u")
    notes: Mapped[str | None] = str_col(300)


__all__ = [
    "Equipment",
    "EquipmentAssignment",
    "EquipmentConsumable",
    "EquipmentIncident",
    "EquipmentUsage",
    "MaintenanceOrder",
    "MaintenancePlan",
]
