"""
Suppliers API — Full CRUD for suppliers, contacts, products, ratings.
Routes: /api/v1/suppliers/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import Optional, List

from app.database import get_db
from app.auth.service import get_current_user, require_staff
from app.models.suppliers import (
    Supplier, SupplierContact, SupplierProduct, SupplierRating,
)
from app.services.activity_service import log_activity
import uuid

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


# ── Schemas ──────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    company_name: str
    category: str = ""
    phone: str = ""
    email: str = ""
    whatsapp: str = ""
    address: str = ""
    city: str = ""
    country: str = "Cameroun"
    tax_id: str = ""
    registration_number: str = ""
    legal_form: str = ""
    specialties: list = []
    delivery_zones: list = []
    payment_terms: str = ""
    min_order_amount: float = 0.0
    notes: str = ""
    logo_url: str = ""

class SupplierUpdate(BaseModel):
    company_name: Optional[str] = None
    category: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    tax_id: Optional[str] = None
    registration_number: Optional[str] = None
    legal_form: Optional[str] = None
    specialties: Optional[list] = None
    delivery_zones: Optional[list] = None
    payment_terms: Optional[str] = None
    min_order_amount: Optional[float] = None
    notes: Optional[str] = None
    logo_url: Optional[str] = None
    status: Optional[str] = None

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    role: str = ""
    email: str = ""
    phone: str = ""
    whatsapp: str = ""
    is_primary: bool = False

class ProductCreate(BaseModel):
    name: str
    reference: str = ""
    description: str = ""
    category: str = ""
    unit: str = ""
    unit_price: float = 0.0
    min_quantity: float = 0.0
    lead_time_days: int = 0
    image_url: str = ""
    specifications: dict = {}

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    reference: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    min_quantity: Optional[float] = None
    lead_time_days: Optional[int] = None
    image_url: Optional[str] = None
    specifications: Optional[dict] = None
    is_available: Optional[bool] = None

class RatingCreate(BaseModel):
    project_id: Optional[str] = None
    quality_score: float = 0.0
    delivery_score: float = 0.0
    price_score: float = 0.0
    communication_score: float = 0.0
    comment: str = ""
    period: str = ""


# ── Supplier CRUD ────────────────────────────────────────────

def _gen_supplier_code(n: int) -> str:
    return f"FRN-{datetime.utcnow().year}-{n:03d}"


@router.get("")
async def list_suppliers(
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(Supplier).where(Supplier.deleted_at.is_(None))
    if status:
        q = q.where(Supplier.status == status)
    if category:
        q = q.where(Supplier.category == category)
    if search:
        q = q.where(or_(
            Supplier.company_name.ilike(f"%{search}%"),
            Supplier.code.ilike(f"%{search}%"),
            Supplier.email.ilike(f"%{search}%"),
        ))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.order_by(Supplier.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return {"items": [_sup_dict(s) for s in rows], "total": total}


@router.post("")
async def create_supplier(
    body: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    cnt = (await db.execute(select(func.count()).select_from(Supplier))).scalar() or 0
    sup = Supplier(
        id=str(uuid.uuid4()),
        code=_gen_supplier_code(cnt + 1),
        **body.model_dump(),
    )
    db.add(sup)
    await db.commit()
    await db.refresh(sup)
    await log_activity(db, user.id, "CREATE", "supplier", sup.id, description=f"Fournisseur créé: {sup.company_name}")
    return _sup_dict(sup)


@router.get("/{supplier_id}")
async def get_supplier(supplier_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    sup = await _get_supplier(db, supplier_id)
    contacts = (await db.execute(
        select(SupplierContact).where(SupplierContact.supplier_id == supplier_id, SupplierContact.deleted_at.is_(None))
    )).scalars().all()
    d = _sup_dict(sup)
    d["contacts"] = [_contact_dict(c) for c in contacts]
    return d


@router.patch("/{supplier_id}")
async def update_supplier(supplier_id: str, body: SupplierUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    sup = await _get_supplier(db, supplier_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(sup, k, v)
    await db.commit()
    await db.refresh(sup)
    await log_activity(db, user.id, "UPDATE", "supplier", sup.id, description=f"Fournisseur modifié: {sup.company_name}")
    return _sup_dict(sup)


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    sup = await _get_supplier(db, supplier_id)
    sup.deleted_at = datetime.utcnow()
    sup.status = "INACTIF"
    await db.commit()
    return {"ok": True}


# ── Contacts ─────────────────────────────────────────────────

@router.get("/{supplier_id}/contacts")
async def list_contacts(supplier_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(SupplierContact).where(SupplierContact.supplier_id == supplier_id, SupplierContact.deleted_at.is_(None))
    )).scalars().all()
    return [_contact_dict(c) for c in rows]


@router.post("/{supplier_id}/contacts")
async def create_contact(supplier_id: str, body: ContactCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    await _get_supplier(db, supplier_id)
    c = SupplierContact(id=str(uuid.uuid4()), supplier_id=supplier_id, **body.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _contact_dict(c)


@router.delete("/{supplier_id}/contacts/{contact_id}")
async def delete_contact(supplier_id: str, contact_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    c = (await db.execute(select(SupplierContact).where(SupplierContact.id == contact_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Contact non trouvé")
    c.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Products / Catalogue ─────────────────────────────────────

@router.get("/{supplier_id}/products")
async def list_products(
    supplier_id: str,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(SupplierProduct).where(
        SupplierProduct.supplier_id == supplier_id,
        SupplierProduct.deleted_at.is_(None),
    )
    if category:
        q = q.where(SupplierProduct.category == category)
    if search:
        q = q.where(SupplierProduct.name.ilike(f"%{search}%"))
    rows = (await db.execute(q.order_by(SupplierProduct.name))).scalars().all()
    return [_product_dict(p) for p in rows]


@router.post("/{supplier_id}/products")
async def create_product(supplier_id: str, body: ProductCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    await _get_supplier(db, supplier_id)
    p = SupplierProduct(id=str(uuid.uuid4()), supplier_id=supplier_id, **body.model_dump())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return _product_dict(p)


@router.patch("/{supplier_id}/products/{product_id}")
async def update_product(supplier_id: str, product_id: str, body: ProductUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    p = (await db.execute(select(SupplierProduct).where(SupplierProduct.id == product_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Produit non trouvé")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    await db.commit()
    await db.refresh(p)
    return _product_dict(p)


@router.delete("/{supplier_id}/products/{product_id}")
async def delete_product(supplier_id: str, product_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    p = (await db.execute(select(SupplierProduct).where(SupplierProduct.id == product_id))).scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Produit non trouvé")
    p.deleted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Ratings ──────────────────────────────────────────────────

@router.get("/{supplier_id}/ratings")
async def list_ratings(supplier_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    rows = (await db.execute(
        select(SupplierRating).where(SupplierRating.supplier_id == supplier_id).order_by(SupplierRating.created_at.desc())
    )).scalars().all()
    return [_rating_dict(r) for r in rows]


@router.post("/{supplier_id}/ratings")
async def create_rating(supplier_id: str, body: RatingCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    await _get_supplier(db, supplier_id)
    overall = (body.quality_score + body.delivery_score + body.price_score + body.communication_score) / 4
    r = SupplierRating(
        id=str(uuid.uuid4()),
        supplier_id=supplier_id,
        rated_by=user.id,
        overall_score=round(overall, 2),
        **body.model_dump(),
    )
    db.add(r)
    # Update supplier aggregate scores
    sup = await _get_supplier(db, supplier_id)
    all_ratings = (await db.execute(
        select(SupplierRating).where(SupplierRating.supplier_id == supplier_id)
    )).scalars().all()
    count = len(all_ratings) + 1
    sup.quality_score = round((sum(x.quality_score for x in all_ratings) + body.quality_score) / count, 2)
    sup.service_rate = round((sum(x.delivery_score for x in all_ratings) + body.delivery_score) / count, 2)
    await db.commit()
    await db.refresh(r)
    return _rating_dict(r)


# ── KPI / Stats ──────────────────────────────────────────────

@router.get("/stats/overview")
async def supplier_stats(db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    total = (await db.execute(select(func.count()).where(Supplier.deleted_at.is_(None)))).scalar() or 0
    active = (await db.execute(select(func.count()).where(Supplier.status == "ACTIF", Supplier.deleted_at.is_(None)))).scalar() or 0
    avg_quality = (await db.execute(select(func.avg(Supplier.quality_score)).where(Supplier.deleted_at.is_(None)))).scalar() or 0
    return {
        "total_suppliers": total,
        "active_suppliers": active,
        "suspended_suppliers": total - active,
        "avg_quality_score": round(float(avg_quality), 2),
    }


# ── Helpers ──────────────────────────────────────────────────

async def _get_supplier(db: AsyncSession, sid: str) -> Supplier:
    sup = (await db.execute(select(Supplier).where(Supplier.id == sid, Supplier.deleted_at.is_(None)))).scalar_one_or_none()
    if not sup:
        raise HTTPException(404, "Fournisseur non trouvé")
    return sup

def _sup_dict(s: Supplier) -> dict:
    return {c.name: getattr(s, c.name) for c in s.__table__.columns}

def _contact_dict(c: SupplierContact) -> dict:
    return {col.name: getattr(c, col.name) for col in c.__table__.columns}

def _product_dict(p: SupplierProduct) -> dict:
    return {col.name: getattr(p, col.name) for col in p.__table__.columns}

def _rating_dict(r: SupplierRating) -> dict:
    return {col.name: getattr(r, col.name) for col in r.__table__.columns}
