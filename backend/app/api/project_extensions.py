"""
Project Extensions API — Sites, lots, milestones, risks, change orders.
Routes: /api/v1/projects/ext/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.service import require_staff
from app.models.extensions import Site, Lot, Milestone, Risk, ChangeOrder
from app.services.activity_service import log_activity
import uuid

router = APIRouter(prefix="/projects/ext", tags=["project-extensions"])


def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}

def _gen_code(prefix: str, n: int) -> str:
    return f"{prefix}-{datetime.utcnow().year}-{n:04d}"


# ── Site Schemas ─────────────────────────────────────────────

class SiteCreate(BaseModel):
    project_id: str
    name: str
    address: str = ""
    city: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    area_m2: float = 0.0
    description: str = ""
    access_instructions: str = ""
    photos: list = []

class SiteUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    area_m2: Optional[float] = None
    status: Optional[str] = None
    description: Optional[str] = None
    access_instructions: Optional[str] = None


# ── Sites ────────────────────────────────────────────────────

@router.get("/sites")
async def list_sites(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(Site).where(Site.project_id == project_id, Site.deleted_at.is_(None))
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/sites")
async def create_site(body: SiteCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    s = Site(id=str(uuid.uuid4()), **body.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _dict(s)


@router.patch("/sites/{site_id}")
async def update_site(site_id: str, body: SiteUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    s = (await db.execute(select(Site).where(Site.id == site_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    await db.commit()
    return _dict(s)


# ── Lot Schemas ──────────────────────────────────────────────

class LotCreate(BaseModel):
    project_id: str
    site_id: Optional[str] = None
    name: str
    code: str = ""
    discipline: str = ""
    description: str = ""
    budget: float = 0.0
    subcontractor_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class LotUpdate(BaseModel):
    name: Optional[str] = None
    discipline: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    actual_cost: Optional[float] = None
    progress: Optional[float] = None
    status: Optional[str] = None
    subcontractor_id: Optional[str] = None


# ── Lots ─────────────────────────────────────────────────────

@router.get("/lots")
async def list_lots(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(Lot).where(Lot.project_id == project_id, Lot.deleted_at.is_(None))
        .order_by(Lot.sort_order)
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/lots")
async def create_lot(body: LotCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    data = body.model_dump()
    for f in ("start_date", "end_date"):
        if data.get(f):
            data[f] = datetime.fromisoformat(data[f])
    lot = Lot(id=str(uuid.uuid4()), **data)
    db.add(lot)
    await db.commit()
    await db.refresh(lot)
    return _dict(lot)


@router.patch("/lots/{lot_id}")
async def update_lot(lot_id: str, body: LotUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    lot = (await db.execute(select(Lot).where(Lot.id == lot_id))).scalar_one_or_none()
    if not lot:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(lot, k, v)
    await db.commit()
    return _dict(lot)


@router.delete("/lots/{lot_id}")
async def delete_lot(lot_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    lot = (await db.execute(select(Lot).where(Lot.id == lot_id))).scalar_one_or_none()
    if not lot:
        raise HTTPException(404)
    lot.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Milestone Schemas ────────────────────────────────────────

class MilestoneCreate(BaseModel):
    project_id: str
    lot_id: Optional[str] = None
    name: str
    description: str = ""
    due_date: Optional[str] = None
    deliverables: list = []
    is_client_visible: bool = True
    is_payment_milestone: bool = False
    payment_percentage: float = 0.0

class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    completed_at: Optional[str] = None
    deliverables: Optional[list] = None


# ── Milestones ───────────────────────────────────────────────

@router.get("/milestones")
async def list_milestones(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(Milestone).where(Milestone.project_id == project_id, Milestone.deleted_at.is_(None))
        .order_by(Milestone.sort_order)
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/milestones")
async def create_milestone(body: MilestoneCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    data = body.model_dump()
    if data.get("due_date"):
        data["due_date"] = datetime.fromisoformat(data["due_date"])
    m = Milestone(id=str(uuid.uuid4()), **data)
    db.add(m)
    await db.commit()
    await db.refresh(m)
    await log_activity(db, user.id, "CREATE", "milestone", m.id, description=f"Jalon: {m.name}")
    return _dict(m)


@router.patch("/milestones/{milestone_id}")
async def update_milestone(milestone_id: str, body: MilestoneUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    m = (await db.execute(select(Milestone).where(Milestone.id == milestone_id))).scalar_one_or_none()
    if not m:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "due_date" in data and data["due_date"]:
        data["due_date"] = datetime.fromisoformat(data["due_date"])
    if "completed_at" in data and data["completed_at"]:
        data["completed_at"] = datetime.fromisoformat(data["completed_at"])
    if "status" in data and data["status"] == "COMPLETE":
        data["completed_at"] = datetime.utcnow()
    for k, v in data.items():
        setattr(m, k, v)
    await db.commit()
    return _dict(m)


# ── Risk Schemas ─────────────────────────────────────────────

class RiskCreate(BaseModel):
    project_id: str
    lot_id: Optional[str] = None
    title: str
    description: str = ""
    category: str = ""
    probability: str = "MOYEN"
    impact: str = "MOYEN"
    mitigation_plan: str = ""
    owner_id: Optional[str] = None

class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    probability: Optional[str] = None
    impact: Optional[str] = None
    status: Optional[str] = None
    mitigation_plan: Optional[str] = None
    actual_impact: Optional[str] = None


# ── Risks ────────────────────────────────────────────────────

RISK_SCORE = {"FAIBLE": 1, "MOYEN": 2, "ELEVE": 3, "CRITIQUE": 4}

@router.get("/risks")
async def list_risks(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(Risk).where(Risk.project_id == project_id, Risk.deleted_at.is_(None))
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/risks")
async def create_risk(body: RiskCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(Risk))).scalar() or 0
    score = RISK_SCORE.get(body.probability, 2) * RISK_SCORE.get(body.impact, 2)
    r = Risk(
        id=str(uuid.uuid4()),
        code=_gen_code("RSK", cnt + 1),
        risk_score=score,
        **body.model_dump(),
    )
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _dict(r)


@router.patch("/risks/{risk_id}")
async def update_risk(risk_id: str, body: RiskUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    r = (await db.execute(select(Risk).where(Risk.id == risk_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(r, k, v)
    if "probability" in data or "impact" in data:
        r.risk_score = RISK_SCORE.get(r.probability, 2) * RISK_SCORE.get(r.impact, 2)
    await db.commit()
    return _dict(r)


# ── Change Order Schemas ─────────────────────────────────────

class ChangeOrderCreate(BaseModel):
    project_id: str
    lot_id: Optional[str] = None
    title: str
    description: str = ""
    reason: str = ""
    requested_by: str = ""
    cost_impact: float = 0.0
    time_impact_days: int = 0
    documents: list = []

class ChangeOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    cost_impact: Optional[float] = None
    time_impact_days: Optional[int] = None
    decision_notes: Optional[str] = None


# ── Change Orders ────────────────────────────────────────────

@router.get("/change-orders")
async def list_change_orders(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(ChangeOrder).where(ChangeOrder.project_id == project_id, ChangeOrder.deleted_at.is_(None))
        .order_by(ChangeOrder.created_at.desc())
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/change-orders")
async def create_change_order(body: ChangeOrderCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(ChangeOrder))).scalar() or 0
    co = ChangeOrder(
        id=str(uuid.uuid4()),
        code=_gen_code("OdM", cnt + 1),
        submitted_by=user.id,
        **body.model_dump(),
    )
    db.add(co)
    await db.commit()
    await db.refresh(co)
    await log_activity(db, user.id, "CREATE", "change_order", co.id, description=f"Ordre de modification: {co.title}")
    return _dict(co)


@router.patch("/change-orders/{co_id}")
async def update_change_order(co_id: str, body: ChangeOrderUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    co = (await db.execute(select(ChangeOrder).where(ChangeOrder.id == co_id))).scalar_one_or_none()
    if not co:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] in ("APPROUVE", "REFUSE"):
        co.approved_by = user.id
        co.approved_at = datetime.utcnow()
    if "status" in data and data["status"] == "APPROUVE" and co.cost_impact:
        co.client_validated = False
    for k, v in data.items():
        setattr(co, k, v)
    await db.commit()
    return _dict(co)


@router.patch("/change-orders/{co_id}/client-validate")
async def client_validate_change_order(co_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    co = (await db.execute(select(ChangeOrder).where(ChangeOrder.id == co_id))).scalar_one_or_none()
    if not co:
        raise HTTPException(404)
    co.client_validated = True
    co.client_validated_at = datetime.utcnow()
    await db.commit()
    return _dict(co)


# ── Stats ────────────────────────────────────────────────────

@router.get("/stats")
async def project_ext_stats(project_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    lots_count = (await db.execute(select(func.count()).where(Lot.project_id == project_id, Lot.deleted_at.is_(None)))).scalar() or 0
    milestones_total = (await db.execute(select(func.count()).where(Milestone.project_id == project_id, Milestone.deleted_at.is_(None)))).scalar() or 0
    milestones_done = (await db.execute(select(func.count()).where(Milestone.project_id == project_id, Milestone.status == "COMPLETE"))).scalar() or 0
    risks_open = (await db.execute(select(func.count()).where(Risk.project_id == project_id, Risk.status == "IDENTIFIE"))).scalar() or 0
    change_orders = (await db.execute(select(func.count()).where(ChangeOrder.project_id == project_id, ChangeOrder.deleted_at.is_(None)))).scalar() or 0
    cost_impact = (await db.execute(select(func.sum(ChangeOrder.cost_impact)).where(ChangeOrder.project_id == project_id, ChangeOrder.status == "APPROUVE"))).scalar() or 0
    return {
        "lots_count": lots_count,
        "milestones_total": milestones_total,
        "milestones_done": milestones_done,
        "risks_open": risks_open,
        "change_orders": change_orders,
        "approved_cost_impact": float(cost_impact),
    }
