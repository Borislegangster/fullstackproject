"""Supplier Management API — Full CRUD, contacts, products, ratings, performance."""
from datetime import datetime
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func, case
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
    Supplier, SupplierContact, SupplierProduct,
    SupplierRating, PurchaseOrderV4,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])

from app.utils.time import utcnow_naive as _now


# ── Schemas ─────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str
    code: Optional[str] = None
    email: str = ""
    phone: str = ""
    address: str = ""
    city: str = ""
    country: str = ""
    zone: str = ""
    speciality: str = ""
    tax_id: str = ""
    payment_terms: str = "30 jours"
    currency: str = "EUR"
    notes: str = ""


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    zone: Optional[str] = None
    speciality: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = None
    currency: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ContactCreate(BaseModel):
    first_name: str
    last_name: str = ""
    email: str = ""
    phone: str = ""
    position: str = ""
    is_primary: bool = False


class ProductCreate(BaseModel):
    name: str
    reference: str = ""
    description: str = ""
    unit: str = "pcs"
    unit_price: float = 0.0
    currency: str = "EUR"
    lead_time_days: int = 0
    category: str = ""


class RatingCreate(BaseModel):
    project_id: Optional[str] = None
    quality: int = 3
    delivery: int = 3
    price: int = 3
    communication: int = 3
    comments: str = ""


# ── Suppliers CRUD ──────────────────────────────────────────

