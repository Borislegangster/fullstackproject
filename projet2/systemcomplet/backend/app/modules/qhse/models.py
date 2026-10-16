"""QHSE : EPI, inspections, incidents, photos, quart d'heure sécurité, actions correctives (§17.1)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Float, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import (
    Base,
    Timestamps,
    UUIDPk,
    Versioned,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class PPEItem(UUIDPk, Timestamps, Base):
    """Équipement de protection individuelle (catalogue)."""

    __tablename__ = "ppe_items"

    name: Mapped[str] = str_col(150, nullable=False)
    kind: Mapped[str] = str_col(
        40, nullable=False
    )  # casque / chaussures / gilet / gants / harnais / lunettes / masque / bouchons
    size: Mapped[str | None] = str_col(20)
    stock_item_id: Mapped[uuid.UUID | None] = fk("stock_items.id")
    lifespan_days: Mapped[int | None] = mapped_column(nullable=True)
    norm: Mapped[str | None] = str_col(80)  # ex. EN 397
    is_active: Mapped[bool] = bool_col(True)


class PPEDistribution(UUIDPk, Base):
    __tablename__ = "ppe_distributions"

    ppe_item_id: Mapped[uuid.UUID] = fk("ppe_items.id", nullable=False)
    employee_id: Mapped[uuid.UUID | None] = fk("employees.id")
    worker_name: Mapped[str | None] = str_col(200)  # intérimaire / sous-traitant
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    quantity: Mapped[int] = int_col(1)
    distributed_at: Mapped[date] = mapped_column(Date, nullable=False)
    expected_replacement: Mapped[date | None] = mapped_column(Date, nullable=True)
    returned_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    signature_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    distributed_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class InspectionTemplate(UUIDPk, Timestamps, Base):
    __tablename__ = "inspection_templates"

    name: Mapped[str] = str_col(200, nullable=False)
    category: Mapped[str] = str_col(40, nullable=False, default="securite")  # securite / qualite / environnement
    checklist: Mapped[list[Any]] = json_col(list)  # [{"key": "...", "label": "...", "weight": 1}]
    is_active: Mapped[bool] = bool_col(True)


class Inspection(UUIDPk, Timestamps, Versioned, Base):
    __tablename__ = "inspections"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    template_id: Mapped[uuid.UUID | None] = fk("inspection_templates.id")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    category: Mapped[str] = str_col(40, nullable=False, default="securite")
    inspector_id: Mapped[uuid.UUID | None] = fk("users.id")
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    results: Mapped[list[Any]] = json_col(list)  # [{"key", "label", "status": ok/nok/na, "comment", "photo_file_id"}]
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    status: Mapped[str] = str_col(20, nullable=False, default="draft")  # draft / completed / closed
    findings: Mapped[str | None] = text_col()
    photo_file_ids: Mapped[list[Any]] = json_col(list)


class Incident(UUIDPk, Timestamps, Versioned, Base):
    __tablename__ = "incidents"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    kind: Mapped[str] = str_col(
        30, nullable=False, default="securite"
    )  # accident / presque_accident / securite / qualite / environnement / materiel
    severity: Mapped[str] = str_col(10, nullable=False, default="medium")  # low / medium / high / critical
    occurred_at: Mapped[datetime] = mapped_column(nullable=False)
    location: Mapped[str | None] = str_col(250)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    people_involved: Mapped[list[Any]] = json_col(list)
    injuries: Mapped[str | None] = text_col()
    lost_time_days: Mapped[int] = int_col(0)
    immediate_actions: Mapped[str | None] = text_col()
    root_cause: Mapped[str | None] = text_col()
    photo_file_ids: Mapped[list[Any]] = json_col(list)
    status: Mapped[str] = str_col(
        20, nullable=False, default="declared", index=True
    )  # declared / investigating / action_plan / closed
    published_to_client: Mapped[bool] = bool_col(False)
    client_summary: Mapped[str | None] = text_col()
    reported_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    closed_at: Mapped[datetime | None] = dt_col()
    closed_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    source: Mapped[str] = str_col(20, nullable=False, default="web")


class CorrectiveAction(UUIDPk, Timestamps, Base):
    __tablename__ = "corrective_actions"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    source_type: Mapped[str] = str_col(20, nullable=False, default="incident")  # incident / inspection / audit / other
    source_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    responsible_id: Mapped[uuid.UUID | None] = fk("users.id")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    status: Mapped[str] = str_col(
        20, nullable=False, default="open", index=True
    )  # open / in_progress / done / verified / cancelled
    closure_evidence_file_ids: Mapped[list[Any]] = json_col(list)
    closure_note: Mapped[str | None] = text_col()
    completed_at: Mapped[datetime | None] = dt_col()
    verified_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    verified_at: Mapped[datetime | None] = dt_col()


class SafetyTalk(UUIDPk, Timestamps, Base):
    """Quart d'heure sécurité."""

    __tablename__ = "safety_talks"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False)
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    talk_date: Mapped[date] = mapped_column(Date, nullable=False)
    topic: Mapped[str] = str_col(250, nullable=False)
    content: Mapped[str | None] = text_col()
    animator_id: Mapped[uuid.UUID | None] = fk("users.id")
    duration_minutes: Mapped[int] = int_col(15)
    attendees: Mapped[list[Any]] = json_col(list)  # [{"employee_id"|"name", "signed": bool}]
    attendee_count: Mapped[int] = int_col(0)
    photo_file_ids: Mapped[list[Any]] = json_col(list)


__all__ = [
    "CorrectiveAction",
    "Incident",
    "Inspection",
    "InspectionTemplate",
    "PPEDistribution",
    "PPEItem",
    "SafetyTalk",
]
