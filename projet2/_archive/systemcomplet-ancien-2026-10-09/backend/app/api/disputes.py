"""Dispute / Litigation Management API — Full workflow with timeline events."""
from datetime import datetime
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, require_admin, get_current_user
# pyrefly: ignore [missing-import]
from app.models.erp_v4 import Dispute, DisputeEvent, DisputeEvidence
from app.services.activity_service import log_activity

router = APIRouter(prefix="/disputes", tags=["Disputes"])

from app.utils.time import utcnow_naive as _now

VALID_STATUSES = ("OUVERT", "EN_ANALYSE", "EN_NEGOCIATION", "DECISION", "RESOLU", "ESCALADE")
VALID_TRANSITIONS = {
    "OUVERT": ("EN_ANALYSE", "ESCALADE"),
    "EN_ANALYSE": ("EN_NEGOCIATION", "DECISION", "ESCALADE"),
    "EN_NEGOCIATION": ("DECISION", "ESCALADE"),
    "DECISION": ("RESOLU", "ESCALADE"),
    "ESCALADE": ("EN_ANALYSE", "DECISION", "RESOLU"),
}


# ── Schemas ─────────────────────────────────────────────────

class DisputeCreate(BaseModel):
    title: str
    description: str = ""
    category: str = ""  # QUALITE, RETARD, FACTURATION, CONTRAT, AUTRE
    priority: str = "NORMALE"  # BASSE, NORMALE, HAUTE, CRITIQUE
    supplier_id: Optional[str] = None
    project_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    delivery_id: Optional[str] = None
    amount_disputed: float = 0.0
    currency: str = "EUR"


class StatusUpdate(BaseModel):
    new_status: str
    reason: str = ""
    resolution_notes: str = ""
    resolution_amount: Optional[float] = None


class EventCreate(BaseModel):
    event_type: str  # NOTE, APPEL, EMAIL, REUNION, DECISION, ESCALADE
    title: str
    description: str = ""
    participants: list = []
    attachments: list = []


class EvidenceCreate(BaseModel):
    title: str
    description: str = ""
    file_url: str = ""
    file_type: str = ""  # PDF, IMAGE, EMAIL, AUTRE
    category: str = ""  # CONTRAT, FACTURE, PHOTO, CORRESPONDANCE


# ── Disputes CRUD ───────────────────────────────────────────

@router.post("", status_code=201)
async def create_dispute(
    data: DisputeCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(Dispute.id)))
    count = count_r.scalar() or 0
    code = f"LIT-{_now().strftime('%Y')}-{count + 1:04d}"
    dispute = Dispute(
        code=code, status="OUVERT", created_by=user.id,
        **data.model_dump(),
    )
    db.add(dispute)
    await db.flush()
    # Auto-create opening event
    opening = DisputeEvent(
        dispute_id=dispute.id,
        event_type="NOTE",
        title="Litige ouvert",
        description=data.description,
        created_by=user.id,
    )
    db.add(opening)
    await log_activity(db, user.id, "DISPUTE_CREATED", "dispute", dispute.id,
                       new_value={"code": code, "title": data.title})
    await db.commit()
    return {"id": dispute.id, "code": code}


