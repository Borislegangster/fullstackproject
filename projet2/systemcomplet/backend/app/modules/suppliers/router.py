"""API Fournisseurs (fiche, contacts, catalogue, tarifs historisés, documents, notation, incidents, scorecard)
+ extranet fournisseur authentifié (§8, §13 extranet)."""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field, ValidationError
from sqlalchemy import cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.files import store_private, validate_upload
from app.core.pagination import PageParams, paginate
from app.core.utils import clean_phone, jsonable, utcnow
from app.modules.billing import service as billing
from app.modules.billing.models import SupplierInvoice
from app.modules.identity import service as identity
from app.modules.procurement import service as procurement
from app.modules.procurement.models import Delivery, PurchaseOrder
from app.modules.suppliers.models import (
    Supplier,
    SupplierContact,
    SupplierDocument,
    SupplierIncident,
    SupplierPriceHistory,
    SupplierProduct,
    SupplierRating,
)
from app.modules.system.models import StoredFile

TAG = "Fournisseurs"
router = APIRouter(tags=[TAG])
extranet = APIRouter(prefix="/extranet/supplier", tags=["Extranet fournisseur"])

SENSITIVE = ("bank_account", "mobile_money_number")


def _mask(value: str | None) -> str | None:
    if not value:
        return None
    return "•" * max(0, len(value) - 4) + value[-4:]


def supplier_out(db: Session, supplier: Supplier, *, detail: bool = False) -> dict[str, Any]:
    data = serialize(supplier)
    for key in SENSITIVE:
        data.pop(key, None)
    data["bank_account_masked"] = _mask(supplier.bank_account)
    data["mobile_money_masked"] = _mask(supplier.mobile_money_number)
    data["contacts"] = [serialize(c) for c in supplier.contacts]
    if detail:
        data["documents"] = [
            serialize(d)
            for d in db.execute(
                select(SupplierDocument)
                .where(SupplierDocument.supplier_id == supplier.id)
                .order_by(SupplierDocument.created_at.desc())
            ).scalars()
        ]
        data["open_incidents"] = db.execute(
            select(func.count())
            .select_from(SupplierIncident)
            .where(SupplierIncident.supplier_id == supplier.id, SupplierIncident.status == "open")
        ).scalar_one()
        data["orders_count"] = db.execute(
            select(func.count())
            .select_from(PurchaseOrder)
            .where(PurchaseOrder.supplier_id == supplier.id, PurchaseOrder.deleted_at.is_(None))
        ).scalar_one()
        data["expired_documents"] = [
            d["title"] for d in data["documents"] if d.get("valid_until") and d["valid_until"] < date.today()
        ]
    return jsonable(data)


class ContactIn(BaseModel):
    kind: str = Field(default="commercial", pattern="^(commercial|logistique|facturation|direction)$")
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    whatsapp: str | None = Field(default=None, max_length=40)
    is_primary: bool = False


class SupplierIn(BaseModel):
    code: str | None = Field(default=None, max_length=30)
    legal_name: str = Field(min_length=2, max_length=250)
    trade_name: str | None = Field(default=None, max_length=250)
    legal_form: str | None = Field(default=None, max_length=60)
    tax_id: str | None = Field(default=None, max_length=60)
    trade_register: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default="Cameroun", max_length=80)
    categories: list[str] = Field(default_factory=list, max_length=50)
    delivery_zones: list[str] = Field(default_factory=list, max_length=100)
    payment_terms: str | None = Field(default=None, max_length=120)
    payment_terms_days: int = Field(default=30, ge=0, le=365)
    min_order_amount: Decimal = Field(default=Decimal("0"), ge=0)
    lead_time_days: int = Field(default=7, ge=0, le=365)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    sms_number: str | None = Field(default=None, max_length=40)
    whatsapp_number: str | None = Field(default=None, max_length=40)
    whatsapp_opt_in: bool = False
    preferred_channel: str = Field(default="whatsapp", pattern="^(whatsapp|email|sms)$")
    bank_name: str | None = Field(default=None, max_length=150)
    bank_account: str | None = Field(default=None, max_length=80)
    mobile_money_number: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)
    organization_id: uuid.UUID | None = None  # organisation extranet (Administration › Organisations)
    contacts: list[ContactIn] = Field(default_factory=list, max_length=30)


