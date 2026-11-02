"""Delivery Workflow API — Shipping, receiving, GRN, quality checks, 3-way match."""
from datetime import datetime
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func, and_
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, get_current_user
# pyrefly: ignore [missing-import]
from app.models.erp_v4 import (
    Delivery, DeliveryItem, GoodsReceipt, GoodsReceiptPhoto,
    PurchaseOrderV4,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])

from app.utils.time import utcnow_naive as _now


# ── Schemas ─────────────────────────────────────────────────

class DeliveryCreate(BaseModel):
    purchase_order_id: str
    supplier_id: Optional[str] = None
    project_id: Optional[str] = None
    expected_date: Optional[datetime] = None
    delivery_address: str = ""
    notes: str = ""
    items: list = []


class ShipData(BaseModel):
    tracking_number: str = ""
    carrier: str = ""
    eta: Optional[datetime] = None
    notes: str = ""


class ReceiveData(BaseModel):
    received_by_name: str = ""
    notes: str = ""
    items_received: list = []


class ItemCheckData(BaseModel):
    status: str  # CONFORME, NON_CONFORME, PARTIEL
    quantity_accepted: float = 0.0
    quantity_rejected: float = 0.0
    defect_type: str = ""
    notes: str = ""


class MatchRequest(BaseModel):
    purchase_order_id: str
    goods_receipt_id: str
    invoice_id: str


# ── Deliveries CRUD ─────────────────────────────────────────

