"""
Disputes & Tenders API — Appels d'offres, soumissions, litiges, retenues.
Routes: /api/v1/tenders/*, /api/v1/disputes/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.service import require_staff
from app.models.extensions import Tender, Bid, Dispute, Retention
from app.services.activity_service import log_activity
import uuid


tender_router = APIRouter(prefix="/tenders", tags=["tenders"])
dispute_router = APIRouter(prefix="/disputes", tags=["disputes"])


def _gen_code(prefix: str, n: int) -> str:
    return f"{prefix}-{datetime.utcnow().year}-{n:04d}"

def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ── Tender Schemas ───────────────────────────────────────────

class TenderCreate(BaseModel):
    project_id: str
    lot_id: Optional[str] = None
    title: str
    description: str = ""
    scope_of_work: str = ""
    technical_specs: str = ""
    quantities: list = []
    quality_criteria: list = []
    deadline: Optional[str] = None
    invited_subcontractors: list = []
    allow_variants: bool = True
    estimated_budget: float = 0.0

class TenderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[str] = None

class BidCreate(BaseModel):
    subcontractor_id: str
    amount: float = 0.0
    duration_days: int = 0
    lines: list = []
    technical_proposal: str = ""
    variants: list = []
    exclusions: str = ""
    conditions: str = ""
    documents: list = []

class BidEvaluate(BaseModel):
    score_technique: float = 0.0
    score_prix: float = 0.0
    evaluation_notes: str = ""
    status: str = "EN_EVALUATION"


# ── Tenders ──────────────────────────────────────────────────

@tender_router.get("")
async def list_tenders(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(Tender).where(Tender.deleted_at.is_(None))
    if project_id:
        q = q.where(Tender.project_id == project_id)
    if status:
        q = q.where(Tender.status == status)
    rows = (await db.execute(q.order_by(Tender.created_at.desc()))).scalars().all()
    return [_dict(r) for r in rows]


@tender_router.post("")
async def create_tender(body: TenderCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(Tender))).scalar() or 0
    t = Tender(
        id=str(uuid.uuid4()),
        code=_gen_code("AO", cnt + 1),
        created_by=user.id,
        deadline=datetime.fromisoformat(body.deadline) if body.deadline else None,
        **{k: v for k, v in body.model_dump().items() if k != "deadline"},
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    await log_activity(db, user.id, "CREATE", "tender", t.id, description=f"Appel d'offres: {t.title}")
    return _dict(t)


@tender_router.get("/{tender_id}")
async def get_tender(tender_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    t = (await db.execute(select(Tender).where(Tender.id == tender_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    bids = (await db.execute(select(Bid).where(Bid.tender_id == tender_id))).scalars().all()
    result = _dict(t)
    result["bids"] = [_dict(b) for b in bids]
    return result


@tender_router.patch("/{tender_id}")
async def update_tender(tender_id: str, body: TenderUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    t = (await db.execute(select(Tender).where(Tender.id == tender_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "deadline" in data and data["deadline"]:
        data["deadline"] = datetime.fromisoformat(data["deadline"])
    for k, v in data.items():
        setattr(t, k, v)
    await db.commit()
    return _dict(t)


@tender_router.post("/{tender_id}/award/{subcontractor_id}")
async def award_tender(tender_id: str, subcontractor_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    t = (await db.execute(select(Tender).where(Tender.id == tender_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    t.status = "ATTRIBUEE"
    t.awarded_to = subcontractor_id
    t.awarded_at = datetime.utcnow()
    bids = (await db.execute(select(Bid).where(Bid.tender_id == tender_id))).scalars().all()
    for b in bids:
        b.status = "RETENU" if b.subcontractor_id == subcontractor_id else "NON_RETENU"
    await db.commit()
    return _dict(t)


# ── Bids ─────────────────────────────────────────────────────

@tender_router.post("/{tender_id}/bids")
async def submit_bid(tender_id: str, body: BidCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    t = (await db.execute(select(Tender).where(Tender.id == tender_id))).scalar_one_or_none()
    if not t:
        raise HTTPException(404)
    b = Bid(id=str(uuid.uuid4()), tender_id=tender_id, **body.model_dump())
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return _dict(b)


@tender_router.patch("/{tender_id}/bids/{bid_id}/evaluate")
async def evaluate_bid(tender_id: str, bid_id: str, body: BidEvaluate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    b = (await db.execute(select(Bid).where(Bid.id == bid_id))).scalar_one_or_none()
    if not b:
        raise HTTPException(404)
    b.score_technique = body.score_technique
    b.score_prix = body.score_prix
    b.score_global = round((body.score_technique * 0.6 + body.score_prix * 0.4), 2)
    b.evaluation_notes = body.evaluation_notes
    b.status = body.status
    b.evaluated_at = datetime.utcnow()
    b.evaluated_by = user.id
    await db.commit()
    return _dict(b)


# ── Disputes ─────────────────────────────────────────────────

class DisputeCreate(BaseModel):
    subcontractor_id: str
    project_id: Optional[str] = None
    contract_id: Optional[str] = None
    situation_id: Optional[str] = None
    title: str
    description: str = ""
    disputed_amount: float = 0.0
    freeze_payment: bool = False

class DisputeUpdate(BaseModel):
    status: Optional[str] = None
    description: Optional[str] = None
    accepted_amount: Optional[float] = None
    decision: Optional[str] = None
    freeze_payment: Optional[bool] = None

class ProposalAdd(BaseModel):
    amount: float = 0.0
    description: str = ""
    from_party: str = ""  # globus / subcontractor


@dispute_router.get("")
async def list_disputes(
    status: Optional[str] = None,
    subcontractor_id: Optional[str] = None,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(Dispute).where(Dispute.deleted_at.is_(None))
    if status:
        q = q.where(Dispute.status == status)
    if subcontractor_id:
        q = q.where(Dispute.subcontractor_id == subcontractor_id)
    if project_id:
        q = q.where(Dispute.project_id == project_id)
    rows = (await db.execute(q.order_by(Dispute.created_at.desc()))).scalars().all()
    return [_dict(r) for r in rows]


@dispute_router.post("")
async def create_dispute(body: DisputeCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(Dispute))).scalar() or 0
    d = Dispute(
        id=str(uuid.uuid4()),
        code=_gen_code("LIT", cnt + 1),
        responsible_id=user.id,
        **body.model_dump(),
    )
    db.add(d)
    await db.commit()
    await db.refresh(d)
    await log_activity(db, user.id, "CREATE", "dispute", d.id, description=f"Litige ouvert: {d.title}")
    return _dict(d)


@dispute_router.get("/{dispute_id}")
async def get_dispute(dispute_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    d = (await db.execute(select(Dispute).where(Dispute.id == dispute_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(404)
    return _dict(d)


@dispute_router.patch("/{dispute_id}")
async def update_dispute(dispute_id: str, body: DisputeUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    d = (await db.execute(select(Dispute).where(Dispute.id == dispute_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] == "DECISION":
        d.decision_by = user.id
        d.decision_at = datetime.utcnow()
    if "status" in data and data["status"] == "ESCALADE":
        d.escalated = True
        d.escalated_at = datetime.utcnow()
    for k, v in data.items():
        setattr(d, k, v)
    await db.commit()
    return _dict(d)


@dispute_router.post("/{dispute_id}/proposals")
async def add_proposal(dispute_id: str, body: ProposalAdd, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    d = (await db.execute(select(Dispute).where(Dispute.id == dispute_id))).scalar_one_or_none()
    if not d:
        raise HTTPException(404)
    proposals = d.proposals or []
    proposals.append({
        "date": datetime.utcnow().isoformat(),
        "from": body.from_party,
        "amount": body.amount,
        "description": body.description,
        "accepted": False,
    })
    d.proposals = proposals
    d.status = "EN_NEGOCIATION"
    await db.commit()
    return _dict(d)


# ── Retentions ───────────────────────────────────────────────

@dispute_router.get("/retentions")
async def list_retentions(contract_id: Optional[str] = None, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    q = select(Retention)
    if contract_id:
        q = q.where(Retention.contract_id == contract_id)
    rows = (await db.execute(q)).scalars().all()
    return [_dict(r) for r in rows]


@dispute_router.post("/retentions")
async def create_retention(body: dict, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    r = Retention(id=str(uuid.uuid4()), **body)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return _dict(r)


@dispute_router.patch("/retentions/{retention_id}/release")
async def release_retention(retention_id: str, amount: float = 0, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    r = (await db.execute(select(Retention).where(Retention.id == retention_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(404)
    r.released_amount += amount
    r.remaining = r.total_retained - r.released_amount
    if r.remaining <= 0:
        r.status = "LIBEREE"
        r.remaining = 0
    else:
        r.status = "PARTIELLEMENT_LIBEREE"
    await db.commit()
    return _dict(r)
