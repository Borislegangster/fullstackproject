"""Procurement API — Purchase Requests, Orders, Stock & Inventory."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, require_admin
from app.models.erp import PurchaseRequest, PurchaseOrder, StockItem, StockMovement
from app.services.activity_service import log_activity

router = APIRouter(prefix="/procurement", tags=["Procurement"])


class PRCreate(BaseModel):
    project_id: Optional[str] = None
    description: str
    items: list = []
    estimated_total: float = 0.0

class StockItemCreate(BaseModel):
    name: str
    category: str = ""
    unit: str = "pcs"
    quantity: float = 0.0
    alert_threshold: float = 10.0
    location: str = ""

class StockMovementCreate(BaseModel):
    stock_item_id: str
    movement_type: str  # IN, OUT
    quantity: float
    project_id: Optional[str] = None
    reference: str = ""
    notes: str = ""


# ── Purchase Requests ────────────────────────────────────────

@router.get("/purchase-requests")
async def list_prs(status_filter: Optional[str] = None, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    query = select(PurchaseRequest).where(PurchaseRequest.deleted_at.is_(None)).order_by(PurchaseRequest.created_at.desc())
    if status_filter:
        query = query.where(PurchaseRequest.status == status_filter)
    r = await db.execute(query)
    return [
        {"id": p.id, "code": p.code, "project_id": p.project_id, "description": p.description,
         "items": p.items, "estimated_total": p.estimated_total, "status": p.status,
         "requested_by": p.requested_by, "created_at": p.created_at}
        for p in r.scalars().all()
    ]

@router.post("/purchase-requests")
async def create_pr(data: PRCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    count_r = await db.execute(select(func.count(PurchaseRequest.id)))
    count = count_r.scalar() or 0
    code = f"DA-{datetime.utcnow().strftime('%Y')}-{count + 1:03d}"
    pr = PurchaseRequest(code=code, requested_by=user.id, **data.model_dump())
    db.add(pr)
    await db.commit()
    return {"id": pr.id, "code": code}

@router.post("/purchase-requests/{pr_id}/validate")
async def validate_pr(pr_id: str, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(PurchaseRequest).where(PurchaseRequest.id == pr_id))
    pr = r.scalars().first()
    if not pr:
        raise HTTPException(404, "DA introuvable")
    pr.status = "VALIDEE"
    pr.validated_by = user.id
    pr.validated_at = datetime.utcnow()

    # Auto-create purchase order
    count_r = await db.execute(select(func.count(PurchaseOrder.id)))
    count = count_r.scalar() or 0
    code = f"BC-{datetime.utcnow().strftime('%Y')}-{count + 1:03d}"
    po = PurchaseOrder(code=code, purchase_request_id=pr.id, items=pr.items, total=pr.estimated_total)
    db.add(po)
    await log_activity(db, user.id, "PR_VALIDATED", "purchase_request", pr.id)
    await db.commit()
    return {"detail": "DA validée, BC créé", "purchase_order_code": code}

@router.post("/purchase-requests/{pr_id}/reject")
async def reject_pr(pr_id: str, reason: str = "", user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(PurchaseRequest).where(PurchaseRequest.id == pr_id))
    pr = r.scalars().first()
    if not pr:
        raise HTTPException(404, "DA introuvable")
    pr.status = "REFUSEE"
    pr.rejection_reason = reason
    await db.commit()
    return {"detail": "DA refusée"}


# ── Purchase Orders ──────────────────────────────────────────

@router.get("/purchase-orders")
async def list_pos(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(PurchaseOrder).where(PurchaseOrder.deleted_at.is_(None)).order_by(PurchaseOrder.created_at.desc()))
    return [
        {"id": p.id, "code": p.code, "supplier": p.supplier, "items": p.items,
         "total": p.total, "status": p.status, "delivery_date": p.delivery_date, "created_at": p.created_at}
        for p in r.scalars().all()
    ]


# ── Stock ────────────────────────────────────────────────────

@router.get("/stock")
async def list_stock(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(StockItem).order_by(StockItem.name))
    return [
        {"id": s.id, "name": s.name, "category": s.category, "unit": s.unit,
         "quantity": s.quantity, "alert_threshold": s.alert_threshold,
         "location": s.location, "low_stock": s.quantity <= s.alert_threshold}
        for s in r.scalars().all()
    ]

@router.post("/stock")
async def create_stock_item(data: StockItemCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    item = StockItem(**data.model_dump())
    db.add(item)
    await db.commit()
    return {"id": item.id}

@router.patch("/stock/{item_id}")
async def update_stock_item(item_id: str, data: dict, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(StockItem).where(StockItem.id == item_id))
    item = r.scalars().first()
    if not item:
        raise HTTPException(404, "Article introuvable")
    for k, v in data.items():
        if hasattr(item, k):
            setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Article mis à jour"}

@router.post("/stock/movements")
async def create_movement(data: StockMovementCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    mov = StockMovement(**data.model_dump(), recorded_by=user.id)
    db.add(mov)
    # Update stock quantity
    r = await db.execute(select(StockItem).where(StockItem.id == data.stock_item_id))
    item = r.scalars().first()
    if item:
        if data.movement_type == "IN":
            item.quantity += data.quantity
        else:
            item.quantity -= data.quantity
        item.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Mouvement enregistré"}
