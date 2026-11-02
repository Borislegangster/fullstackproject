"""Procurement API — Purchase Requests, Orders, Stock & Inventory."""
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


from app.utils.time import utcnow_naive as _now


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


class StockItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    alert_threshold: Optional[float] = None
    location: Optional[str] = None

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
    code = f"DA-{_now().strftime('%Y')}-{count + 1:03d}"
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
    pr.validated_at = _now()

    # Auto-create purchase order
    count_r = await db.execute(select(func.count(PurchaseOrder.id)))
    count = count_r.scalar() or 0
    code = f"BC-{_now().strftime('%Y')}-{count + 1:03d}"
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
async def update_stock_item(
    item_id: str,
    data: StockItemUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Update a stock item with strict Pydantic schema."""
    r = await db.execute(select(StockItem).where(StockItem.id == item_id))
    item = r.scalars().first()
    if not item:
        raise HTTPException(404, "Article introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(item, k, v)
    item.updated_at = _now()
    await db.commit()
    return {"detail": "Article mis à jour"}


@router.get("/stock/movements")
async def list_stock_movements(
    stock_item_id: Optional[str] = None,
    project_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(StockMovement).order_by(StockMovement.created_at.desc())
    if stock_item_id:
        q = q.where(StockMovement.stock_item_id == stock_item_id)
    if project_id:
        q = q.where(StockMovement.project_id == project_id)
    r = await db.execute(q)
    return [
        {
            "id": m.id, "stock_item_id": m.stock_item_id,
            "movement_type": m.movement_type, "quantity": m.quantity,
            "project_id": m.project_id, "reference": m.reference,
            "notes": m.notes, "created_at": m.created_at,
        }
        for m in r.scalars().all()
    ]


@router.delete("/stock/{item_id}")
async def delete_stock_item(
    item_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(StockItem).where(StockItem.id == item_id))
    item = r.scalars().first()
    if not item:
        raise HTTPException(404, "Article introuvable")
    await db.delete(item)
    await db.commit()
    return {"detail": "Article supprimé"}


@router.get("/purchase-orders/{po_id}")
async def get_purchase_order(
    po_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id, PurchaseOrder.deleted_at.is_(None)))
    po = r.scalars().first()
    if not po:
        raise HTTPException(404, "Bon de commande introuvable")
    return {
        "id": po.id, "code": po.code, "supplier": po.supplier,
        "items": po.items, "total": po.total, "status": po.status,
        "delivery_date": po.delivery_date, "created_at": po.created_at,
    }


@router.patch("/purchase-orders/{po_id}/receive")
async def receive_purchase_order(
    po_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Mark a purchase order as received (LIVRE) and auto-create stock movements."""
    r = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = r.scalars().first()
    if not po:
        raise HTTPException(404, "Bon de commande introuvable")
    po.status = "LIVRE"
    po.delivery_date = _now()
    po.updated_at = _now()
    # Auto-increment stock for items that map to known stock items
    for item in (po.items or []):
        if not isinstance(item, dict):
            continue
        # Optional: stock_item_id can be in the item dict
        sid = item.get("stock_item_id")
        qty = float(item.get("qty") or item.get("quantity") or 0)
        if sid and qty:
            r2 = await db.execute(select(StockItem).where(StockItem.id == sid))
            sk = r2.scalars().first()
            if sk:
                sk.quantity = (sk.quantity or 0) + qty
                sk.updated_at = _now()
                db.add(StockMovement(
                    stock_item_id=sid, movement_type="IN", quantity=qty,
                    reference=po.code, notes="Réception BC", recorded_by=user.id,
                ))
    await log_activity(db, user.id, "PO_RECEIVED", "purchase_order", po_id)
    await db.commit()
    return {"detail": "Bon de commande réceptionné"}

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
        item.updated_at = _now()
    await db.commit()
    return {"detail": "Mouvement enregistré"}