@router.post("", status_code=201)
async def create_delivery(
    data: DeliveryCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    # Validate PO exists
    po_r = await db.execute(
        select(PurchaseOrderV4).where(
            PurchaseOrderV4.id == data.purchase_order_id,
            PurchaseOrderV4.deleted_at.is_(None),
        )
    )
    po = po_r.scalars().first()
    if not po:
        raise HTTPException(404, "Bon de commande introuvable")
    # Generate code
    count_r = await db.execute(select(func.count(Delivery.id)))
    count = count_r.scalar() or 0
    code = f"LIV-{_now().strftime('%Y')}-{count + 1:04d}"
    payload = data.model_dump(exclude={"items"})
    payload["supplier_id"] = data.supplier_id or po.supplier_id
    payload["project_id"] = data.project_id or po.project_id
    delivery = Delivery(code=code, created_by=user.id, **payload)
    db.add(delivery)
    await db.flush()
    # Create delivery items
    for idx, item in enumerate(data.items):
        if not isinstance(item, dict):
            continue
        di = DeliveryItem(
            delivery_id=delivery.id,
            line_number=idx + 1,
            product_name=item.get("product_name", ""),
            reference=item.get("reference", ""),
            quantity_ordered=float(item.get("quantity_ordered", 0)),
            unit=item.get("unit", "pcs"),
        )
        db.add(di)
    await log_activity(db, user.id, "DELIVERY_CREATED", "delivery", delivery.id,
                       new_value={"code": code, "po": data.purchase_order_id})
    await db.commit()
    return {"id": delivery.id, "code": code}


@router.get("")
async def list_deliveries(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    project_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(Delivery).where(Delivery.deleted_at.is_(None))
    if status:
        query = query.where(Delivery.status == status)
    if supplier_id:
        query = query.where(Delivery.supplier_id == supplier_id)
    if project_id:
        query = query.where(Delivery.project_id == project_id)
    if date_from:
        query = query.where(Delivery.created_at >= date_from)
    if date_to:
        query = query.where(Delivery.created_at <= date_to)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    r = await db.execute(
        query.order_by(Delivery.created_at.desc()).offset(offset).limit(limit)
    )
    items = [
        {
            "id": d.id, "code": d.code, "purchase_order_id": d.purchase_order_id,
            "supplier_id": d.supplier_id, "project_id": d.project_id,
            "status": d.status, "expected_date": d.expected_date,
            "shipped_at": d.shipped_at, "received_at": d.received_at,
            "tracking_number": d.tracking_number, "created_at": d.created_at,
        }
        for d in r.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{delivery_id}")
async def get_delivery(
    delivery_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Delivery).where(Delivery.id == delivery_id, Delivery.deleted_at.is_(None))
    )
    d = r.scalars().first()
    if not d:
        raise HTTPException(404, "Livraison introuvable")
    # Fetch items
    items_r = await db.execute(
        select(DeliveryItem).where(DeliveryItem.delivery_id == delivery_id)
        .order_by(DeliveryItem.line_number)
    )
    items = [
        {
            "id": di.id, "line_number": di.line_number,
            "product_name": di.product_name, "reference": di.reference,
            "quantity_ordered": di.quantity_ordered,
            "quantity_received": di.quantity_received,
            "quantity_accepted": di.quantity_accepted,
            "quality_status": di.quality_status, "unit": di.unit,
        }
        for di in items_r.scalars().all()
    ]
    return {
        "id": d.id, "code": d.code, "purchase_order_id": d.purchase_order_id,
        "supplier_id": d.supplier_id, "project_id": d.project_id,
        "status": d.status, "expected_date": d.expected_date,
        "shipped_at": d.shipped_at, "received_at": d.received_at,
        "tracking_number": d.tracking_number, "carrier": d.carrier,
        "delivery_address": d.delivery_address, "notes": d.notes,
        "created_by": d.created_by, "created_at": d.created_at,
        "items": items,
    }


# ── Ship ────────────────────────────────────────────────────

@router.put("/{delivery_id}/ship")
async def mark_shipped(
    delivery_id: str,
    data: ShipData,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Delivery).where(Delivery.id == delivery_id, Delivery.deleted_at.is_(None))
    )
    d = r.scalars().first()
    if not d:
        raise HTTPException(404, "Livraison introuvable")
    if d.status not in ("BROUILLON", "CONFIRMEE"):
        raise HTTPException(400, f"Impossible d'expedier une livraison en statut {d.status}")
    d.status = "EXPEDIEE"
    d.shipped_at = _now()
    d.tracking_number = data.tracking_number
    d.carrier = data.carrier
    if data.eta:
        d.expected_date = data.eta
    d.updated_at = _now()
    await log_activity(db, user.id, "DELIVERY_SHIPPED", "delivery", delivery_id,
                       new_value={"tracking": data.tracking_number, "carrier": data.carrier})
    await db.commit()
    return {"detail": "Livraison marquee comme expediee"}


# ── Receive (GRN creation) ──────────────────────────────────

@router.post("/{delivery_id}/receive", status_code=201)
async def receive_delivery(
    delivery_id: str,
    data: ReceiveData,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Delivery).where(Delivery.id == delivery_id, Delivery.deleted_at.is_(None))
    )
    d = r.scalars().first()
    if not d:
        raise HTTPException(404, "Livraison introuvable")
    if d.status == "RECUE":
        raise HTTPException(400, "Livraison deja recue")
    d.status = "RECUE"
    d.received_at = _now()
    d.updated_at = _now()
    # Create GRN
    grn_count = await db.execute(select(func.count(GoodsReceipt.id)))
    grn_num = (grn_count.scalar() or 0) + 1
    grn_code = f"BRE-{_now().strftime('%Y')}-{grn_num:04d}"
    grn = GoodsReceipt(
        code=grn_code,
        delivery_id=delivery_id,
        purchase_order_id=d.purchase_order_id,
        supplier_id=d.supplier_id,
        received_by=user.id,
        received_by_name=data.received_by_name or user.full_name,
        received_at=_now(),
        notes=data.notes,
        items_received=data.items_received,
    )
    db.add(grn)
    # Update delivery item quantities if provided
    for item_data in data.items_received:
        if not isinstance(item_data, dict):
            continue
        item_id = item_data.get("item_id")
        qty = float(item_data.get("quantity_received", 0))
        if item_id and qty:
            item_r = await db.execute(
                select(DeliveryItem).where(DeliveryItem.id == item_id)
            )
            di = item_r.scalars().first()
            if di:
                di.quantity_received = qty
    await log_activity(db, user.id, "DELIVERY_RECEIVED", "delivery", delivery_id,
                       new_value={"grn_code": grn_code})
    await db.commit()
    return {"id": grn.id, "code": grn_code, "detail": "Livraison receptionnee, BRE cree"}


# ── Quality check per item ──────────────────────────────────

