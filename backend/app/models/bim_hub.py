"""
BIM Hub Models — Models, versions, disciplines, issues, annotations, clashes.
"""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
)
from app.database import Base
import uuid


def _uuid():
    return str(uuid.uuid4())


class BimModel(Base):
    __tablename__ = "bim_models"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    file_format = Column(String, default="")  # RVT, DWG, IFC, SKP, PDF
    discipline = Column(String, default="")  # architecture, structure, mep, etc.

    current_version_id = Column(String, nullable=True)
    version_count = Column(Integer, default=0)

    aps_urn = Column(String, default="")
    aps_bucket = Column(String, default="")
    thumbnail_url = Column(String, default="")

    status = Column(String, default="ACTIF", index=True)  # ACTIF/ARCHIVE/SUPPRIME
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class BimVersion(Base):
    __tablename__ = "bim_versions"

    id = Column(String, primary_key=True, default=_uuid)
    model_id = Column(String, ForeignKey("bim_models.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    version_label = Column(String, default="")

    file_url = Column(String, default="")
    storage_key = Column(String, default="")
    file_size = Column(Integer, default=0)
    checksum = Column(String, default="")

    aps_urn = Column(String, default="")
    translation_status = Column(String, default="PENDING")
    # PENDING/PROCESSING/COMPLETE/FAILED
    derivatives = Column(JSON, default=list)

    change_description = Column(Text, default="")
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=True)
    validated_by = Column(String, ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime, nullable=True)

    status = Column(String, default="EN_REVUE", index=True)
    # EN_REVUE/VALIDE/PUBLIE/OBSOLETE

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DisciplineLayer(Base):
    __tablename__ = "discipline_layers"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    code = Column(String, default="")  # ARCH, STR, ELEC, PLUMB, HVAC, VRD, MENU, SEC
    color = Column(String, default="#385AA6")
    is_visible = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    model_ids = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Viewpoint(Base):
    __tablename__ = "bim_viewpoints"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    model_id = Column(String, ForeignKey("bim_models.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")

    camera_position = Column(JSON, default=dict)  # {x, y, z}
    camera_target = Column(JSON, default=dict)
    camera_up = Column(JSON, default=dict)
    section_planes = Column(JSON, default=list)
    hidden_elements = Column(JSON, default=list)
    visible_layers = Column(JSON, default=list)
    thumbnail_url = Column(String, default="")

    is_shared = Column(Boolean, default=False)
    shared_with_client = Column(Boolean, default=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BimIssue(Base):
    __tablename__ = "bim_issues"

    id = Column(String, primary_key=True, default=_uuid)
    code = Column(String, unique=True, nullable=False, index=True)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    model_id = Column(String, ForeignKey("bim_models.id"), nullable=True)
    version_id = Column(String, ForeignKey("bim_versions.id"), nullable=True)
    viewpoint_id = Column(String, ForeignKey("bim_viewpoints.id"), nullable=True)

    title = Column(String, nullable=False)
    description = Column(Text, default="")
    discipline = Column(String, default="")
    priority = Column(String, default="NORMALE")  # BASSE/NORMALE/HAUTE/CRITIQUE
    status = Column(String, default="OUVERTE", index=True)
    # OUVERTE/EN_COURS/EN_REVUE/RESOLUE/FERMEE

    location = Column(JSON, default=dict)  # {x, y, z, zone, level}
    element_ids = Column(JSON, default=list)
    photos = Column(JSON, default=list)

    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)
    reported_by = Column(String, ForeignKey("users.id"), nullable=True)
    resolved_by = Column(String, ForeignKey("users.id"), nullable=True)
    due_date = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    cost_impact = Column(Float, default=0.0)
    time_impact_days = Column(Integer, default=0)
    comments = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class BimAnnotation(Base):
    __tablename__ = "bim_annotations"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    model_id = Column(String, ForeignKey("bim_models.id"), nullable=True)
    version_id = Column(String, ForeignKey("bim_versions.id"), nullable=True)
    issue_id = Column(String, ForeignKey("bim_issues.id"), nullable=True)

    annotation_type = Column(String, default="PIN")
    # PIN/TEXT/MEASURE/PHOTO/CAPTURE/ARROW/RECTANGLE
    content = Column(Text, default="")

    position = Column(JSON, default=dict)  # coordinates/object/view
    geometry = Column(JSON, default=dict)  # shape data for arrows/rectangles
    element_id = Column(String, default="")
    view_state = Column(JSON, default=dict)

    author_id = Column(String, ForeignKey("users.id"), nullable=True)
    is_resolved = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class Clash(Base):
    __tablename__ = "bim_clashes"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    code = Column(String, unique=True, nullable=False, index=True)

    object_a_id = Column(String, default="")
    object_a_discipline = Column(String, default="")
    object_a_description = Column(String, default="")

    object_b_id = Column(String, default="")
    object_b_discipline = Column(String, default="")
    object_b_description = Column(String, default="")

    clash_type = Column(String, default="HARD")  # HARD/SOFT/CLEARANCE
    severity = Column(String, default="MOYEN")  # FAIBLE/MOYEN/GRAVE/CRITIQUE
    location = Column(JSON, default=dict)  # {x, y, z, zone, level}
    viewpoint_id = Column(String, ForeignKey("bim_viewpoints.id"), nullable=True)

    status = Column(String, default="NOUVEAU", index=True)
    # NOUVEAU/EN_COURS/RESOLU/ACCEPTE/IGNORE

    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)
    resolved_by = Column(String, ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(Text, default="")
    cost_avoided = Column(Float, default=0.0)
    resolution_time_hours = Column(Float, default=0.0)

    detected_by = Column(String, default="MANUAL")  # MANUAL/AUTO
    reported_by = Column(String, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class SpatialZone(Base):
    __tablename__ = "spatial_zones"

    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    code = Column(String, default="")
    level = Column(String, default="")  # RDC, R+1, etc.
    zone_type = Column(String, default="")  # piece, zone, etage, batiment
    parent_zone_id = Column(String, ForeignKey("spatial_zones.id"), nullable=True)
    qr_code_data = Column(String, default="")
    bounding_box = Column(JSON, default=dict)
    zone_metadata = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