class SupplierUpdate(BaseModel):
    legal_name: str | None = Field(default=None, min_length=2, max_length=250)
    trade_name: str | None = Field(default=None, max_length=250)
    legal_form: str | None = Field(default=None, max_length=60)
    tax_id: str | None = Field(default=None, max_length=60)
    trade_register: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=80)
    categories: list[str] | None = Field(default=None, max_length=50)
    delivery_zones: list[str] | None = Field(default=None, max_length=100)
    payment_terms: str | None = Field(default=None, max_length=120)
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    min_order_amount: Decimal | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0, le=365)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    sms_number: str | None = Field(default=None, max_length=40)
    whatsapp_number: str | None = Field(default=None, max_length=40)
    whatsapp_opt_in: bool | None = None
    preferred_channel: str | None = Field(default=None, pattern="^(whatsapp|email|sms)$")
    bank_name: str | None = Field(default=None, max_length=150)
    bank_account: str | None = Field(default=None, max_length=80)
    mobile_money_number: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=4000)
    organization_id: uuid.UUID | None = None


def _normalize(values: dict[str, Any]) -> dict[str, Any]:
    for key in ("phone", "sms_number", "whatsapp_number", "mobile_money_number"):
        if values.get(key):
            values[key] = clean_phone(values[key])
    if values.get("email"):
        values["email"] = str(values["email"]).lower()
    return values


def _next_code(db: Session) -> str:
    count = db.execute(select(func.count()).select_from(Supplier)).scalar_one()
    while True:
        count += 1
        code = f"FRN-{count:05d}"
        if not db.execute(select(Supplier.id).where(Supplier.code == code)).first():
            return code


