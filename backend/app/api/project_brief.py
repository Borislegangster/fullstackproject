"""
Project Brief API — Multi-step questionnaire for /decrire-mon-projet.
Routes: /api/v1/project-brief/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.service import get_current_user
from app.models.extensions import ProjectBrief
from app.services.notification_service import create_notification
import uuid

router = APIRouter(prefix="/project-brief", tags=["project-brief"])


def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ── Schemas ──────────────────────────────────────────────────

class BriefStep1(BaseModel):
    project_type: str = ""
    universe: str = ""
    construction_type: str = ""
    surface_m2: float = 0.0
    floors: int = 1
    location_city: str = ""
    location_address: str = ""
    terrain_owned: bool = False
    terrain_description: str = ""

class BriefStep2(BaseModel):
    budget_range: str = ""
    budget_min: float = 0.0
    budget_max: float = 0.0
    financing_mode: str = ""
    timeline: str = ""
    desired_start_date: Optional[str] = None
    desired_end_date: Optional[str] = None
    urgency: str = "NORMAL"

class BriefStep3(BaseModel):
    rooms: list = []
    special_features: list = []
    style_preferences: list = []
    materials_preferences: list = []
    energy_requirements: list = []
    accessibility_needs: list = []
    description_libre: str = ""

class BriefStep4(BaseModel):
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    contact_whatsapp: str = ""
    company_name: str = ""
    how_found_us: str = ""
    documents: list = []
    photos: list = []
    accept_terms: bool = False
    newsletter_opt_in: bool = False

class BriefUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    internal_notes: Optional[str] = None
    estimated_budget: Optional[float] = None
    priority: Optional[str] = None


# ── Public endpoints (no auth for initial submission) ────────

@router.post("/start")
async def start_brief(body: BriefStep1, db: AsyncSession = Depends(get_db)):
    cnt = (await db.execute(select(func.count()).select_from(ProjectBrief))).scalar() or 0
    brief = ProjectBrief(
        id=str(uuid.uuid4()),
        code=f"DMP-{datetime.utcnow().year}-{cnt + 1:04d}",
        current_step=1,
        step1_data=body.model_dump(),
        project_type=body.project_type,
        universe=body.universe,
    )
    db.add(brief)
    await db.commit()
    await db.refresh(brief)
    return {"id": brief.id, "code": brief.code, "current_step": 1}


@router.patch("/{brief_id}/step2")
async def save_step2(brief_id: str, body: BriefStep2, db: AsyncSession = Depends(get_db)):
    brief = (await db.execute(select(ProjectBrief).where(ProjectBrief.id == brief_id))).scalar_one_or_none()
    if not brief:
        raise HTTPException(404)
    brief.step2_data = body.model_dump()
    brief.current_step = max(brief.current_step, 2)
    await db.commit()
    return {"id": brief.id, "current_step": brief.current_step}


@router.patch("/{brief_id}/step3")
async def save_step3(brief_id: str, body: BriefStep3, db: AsyncSession = Depends(get_db)):
    brief = (await db.execute(select(ProjectBrief).where(ProjectBrief.id == brief_id))).scalar_one_or_none()
    if not brief:
        raise HTTPException(404)
    brief.step3_data = body.model_dump()
    brief.current_step = max(brief.current_step, 3)
    await db.commit()
    return {"id": brief.id, "current_step": brief.current_step}


@router.patch("/{brief_id}/step4")
async def save_step4(brief_id: str, body: BriefStep4, db: AsyncSession = Depends(get_db)):
    brief = (await db.execute(select(ProjectBrief).where(ProjectBrief.id == brief_id))).scalar_one_or_none()
    if not brief:
        raise HTTPException(404)
    brief.step4_data = body.model_dump()
    brief.contact_name = body.contact_name
    brief.contact_email = body.contact_email
    brief.contact_phone = body.contact_phone
    brief.current_step = 4
    brief.status = "SOUMIS"
    brief.submitted_at = datetime.utcnow()
    await db.commit()
    return {"id": brief.id, "code": brief.code, "status": "SOUMIS"}


@router.get("/{brief_id}")
async def get_brief_public(brief_id: str, db: AsyncSession = Depends(get_db)):
    brief = (await db.execute(select(ProjectBrief).where(ProjectBrief.id == brief_id))).scalar_one_or_none()
    if not brief:
        raise HTTPException(404)
    return {
        "id": brief.id,
        "code": brief.code,
        "status": brief.status,
        "current_step": brief.current_step,
        "step1_data": brief.step1_data,
        "step2_data": brief.step2_data,
        "step3_data": brief.step3_data,
        "step4_data": brief.step4_data,
    }


# ── Admin endpoints ──────────────────────────────────────────

@router.get("")
async def list_briefs(
    status: Optional[str] = None,
    universe: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    q = select(ProjectBrief)
    if status:
        q = q.where(ProjectBrief.status == status)
    if universe:
        q = q.where(ProjectBrief.universe == universe)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.order_by(ProjectBrief.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return {"items": [_dict(r) for r in rows], "total": total}


@router.patch("/{brief_id}/admin")
async def update_brief_admin(brief_id: str, body: BriefUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    brief = (await db.execute(select(ProjectBrief).where(ProjectBrief.id == brief_id))).scalar_one_or_none()
    if not brief:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] == "EN_ETUDE":
        brief.reviewed_at = datetime.utcnow()
    if "status" in data and data["status"] == "CONVERTI":
        brief.converted_at = datetime.utcnow()
    for k, v in data.items():
        setattr(brief, k, v)
    await db.commit()
    return _dict(brief)


@router.get("/stats")
async def brief_stats(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    total = (await db.execute(select(func.count()).select_from(ProjectBrief))).scalar() or 0
    submitted = (await db.execute(select(func.count()).where(ProjectBrief.status == "SOUMIS"))).scalar() or 0
    converted = (await db.execute(select(func.count()).where(ProjectBrief.status == "CONVERTI"))).scalar() or 0
    return {
        "total": total,
        "submitted": submitted,
        "en_etude": total - submitted - converted,
        "converted": converted,
        "conversion_rate": round(converted / max(total, 1) * 100, 1),
    }
