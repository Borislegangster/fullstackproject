"""
CMS Offers & Expertises API — Universes, offers, expertises for vitrine.
Routes: /api/v1/cms/offers/*, /api/v1/cms/expertises/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.service import require_admin, get_current_user
from app.models.extensions import CMSOffer, CMSExpertise, CMSRedirect
import uuid

router = APIRouter(prefix="/cms", tags=["cms-content"])


def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ── Offer Schemas ────────────────────────────────────────────

class OfferCreate(BaseModel):
    universe: str
    slug: str
    name: str
    tagline: str = ""
    hero_title: str = ""
    hero_subtitle: str = ""
    hero_image: str = ""
    hero_video: str = ""
    description: str = ""
    features: list = []
    offers: list = []
    testimonials: list = []
    faq: list = []
    cta_title: str = ""
    cta_description: str = ""
    cta_button_text: str = ""
    cta_button_url: str = ""
    seo_title: str = ""
    seo_description: str = ""
    seo_keywords: list = []
    sort_order: int = 0

class OfferUpdate(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    hero_image: Optional[str] = None
    hero_video: Optional[str] = None
    description: Optional[str] = None
    features: Optional[list] = None
    offers: Optional[list] = None
    testimonials: Optional[list] = None
    faq: Optional[list] = None
    cta_title: Optional[str] = None
    cta_description: Optional[str] = None
    is_published: Optional[bool] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None


# ── Offers ───────────────────────────────────────────────────

@router.get("/offers")
async def list_offers(
    universe: Optional[str] = None,
    published_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    q = select(CMSOffer).where(CMSOffer.deleted_at.is_(None))
    if universe:
        q = q.where(CMSOffer.universe == universe)
    if published_only:
        q = q.where(CMSOffer.is_published == True)
    rows = (await db.execute(q.order_by(CMSOffer.sort_order))).scalars().all()
    return [_dict(r) for r in rows]


@router.get("/offers/{slug}")
async def get_offer(slug: str, db: AsyncSession = Depends(get_db)):
    o = (await db.execute(
        select(CMSOffer).where(CMSOffer.slug == slug, CMSOffer.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not o:
        raise HTTPException(404)
    return _dict(o)


@router.post("/offers")
async def create_offer(body: OfferCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    o = CMSOffer(id=str(uuid.uuid4()), **body.model_dump())
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return _dict(o)


@router.patch("/offers/{offer_id}")
async def update_offer(offer_id: str, body: OfferUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    o = (await db.execute(select(CMSOffer).where(CMSOffer.id == offer_id))).scalar_one_or_none()
    if not o:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(o, k, v)
    await db.commit()
    return _dict(o)


@router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    o = (await db.execute(select(CMSOffer).where(CMSOffer.id == offer_id))).scalar_one_or_none()
    if not o:
        raise HTTPException(404)
    o.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Expertise Schemas ────────────────────────────────────────

class ExpertiseCreate(BaseModel):
    slug: str
    name: str
    category: str = ""
    description: str = ""
    icon: str = ""
    image: str = ""
    capabilities: list = []
    tools: list = []
    certifications: list = []
    projects_count: int = 0
    years_experience: int = 0
    key_figures: list = []
    seo_title: str = ""
    seo_description: str = ""
    sort_order: int = 0

class ExpertiseUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    image: Optional[str] = None
    capabilities: Optional[list] = None
    tools: Optional[list] = None
    certifications: Optional[list] = None
    is_published: Optional[bool] = None


# ── Expertises ───────────────────────────────────────────────

@router.get("/expertises")
async def list_expertises(
    category: Optional[str] = None,
    published_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    q = select(CMSExpertise).where(CMSExpertise.deleted_at.is_(None))
    if category:
        q = q.where(CMSExpertise.category == category)
    if published_only:
        q = q.where(CMSExpertise.is_published == True)
    rows = (await db.execute(q.order_by(CMSExpertise.sort_order))).scalars().all()
    return [_dict(r) for r in rows]


@router.get("/expertises/{slug}")
async def get_expertise(slug: str, db: AsyncSession = Depends(get_db)):
    e = (await db.execute(
        select(CMSExpertise).where(CMSExpertise.slug == slug, CMSExpertise.deleted_at.is_(None))
    )).scalar_one_or_none()
    if not e:
        raise HTTPException(404)
    return _dict(e)


@router.post("/expertises")
async def create_expertise(body: ExpertiseCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    e = CMSExpertise(id=str(uuid.uuid4()), **body.model_dump())
    db.add(e)
    await db.commit()
    await db.refresh(e)
    return _dict(e)


@router.patch("/expertises/{expertise_id}")
async def update_expertise(expertise_id: str, body: ExpertiseUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    e = (await db.execute(select(CMSExpertise).where(CMSExpertise.id == expertise_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    await db.commit()
    return _dict(e)


@router.delete("/expertises/{expertise_id}")
async def delete_expertise(expertise_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    e = (await db.execute(select(CMSExpertise).where(CMSExpertise.id == expertise_id))).scalar_one_or_none()
    if not e:
        raise HTTPException(404)
    e.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Redirects ────────────────────────────────────────────────

@router.get("/redirects")
async def list_redirects(db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    rows = (await db.execute(select(CMSRedirect).where(CMSRedirect.is_active == True))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/redirects")
async def create_redirect(body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    r = CMSRedirect(id=str(uuid.uuid4()), **body)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _dict(r)
