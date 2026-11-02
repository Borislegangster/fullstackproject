"""Tenders / RFQ / Consultation API — Lots, bids, comparison, award."""
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
from app.models.erp_v4 import (
    Tender, TenderLot, TenderInvitation, Bid, BidItem,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/tenders", tags=["Tenders"])

from app.utils.time import utcnow_naive as _now


# ── Schemas ─────────────────────────────────────────────────

class TenderCreate(BaseModel):
    title: str
    description: str = ""
    project_id: Optional[str] = None
    type: str = "CONSULTATION"  # CONSULTATION, APPEL_OFFRES, GREPRE_GRE
    deadline: Optional[datetime] = None
    budget_estimate: float = 0.0
    currency: str = "EUR"
    requirements: list = []
    documents: list = []


class TenderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    deadline: Optional[datetime] = None
    budget_estimate: Optional[float] = None
    requirements: Optional[list] = None
    status: Optional[str] = None


class LotCreate(BaseModel):
    title: str
    description: str = ""
    lot_number: int = 1
    estimated_amount: float = 0.0
    speciality: str = ""
    unit: str = ""
    quantity: float = 0.0


class InviteData(BaseModel):
    supplier_ids: list = []
    subcontractor_ids: list = []
    message: str = ""


class BidCreate(BaseModel):
    lot_id: Optional[str] = None
    supplier_id: Optional[str] = None
    subcontractor_id: Optional[str] = None
    total_amount: float = 0.0
    currency: str = "EUR"
    delivery_days: int = 0
    validity_days: int = 30
    technical_notes: str = ""
    items: list = []
    documents: list = []


class AwardData(BaseModel):
    lot_id: str
    bid_id: str
    notes: str = ""


# ── Tenders CRUD ────────────────────────────────────────────

@router.post("", status_code=201)
async def create_tender(
    data: TenderCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(Tender.id)))
    count = count_r.scalar() or 0
    code = f"AO-{_now().strftime('%Y')}-{count + 1:04d}"
    tender = Tender(
        code=code, status="BROUILLON", created_by=user.id,
        **data.model_dump(),
    )
    db.add(tender)
    await log_activity(db, user.id, "TENDER_CREATED", "tender", tender.id,
                       new_value={"code": code, "title": data.title})
    await db.commit()
    return {"id": tender.id, "code": code}


@router.get("")
async def list_tenders(
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(Tender).where(Tender.deleted_at.is_(None))
    if status:
        query = query.where(Tender.status == status)
    if project_id:
        query = query.where(Tender.project_id == project_id)
    if type:
        query = query.where(Tender.type == type)
    if search:
        query = query.where(Tender.title.ilike(f"%{search}%"))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    r = await db.execute(
        query.order_by(Tender.created_at.desc()).offset(offset).limit(limit)
    )
    items = [
        {
            "id": t.id, "code": t.code, "title": t.title,
            "type": t.type, "status": t.status,
            "project_id": t.project_id, "deadline": t.deadline,
            "budget_estimate": t.budget_estimate,
            "created_by": t.created_by, "created_at": t.created_at,
        }
        for t in r.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{tender_id}")
async def get_tender(
    tender_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Tender).where(Tender.id == tender_id, Tender.deleted_at.is_(None))
    )
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Consultation introuvable")
    # Lots
    lots_r = await db.execute(
        select(TenderLot).where(TenderLot.tender_id == tender_id)
        .order_by(TenderLot.lot_number)
    )
    lots = [
        {
            "id": l.id, "lot_number": l.lot_number, "title": l.title,
            "description": l.description, "estimated_amount": l.estimated_amount,
            "speciality": l.speciality, "awarded_to": l.awarded_to,
            "awarded_bid_id": l.awarded_bid_id, "status": l.status,
        }
        for l in lots_r.scalars().all()
    ]
    # Bids
    bids_r = await db.execute(
        select(Bid).where(Bid.tender_id == tender_id)
        .order_by(Bid.created_at.asc())
    )
    bids = [
        {
            "id": b.id, "lot_id": b.lot_id,
            "supplier_id": b.supplier_id, "subcontractor_id": b.subcontractor_id,
            "total_amount": b.total_amount, "delivery_days": b.delivery_days,
            "validity_days": b.validity_days, "status": b.status,
            "created_at": b.created_at,
        }
        for b in bids_r.scalars().all()
    ]
    # Invitations
    inv_r = await db.execute(
        select(TenderInvitation).where(TenderInvitation.tender_id == tender_id)
    )
    invitations = [
        {
            "id": i.id, "supplier_id": i.supplier_id,
            "subcontractor_id": i.subcontractor_id,
            "status": i.status, "sent_at": i.sent_at,
            "responded_at": i.responded_at,
        }
        for i in inv_r.scalars().all()
    ]
    return {
        "id": t.id, "code": t.code, "title": t.title,
        "description": t.description, "type": t.type,
        "status": t.status, "project_id": t.project_id,
        "deadline": t.deadline, "budget_estimate": t.budget_estimate,
        "currency": t.currency, "requirements": t.requirements,
        "documents": t.documents, "created_by": t.created_by,
        "created_at": t.created_at,
        "lots": lots,
        "bids": bids,
        "invitations": invitations,
    }


@router.put("/{tender_id}")
async def update_tender(
    tender_id: str,
    data: TenderUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Tender).where(Tender.id == tender_id, Tender.deleted_at.is_(None))
    )
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Consultation introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(t, k, v)
    t.updated_at = _now()
    await log_activity(db, user.id, "TENDER_UPDATED", "tender", tender_id,
                       new_value=updates)
    await db.commit()
    return {"detail": "Consultation mise a jour"}