@router.post("/{delivery_id}/items/{item_id}/check")
async def quality_check_item(
    delivery_id: str,
    item_id: str,
    data: ItemCheckData,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(DeliveryItem).where(
            DeliveryItem.id == item_id,
            DeliveryItem.delivery_id == delivery_id,
        )
    )
    di = r.scalars().first()
    if not di:
        raise HTTPException(404, "Article de livraison introuvable")
    if data.status not in ("CONFORME", "NON_CONFORME", "PARTIEL"):
        raise HTTPException(400, "Statut invalide")
    di.quality_status = data.status
    di.quantity_accepted = data.quantity_accepted
    di.quantity_rejected = data.quantity_rejected
    di.defect_type = data.defect_type
    di.quality_notes = data.notes
    di.checked_by = user.id
    di.checked_at = _now()
    await log_activity(db, user.id, "DELIVERY_ITEM_CHECKED", "delivery_item", item_id,
                       new_value={"status": data.status})
    await db.commit()
    return {"detail": "Controle qualite enregistre"}


# ── GRN ─────────────────────────────────────────────────────

@router.get("/{delivery_id}/grn")
async def get_grn(
    delivery_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(GoodsReceipt).where(GoodsReceipt.delivery_id == delivery_id)
    )
    grn = r.scalars().first()
    if not grn:
        raise HTTPException(404, "Bon de reception introuvable")
    # Fetch photos
    photos_r = await db.execute(
        select(GoodsReceiptPhoto).where(GoodsReceiptPhoto.goods_receipt_id == grn.id)
    )
    photos = [
        {"id": p.id, "url": p.url, "caption": p.caption, "uploaded_at": p.uploaded_at}
        for p in photos_r.scalars().all()
    ]
    return {
        "id": grn.id, "code": grn.code, "delivery_id": grn.delivery_id,
        "purchase_order_id": grn.purchase_order_id, "supplier_id": grn.supplier_id,
        "received_by": grn.received_by, "received_by_name": grn.received_by_name,
        "received_at": grn.received_at, "notes": grn.notes,
        "items_received": grn.items_received, "status": grn.status,
        "photos": photos,
    }


@router.post("/{delivery_id}/grn/photos", status_code=201)
async def upload_grn_photos(
    delivery_id: str,
    url: str = "",
    caption: str = "",
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Add proof photo URL to GRN. Actual file upload handled by upload service."""
    grn_r = await db.execute(
        select(GoodsReceipt).where(GoodsReceipt.delivery_id == delivery_id)
    )
    grn = grn_r.scalars().first()
    if not grn:
        raise HTTPException(404, "Bon de reception introuvable")
    photo = GoodsReceiptPhoto(
        goods_receipt_id=grn.id,
        url=url,
        caption=caption,
        uploaded_by=user.id,
        uploaded_at=_now(),
    )
    db.add(photo)
    await db.commit()
    return {"id": photo.id}


# ── 3-Way Match ─────────────────────────────────────────────

@router.post("/match")
async def three_way_match(
    data: MatchRequest,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """3-way match: PO vs GRN vs Invoice. Compares totals and flags discrepancies."""
    from app.models.erp import Invoice
    # Load PO
    po_r = await db.execute(
        select(PurchaseOrderV4).where(PurchaseOrderV4.id == data.purchase_order_id)
    )
    po = po_r.scalars().first()
    if not po:
        raise HTTPException(404, "Bon de commande introuvable")
    # Load GRN
    grn_r = await db.execute(
        select(GoodsReceipt).where(GoodsReceipt.id == data.goods_receipt_id)
    )
    grn = grn_r.scalars().first()
    if not grn:
        raise HTTPException(404, "Bon de reception introuvable")
    # Load Invoice
    inv_r = await db.execute(
        select(Invoice).where(Invoice.id == data.invoice_id)
    )
    inv = inv_r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    # Compare
    po_total = float(po.total or 0)
    inv_total = float(inv.total or 0)
    discrepancies = []
    matched = True
    # PO vs Invoice total
    if abs(po_total - inv_total) > 0.01:
        discrepancies.append({
            "type": "MONTANT",
            "description": f"Ecart PO ({po_total}) vs Facture ({inv_total})",
            "difference": round(inv_total - po_total, 2),
        })
        matched = False
    # GRN quantities vs PO items
    if grn.purchase_order_id != po.id:
        discrepancies.append({
            "type": "REFERENCE",
            "description": "Le BRE ne correspond pas au bon de commande",
        })
        matched = False
    status = "MATCH" if matched else "ECART"
    await log_activity(db, user.id, "THREE_WAY_MATCH", "delivery", grn.delivery_id,
                       new_value={"status": status, "discrepancies": len(discrepancies)})
    await db.commit()
    return {
        "status": status,
        "matched": matched,
        "po_total": po_total,
        "invoice_total": inv_total,
        "discrepancies": discrepancies,
    }