@router.get("")
async def list_disputes(
    status: Optional[str] = None,
    category: Optional[str] = None,
    priority: Optional[str] = None,
    supplier_id: Optional[str] = None,
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(Dispute).where(Dispute.deleted_at.is_(None))
    if status:
        query = query.where(Dispute.status == status)
    if category:
        query = query.where(Dispute.category == category)
    if priority:
        query = query.where(Dispute.priority == priority)
    if supplier_id:
        query = query.where(Dispute.supplier_id == supplier_id)
    if project_id:
        query = query.where(Dispute.project_id == project_id)
    if search:
        query = query.where(Dispute.title.ilike(f"%{search}%"))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    r = await db.execute(
        query.order_by(Dispute.created_at.desc()).offset(offset).limit(limit)
    )
    items = [
        {
            "id": d.id, "code": d.code, "title": d.title,
            "category": d.category, "priority": d.priority,
            "status": d.status, "supplier_id": d.supplier_id,
            "project_id": d.project_id, "amount_disputed": d.amount_disputed,
            "created_by": d.created_by, "created_at": d.created_at,
        }
        for d in r.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/stats")
async def dispute_stats(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Dispute statistics: counts by status, category, priority; total amounts."""
    by_status = {}
    for s in VALID_STATUSES:
        r = await db.execute(
            select(func.count(Dispute.id)).where(
                Dispute.status == s, Dispute.deleted_at.is_(None)
            )
        )
        by_status[s] = r.scalar() or 0
    # By category
    cat_r = await db.execute(
        select(Dispute.category, func.count(Dispute.id))
        .where(Dispute.deleted_at.is_(None))
        .group_by(Dispute.category)
    )
    by_category = {cat: cnt for cat, cnt in cat_r.all()}
    # By priority
    prio_r = await db.execute(
        select(Dispute.priority, func.count(Dispute.id))
        .where(Dispute.deleted_at.is_(None))
        .group_by(Dispute.priority)
    )
    by_priority = {p: cnt for p, cnt in prio_r.all()}
    # Total disputed amount
    total_amount_r = await db.execute(
        select(func.sum(Dispute.amount_disputed)).where(Dispute.deleted_at.is_(None))
    )
    resolved_amount_r = await db.execute(
        select(func.sum(Dispute.resolution_amount)).where(
            Dispute.status == "RESOLU", Dispute.deleted_at.is_(None)
        )
    )
    return {
        "by_status": by_status,
        "by_category": by_category,
        "by_priority": by_priority,
        "total_disputed_amount": round(float(total_amount_r.scalar() or 0), 2),
        "total_resolved_amount": round(float(resolved_amount_r.scalar() or 0), 2),
        "total_open": sum(by_status.get(s, 0) for s in ("OUVERT", "EN_ANALYSE", "EN_NEGOCIATION")),
    }


@router.get("/{dispute_id}")
async def get_dispute(
    dispute_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Dispute).where(Dispute.id == dispute_id, Dispute.deleted_at.is_(None))
    )
    d = r.scalars().first()
    if not d:
        raise HTTPException(404, "Litige introuvable")
    # Timeline events
    events_r = await db.execute(
        select(DisputeEvent)
        .where(DisputeEvent.dispute_id == dispute_id)
        .order_by(DisputeEvent.created_at.asc())
    )
    events = [
        {
            "id": e.id, "event_type": e.event_type, "title": e.title,
            "description": e.description, "participants": e.participants,
            "attachments": e.attachments, "created_by": e.created_by,
            "created_at": e.created_at,
        }
        for e in events_r.scalars().all()
    ]
    # Evidence
    evidence_r = await db.execute(
        select(DisputeEvidence)
        .where(DisputeEvidence.dispute_id == dispute_id)
        .order_by(DisputeEvidence.created_at.asc())
    )
    evidence = [
        {
            "id": ev.id, "title": ev.title, "description": ev.description,
            "file_url": ev.file_url, "file_type": ev.file_type,
            "category": ev.category, "uploaded_by": ev.uploaded_by,
            "created_at": ev.created_at,
        }
        for ev in evidence_r.scalars().all()
    ]
    return {
        "id": d.id, "code": d.code, "title": d.title,
        "description": d.description, "category": d.category,
        "priority": d.priority, "status": d.status,
        "supplier_id": d.supplier_id, "project_id": d.project_id,
        "purchase_order_id": d.purchase_order_id,
        "delivery_id": d.delivery_id,
        "amount_disputed": d.amount_disputed, "currency": d.currency,
        "resolution_notes": d.resolution_notes,
        "resolution_amount": d.resolution_amount,
        "created_by": d.created_by, "created_at": d.created_at,
        "resolved_at": d.resolved_at,
        "timeline": events,
        "evidence": evidence,
    }


# ── Status transitions ──────────────────────────────────────

@router.put("/{dispute_id}/status")
async def update_dispute_status(
    dispute_id: str,
    data: StatusUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Dispute).where(Dispute.id == dispute_id, Dispute.deleted_at.is_(None))
    )
    d = r.scalars().first()
    if not d:
        raise HTTPException(404, "Litige introuvable")
    if data.new_status not in VALID_STATUSES:
        raise HTTPException(400, f"Statut invalide: {data.new_status}")
    allowed = VALID_TRANSITIONS.get(d.status, ())
    if data.new_status not in allowed:
        raise HTTPException(
            400,
            f"Transition {d.status} -> {data.new_status} non autorisee. "
            f"Transitions possibles: {', '.join(allowed)}",
        )
    old_status = d.status
    d.status = data.new_status
    d.updated_at = _now()
    if data.new_status == "RESOLU":
        d.resolved_at = _now()
        d.resolution_notes = data.resolution_notes
        if data.resolution_amount is not None:
            d.resolution_amount = data.resolution_amount
    # Auto-create timeline event for status change
    event = DisputeEvent(
        dispute_id=dispute_id,
        event_type="DECISION" if data.new_status == "DECISION" else "NOTE",
        title=f"Statut: {old_status} -> {data.new_status}",
        description=data.reason,
        created_by=user.id,
    )
    db.add(event)
    await log_activity(db, user.id, "DISPUTE_STATUS_CHANGED", "dispute", dispute_id,
                       new_value={"from": old_status, "to": data.new_status})
    await db.commit()
    return {"detail": f"Statut mis a jour: {data.new_status}"}


# ── Timeline events ─────────────────────────────────────────

@router.post("/{dispute_id}/events", status_code=201)
async def add_event(
    dispute_id: str,
    data: EventCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Dispute).where(Dispute.id == dispute_id, Dispute.deleted_at.is_(None))
    )
    if not r.scalars().first():
        raise HTTPException(404, "Litige introuvable")
    event = DisputeEvent(
        dispute_id=dispute_id, created_by=user.id,
        **data.model_dump(),
    )
    db.add(event)
    await log_activity(db, user.id, "DISPUTE_EVENT_ADDED", "dispute", dispute_id)
    await db.commit()
    return {"id": event.id}


# ── Evidence ────────────────────────────────────────────────

@router.post("/{dispute_id}/evidence", status_code=201)
async def add_evidence(
    dispute_id: str,
    data: EvidenceCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Dispute).where(Dispute.id == dispute_id, Dispute.deleted_at.is_(None))
    )
    if not r.scalars().first():
        raise HTTPException(404, "Litige introuvable")
    evidence = DisputeEvidence(
        dispute_id=dispute_id, uploaded_by=user.id,
        **data.model_dump(),
    )
    db.add(evidence)
    await log_activity(db, user.id, "DISPUTE_EVIDENCE_ADDED", "dispute", dispute_id)
    await db.commit()
    return {"id": evidence.id}
