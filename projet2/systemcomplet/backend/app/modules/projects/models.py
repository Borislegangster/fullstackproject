"""Projet : Project, Site, Phase, Lot, Task, Milestone, Schedule, Risk, ChangeOrder + journal chantier,
médias, décisions client, contenus immersifs, dossier Tranquillité, digest client, garanties (§19)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, Numeric, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
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

PROJECT_STATUSES = (
    "prospect",
    "etude",
    "conception",
    "permis",
    "preparation",
    "execution",
    "reception",
    "garantie",
    "clos",
    "suspendu",
    "annule",
)
UNIVERSES = ("HOME", "BUSINESS", "PREMIUM", "DIASPORA", "ENGINEERING")


class Project(UUIDPk, Timestamps, SoftDelete, Versioned, Base):
    __tablename__ = "projects"

    code: Mapped[str] = str_col(40, nullable=False, unique=True)
    name: Mapped[str] = str_col(250, nullable=False, index=True)
    description: Mapped[str | None] = text_col()
    client_organization_id: Mapped[uuid.UUID | None] = fk("organizations.id")
    universe: Mapped[str | None] = str_col(20, index=True)
    offer_code: Mapped[str | None] = str_col(60)
    project_type: Mapped[str] = str_col(40, nullable=False, default="construction_neuve")
    status: Mapped[str] = str_col(20, nullable=False, default="etude", index=True)
    health: Mapped[str] = str_col(20, nullable=False, default="on_track")
    address: Mapped[str | None] = text_col()
    city: Mapped[str | None] = str_col(120)
    country: Mapped[str | None] = str_col(80, default="Cameroun")
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    surface_m2: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    levels: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_planned: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_planned: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_actual: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_actual: Mapped[date | None] = mapped_column(Date, nullable=True)
    reception_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_amount: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    progress_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    manager_id: Mapped[uuid.UUID | None] = fk("users.id")
    director_id: Mapped[uuid.UUID | None] = fk("users.id")
    commercial_id: Mapped[uuid.UUID | None] = fk("users.id")
    contract_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)  # crm.contracts (lien logique)
    opportunity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    cover_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    client_visible: Mapped[bool] = bool_col(True)
    is_diaspora: Mapped[bool] = bool_col(False)
    tags: Mapped[list[Any]] = json_col(list)
    settings: Mapped[dict[str, Any]] = json_col(dict)  # politique de publication client, sous-traitants visibles…

    sites: Mapped[list[Site]] = relationship(back_populates="project", lazy="selectin", order_by="Site.code")


class ProjectMember(UUIDPk, Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    project_role: Mapped[str] = str_col(40, nullable=False, default="membre")
    lots: Mapped[list[Any]] = json_col(list)  # vide = tous les lots
    disciplines: Mapped[list[Any]] = json_col(list)  # vide = toutes les disciplines
    sites: Mapped[list[Any]] = json_col(list)
    can_view_finance: Mapped[bool] = bool_col(False)
    added_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Site(UUIDPk, Timestamps, SoftDelete, Base):
    """Chantier rattaché à un projet."""

    __tablename__ = "sites"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    code: Mapped[str] = str_col(40, nullable=False, unique=True)
    name: Mapped[str] = str_col(200, nullable=False)
    address: Mapped[str | None] = text_col()
    city: Mapped[str | None] = str_col(120)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    geofence_radius_m: Mapped[int] = int_col(300)
    site_manager_id: Mapped[uuid.UUID | None] = fk("users.id")
    status: Mapped[str] = str_col(20, nullable=False, default="preparation")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    access_instructions: Mapped[str | None] = text_col()
    safety_notes: Mapped[str | None] = text_col()
    live_stream_url: Mapped[str | None] = str_col(500)

    project: Mapped[Project] = relationship(back_populates="sites")


class Phase(UUIDPk, Timestamps, Base):
    __tablename__ = "phases"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(200, nullable=False)
    sort_order: Mapped[int] = int_col(0)
    start_planned: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_planned: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_actual: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_actual: Mapped[date | None] = mapped_column(Date, nullable=True)
    progress_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    status: Mapped[str] = str_col(20, nullable=False, default="planned")
    color: Mapped[str | None] = str_col(9)
    client_visible: Mapped[bool] = bool_col(True)


class Lot(UUIDPk, Timestamps, Base):
    __tablename__ = "lots"
    __table_args__ = (UniqueConstraint("project_id", "code"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    code: Mapped[str] = str_col(30, nullable=False)
    name: Mapped[str] = str_col(200, nullable=False)
    discipline: Mapped[str | None] = str_col(40)
    description: Mapped[str | None] = text_col()
    budget_amount: Mapped[Decimal] = money_col()
    sort_order: Mapped[int] = int_col(0)
    subcontractor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True, index=True)
    status: Mapped[str] = str_col(20, nullable=False, default="planned")
    progress_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )


class Task(UUIDPk, Timestamps, SoftDelete, Versioned, Base):
    __tablename__ = "tasks"
    __table_args__ = (Index("ix_tasks_project_dates", "project_id", "start_planned"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    phase_id: Mapped[uuid.UUID | None] = fk("phases.id")
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    parent_id: Mapped[uuid.UUID | None] = fk("tasks.id")
    wbs_code: Mapped[str | None] = str_col(40)
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    status: Mapped[str] = str_col(20, nullable=False, default="todo", index=True)
    priority: Mapped[str] = str_col(20, nullable=False, default="normal")
    start_planned: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_planned: Mapped[date | None] = mapped_column(Date, nullable=True)
    duration_days: Mapped[int] = int_col(1)
    start_actual: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_actual: Mapped[date | None] = mapped_column(Date, nullable=True)
    baseline_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    baseline_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    progress_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"), server_default="0"
    )
    is_milestone: Mapped[bool] = bool_col(False)
    milestone_id: Mapped[uuid.UUID | None] = fk("milestones.id")
    estimated_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    actual_hours: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    planned_cost: Mapped[Decimal] = money_col()
    checklist: Mapped[list[Any]] = json_col(list)
    constraint_type: Mapped[str] = str_col(10, nullable=False, default="asap")
    constraint_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    sort_order: Mapped[int] = int_col(0)
    client_visible: Mapped[bool] = bool_col(False)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)

    assignments: Mapped[list[TaskAssignment]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class TaskAssignment(UUIDPk, Base):
    __tablename__ = "task_assignments"
    __table_args__ = (UniqueConstraint("task_id", "user_id"),)

    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = fk("users.id")
    team_id: Mapped[uuid.UUID | None] = fk("teams.id")
    employee_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    allocation_pct: Mapped[int] = int_col(100)


class TaskDependency(UUIDPk, Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (UniqueConstraint("predecessor_id", "successor_id"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    predecessor_id: Mapped[uuid.UUID] = fk("tasks.id", nullable=False, ondelete="CASCADE")
    successor_id: Mapped[uuid.UUID] = fk("tasks.id", nullable=False, ondelete="CASCADE")
    type: Mapped[str] = str_col(2, nullable=False, default="FS")  # FS / SS / FF / SF
    lag_days: Mapped[int] = int_col(0)


class Milestone(UUIDPk, Timestamps, Base):
    __tablename__ = "milestones"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(200, nullable=False)
    description: Mapped[str | None] = text_col()
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    achieved_at: Mapped[datetime | None] = dt_col()
    status: Mapped[str] = str_col(20, nullable=False, default="planned")  # planned / achieved / late / cancelled
    client_visible: Mapped[bool] = bool_col(True)
    payment_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)  # déclencheur appel de fonds
    sort_order: Mapped[int] = int_col(0)


class ScheduleBaseline(UUIDPk, Base):
    __tablename__ = "schedule_baselines"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(150, nullable=False)
    number: Mapped[int] = int_col(1)
    data: Mapped[dict[str, Any]] = json_col(dict)
    is_current: Mapped[bool] = bool_col(True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    reason: Mapped[str | None] = text_col()


class WorkCalendar(UUIDPk, Base):
    __tablename__ = "work_calendars"

    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")
    name: Mapped[str] = str_col(120, nullable=False, default="Calendrier standard")
    working_days: Mapped[list[Any]] = json_col(lambda: [0, 1, 2, 3, 4, 5])  # lundi=0 … samedi=5
    holidays: Mapped[list[Any]] = json_col(list)
    hours_per_day: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), nullable=False, default=Decimal("8"), server_default="8"
    )


class Risk(UUIDPk, Timestamps, Base):
    __tablename__ = "project_risks"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    category: Mapped[str] = str_col(30, nullable=False, default="technique")
    probability: Mapped[int] = int_col(3)
    impact: Mapped[int] = int_col(3)
    owner_id: Mapped[uuid.UUID | None] = fk("users.id")
    mitigation: Mapped[str | None] = text_col()
    contingency: Mapped[str | None] = text_col()
    status: Mapped[str] = str_col(20, nullable=False, default="identified")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = str_col(20, nullable=False, default="manual")  # manual / prediction
    cost_exposure: Mapped[Decimal] = money_col()

    @property
    def score(self) -> int:
        return int(self.probability or 0) * int(self.impact or 0)


class ChangeOrder(UUIDPk, Timestamps, Base):
    """Avenant / change order (impact prix et délai)."""

    __tablename__ = "change_orders"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    lot_id: Mapped[uuid.UUID | None] = fk("lots.id")
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    reason: Mapped[str] = str_col(30, nullable=False, default="client_request")
    origin: Mapped[str] = str_col(20, nullable=False, default="manual")  # manual / decision / configurator
    decision_id: Mapped[uuid.UUID | None] = fk("decisions.id")
    cost_impact: Mapped[Decimal] = money_col()
    delay_impact_days: Mapped[int] = int_col(0)
    lines: Mapped[list[Any]] = json_col(list)
    status: Mapped[str] = str_col(20, nullable=False, default="draft")
    submitted_at: Mapped[datetime | None] = dt_col()
    client_approved_at: Mapped[datetime | None] = dt_col()
    client_approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    approved_at: Mapped[datetime | None] = dt_col()
    document_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class DailyLog(UUIDPk, Timestamps, Versioned, Base):
    """Journal de chantier."""

    __tablename__ = "daily_logs"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    weather: Mapped[str | None] = str_col(120)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    workforce_count: Mapped[int] = int_col(0)
    subcontractor_workforce: Mapped[int] = int_col(0)
    activities: Mapped[str | None] = text_col()
    issues: Mapped[str | None] = text_col()
    deliveries_summary: Mapped[str | None] = text_col()
    visitors: Mapped[str | None] = text_col()
    safety_notes: Mapped[str | None] = text_col()
    delay_hours: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    needs: Mapped[str | None] = text_col()
    is_critical: Mapped[bool] = bool_col(False)
    author_id: Mapped[uuid.UUID | None] = fk("users.id")
    status: Mapped[str] = str_col(20, nullable=False, default="draft")  # draft / submitted / validated
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    source: Mapped[str] = str_col(20, nullable=False, default="manual")  # manual / voice_ai / offline
    voice_report_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    client_visible: Mapped[bool] = bool_col(False)


# Étapes d'une photo / vidéo de chantier : avant, pendant, après travaux, inspection, livraison, incident.
SITE_MEDIA_STAGES = ("before", "during", "after", "inspection", "delivery", "incident")


class SiteMedia(UUIDPk, Timestamps, Base):
    __tablename__ = "site_media"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    task_id: Mapped[uuid.UUID | None] = fk("tasks.id")
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    daily_log_id: Mapped[uuid.UUID | None] = fk("daily_logs.id")
    file_id: Mapped[uuid.UUID] = fk("stored_files.id", nullable=False)
    media_type: Mapped[str] = str_col(10, nullable=False, default="photo")  # photo / video
    caption: Mapped[str | None] = str_col(500)
    stage: Mapped[str] = str_col(10, nullable=False, default="during")  # SITE_MEDIA_STAGES
    taken_at: Mapped[datetime | None] = dt_col()
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    published_to_client: Mapped[bool] = bool_col(False)
    uploaded_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    tags: Mapped[list[Any]] = json_col(list)


class ProgressUpdate(UUIDPk, Base):
    __tablename__ = "progress_updates"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    task_id: Mapped[uuid.UUID] = fk("tasks.id", nullable=False, ondelete="CASCADE")
    previous_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    new_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    note: Mapped[str | None] = text_col()
    evidence_file_ids: Mapped[list[Any]] = json_col(list)
    reported_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    reported_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    source: Mapped[str] = str_col(20, nullable=False, default="web")


class Decision(UUIDPk, Timestamps, Base):
    """Décision client irrévocable : qui, quand, sur quelle version, avec quel impact prix/délai (§3.2)."""

    __tablename__ = "decisions"

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(20, nullable=False, default="option")  # material / option / plan / budget / planning
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    options: Mapped[list[Any]] = json_col(list)
    selected_option: Mapped[str | None] = str_col(200)
    price_impact: Mapped[Decimal] = money_col()
    delay_impact_days: Mapped[int] = int_col(0)
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    reference_type: Mapped[str | None] = str_col(40)  # document_version / bim_version / scenario
    reference_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    version_label: Mapped[str | None] = str_col(60)
    status: Mapped[str] = str_col(20, nullable=False, default="pending_client", index=True)
    requested_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    validation_method: Mapped[str | None] = str_col(20)  # otp / esign
    validation_proof: Mapped[dict[str, Any]] = json_col(dict)
    content_hash: Mapped[str | None] = str_col(64)
    locked_at: Mapped[datetime | None] = dt_col()
    change_order_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    superseded_by_id: Mapped[uuid.UUID | None] = fk("decisions.id", index=False)
    rejection_reason: Mapped[str | None] = text_col()


class ImmersiveContent(UUIDPk, Timestamps, Base):
    __tablename__ = "immersive_contents"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    kind: Mapped[str] = str_col(20, nullable=False)  # photo_360 / video_360 / drone / live / timelapse / virtual_tour
    title: Mapped[str] = str_col(200, nullable=False)
    description: Mapped[str | None] = text_col()
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    external_url: Mapped[str | None] = str_col(500)
    captured_at: Mapped[datetime | None] = dt_col()
    comparison_group: Mapped[str | None] = str_col(80)
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    published_to_client: Mapped[bool] = bool_col(False)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class TranquilliteItem(UUIDPk, Timestamps, Base):
    """Dossier Tranquillité : foncier, titre, permis, actes notariés, vérifications et preuves (§6.2)."""

    __tablename__ = "tranquillite_items"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    category: Mapped[str] = str_col(30, nullable=False)
    title: Mapped[str] = str_col(250, nullable=False)
    reference_number: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)
    authority: Mapped[str | None] = str_col(200)
    status: Mapped[str] = str_col(20, nullable=False, default="a_fournir")
    issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    responsible_id: Mapped[uuid.UUID | None] = fk("users.id")
    notes: Mapped[str | None] = text_col()
    document_ids: Mapped[list[Any]] = json_col(list)
    verification_notes: Mapped[str | None] = text_col()
    verified_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    verified_at: Mapped[datetime | None] = dt_col()
    anchor_hash: Mapped[str | None] = str_col(64)
    anchor_receipt: Mapped[dict[str, Any]] = json_col(dict)
    anchored_at: Mapped[datetime | None] = dt_col()
    client_visible: Mapped[bool] = bool_col(True)


class ClientDigest(UUIDPk, Base):
    __tablename__ = "client_digests"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[dict[str, Any]] = json_col(dict)
    summary: Mapped[str | None] = text_col()
    generated_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    sent_at: Mapped[datetime | None] = dt_col()
    recipients: Mapped[list[Any]] = json_col(list)


class Warranty(UUIDPk, Timestamps, Base):
    __tablename__ = "warranties"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(30, nullable=False)  # parfait_achevement / biennale / decennale / equipement
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    coverage: Mapped[str | None] = text_col()
    insurer: Mapped[str | None] = str_col(200)
    policy_number: Mapped[str | None] = str_col(100)


class TrustSnapshot(UUIDPk, Base):
    """Indice de confiance du chantier (0-100) figé chaque jour : historique et tendance visibles par le client."""

    __tablename__ = "trust_snapshots"
    __table_args__ = (UniqueConstraint("project_id", "as_of"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    level: Mapped[str] = str_col(20, nullable=False, default="indisponible")
    components: Mapped[list[Any]] = json_col(list)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


__all__ = [
    "PROJECT_STATUSES",
    "UNIVERSES",
    "ChangeOrder",
    "ClientDigest",
    "DailyLog",
    "Decision",
    "ImmersiveContent",
    "Lot",
    "Milestone",
    "Phase",
    "ProgressUpdate",
    "Project",
    "ProjectMember",
    "Risk",
    "ScheduleBaseline",
    "Site",
    "SiteMedia",
    "Task",
    "TaskAssignment",
    "TaskDependency",
    "TranquilliteItem",
    "TrustSnapshot",
    "Warranty",
    "WorkCalendar",
]