# ── Lots ────────────────────────────────────────────────────

@router.post("/{tender_id}/lots", status_code=201)
async def add_lot(
    tender_id: str,
    data: LotCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Tender).where(Tender.id == tender_id, Tender.deleted_at.is_(None))
    )
    if not r.scalars().first():
        raise HTTPException(404, "Consultation introuvable")
    lot = TenderLot(tender_id=tender_id, **data.model_dump())
    db.add(lot)
    await log_activity(db, user.id, "TENDER_LOT_ADDED", "tender", tender_id)
    await db.commit()
    return {"id": lot.id}


# ── Invitations ─────────────────────────────────────────────

@router.post("/{tender_id}/invite", status_code=201)
async def invite_participants(
    tender_id: str,
    data: InviteData,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Tender).where(Tender.id == tender_id, Tender.deleted_at.is_(None))
    )
    tender = r.scalars().first()
    if not tender:
        raise HTTPException(404, "Consultation introuvable")
    created = 0
    for sid in data.supplier_ids:
        inv = TenderInvitation(
            tender_id=tender_id, supplier_id=sid,
            message=data.message, sent_at=_now(), status="ENVOYEE",
        )
        db.add(inv)
        created += 1
    for scid in data.subcontractor_ids:
        inv = TenderInvitation(
            tender_id=tender_id, subcontractor_id=scid,
            message=data.message, sent_at=_now(), status="ENVOYEE",
        )
        db.add(inv)
        created += 1
    if tender.status == "BROUILLON":
        tender.status = "PUBLIEE"
        tender.updated_at = _now()
    await log_activity(db, user.id, "TENDER_INVITATIONS_SENT", "tender", tender_id,
                       new_value={"count": created})
    await db.commit()
    return {"detail": f"{created} invitation(s) envoyee(s)"}


# ── Bids ────────────────────────────────────────────────────

@router.post("/{tender_id}/bids", status_code=201)
async def submit_bid(
    tender_id: str,
    data: BidCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Tender).where(Tender.id == tender_id, Tender.deleted_at.is_(None))
    )
    tender = r.scalars().first()
    if not tender:
        raise HTTPException(404, "Consultation introuvable")
    if tender.status not in ("PUBLIEE", "EN_COURS"):
        raise HTTPException(400, "Cette consultation n'accepte plus de soumissions")
    if tender.deadline and _now() > tender.deadline:
        raise HTTPException(400, "Date limite de soumission depassee")
    bid = Bid(
        tender_id=tender_id, submitted_by=user.id, status="SOUMISE",
        **data.model_dump(exclude={"items"}),
    )
    db.add(bid)
    await db.flush()
    # Bid items
    for idx, item in enumerate(data.items):
        if not isinstance(item, dict):
            continue
        bi = BidItem(
            bid_id=bid.id,
            line_number=idx + 1,
            description=item.get("description", ""),
            quantity=float(item.get("quantity", 0)),
            unit_price=float(item.get("unit_price", 0)),
            total=float(item.get("total", 0)),
        )
        db.add(bi)
    await log_activity(db, user.id, "BID_SUBMITTED", "tender", tender_id,
                       new_value={"bid_amount": data.total_amount})
    await db.commit()
    return {"id": bid.id}