@router.get("")
async def list_suppliers(
    status: Optional[str] = None,
    zone: Optional[str] = None,
    speciality: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(Supplier).where(Supplier.deleted_at.is_(None))
    if status:
        query = query.where(Supplier.status == status)
    if zone:
        query = query.where(Supplier.zone == zone)
    if speciality:
        query = query.where(Supplier.speciality == speciality)
    if search:
        query = query.where(Supplier.name.ilike(f"%{search}%"))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(Supplier.name).offset(offset).limit(limit)
    r = await db.execute(query)
    items = [
        {
            "id": s.id, "code": s.code, "name": s.name, "email": s.email,
            "phone": s.phone, "city": s.city, "country": s.country,
            "zone": s.zone, "speciality": s.speciality, "status": s.status,
            "rating": s.rating, "payment_terms": s.payment_terms,
            "created_at": s.created_at,
        }
        for s in r.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("", status_code=201)
async def create_supplier(
    data: SupplierCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    if not data.code:
        count_r = await db.execute(select(func.count(Supplier.id)))
        count = count_r.scalar() or 0
        data.code = f"FRN-{_now().strftime('%Y')}-{count + 1:04d}"
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    await log_activity(db, user.id, "SUPPLIER_CREATED", "supplier", supplier.id,
                       new_value={"name": data.name, "code": data.code})
    await db.commit()
    return {"id": supplier.id, "code": supplier.code}


@router.get("/performance")
async def supplier_performance(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Performance dashboard: top suppliers, avg ratings, delivery stats."""
    total_r = await db.execute(
        select(func.count(Supplier.id)).where(Supplier.deleted_at.is_(None))
    )
    active_r = await db.execute(
        select(func.count(Supplier.id)).where(
            Supplier.deleted_at.is_(None), Supplier.status == "ACTIF"
        )
    )
    # Top 10 by rating
    top_r = await db.execute(
        select(Supplier.id, Supplier.name, Supplier.rating, Supplier.speciality)
        .where(Supplier.deleted_at.is_(None), Supplier.rating.isnot(None))
        .order_by(Supplier.rating.desc())
        .limit(10)
    )
    top_suppliers = [
        {"id": sid, "name": name, "rating": rating, "speciality": spec}
        for sid, name, rating, spec in top_r.all()
    ]
    # Avg rating by zone
    zone_r = await db.execute(
        select(Supplier.zone, func.avg(Supplier.rating), func.count(Supplier.id))
        .where(Supplier.deleted_at.is_(None), Supplier.zone != "")
        .group_by(Supplier.zone)
    )
    by_zone = [
        {"zone": z, "avg_rating": round(float(avg or 0), 2), "count": c}
        for z, avg, c in zone_r.all()
    ]
    return {
        "total_suppliers": total_r.scalar() or 0,
        "active_suppliers": active_r.scalar() or 0,
        "top_suppliers": top_suppliers,
        "by_zone": by_zone,
    }


@router.get("/{supplier_id}")
async def get_supplier(
    supplier_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.deleted_at.is_(None))
    )
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Fournisseur introuvable")
    # Fetch contacts
    contacts_r = await db.execute(
        select(SupplierContact).where(
            SupplierContact.supplier_id == supplier_id,
            SupplierContact.deleted_at.is_(None),
        )
    )
    contacts = [
        {
            "id": c.id, "first_name": c.first_name, "last_name": c.last_name,
            "email": c.email, "phone": c.phone, "position": c.position,
            "is_primary": c.is_primary,
        }
        for c in contacts_r.scalars().all()
    ]
    # Fetch recent ratings
    ratings_r = await db.execute(
        select(SupplierRating)
        .where(SupplierRating.supplier_id == supplier_id)
        .order_by(SupplierRating.created_at.desc())
        .limit(5)
    )
    ratings = [
        {
            "id": rt.id, "quality": rt.quality, "delivery": rt.delivery,
            "price": rt.price, "communication": rt.communication,
            "comments": rt.comments, "created_at": rt.created_at,
        }
        for rt in ratings_r.scalars().all()
    ]
    return {
        "id": s.id, "code": s.code, "name": s.name, "email": s.email,
        "phone": s.phone, "address": s.address, "city": s.city,
        "country": s.country, "zone": s.zone, "speciality": s.speciality,
        "tax_id": s.tax_id, "status": s.status, "rating": s.rating,
        "payment_terms": s.payment_terms, "currency": s.currency,
        "notes": s.notes, "created_at": s.created_at,
        "contacts": contacts, "recent_ratings": ratings,
    }


@router.put("/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    data: SupplierUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.deleted_at.is_(None))
    )
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Fournisseur introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(s, k, v)
    s.updated_at = _now()
    await log_activity(db, user.id, "SUPPLIER_UPDATED", "supplier", supplier_id,
                       new_value=updates)
    await db.commit()
    return {"detail": "Fournisseur mis a jour"}


@router.delete("/{supplier_id}")
async def delete_supplier(
    supplier_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Fournisseur introuvable")
    s.deleted_at = _now()
    await log_activity(db, user.id, "SUPPLIER_DELETED", "supplier", supplier_id)
    await db.commit()
    return {"detail": "Fournisseur supprime"}


# ── Contacts ────────────────────────────────────────────────

@router.post("/{supplier_id}/contacts", status_code=201)
async def add_contact(
    supplier_id: str,
    data: ContactCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.deleted_at.is_(None))
    )
    if not r.scalars().first():
        raise HTTPException(404, "Fournisseur introuvable")
    # If is_primary, unset others
    if data.is_primary:
        existing = await db.execute(
            select(SupplierContact).where(
                SupplierContact.supplier_id == supplier_id,
                SupplierContact.is_primary == True,  # noqa: E712
                SupplierContact.deleted_at.is_(None),
            )
        )
        for c in existing.scalars().all():
            c.is_primary = False
    contact = SupplierContact(supplier_id=supplier_id, **data.model_dump())
    db.add(contact)
    await log_activity(db, user.id, "SUPPLIER_CONTACT_ADDED", "supplier", supplier_id)
    await db.commit()
    return {"id": contact.id}


# ── Products / Catalogue ────────────────────────────────────

@router.get("/{supplier_id}/products")
async def list_products(
    supplier_id: str,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(SupplierProduct).where(
        SupplierProduct.supplier_id == supplier_id,
        SupplierProduct.deleted_at.is_(None),
    )
    if category:
        query = query.where(SupplierProduct.category == category)
    if search:
        query = query.where(SupplierProduct.name.ilike(f"%{search}%"))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    r = await db.execute(query.order_by(SupplierProduct.name).offset(offset).limit(limit))
    items = [
        {
            "id": p.id, "name": p.name, "reference": p.reference,
            "description": p.description, "unit": p.unit,
            "unit_price": p.unit_price, "currency": p.currency,
            "lead_time_days": p.lead_time_days, "category": p.category,
        }
        for p in r.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/{supplier_id}/products", status_code=201)
async def add_product(
    supplier_id: str,
    data: ProductCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.deleted_at.is_(None))
    )
    if not r.scalars().first():
        raise HTTPException(404, "Fournisseur introuvable")
    product = SupplierProduct(supplier_id=supplier_id, **data.model_dump())
    db.add(product)
    await log_activity(db, user.id, "SUPPLIER_PRODUCT_ADDED", "supplier", supplier_id)
    await db.commit()
    return {"id": product.id}


# ── Ratings ─────────────────────────────────────────────────

@router.get("/{supplier_id}/ratings")
async def list_ratings(
    supplier_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(SupplierRating).where(
        SupplierRating.supplier_id == supplier_id
    ).order_by(SupplierRating.created_at.desc())
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    r = await db.execute(query.offset(offset).limit(limit))
    items = [
        {
            "id": rt.id, "project_id": rt.project_id,
            "quality": rt.quality, "delivery": rt.delivery,
            "price": rt.price, "communication": rt.communication,
            "average": round((rt.quality + rt.delivery + rt.price + rt.communication) / 4, 2),
            "comments": rt.comments, "rated_by": rt.rated_by,
            "created_at": rt.created_at,
        }
        for rt in r.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.post("/{supplier_id}/ratings", status_code=201)
async def rate_supplier(
    supplier_id: str,
    data: RatingCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id, Supplier.deleted_at.is_(None))
    )
    supplier = r.scalars().first()
    if not supplier:
        raise HTTPException(404, "Fournisseur introuvable")
    for score, label in [
        (data.quality, "qualite"), (data.delivery, "livraison"),
        (data.price, "prix"), (data.communication, "communication"),
    ]:
        if score < 1 or score > 5:
            raise HTTPException(400, f"Score {label} doit etre entre 1 et 5")
    rating = SupplierRating(
        supplier_id=supplier_id, rated_by=user.id, **data.model_dump()
    )
    db.add(rating)
    # Recalculate average rating
    all_r = await db.execute(
        select(SupplierRating).where(SupplierRating.supplier_id == supplier_id)
    )
    all_ratings = all_r.scalars().all()
    if all_ratings:
        avg = sum(
            (rt.quality + rt.delivery + rt.price + rt.communication) / 4
            for rt in all_ratings
        ) / len(all_ratings)
        supplier.rating = round(avg, 1)
    await log_activity(db, user.id, "SUPPLIER_RATED", "supplier", supplier_id)
    await db.commit()
    return {"id": rating.id, "new_avg_rating": supplier.rating}


# ── Orders ──────────────────────────────────────────────────

@router.get("/{supplier_id}/orders")
async def list_supplier_orders(
    supplier_id: str,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(PurchaseOrderV4).where(
        PurchaseOrderV4.supplier_id == supplier_id,
        PurchaseOrderV4.deleted_at.is_(None),
    )
    if status:
        query = query.where(PurchaseOrderV4.status == status)
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    r = await db.execute(query.order_by(PurchaseOrderV4.created_at.desc()).offset(offset).limit(limit))
    items = [
        {
            "id": po.id, "code": po.code, "total": po.total,
            "status": po.status, "delivery_date": po.delivery_date,
            "project_id": po.project_id, "created_at": po.created_at,
        }
        for po in r.scalars().all()
    ]
    return {"items": items, "total": total, "limit": limit, "offset": offset}
