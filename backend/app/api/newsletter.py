"""
Newsletter & Marketing API — Segments, templates, campaigns, automation.
Routes: /api/v1/newsletter/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.auth.service import require_staff, require_admin
from app.models.marketing import (
    NewsletterSegment, NewsletterTemplate, Campaign, CampaignEvent,
    AutoReplyTemplate, FormDefinition,
)
from app.models.cms import NewsletterSubscriber
from app.services.activity_service import log_activity
import uuid

router = APIRouter(prefix="/newsletter", tags=["newsletter"])


# ── Schemas ──────────────────────────────────────────────────

class SegmentCreate(BaseModel):
    name: str
    description: str = ""
    criteria: dict = {}
    is_dynamic: bool = True

class TemplateCreate(BaseModel):
    name: str
    subject: str = ""
    html_content: str = ""
    text_content: str = ""
    category: str = ""
    variables: list = []

class CampaignCreate(BaseModel):
    name: str
    description: str = ""
    campaign_type: str = "PONCTUELLE"
    template_id: Optional[str] = None
    segment_ids: list = []
    subject: str = ""
    from_name: str = "Globus Engineering"
    reply_to: str = ""
    scheduled_at: Optional[str] = None
    automation_trigger: str = ""
    automation_delay_hours: int = 0

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    subject: Optional[str] = None
    template_id: Optional[str] = None
    segment_ids: Optional[list] = None
    scheduled_at: Optional[str] = None

class AutoReplyCreate(BaseModel):
    name: str
    trigger: str
    channel: str = "EMAIL"
    subject: str = ""
    html_content: str = ""
    text_content: str = ""
    is_active: bool = True
    delay_minutes: int = 0


# ── Subscribers ──────────────────────────────────────────────

@router.get("/subscribers")
async def list_subscribers(
    status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(NewsletterSubscriber)
    if status:
        q = q.where(NewsletterSubscriber.status == status) if hasattr(NewsletterSubscriber, 'status') else q
    if search:
        q = q.where(NewsletterSubscriber.email.ilike(f"%{search}%"))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.order_by(NewsletterSubscriber.subscribed_at.desc()).offset(skip).limit(limit))).scalars().all()
    return {"items": [_dict(r) for r in rows], "total": total}


@router.delete("/subscribers/{sub_id}")
async def unsubscribe(sub_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    sub = (await db.execute(select(NewsletterSubscriber).where(NewsletterSubscriber.id == sub_id))).scalar_one_or_none()
    if not sub:
        raise HTTPException(404)
    await db.delete(sub)
    await db.commit()
    return {"ok": True}


# ── Segments ─────────────────────────────────────────────────

@router.get("/segments")
async def list_segments(db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(NewsletterSegment).where(NewsletterSegment.deleted_at.is_(None))
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/segments")
async def create_segment(body: SegmentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    s = NewsletterSegment(id=str(uuid.uuid4()), **body.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _dict(s)


@router.delete("/segments/{segment_id}")
async def delete_segment(segment_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    s = (await db.execute(select(NewsletterSegment).where(NewsletterSegment.id == segment_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(404)
    s.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Templates ────────────────────────────────────────────────

@router.get("/templates")
async def list_templates(db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(NewsletterTemplate).where(NewsletterTemplate.deleted_at.is_(None))
    )).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/templates")
async def create_template(body: TemplateCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    t = NewsletterTemplate(id=str(uuid.uuid4()), created_by=user.id, **body.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return _dict(t)


@router.patch("/templates/{template_id}")
async def update_template(template_id: str, body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    t = (await db.execute(select(NewsletterTemplate).where(NewsletterTemplate.id == template_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    for k, v in body.items():
        if hasattr(t, k):
            setattr(t, k, v)
    t.version += 1
    await db.commit()
    await db.refresh(t)
    return _dict(t)


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    t = (await db.execute(select(NewsletterTemplate).where(NewsletterTemplate.id == template_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    t.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Campaigns ────────────────────────────────────────────────

@router.get("/campaigns")
async def list_campaigns(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(Campaign).where(Campaign.deleted_at.is_(None))
    if status:
        q = q.where(Campaign.status == status)
    rows = (await db.execute(q.order_by(Campaign.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/campaigns")
async def create_campaign(body: CampaignCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    c = Campaign(
        id=str(uuid.uuid4()),
        created_by=user.id,
        scheduled_at=datetime.fromisoformat(body.scheduled_at) if body.scheduled_at else None,
        **{k: v for k, v in body.model_dump().items() if k != "scheduled_at"},
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    await log_activity(db, user.id, "CREATE", "campaign", c.id, description=f"Campagne créée: {c.name}")
    return _dict(c)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    events = (await db.execute(
        select(CampaignEvent.event_type, func.count().label("count"))
        .where(CampaignEvent.campaign_id == campaign_id)
        .group_by(CampaignEvent.event_type)
    )).all()
    result = _dict(c)
    result["event_stats"] = {e.event_type: e.count for e in events}
    return result


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: str, body: CampaignUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "scheduled_at" in data and data["scheduled_at"]:
        data["scheduled_at"] = datetime.fromisoformat(data["scheduled_at"])
    for k, v in data.items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return _dict(c)


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404)
    c.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Campaign Stats ───────────────────────────────────────────

@router.get("/stats")
async def newsletter_stats(db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    total_subs = (await db.execute(select(func.count()).select_from(NewsletterSubscriber))).scalar() or 0
    total_campaigns = (await db.execute(select(func.count()).where(Campaign.deleted_at.is_(None)))).scalar() or 0
    sent_campaigns = (await db.execute(select(func.count()).where(Campaign.status == "ENVOYEE"))).scalar() or 0
    total_sent = (await db.execute(select(func.sum(Campaign.sent_count)).where(Campaign.status == "ENVOYEE"))).scalar() or 0
    total_opened = (await db.execute(select(func.sum(Campaign.opened_count)).where(Campaign.status == "ENVOYEE"))).scalar() or 0
    return {
        "total_subscribers": total_subs,
        "total_campaigns": total_campaigns,
        "sent_campaigns": sent_campaigns,
        "total_emails_sent": int(total_sent or 0),
        "total_opens": int(total_opened or 0),
        "avg_open_rate": round(float(total_opened or 0) / max(float(total_sent or 1), 1) * 100, 1),
    }


# ── Auto-Replies ─────────────────────────────────────────────

@router.get("/auto-replies")
async def list_auto_replies(db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(select(AutoReplyTemplate))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/auto-replies")
async def create_auto_reply(body: AutoReplyCreate, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    ar = AutoReplyTemplate(id=str(uuid.uuid4()), **body.model_dump())
    db.add(ar)
    await db.commit()
    await db.refresh(ar)
    return _dict(ar)


@router.patch("/auto-replies/{ar_id}")
async def update_auto_reply(ar_id: str, body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_admin)):
    ar = (await db.execute(select(AutoReplyTemplate).where(AutoReplyTemplate.id == ar_id))).scalar_one_or_none()
    if not ar:
        raise HTTPException(404)
    for k, v in body.items():
        if hasattr(ar, k):
            setattr(ar, k, v)
    await db.commit()
    return _dict(ar)


def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