@router.get("/suppliers")
def list_suppliers(
    params: PageParams = Depends(),
    status: str | None = None,
    category: str | None = None,
    city: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("suppliers:read")
    stmt = select(Supplier).where(Supplier.deleted_at.is_(None))
    if status:
        stmt = stmt.where(Supplier.status == status)
    if city:
        stmt = stmt.where(Supplier.city.ilike(city))
    if category:
        stmt = stmt.where(cast(Supplier.categories, JSONB).contains([category]))
    return paginate(
        db,
        stmt,
        params,
        sort_fields={
            "legal_name": Supplier.legal_name,
            "quality_score": Supplier.quality_score,
            "on_time_rate": Supplier.on_time_rate,
            "created_at": Supplier.created_at,
        },
        default_sort=Supplier.legal_name.asc(),
        search_columns=[Supplier.legal_name, Supplier.trade_name, Supplier.code, Supplier.city],
        transform=lambda s: supplier_out(db, s),
    )


@router.post("/suppliers", status_code=201)
def create_supplier(
    data: SupplierIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("suppliers:write")
    values = _normalize(data.model_dump(exclude={"contacts"}))
    values["code"] = (values.get("code") or "").strip().upper() or _next_code(db)
    if values["whatsapp_opt_in"] and not values.get("whatsapp_number"):
        raise BusinessRuleError("Numéro WhatsApp Business requis pour l'opt-in")
    if values.get("organization_id"):
        identity.check_linked_organization(db, values["organization_id"], kind="supplier", model=Supplier)
    supplier = Supplier(**values, status="active")
    for contact in data.contacts:
        supplier.contacts.append(SupplierContact(**_normalize(contact.model_dump())))
    db.add(supplier)
    try:
        db.flush()
    except IntegrityError as exc:
        raise Conflict("Code fournisseur déjà utilisé", code="DUPLICATE_CODE") from exc
    audit.record(
        db,
        family="business",
        module="suppliers",
        action="CREATE",
        resource_type="supplier",
        resource_id=supplier.id,
        diff={"legal_name": supplier.legal_name, "code": supplier.code},
    )
    db.commit()
    return supplier_out(db, supplier, detail=True)


@router.get("/suppliers/{supplier_id}")
def get_supplier(
    supplier_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("suppliers:read")
    supplier = db.get(Supplier, supplier_id)
    if supplier is None or supplier.deleted_at is not None:
        raise NotFound("Fournisseur introuvable")
    return supplier_out(db, supplier, detail=True)


@router.patch("/suppliers/{supplier_id}")
def update_supplier(
    supplier_id: uuid.UUID, data: SupplierUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("suppliers:write")
    supplier = db.get(Supplier, supplier_id)
    if supplier is None or supplier.deleted_at is not None:
        raise NotFound("Fournisseur introuvable")
    values = _normalize(data.model_dump(exclude_unset=True))
    if values.get("organization_id"):
        identity.check_linked_organization(
            db, values["organization_id"], kind="supplier", model=Supplier, current_id=supplier.id
        )
    changed_sensitive = [k for k in SENSITIVE if k in values]
    diff = {}
    for key, value in values.items():
        old = getattr(supplier, key)
        if old != value:
            diff[key] = (
                ("***modifié" if old else "***ajouté")
                if key in SENSITIVE
                else {"old": jsonable(old), "new": jsonable(value)}
            )
            setattr(supplier, key, value)
    if diff:
        audit.record(
            db,
            family="business",
            module="suppliers",
            action="UPDATE",
            resource_type="supplier",
            resource_id=supplier.id,
            diff=diff,
            criticality="HIGH" if changed_sensitive else "LOW",
        )
    db.commit()
    return supplier_out(db, supplier, detail=True)


class StatusIn(BaseModel):
    status: str = Field(pattern="^(pending|active|suspended|blacklisted)$")
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/suppliers/{supplier_id}/status")
def set_supplier_status(
    supplier_id: uuid.UUID, data: StatusIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("suppliers:write")
    supplier = db.get(Supplier, supplier_id)
    if supplier is None or supplier.deleted_at is not None:
        raise NotFound("Fournisseur introuvable")
    previous = supplier.status
    supplier.status = data.status
    audit.record(
        db,
        family="business",
        module="suppliers",
        action="STATUS",
        resource_type="supplier",
        resource_id=supplier.id,
        reason=data.reason,
        diff={"from": previous, "to": data.status},
        criticality="MEDIUM",
    )
    db.commit()
    return supplier_out(db, supplier, detail=True)


@router.delete("/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    access.require("suppliers:write")
    supplier = db.get(Supplier, supplier_id)
    if supplier is None or supplier.deleted_at is not None:
        raise NotFound("Fournisseur introuvable")
    open_orders = db.execute(
        select(func.count())
        .select_from(PurchaseOrder)
        .where(
            PurchaseOrder.supplier_id == supplier.id, PurchaseOrder.status.not_in(["closed", "cancelled", "refused"])
        )
    ).scalar_one()
    if open_orders:
        raise BusinessRuleError("Fournisseur avec commandes en cours : suspendre plutôt que supprimer")
    supplier.deleted_at = utcnow()
    audit.record(
        db,
        family="business",
        module="suppliers",
        action="DELETE",
        resource_type="supplier",
        resource_id=supplier.id,
        criticality="MEDIUM",
    )
    db.commit()
    return {"status": "deleted"}


@router.get("/suppliers/{supplier_id}/scorecard")
def supplier_scorecard(
    supplier_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Scorecard : qualité, taux de service, erreurs, ponctualité, retards, incidents, notes, volume d'achats."""
    access.require("suppliers:read")
    supplier = procurement.refresh_supplier_kpis(db, supplier_id)
    db.commit()
    ratings = (
        db.execute(
            select(SupplierRating)
            .where(SupplierRating.supplier_id == supplier_id)
            .order_by(SupplierRating.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    incidents = db.execute(
        select(SupplierIncident.kind, func.count())
        .where(SupplierIncident.supplier_id == supplier_id)
        .group_by(SupplierIncident.kind)
    ).all()
    spend = db.execute(
        select(func.coalesce(func.sum(PurchaseOrder.total), 0)).where(
            PurchaseOrder.supplier_id == supplier_id,
            PurchaseOrder.status.not_in(["draft", "pending_approval", "cancelled", "refused"]),
        )
    ).scalar_one()
    since = utcnow() - timedelta(days=365)
    monthly = db.execute(
        select(
            func.date_trunc("month", PurchaseOrder.created_at).label("m"),
            func.coalesce(func.sum(PurchaseOrder.total), 0),
        )
        .where(
            PurchaseOrder.supplier_id == supplier_id,
            PurchaseOrder.created_at >= since,
            PurchaseOrder.status.not_in(["draft", "pending_approval", "cancelled", "refused"]),
        )
        .group_by("m")
        .order_by("m")
    ).all()

    def avg(attr: str) -> float | None:
        return round(sum(getattr(r, attr) for r in ratings) / len(ratings), 2) if ratings else None

    return jsonable(
        {
            "supplier": {"id": supplier.id, "legal_name": supplier.legal_name, "status": supplier.status},
            "kpis": {
                "quality_score": supplier.quality_score,
                "service_rate": supplier.service_rate,
                "error_rate": supplier.error_rate,
                "on_time_rate": supplier.on_time_rate,
                "avg_delay_days": supplier.avg_delay_days,
            },
            "ratings": {
                "count": len(ratings),
                "quality": avg("quality"),
                "timeliness": avg("timeliness"),
                "compliance": avg("compliance"),
                "communication": avg("communication"),
                "latest": [serialize(r) for r in ratings[:10]],
            },
            "incidents": {kind: count for kind, count in incidents},
            "spend_total": spend,
            "spend_monthly": [
                {"month": m.date().isoformat() if m else None, "amount": amount} for m, amount in monthly
            ],
        }
    )


# ---------------------------------------------------------------------------- contacts & catalogue
def _check_supplier_exists(db: Session, obj: Any, access: Access, values: dict[str, Any]) -> None:
    supplier = db.get(Supplier, obj.supplier_id)
    if supplier is None or supplier.deleted_at is not None:
        raise BusinessRuleError("Fournisseur inconnu")
    for key in ("phone", "whatsapp"):
        if getattr(obj, key, None):
            setattr(obj, key, clean_phone(getattr(obj, key)))


router.include_router(
    make_crud_router(
        SupplierContact,
        prefix="/supplier-contacts",
        tags=[TAG],
        module="suppliers",
        read_perm="suppliers:read",
        write_perm="suppliers:write",
        label="Contact fournisseur",
        filters=["supplier_id", "kind"],
        search=["name", "email"],
        before_create=_check_supplier_exists,
    )
)


def _track_price(db: Session, obj: SupplierProduct, access: Access, values: dict[str, Any]) -> None:
    if (
        "unit_price" in values
        and values["unit_price"] is not None
        and Decimal(values["unit_price"]) != Decimal(obj.unit_price or 0)
    ):
        db.add(
            SupplierPriceHistory(
                product_id=obj.id,
                unit_price=obj.unit_price,
                currency=obj.currency,
                valid_from=obj.updated_at.date() if obj.updated_at else date.today(),
                valid_to=date.today(),
                source="negotiation",
                created_by_id=access.p.id,
            )
        )


def _product_created(db: Session, obj: SupplierProduct, access: Access, action: str) -> None:
    if action == "create":
        db.add(
            SupplierPriceHistory(
                product_id=obj.id,
                unit_price=obj.unit_price,
                currency=obj.currency,
                valid_from=date.today(),
                source="negotiation",
                created_by_id=access.p.id,
            )
        )


router.include_router(
    make_crud_router(
        SupplierProduct,
        prefix="/supplier-products",
        tags=[TAG],
        module="suppliers",
        read_perm="suppliers:read",
        write_perm="suppliers:write",
        label="Article fournisseur",
        filters=["supplier_id", "stock_item_id", "category", "is_active"],
        search=["name", "reference"],
        sort=["name", "unit_price", "lead_time_days"],
        default_sort="name",
        before_create=_check_supplier_exists,
        before_update=_track_price,
        after_change=_product_created,
    )
)


@router.get("/supplier-products/{product_id}/price-history")
def price_history(
    product_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("suppliers:read")
    rows = db.execute(
        select(SupplierPriceHistory)
        .where(SupplierPriceHistory.product_id == product_id)
        .order_by(SupplierPriceHistory.valid_from.desc(), SupplierPriceHistory.created_at.desc())
    ).scalars()
    return [jsonable(serialize(r)) for r in rows]


@router.get("/supplier-products/compare")
def compare_prices(
    stock_item_id: uuid.UUID | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    """Comparatif multi-fournisseurs d'un article (prix, délai, stock, score qualité)."""
    access.require("suppliers:read")
    if not stock_item_id and not q:
        raise BusinessRuleError("Article ou recherche requis")
    stmt = (
        select(SupplierProduct, Supplier)
        .join(Supplier, Supplier.id == SupplierProduct.supplier_id)
        .where(SupplierProduct.is_active.is_(True), Supplier.deleted_at.is_(None), Supplier.status == "active")
    )
    if stock_item_id:
        stmt = stmt.where(SupplierProduct.stock_item_id == stock_item_id)
    if q:
        stmt = stmt.where(or_(SupplierProduct.name.ilike(f"%{q}%"), SupplierProduct.reference.ilike(f"%{q}%")))
    rows = db.execute(stmt.order_by(SupplierProduct.unit_price).limit(100)).all()
    return jsonable(
        [
            {
                "product": serialize(p),
                "supplier": {
                    "id": s.id,
                    "legal_name": s.legal_name,
                    "quality_score": s.quality_score,
                    "on_time_rate": s.on_time_rate,
                },
                "lead_time_days": p.lead_time_days or s.lead_time_days,
            }
            for p, s in rows
        ]
    )


# ---------------------------------------------------------------------------- documents, notations, incidents
@router.post("/suppliers/{supplier_id}/documents", status_code=201)
async def upload_supplier_document(
    supplier_id: uuid.UUID,
    kind: str = Form(..., max_length=40),
    title: str = Form(..., min_length=2, max_length=250),
    valid_until: date | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("suppliers:write")
    if db.get(Supplier, supplier_id) is None:
        raise NotFound("Fournisseur introuvable")
    upload = validate_upload(file.filename or "document", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="supplier_documents", classification="confidential", uploaded_by_id=access.p.id
    )
    doc = SupplierDocument(supplier_id=supplier_id, kind=kind, title=title, file_id=stored.id, valid_until=valid_until)
    db.add(doc)
    db.flush()
    audit.record(
        db,
        family="business",
        module="suppliers",
        action="DOCUMENT_ADD",
        resource_type="supplier",
        resource_id=supplier_id,
        diff={"kind": kind, "title": title},
    )
    db.commit()
    return jsonable(serialize(doc))


@router.post("/supplier-documents/{document_id}/verify")
def verify_supplier_document(
    document_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("suppliers:write")
    doc = db.get(SupplierDocument, document_id)
    if doc is None:
        raise NotFound("Document introuvable")
    doc.verified = True
    doc.verified_by_id = access.p.id
    audit.record(
        db,
        family="business",
        module="suppliers",
        action="DOCUMENT_VERIFY",
        resource_type="supplier",
        resource_id=doc.supplier_id,
        diff={"document": doc.title},
    )
    db.commit()
    return jsonable(serialize(doc))


@router.get("/supplier-documents/{document_id}/file")
def supplier_document_file(
    document_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("suppliers:read")
    doc = db.get(SupplierDocument, document_id)
    if doc is None or not doc.file_id:
        raise NotFound("Document introuvable")
    return file_response(db.get(StoredFile, doc.file_id))


class SupplierRatingIn(BaseModel):
    purchase_order_id: uuid.UUID | None = None
    goods_receipt_id: uuid.UUID | None = None
    quality: int = Field(ge=1, le=5)
    timeliness: int = Field(ge=1, le=5)
    compliance: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


@router.get("/suppliers/{supplier_id}/ratings")
def list_ratings(
    supplier_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("suppliers:read")
    rows = db.execute(
        select(SupplierRating)
        .where(SupplierRating.supplier_id == supplier_id)
        .order_by(SupplierRating.created_at.desc())
    ).scalars()
    return [jsonable({**serialize(r), "average": r.average}) for r in rows]


@router.post("/suppliers/{supplier_id}/ratings", status_code=201)
def rate_supplier(
    supplier_id: uuid.UUID, data: SupplierRatingIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if not access.p.has_any("suppliers:write", "procurement:order", "deliveries:receive"):
        raise Forbidden("Notation réservée aux acheteurs et réceptionnaires", code="PERMISSION_DENIED")
    if db.get(Supplier, supplier_id) is None:
        raise NotFound("Fournisseur introuvable")
    rating = SupplierRating(supplier_id=supplier_id, rated_by_id=access.p.id, **data.model_dump())
    db.add(rating)
    db.flush()
    procurement.refresh_supplier_kpis(db, supplier_id)
    db.commit()
    return jsonable({**serialize(rating), "average": rating.average})


router.include_router(
    make_crud_router(
        SupplierIncident,
        prefix="/supplier-incidents",
        tags=[TAG],
        module="suppliers",
        read_perm="suppliers:read",
        write_perm="procurement:order",
        label="Incident fournisseur",
        filters=["supplier_id", "kind", "status"],
        sort=["created_at"],
        creator_attr="created_by_id",
        readonly_fields={"resolved_at"},
        before_create=_check_supplier_exists,
        allow_delete=False,
    )
)


class ResolveIncidentIn(BaseModel):
    resolution: str = Field(min_length=5, max_length=4000)
    amount_impact: Decimal | None = None


@router.post("/supplier-incidents/{incident_id}/resolve")
def resolve_incident(
    incident_id: uuid.UUID, data: ResolveIncidentIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("procurement:order")
    incident = db.get(SupplierIncident, incident_id)
    if incident is None:
        raise NotFound("Incident introuvable")
    incident.status = "resolved"
    incident.resolution = data.resolution
    incident.resolved_at = utcnow()
    if data.amount_impact is not None:
        incident.amount_impact = data.amount_impact
    audit.record(
        db,
        family="business",
        module="suppliers",
        action="INCIDENT_RESOLVE",
        resource_type="supplier_incident",
        resource_id=incident.id,
        reason=data.resolution,
    )
    db.commit()
    return jsonable(serialize(incident))


# ============================================================================ extranet fournisseur (compte authentifié)
def my_supplier(db: Session, access: Access) -> Supplier:
    access.require("extranet:supplier")
    if not access.p.organization_id:
        raise Forbidden("Compte non rattaché à un fournisseur", code="ORGANIZATION_REQUIRED")
    supplier = db.execute(
        select(Supplier).where(Supplier.organization_id == access.p.organization_id, Supplier.deleted_at.is_(None))
    ).scalar_one_or_none()
    if supplier is None:
        raise Forbidden("Aucun fournisseur rattaché à votre organisation", code="ORGANIZATION_REQUIRED")
    return supplier


def _my_order(db: Session, supplier: Supplier, order_id: uuid.UUID) -> PurchaseOrder:
    po = db.get(PurchaseOrder, order_id)
    if (
        po is None
        or po.supplier_id != supplier.id
        or po.deleted_at is not None
        or po.status in ("draft", "pending_approval", "approved")
    ):
        raise NotFound("Bon de commande introuvable")
    return po


@extranet.get("/profile")
def extranet_profile(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    data = supplier_out(db, supplier, detail=True)
    data.pop("notes", None)
    return data


class ExtranetProfileIn(BaseModel):
    address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    whatsapp_number: str | None = Field(default=None, max_length=40)
    whatsapp_opt_in: bool | None = None
    delivery_zones: list[str] | None = Field(default=None, max_length=100)
    lead_time_days: int | None = Field(default=None, ge=0, le=365)


@extranet.patch("/profile")
def extranet_update_profile(
    data: ExtranetProfileIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Mise à jour des coordonnées (les coordonnées bancaires passent par la finance avec contrôle)."""
    supplier = my_supplier(db, access)
    values = _normalize(data.model_dump(exclude_unset=True))
    for key, value in values.items():
        setattr(supplier, key, value)
    audit.record(
        db,
        family="business",
        module="extranet",
        action="PROFILE_UPDATE",
        resource_type="supplier",
        resource_id=supplier.id,
        diff={"fields": sorted(values)},
    )
    db.commit()
    return supplier_out(db, supplier, detail=True)


@extranet.get("/orders")
def extranet_orders(
    params: PageParams = Depends(),
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    stmt = select(PurchaseOrder).where(
        PurchaseOrder.supplier_id == supplier.id,
        PurchaseOrder.deleted_at.is_(None),
        PurchaseOrder.status.not_in(["draft", "pending_approval", "approved"]),
    )
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    return paginate(
        db,
        stmt,
        params,
        default_sort=PurchaseOrder.created_at.desc(),
        search_columns=[PurchaseOrder.number],
        transform=lambda po: {"id": str(po.id), **procurement.portal_view(db, po)},
    )


@extranet.get("/orders/{order_id}")
def extranet_order(
    order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    po = _my_order(db, supplier, order_id)
    if po.supplier_viewed_at is None:
        po.supplier_viewed_at = utcnow()
        db.commit()
    return {"id": str(po.id), **procurement.portal_view(db, po)}


@extranet.get("/orders/{order_id}/pdf")
def extranet_order_pdf(
    order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    supplier = my_supplier(db, access)
    po = _my_order(db, supplier, order_id)
    if po.pdf_file_id:
        return file_response(db.get(StoredFile, po.pdf_file_id), inline=False)
    return Response(
        procurement.po_pdf(db, po),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{po.number}.pdf"'},
    )


class ExtranetRespondIn(BaseModel):
    action: str = Field(pattern="^(confirm|refuse|counter)$")
    note: str | None = Field(default=None, max_length=2000)
    counter: dict[str, Any] | None = None


@extranet.post("/orders/{order_id}/respond")
def extranet_respond(
    order_id: uuid.UUID, data: ExtranetRespondIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    po = _my_order(db, supplier, order_id)
    if data.action == "refuse" and not (data.note or "").strip():
        raise BusinessRuleError("Motif du refus obligatoire", code="REASON_REQUIRED")
    procurement.supplier_respond(
        db,
        po,
        action=data.action,
        note=data.note,
        counter=jsonable(data.counter),
        actor_label=f"{supplier.legal_name} ({access.p.user.email})",
        channel="extranet",
    )
    db.commit()
    return {"id": str(po.id), **procurement.portal_view(db, po)}


class ExtranetShipmentIn(BaseModel):
    eta: datetime
    carrier: str | None = Field(default=None, max_length=150)
    tracking_ref: str | None = Field(default=None, max_length=150)
    vehicle_plate: str | None = Field(default=None, max_length=30)
    driver_name: str | None = Field(default=None, max_length=150)
    driver_phone: str | None = Field(default=None, max_length=40)
    delivery_note_ref: str | None = Field(default=None, max_length=80)


@extranet.post("/orders/{order_id}/shipment", status_code=201)
def extranet_shipment(
    order_id: uuid.UUID, data: ExtranetShipmentIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    po = _my_order(db, supplier, order_id)
    procurement.announce_shipment(
        db,
        po,
        eta=data.eta,
        carrier=data.carrier,
        tracking=data.tracking_ref,
        vehicle=data.vehicle_plate,
        driver=data.driver_name,
        driver_phone=data.driver_phone,
        note_ref=data.delivery_note_ref,
    )
    db.commit()
    return {"id": str(po.id), **procurement.portal_view(db, po)}


class ExtranetInvoiceLine(BaseModel):
    po_line_id: uuid.UUID
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


@extranet.post("/orders/{order_id}/invoices", status_code=201)
async def extranet_invoice(
    order_id: uuid.UUID,
    supplier_reference: str = Form(..., min_length=1, max_length=80),
    invoice_date: date = Form(...),
    due_date: date | None = Form(None),
    tax_amount: Decimal = Form(Decimal("0")),
    lines_json: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    po = _my_order(db, supplier, order_id)
    if po.status not in ("partially_received", "received", "invoiced"):
        raise BusinessRuleError("Facturation possible après réception de la marchandise", code="NOT_RECEIVED")
    try:
        raw = [ExtranetInvoiceLine.model_validate(x) for x in json.loads(lines_json)]
    except (ValueError, ValidationError) as exc:
        raise BusinessRuleError("Lignes de facture invalides") from exc
    po_lines = {li.id: li for li in po.lines}
    lines = []
    for item in raw:
        po_line = po_lines.get(item.po_line_id)
        if po_line is None:
            raise BusinessRuleError("Ligne hors bon de commande")
        lines.append(
            {
                "po_line_id": po_line.id,
                "description": po_line.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
            }
        )
    if not lines:
        raise BusinessRuleError("Aucune ligne facturée")
    billing.ensure_new_invoice(db, supplier.id, supplier_reference)
    upload = validate_upload(file.filename or "facture.pdf", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="supplier_invoices", classification="confidential", uploaded_by_id=access.p.id
    )
    try:
        invoice = billing.register_supplier_invoice(
            db,
            supplier_id=supplier.id,
            reference=supplier_reference,
            po_id=po.id,
            invoice_date=invoice_date,
            due_date=due_date,
            lines=lines,
            tax_amount=tax_amount,
            file_id=stored.id,
            user_id=access.p.id,
            source="extranet",
        )
    except IntegrityError as exc:
        raise Conflict("Facture déjà déposée", code="DUPLICATE_INVOICE") from exc
    match = billing.three_way_match(db, invoice, user_id=None)
    db.commit()
    return jsonable(
        {
            "invoice": {"id": invoice.id, "number": invoice.number, "status": invoice.status, "total": invoice.total},
            "match": match.result,
        }
    )


@extranet.get("/invoices")
def extranet_invoices(
    params: PageParams = Depends(), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    stmt = select(SupplierInvoice).where(
        SupplierInvoice.supplier_id == supplier.id, SupplierInvoice.deleted_at.is_(None)
    )
    return paginate(
        db,
        stmt,
        params,
        default_sort=SupplierInvoice.invoice_date.desc(),
        search_columns=[SupplierInvoice.supplier_reference],
        transform=lambda i: jsonable(
            {
                "id": i.id,
                "number": i.number,
                "reference": i.supplier_reference,
                "invoice_date": i.invoice_date,
                "due_date": i.due_date,
                "total": i.total,
                "amount_paid": i.amount_paid,
                "status": i.status,
                "match_status": i.match_status,
            }
        ),
    )


@extranet.get("/payments")
def extranet_payments(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    from app.modules.finance.models import Payment

    supplier = my_supplier(db, access)
    rows = db.execute(
        select(Payment)
        .where(
            Payment.counterparty_type == "supplier", Payment.counterparty_id == supplier.id, Payment.direction == "out"
        )
        .order_by(Payment.created_at.desc())
        .limit(200)
    ).scalars()
    return jsonable(
        [
            {
                "number": p.number,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "method": p.method,
                "paid_at": p.paid_at,
                "created_at": p.created_at,
            }
            for p in rows
        ]
    )


@extranet.get("/deliveries")
def extranet_deliveries(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    supplier = my_supplier(db, access)
    rows = db.execute(
        select(Delivery).where(Delivery.supplier_id == supplier.id).order_by(Delivery.created_at.desc()).limit(200)
    ).scalars()
    return jsonable([serialize(d) for d in rows])


@extranet.post("/documents", status_code=201)
async def extranet_upload_document(
    kind: str = Form(..., max_length=40),
    title: str = Form(..., min_length=2, max_length=250),
    valid_until: date | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    supplier = my_supplier(db, access)
    upload = validate_upload(file.filename or "document", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="supplier_documents", classification="confidential", uploaded_by_id=access.p.id
    )
    doc = SupplierDocument(supplier_id=supplier.id, kind=kind, title=title, file_id=stored.id, valid_until=valid_until)
    db.add(doc)
    db.flush()
    audit.record(
        db,
        family="business",
        module="extranet",
        action="DOCUMENT_ADD",
        resource_type="supplier",
        resource_id=supplier.id,
        diff={"kind": kind, "title": title},
    )
    db.commit()
    return jsonable(serialize(doc))


@extranet.get("/documents/{document_id}/file")
def extranet_document_file(
    document_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    """Consultation par le fournisseur de ses propres pièces (attestations, certificats, Kbis…)."""
    supplier = my_supplier(db, access)
    doc = db.get(SupplierDocument, document_id)
    if doc is None or doc.supplier_id != supplier.id:
        raise NotFound("Document introuvable")
    return file_response(db.get(StoredFile, doc.file_id))


@extranet.get("/scorecard")
def extranet_scorecard(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    supplier = procurement.refresh_supplier_kpis(db, my_supplier(db, access).id)
    db.commit()
    return jsonable(
        {
            "quality_score": supplier.quality_score,
            "service_rate": supplier.service_rate,
            "error_rate": supplier.error_rate,
            "on_time_rate": supplier.on_time_rate,
            "avg_delay_days": supplier.avg_delay_days,
        }
    )
