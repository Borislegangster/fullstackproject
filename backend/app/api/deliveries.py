"""
Deliveries & GRN API — Livraisons, réception, GRN, 3-way match.
Routes: /api/v1/deliveries/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.auth.service import get_current_user, require_staff
from app.models.suppliers import (
    Delivery, DeliveryItem, GoodsReceipt, SupplierInvoice, InvoiceMatch,
)
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification
import uuid

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


# ── Schemas ──────────────────────────────────────────────────

class DeliveryCreate(BaseModel):
    purchase_order_id: Optional[str] = None
    supplier_id: Optional[str] = None
    project_id: Optional[str] = None
    expected_date: Optional[str] = None
    transporter: str = ""
    tracking_number: str = ""
    notes: str = ""
    items: list = []

class DeliveryUpdate(BaseModel):
    status: Optional[str] = None
    expected_date: Optional[str] = None
    shipped_date: Optional[str] = None
    transporter: Optional[str] = None
    tracking_number: Optional[str] = None
    vehicle_plate: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    notes: Optional[str] = None

class ReceptionCreate(BaseModel):
    delivery_id: str
    items: list = []  # [{product_name, quantity_received, quantity_damaged, quantity_different, notes, photos}]
    photos: list = []
    geolocation: dict = {}
    notes: str = ""

class SupplierInvoiceCreate(BaseModel):
    supplier_id: str
    project_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    goods_receipt_id: Optional[str] = None
    invoice_number: str = ""
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    amount_ht: float = 0.0
    tax_rate: float = 0.0
    tax_amount: float = 0.0
    amount_ttc: float = 0.0
    lines: list = []
    file_url: str = ""
    notes: str = ""

class SupplierInvoiceUpdate(BaseModel):
    status: Optional[str] = None
    amount_paid: Optional[float] = None
    payment_reference: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


def _gen_code(prefix: str, n: int) -> str:
    return f"{prefix}-{datetime.utcnow().year}-{n:04d}"


# ── Deliveries ───────────────────────────────────────────────

@router.get("")
async def list_deliveries(
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(Delivery).where(Delivery.deleted_at.is_(None))
    if status:
        q = q.where(Delivery.status == status)
    if project_id:
        q = q.where(Delivery.project_id == project_id)
    if supplier_id:
        q = q.where(Delivery.supplier_id == supplier_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.order_by(Delivery.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return {"items": [_dict(r) for r in rows], "total": total}


@router.post("")
async def create_delivery(body: DeliveryCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(Delivery))).scalar() or 0
    d = Delivery(
        id=str(uuid.uuid4()),
        code=_gen_code("LIV", cnt + 1),
        purchase_order_id=body.purchase_order_id,
        supplier_id=body.supplier_id,
        project_id=body.project_id,
        expected_date=datetime.fromisoformat(body.expected_date) if body.expected_date else None,
        transporter=body.transporter,
        tracking_number=body.tracking_number,
        notes=body.notes,
    )
    db.add(d)
    for item in body.items:
        di = DeliveryItem(
            id=str(uuid.uuid4()),
            delivery_id=d.id,
            product_name=item.get("product_name", ""),
            product_ref=item.get("product_ref", ""),
            unit=item.get("unit", ""),
            quantity_expected=item.get("quantity_expected", 0),
            unit_price=item.get("unit_price", 0),
        )
        db.add(di)
    await db.commit()
    await db.refresh(d)
    await log_activity(db, user.id, "CREATE", "delivery", d.id, description=f"Livraison créée: {d.code}")
    return _dict(d)


@router.get("/{delivery_id}")
async def get_delivery(delivery_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    d = await _get_delivery(db, delivery_id)
    items = (await db.execute(select(DeliveryItem).where(DeliveryItem.delivery_id == delivery_id))).scalars().all()
    result = _dict(d)
    result["items"] = [_dict(i) for i in items]
    return result


@router.patch("/{delivery_id}")
async def update_delivery(delivery_id: str, body: DeliveryUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    d = await _get_delivery(db, delivery_id)
    data = body.model_dump(exclude_unset=True)
    for k in ("expected_date", "shipped_date"):
        if k in data and data[k]:
            data[k] = datetime.fromisoformat(data[k])
    for k, v in data.items():
        setattr(d, k, v)
    await db.commit()
    await db.refresh(d)
    return _dict(d)


@router.patch("/{delivery_id}/ship")
async def mark_shipped(delivery_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    d = await _get_delivery(db, delivery_id)
    d.status = "EXPEDIEE"
    d.shipped_date = datetime.utcnow()
    await db.commit()
    return _dict(d)


# ── Reception / GRN ──────────────────────────────────────────

@router.post("/receive")
async def receive_delivery(body: ReceptionCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    d = await _get_delivery(db, body.delivery_id)
    has_discrepancy = False
    for item_data in body.items:
        item = (await db.execute(
            select(DeliveryItem).where(
                DeliveryItem.delivery_id == d.id,
                DeliveryItem.product_name == item_data.get("product_name", ""),
            )
        )).scalar_one_or_none()
        if item:
            item.quantity_received = item_data.get("quantity_received", 0)
            item.quantity_damaged = item_data.get("quantity_damaged", 0)
            item.quantity_different = item_data.get("quantity_different", 0)
            item.notes = item_data.get("notes", "")
            item.photos = item_data.get("photos", [])
            if item.quantity_received != item.quantity_expected or item.quantity_damaged > 0:
                item.status = "ECART"
                has_discrepancy = True
            else:
                item.status = "CONFORME"

    all_received = all(
        i.get("quantity_received", 0) >= i.get("quantity_expected", 0)
        for i in body.items
    ) if body.items else True

    d.status = "RECUE" if all_received and not has_discrepancy else "PARTIELLE"
    d.received_date = datetime.utcnow()
    d.received_by = user.id
    d.photos = body.photos
    d.geolocation = body.geolocation

    cnt = (await db.execute(select(func.count()).select_from(GoodsReceipt))).scalar() or 0
    grn = GoodsReceipt(
        id=str(uuid.uuid4()),
        code=_gen_code("GRN", cnt + 1),
        delivery_id=d.id,
        purchase_order_id=d.purchase_order_id,
        supplier_id=d.supplier_id,
        project_id=d.project_id,
        items=[i for i in body.items],
        total_amount=sum(i.get("quantity_received", 0) * i.get("unit_price", 0) for i in body.items),
        received_by=user.id,
        has_discrepancy=has_discrepancy,
        discrepancy_notes=body.notes if has_discrepancy else "",
        photos=body.photos,
        geolocation=body.geolocation,
        status="VALIDE" if not has_discrepancy else "BROUILLON",
    )
    db.add(grn)
    await db.commit()
    await log_activity(db, user.id, "CREATE", "goods_receipt", grn.id, description=f"Réception {grn.code}")
    return {"delivery": _dict(d), "grn": _dict(grn)}


@router.get("/grn")
async def list_grn(
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(GoodsReceipt)
    if project_id:
        q = q.where(GoodsReceipt.project_id == project_id)
    rows = (await db.execute(q.order_by(GoodsReceipt.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return [_dict(r) for r in rows]


# ── Supplier Invoices ────────────────────────────────────────

@router.get("/supplier-invoices")
async def list_supplier_invoices(
    supplier_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(SupplierInvoice).where(SupplierInvoice.deleted_at.is_(None))
    if supplier_id:
        q = q.where(SupplierInvoice.supplier_id == supplier_id)
    if status:
        q = q.where(SupplierInvoice.status == status)
    rows = (await db.execute(q.order_by(SupplierInvoice.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("/supplier-invoices")
async def create_supplier_invoice(body: SupplierInvoiceCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    cnt = (await db.execute(select(func.count()).select_from(SupplierInvoice))).scalar() or 0
    inv = SupplierInvoice(
        id=str(uuid.uuid4()),
        code=_gen_code("F-FRN", cnt + 1),
        supplier_id=body.supplier_id,
        project_id=body.project_id,
        purchase_order_id=body.purchase_order_id,
        goods_receipt_id=body.goods_receipt_id,
        invoice_number=body.invoice_number,
        invoice_date=datetime.fromisoformat(body.invoice_date) if body.invoice_date else None,
        due_date=datetime.fromisoformat(body.due_date) if body.due_date else None,
        amount_ht=body.amount_ht,
        tax_rate=body.tax_rate,
        tax_amount=body.tax_amount,
        amount_ttc=body.amount_ttc,
        lines=body.lines,
        file_url=body.file_url,
        notes=body.notes,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    await log_activity(db, user.id, "CREATE", "supplier_invoice", inv.id, description=f"Facture fournisseur {inv.code}")
    return _dict(inv)


@router.patch("/supplier-invoices/{invoice_id}")
async def update_supplier_invoice(invoice_id: str, body: SupplierInvoiceUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    inv = (await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == invoice_id))).scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Facture non trouvée")
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] == "VALIDEE":
        inv.validated_by = user.id
        inv.validated_at = datetime.utcnow()
    if "status" in data and data["status"] == "PAYEE":
        inv.paid_at = datetime.utcnow()
    for k, v in data.items():
        setattr(inv, k, v)
    await db.commit()
    await db.refresh(inv)
    return _dict(inv)


# ── 3-Way Match ──────────────────────────────────────────────

@router.post("/supplier-invoices/{invoice_id}/match")
async def three_way_match(invoice_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    inv = (await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == invoice_id))).scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Facture non trouvée")

    po_amount = 0.0
    grn_amount = 0.0

    if inv.purchase_order_id:
        from app.models.erp import PurchaseOrder
        po = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == inv.purchase_order_id))).scalar_one_or_none()
        if po:
            po_amount = po.total or 0.0

    if inv.goods_receipt_id:
        grn = (await db.execute(select(GoodsReceipt).where(GoodsReceipt.id == inv.goods_receipt_id))).scalar_one_or_none()
        if grn:
            grn_amount = grn.total_amount or 0.0

    invoice_amount = inv.amount_ttc
    amount_variance = abs(invoice_amount - po_amount) if po_amount else 0
    tolerance = 0.02

    if po_amount > 0:
        variance_pct = amount_variance / po_amount
    else:
        variance_pct = 0

    if variance_pct <= tolerance:
        match_status = "CONFORME"
    elif variance_pct <= 0.05:
        match_status = "ECART_MINEUR"
    else:
        match_status = "ECART_MAJEUR"

    match = InvoiceMatch(
        id=str(uuid.uuid4()),
        supplier_invoice_id=invoice_id,
        purchase_order_id=inv.purchase_order_id,
        goods_receipt_id=inv.goods_receipt_id,
        po_amount=po_amount,
        grn_amount=grn_amount,
        invoice_amount=invoice_amount,
        amount_variance=amount_variance,
        status=match_status,
        matched_by=user.id,
    )
    db.add(match)
    inv.match_status = "RAPPROCHEE" if match_status == "CONFORME" else "ECART_DETECTE"
    await db.commit()
    await db.refresh(match)
    await log_activity(db, user.id, "CREATE", "invoice_match", match.id, description=f"Rapprochement 3 voies: {match_status}")
    return _dict(match)


# ── Helpers ──────────────────────────────────────────────────

async def _get_delivery(db: AsyncSession, did: str) -> Delivery:
    d = (await db.execute(select(Delivery).where(Delivery.id == did, Delivery.deleted_at.is_(None)))).scalar_one_or_none()
    if not d:
        raise HTTPException(404, "Livraison non trouvée")
    return d

def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
