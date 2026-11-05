"""
BIM Hub API — Models, versions, issues, annotations, clashes, spatial zones.
Routes: /api/v1/bim/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.service import require_staff
from app.models.bim_hub import (
    BimModel, BimVersion, DisciplineLayer, Viewpoint,
    BimIssue, BimAnnotation, Clash, SpatialZone,
)
from app.services.activity_service import log_activity
import uuid

router = APIRouter(prefix="/bim", tags=["bim"])


# ── Schemas ──────────────────────────────────────────────────

class ModelCreate(BaseModel):
    project_id: str
    name: str
    description: str = ""
    file_format: str = ""
    discipline: str = ""

class VersionCreate(BaseModel):
    version_label: str = ""
    file_url: str = ""
    storage_key: str = ""
    file_size: int = 0
    checksum: str = ""
    change_description: str = ""

class IssueCreate(BaseModel):
    project_id: str
    model_id: Optional[str] = None
    version_id: Optional[str] = None
    title: str
    description: str = ""
    discipline: str = ""
    priority: str = "NORMALE"
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    location: dict = {}
    element_ids: list = []
    photos: list = []

class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    resolution_notes: Optional[str] = None

class AnnotationCreate(BaseModel):
    project_id: str
    model_id: Optional[str] = None
    version_id: Optional[str] = None
    issue_id: Optional[str] = None
    annotation_type: str = "PIN"
    content: str = ""
    position: dict = {}
    geometry: dict = {}
    element_id: str = ""

class ClashCreate(BaseModel):
    project_id: str
    object_a_id: str = ""
    object_a_discipline: str = ""
    object_a_description: str = ""
    object_b_id: str = ""
    object_b_discipline: str = ""
    object_b_description: str = ""
    clash_type: str = "HARD"
    severity: str = "MOYEN"
    location: dict = {}

class ZoneCreate(BaseModel):
    project_id: str
    name: str
    code: str = ""
    level: str = ""
    zone_type: str = ""
    parent_zone_id: Optional[str] = None
    bounding_box: dict = {}

class LayerCreate(BaseModel):
    project_id: str
    name: str
    code: str = ""
    color: str = "#385AA6"
    model_ids: list = []


def _gen_code(prefix: str, n: int) -> str:
    return f"{prefix}-{datetime.utcnow().year}-{n:04d}"


# ── Models ───────────────────────────────────────────────────

@router.get("/models")
async def list_models(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(BimModel).where(BimModel.project_id == project_id, BimModel.deleted_at.is_(None))
        .order_by(BimModel.created_at.desc())
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/models")
async def create_model(body: ModelCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    m = BimModel(id=str(uuid.uuid4()), uploaded_by=user.id, **body.model_dump())
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return _dict(m)


@router.get("/models/{model_id}")
async def get_model(model_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    m = (await db.execute(select(BimModel).where(BimModel.id == model_id))).scalar_one_or_none()
    if not m:
        raise HTTPException(404)
    versions = (await db.execute(
        select(BimVersion).where(BimVersion.model_id == model_id).order_by(BimVersion.version_number.desc())
    )).scalars().all()
    result = _dict(m)
    result["versions"] = [_dict(v) for v in versions]
    return result


@router.post("/models/{model_id}/versions")
async def create_version(model_id: str, body: VersionCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    m = (await db.execute(select(BimModel).where(BimModel.id == model_id))).scalar_one_or_none()
    if not m:
        raise HTTPException(404)
    m.version_count += 1
    v = BimVersion(
        id=str(uuid.uuid4()),
        model_id=model_id,
        version_number=m.version_count,
        uploaded_by=user.id,
        **body.model_dump(),
    )
    db.add(v)
    m.current_version_id = v.id
    await db.commit()
    await db.refresh(v)
    return _dict(v)


@router.patch("/versions/{version_id}/validate")
async def validate_version(version_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    v = (await db.execute(select(BimVersion).where(BimVersion.id == version_id))).scalar_one_or_none()
    if not v:
        raise HTTPException(404)
    v.status = "VALIDE"
    v.validated_by = user.id
    v.validated_at = datetime.utcnow()
    await db.commit()
    return _dict(v)


@router.patch("/versions/{version_id}/publish")
async def publish_version(version_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    v = (await db.execute(select(BimVersion).where(BimVersion.id == version_id))).scalar_one_or_none()
    if not v:
        raise HTTPException(404)
    old_versions = (await db.execute(
        select(BimVersion).where(BimVersion.model_id == v.model_id, BimVersion.status == "PUBLIE")
    )).scalars().all()
    for ov in old_versions:
        ov.status = "OBSOLETE"
    v.status = "PUBLIE"
    await db.commit()
    return _dict(v)


# ── Discipline Layers ────────────────────────────────────────

@router.get("/layers")
async def list_layers(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(DisciplineLayer).where(DisciplineLayer.project_id == project_id)
        .order_by(DisciplineLayer.sort_order)
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/layers")
async def create_layer(body: LayerCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    layer = DisciplineLayer(id=str(uuid.uuid4()), **body.model_dump())
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return _dict(layer)


# ── Issues ───────────────────────────────────────────────────

@router.get("/issues")
async def list_issues(
    project_id: str,
    status: Optional[str] = None,
    discipline: Optional[str] = None,
    priority: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(BimIssue).where(BimIssue.project_id == project_id, BimIssue.deleted_at.is_(None))
    if status:
        q = q.where(BimIssue.status == status)
    if discipline:
        q = q.where(BimIssue.discipline == discipline)
    if priority:
        q = q.where(BimIssue.priority == priority)
    rows = (await db.execute(q.order_by(BimIssue.created_at.desc()))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/issues")
async def create_issue(body: IssueCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(BimIssue))).scalar() or 0
    issue = BimIssue(
        id=str(uuid.uuid4()),
        code=_gen_code("ISS", cnt + 1),
        reported_by=user.id,
        due_date=datetime.fromisoformat(body.due_date) if body.due_date else None,
        **{k: v for k, v in body.model_dump().items() if k != "due_date"},
    )
    db.add(issue)
    await db.commit()
    await db.refresh(issue)
    await log_activity(db, user.id, "CREATE", "bim_issue", issue.id, description=f"Issue BIM: {issue.title}")
    return _dict(issue)


@router.get("/issues/{issue_id}")
async def get_issue(issue_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    issue = (await db.execute(select(BimIssue).where(BimIssue.id == issue_id))).scalar_one_or_none()
    if not issue:
        raise HTTPException(404)
    annots = (await db.execute(
        select(BimAnnotation).where(BimAnnotation.issue_id == issue_id)
    )).scalars().all()
    result = _dict(issue)
    result["annotations"] = [_dict(a) for a in annots]
    return result


@router.patch("/issues/{issue_id}")
async def update_issue(issue_id: str, body: IssueUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    issue = (await db.execute(select(BimIssue).where(BimIssue.id == issue_id))).scalar_one_or_none()
    if not issue:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] in ("RESOLUE", "FERMEE"):
        issue.resolved_by = user.id
        issue.resolved_at = datetime.utcnow()
    if "due_date" in data and data["due_date"]:
        data["due_date"] = datetime.fromisoformat(data["due_date"])
    for k, v in data.items():
        setattr(issue, k, v)
    await db.commit()
    await db.refresh(issue)
    return _dict(issue)


# ── Annotations ──────────────────────────────────────────────

@router.get("/annotations")
async def list_annotations(project_id: str, model_id: Optional[str] = None, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    q = select(BimAnnotation).where(BimAnnotation.project_id == project_id, BimAnnotation.deleted_at.is_(None))
    if model_id:
        q = q.where(BimAnnotation.model_id == model_id)
    rows = (await db.execute(q.order_by(BimAnnotation.created_at.desc()))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/annotations")
async def create_annotation(body: AnnotationCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    a = BimAnnotation(id=str(uuid.uuid4()), author_id=user.id, **body.model_dump())
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return _dict(a)


# ── Clashes ──────────────────────────────────────────────────

@router.get("/clashes")
async def list_clashes(project_id: str, status: Optional[str] = None, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    q = select(Clash).where(Clash.project_id == project_id, Clash.deleted_at.is_(None))
    if status:
        q = q.where(Clash.status == status)
    rows = (await db.execute(q.order_by(Clash.created_at.desc()))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/clashes")
async def create_clash(body: ClashCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(Clash))).scalar() or 0
    c = Clash(id=str(uuid.uuid4()), code=_gen_code("CLH", cnt + 1), reported_by=user.id, **body.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _dict(c)


@router.patch("/clashes/{clash_id}/resolve")
async def resolve_clash(clash_id: str, notes: str = "", cost_avoided: float = 0, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    c = (await db.execute(select(Clash).where(Clash.id == clash_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    c.status = "RESOLU"
    c.resolved_by = user.id
    c.resolved_at = datetime.utcnow()
    c.resolution_notes = notes
    c.cost_avoided = cost_avoided
    await db.commit()
    return _dict(c)


# ── Spatial Zones ────────────────────────────────────────────

@router.get("/zones")
async def list_zones(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(SpatialZone).where(SpatialZone.project_id == project_id)
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/zones")
async def create_zone(body: ZoneCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    z = SpatialZone(id=str(uuid.uuid4()), **body.model_dump())
    db.add(z)
    await db.commit()
    await db.refresh(z)
    return _dict(z)


# ── Viewpoints ───────────────────────────────────────────────

@router.get("/viewpoints")
async def list_viewpoints(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(Viewpoint).where(Viewpoint.project_id == project_id)
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/viewpoints")
async def create_viewpoint(body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    v = Viewpoint(id=str(uuid.uuid4()), created_by=user.id, **body)
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return _dict(v)


# ── Stats ────────────────────────────────────────────────────

@router.get("/stats")
async def bim_stats(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    models_count = (await db.execute(select(func.count()).where(BimModel.project_id == project_id, BimModel.deleted_at.is_(None)))).scalar() or 0
    open_issues = (await db.execute(select(func.count()).where(BimIssue.project_id == project_id, BimIssue.status.in_(["OUVERTE", "EN_COURS"])))).scalar() or 0
    resolved_issues = (await db.execute(select(func.count()).where(BimIssue.project_id == project_id, BimIssue.status.in_(["RESOLUE", "FERMEE"])))).scalar() or 0
    open_clashes = (await db.execute(select(func.count()).where(Clash.project_id == project_id, Clash.status.in_(["NOUVEAU", "EN_COURS"])))).scalar() or 0
    resolved_clashes = (await db.execute(select(func.count()).where(Clash.project_id == project_id, Clash.status == "RESOLU"))).scalar() or 0
    cost_avoided = (await db.execute(select(func.sum(Clash.cost_avoided)).where(Clash.project_id == project_id, Clash.status == "RESOLU"))).scalar() or 0
    return {
        "models_count": models_count,
        "open_issues": open_issues,
        "resolved_issues": resolved_issues,
        "open_clashes": open_clashes,
        "resolved_clashes": resolved_clashes,
        "total_cost_avoided": float(cost_avoided),
    }


def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