# ── Compare bids ────────────────────────────────────────────

@router.get("/{tender_id}/compare")
async def compare_bids(
    tender_id: str,
    lot_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Tender).where(Tender.id == tender_id, Tender.deleted_at.is_(None))
    )
    if not r.scalars().first():
        raise HTTPException(404, "Consultation introuvable")
    query = select(Bid).where(Bid.tender_id == tender_id)
    if lot_id:
        query = query.where(Bid.lot_id == lot_id)
    bids_r = await db.execute(query.order_by(Bid.total_amount.asc()))
    bids = bids_r.scalars().all()
    if not bids:
        return {"bids": [], "summary": {"count": 0}}
    comparison = []
    for b in bids:
        # Load items for each bid
        items_r = await db.execute(
            select(BidItem).where(BidItem.bid_id == b.id).order_by(BidItem.line_number)
        )
        bid_items = [
            {
                "line_number": bi.line_number, "description": bi.description,
                "quantity": bi.quantity, "unit_price": bi.unit_price, "total": bi.total,
            }
            for bi in items_r.scalars().all()
        ]
        comparison.append({
            "bid_id": b.id, "lot_id": b.lot_id,
            "supplier_id": b.supplier_id, "subcontractor_id": b.subcontractor_id,
            "total_amount": b.total_amount, "delivery_days": b.delivery_days,
            "validity_days": b.validity_days, "status": b.status,
            "technical_notes": b.technical_notes,
            "items": bid_items, "submitted_at": b.created_at,
        })
    amounts = [b.total_amount for b in bids if b.total_amount]
    return {
        "bids": comparison,
        "summary": {
            "count": len(bids),
            "lowest": min(amounts) if amounts else 0,
            "highest": max(amounts) if amounts else 0,
            "average": round(sum(amounts) / len(amounts), 2) if amounts else 0,
        },
    }


# ── Award ───────────────────────────────────────────────────

@router.post("/{tender_id}/award", status_code=201)
async def award_lot(
    tender_id: str,
    data: AwardData,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Tender).where(Tender.id == tender_id, Tender.deleted_at.is_(None))
    )
    tender = r.scalars().first()
    if not tender:
        raise HTTPException(404, "Consultation introuvable")
    # Find lot
    lot_r = await db.execute(
        select(TenderLot).where(TenderLot.id == data.lot_id, TenderLot.tender_id == tender_id)
    )
    lot = lot_r.scalars().first()
    if not lot:
        raise HTTPException(404, "Lot introuvable")
    # Find bid
    bid_r = await db.execute(
        select(Bid).where(Bid.id == data.bid_id, Bid.tender_id == tender_id)
    )
    bid = bid_r.scalars().first()
    if not bid:
        raise HTTPException(404, "Soumission introuvable")
    # Award
    lot.awarded_bid_id = bid.id
    lot.awarded_to = bid.supplier_id or bid.subcontractor_id
    lot.status = "ATTRIBUE"
    bid.status = "RETENUE"
    # Reject other bids for this lot
    others_r = await db.execute(
        select(Bid).where(
            Bid.tender_id == tender_id,
            Bid.lot_id == data.lot_id,
            Bid.id != bid.id,
            Bid.status == "SOUMISE",
        )
    )
    for other in others_r.scalars().all():
        other.status = "NON_RETENUE"
    # Check if all lots awarded
    all_lots_r = await db.execute(
        select(TenderLot).where(TenderLot.tender_id == tender_id)
    )
    all_lots = all_lots_r.scalars().all()
    if all_lots and all(l.status == "ATTRIBUE" for l in all_lots):
        tender.status = "ATTRIBUEE"
        tender.updated_at = _now()
    await log_activity(db, user.id, "TENDER_LOT_AWARDED", "tender", tender_id,
                       new_value={"lot_id": data.lot_id, "bid_id": data.bid_id})
    await db.commit()
    return {"detail": "Lot attribue", "lot_id": lot.id, "bid_id": bid.id}
