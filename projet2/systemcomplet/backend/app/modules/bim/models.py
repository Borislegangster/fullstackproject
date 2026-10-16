"""Hub BIM : BimModel, BimVersion, Derivative, DisciplineLayer, Viewpoint, Issue, Annotation, Clash,
SpatialZone (+ scans QR) (§10)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Float, ForeignKey, Index, Numeric, UniqueConstraint, Uuid, func
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
from app.core.utils import utcnow

DEFAULT_DISCIPLINES = [
    ("architecture", "Architecture", "#385AA6"),
    ("structure", "Structure", "#6B7280"),
    ("electricite", "Électricité", "#F59E0B"),
    ("plomberie", "Plomberie", "#0EA5E9"),
    ("cvc", "CVC / HVAC", "#10B981"),
    ("vrd", "VRD", "#8B5CF6"),
    ("menuiserie", "Menuiserie", "#B45309"),
    ("securite", "Sécurité", "#EF4444"),
]


class DisciplineLayer(UUIDPk, Timestamps, Base):
    __tablename__ = "discipline_layers"
    __table_args__ = (UniqueConstraint("project_id", "key"),)

    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")  # null = référentiel global
    key: Mapped[str] = str_col(40, nullable=False)
    name: Mapped[str] = str_col(120, nullable=False)
    color: Mapped[str] = str_col(9, nullable=False, default="#385AA6")
    visible_by_default: Mapped[bool] = bool_col(True)
    sort_order: Mapped[int] = int_col(0)


class BimModel(UUIDPk, Timestamps, SoftDelete, Base):
    __tablename__ = "bim_models"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(250, nullable=False)
    discipline: Mapped[str] = str_col(40, nullable=False, default="architecture", index=True)
    description: Mapped[str | None] = text_col()
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    published_version_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    is_master: Mapped[bool] = bool_col(True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class BimVersion(UUIDPk, Base):
    __tablename__ = "bim_versions"
    __table_args__ = (UniqueConstraint("model_id", "number"),)

    model_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("bim_models.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = int_col(1)
    document_version_id: Mapped[uuid.UUID | None] = fk("document_versions.id")  # fichier source stocké en GED
    file_id: Mapped[uuid.UUID] = fk("stored_files.id", nullable=False)
    source_format: Mapped[str] = str_col(
        10, nullable=False
    )  # rvt / dwg / ifc / skp / pdf / nwd / glb / gltf / obj / stl
    viewer: Mapped[str] = str_col(10, nullable=False, default="three")  # aps / three
    status: Mapped[str] = str_col(
        20, nullable=False, default="uploaded", index=True
    )  # uploaded / translating / ready / failed / validated / published / obsolete
    revision_reason: Mapped[str | None] = text_col()
    aps_object_id: Mapped[str | None] = str_col(400)
    aps_urn: Mapped[str | None] = str_col(400)
    translation_progress: Mapped[str | None] = str_col(20)
    translation_error: Mapped[str | None] = text_col()
    manifest: Mapped[dict[str, Any]] = json_col(dict)
    metadata_summary: Mapped[dict[str, Any]] = json_col(dict)
    uploaded_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    validated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    validated_at: Mapped[datetime | None] = dt_col()
    published_to_client: Mapped[bool] = bool_col(False)
    published_at: Mapped[datetime | None] = dt_col()
    obsolete_at: Mapped[datetime | None] = dt_col()

    derivatives: Mapped[list[Derivative]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class Derivative(UUIDPk, Base):
    __tablename__ = "bim_derivatives"

    version_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("bim_versions.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = str_col(10, nullable=False)  # 2d / 3d
    guid: Mapped[str | None] = str_col(120)
    name: Mapped[str] = str_col(250, nullable=False)
    role: Mapped[str | None] = str_col(40)
    status: Mapped[str] = str_col(20, nullable=False, default="success")


class Viewpoint(UUIDPk, Timestamps, Base):
    __tablename__ = "bim_viewpoints"

    version_id: Mapped[uuid.UUID] = fk("bim_versions.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(200, nullable=False)
    camera: Mapped[dict[str, Any]] = json_col(dict)
    visible_disciplines: Mapped[list[Any]] = json_col(list)
    snapshot_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    is_preset: Mapped[bool] = bool_col(False)  # vues prédéfinies (client)
    client_visible: Mapped[bool] = bool_col(False)
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class SpatialZone(UUIDPk, Timestamps, Base):
    """Zone / pièce : support du QR spatial (chantier + niveau + zone + discipline)."""

    __tablename__ = "spatial_zones"
    __table_args__ = (UniqueConstraint("project_id", "code"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    site_id: Mapped[uuid.UUID | None] = fk("sites.id")
    code: Mapped[str] = str_col(40, nullable=False)
    name: Mapped[str] = str_col(200, nullable=False)
    level: Mapped[str | None] = str_col(40)
    zone_type: Mapped[str] = str_col(20, nullable=False, default="piece")  # piece / zone / niveau / exterieur
    discipline: Mapped[str | None] = str_col(40)
    qr_token: Mapped[str] = str_col(64, nullable=False, unique=True)
    bbox: Mapped[dict[str, Any]] = json_col(dict)
    element_ids: Mapped[list[Any]] = json_col(list)
    checklist: Mapped[list[Any]] = json_col(list)
    area_m2: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    client_label: Mapped[str | None] = str_col(120)  # libellé sans jargon (mode visite)


class ZoneScan(UUIDPk, Base):
    __tablename__ = "zone_scans"

    zone_id: Mapped[uuid.UUID] = fk("spatial_zones.id", nullable=False, ondelete="CASCADE")
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    scanned_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    application: Mapped[str | None] = str_col(40)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)


class BimIssue(UUIDPk, Timestamps, Versioned, Base):
    __tablename__ = "bim_issues"
    __table_args__ = (Index("ix_bim_issues_project_status", "project_id", "status"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    model_id: Mapped[uuid.UUID | None] = fk("bim_models.id")
    version_id: Mapped[uuid.UUID | None] = fk("bim_versions.id")  # version exacte
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    title: Mapped[str] = str_col(250, nullable=False)
    description: Mapped[str | None] = text_col()
    kind: Mapped[str] = str_col(
        20, nullable=False, default="design"
    )  # clash / design / question / observation / defect
    priority: Mapped[str] = str_col(10, nullable=False, default="medium")  # low / medium / high / critical
    status: Mapped[str] = str_col(
        20, nullable=False, default="open"
    )  # open / in_progress / resolved / closed / reopened
    discipline: Mapped[str | None] = str_col(40)
    assignee_id: Mapped[uuid.UUID | None] = fk("users.id")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    location: Mapped[dict[str, Any]] = json_col(dict)  # dbIds / guid / coordonnées
    viewpoint: Mapped[dict[str, Any]] = json_col(dict)
    snapshot_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    clash_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    resolved_in_version_id: Mapped[uuid.UUID | None] = fk("bim_versions.id", index=False)
    resolution_note: Mapped[str | None] = text_col()
    resolved_at: Mapped[datetime | None] = dt_col()
    closed_at: Mapped[datetime | None] = dt_col()
    meeting_call_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class IssueComment(UUIDPk, Base):
    __tablename__ = "bim_issue_comments"

    issue_id: Mapped[uuid.UUID] = fk("bim_issues.id", nullable=False, ondelete="CASCADE")
    author_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    body: Mapped[str] = text_col(nullable=False)
    file_ids: Mapped[list[Any]] = json_col(list)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class BimAnnotation(UUIDPk, Timestamps, SoftDelete, Versioned, Base):
    """Annotation temps réel ancrée à une version précise (V4-BIM-21)."""

    __tablename__ = "bim_annotations"

    version_id: Mapped[uuid.UUID] = fk("bim_versions.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(20, nullable=False)  # pin / text / measure / photo / capture / arrow / rect / issue
    geometry: Mapped[dict[str, Any]] = json_col(dict)  # position, normale, points, dbId, état caméra
    content: Mapped[str | None] = text_col()
    measurement_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    measurement_unit: Mapped[str | None] = str_col(10)
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    color: Mapped[str] = str_col(9, nullable=False, default="#FB8C43")
    discipline: Mapped[str | None] = str_col(40)
    issue_id: Mapped[uuid.UUID | None] = fk("bim_issues.id")
    author_id: Mapped[uuid.UUID | None] = fk("users.id")
    client_visible: Mapped[bool] = bool_col(False)


class ClashRule(UUIDPk, Timestamps, Base):
    __tablename__ = "bim_clash_rules"

    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")
    name: Mapped[str] = str_col(200, nullable=False)
    discipline_a: Mapped[str] = str_col(40, nullable=False)
    discipline_b: Mapped[str] = str_col(40, nullable=False)
    clash_type: Mapped[str] = str_col(20, nullable=False, default="hard")  # hard / soft / clearance / duplicate
    tolerance_mm: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("0"))
    severity: Mapped[str] = str_col(10, nullable=False, default="medium")
    cost_per_clash: Mapped[Decimal] = money_col()  # coût évité estimé par conflit
    is_active: Mapped[bool] = bool_col(True)


class Clash(UUIDPk, Timestamps, Base):
    __tablename__ = "bim_clashes"
    __table_args__ = (Index("ix_bim_clashes_project_status", "project_id", "status"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    rule_id: Mapped[uuid.UUID | None] = fk("bim_clash_rules.id")
    version_a_id: Mapped[uuid.UUID | None] = fk("bim_versions.id", index=False)
    version_b_id: Mapped[uuid.UUID | None] = fk("bim_versions.id", index=False)
    object_a: Mapped[dict[str, Any]] = json_col(dict)  # {"db_id", "guid", "name", "discipline"}
    object_b: Mapped[dict[str, Any]] = json_col(dict)
    discipline_a: Mapped[str | None] = str_col(40)
    discipline_b: Mapped[str | None] = str_col(40)
    clash_type: Mapped[str] = str_col(20, nullable=False, default="hard")
    severity: Mapped[str] = str_col(10, nullable=False, default="medium")
    location: Mapped[dict[str, Any]] = json_col(dict)
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    detection: Mapped[str] = str_col(10, nullable=False, default="manual")  # manual / assisted
    status: Mapped[str] = str_col(20, nullable=False, default="new")  # new / active / reviewed / approved / resolved
    estimated_cost_avoided: Mapped[Decimal] = money_col()
    issue_id: Mapped[uuid.UUID | None] = fk("bim_issues.id")
    detected_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    resolved_at: Mapped[datetime | None] = dt_col()
    signature: Mapped[str | None] = str_col(64, index=True)  # empreinte (récurrence / doublons)


__all__ = [
    "DEFAULT_DISCIPLINES",
    "BimAnnotation",
    "BimIssue",
    "BimModel",
    "BimVersion",
    "Clash",
    "ClashRule",
    "Derivative",
    "DisciplineLayer",
    "IssueComment",
    "SpatialZone",
    "Viewpoint",
    "ZoneScan",
]
