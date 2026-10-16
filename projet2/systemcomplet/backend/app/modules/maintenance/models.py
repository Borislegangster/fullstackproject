"""Passeport du bâtiment et maintenance (innovation I2) : équipements installés (notices, garanties), carnet
d'entretien planifié et rappels au client, signaux de SAV prédictif."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, int_col, money_col, str_col, text_col


class BuildingEquipment(UUIDPk, Timestamps, Base):
    __tablename__ = "building_equipment"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    category: Mapped[str] = str_col(40, nullable=False)  # climatisation / plomberie / electricite / solaire / toiture…
    name: Mapped[str] = str_col(200, nullable=False)
    brand: Mapped[str | None] = str_col(120)
    model: Mapped[str | None] = str_col(120)
    serial_number: Mapped[str | None] = str_col(120)
    location: Mapped[str | None] = str_col(200)
    installed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    warranty_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    manual_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    maintenance_interval_days: Mapped[int | None] = int_col(None, nullable=True)
    last_service_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = text_col()
    client_visible: Mapped[bool] = bool_col(True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class MaintenanceTask(UUIDPk, Timestamps, Base):
    __tablename__ = "maintenance_tasks"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    equipment_id: Mapped[uuid.UUID | None] = fk("building_equipment.id", ondelete="CASCADE")
    title: Mapped[str] = str_col(200, nullable=False)
    instructions: Mapped[str | None] = text_col()
    due_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    recurrence_days: Mapped[int | None] = int_col(None, nullable=True)
    performer: Mapped[str] = str_col(20, nullable=False, default="client")  # client / technicien
    estimated_cost: Mapped[Decimal] = money_col()
    status: Mapped[str] = str_col(
        20, nullable=False, default="planned", index=True
    )  # planned / done / skipped / booked
    done_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    done_note: Mapped[str | None] = text_col()
    reminded_at: Mapped[datetime | None] = dt_col()
    ticket_id: Mapped[uuid.UUID | None] = fk("tickets.id")


__all__ = ["BuildingEquipment", "MaintenanceTask"]
