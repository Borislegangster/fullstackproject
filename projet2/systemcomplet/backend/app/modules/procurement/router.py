"""API Achats / Livraisons / Réceptions / Factures fournisseurs (§8)
+ portail fournisseur sécurisé + webhook WhatsApp Business."""

from __future__ import annotations

import io
import json
import logging
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

import qrcode
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.config import settings
from app.core.crud import serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import AppError, BusinessRuleError, Forbidden, NotFound
from app.core.files import store_private, validate_upload
from app.core.idempotency import Idempotency, idempotency
from app.core.numbering import next_number
from app.core.pagination import PageParams, paginate
from app.core.ratelimit import rate_limit
from app.core.utils import jsonable, money, utcnow
from app.modules.billing import service as billing
from app.modules.billing.models import SupplierInvoice
from app.modules.procurement import service
from app.modules.procurement.models import (
    Approval,
    Delivery,
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    SupplierMessage,
    SupplierReturn,
)
from app.modules.projects.models import Lot, Project, Site
from app.modules.suppliers.models import Supplier, SupplierRating
from app.modules.system.models import InboundWebhookEvent, StoredFile

log = logging.getLogger("globus.procurement")
TAG = "Achats & livraisons"
router = APIRouter(tags=[TAG])
public = APIRouter(
    prefix="/public/supplier-portal",
    tags=["Portail fournisseur (lien sécurisé)"],
    dependencies=[Depends(rate_limit("supplier_portal", "60/minute"))],
)
whatsapp = APIRouter(prefix="/webhooks/whatsapp", tags=["Webhooks WhatsApp Business"])


def _load(db: Session, model: Any, obj_id: uuid.UUID, label: str) -> Any:
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "deleted_at", None) is not None:
        raise NotFound(f"{label} introuvable")
    return obj


def _check_scope(db: Session, project_id: uuid.UUID, site_id: uuid.UUID | None, lot_id: uuid.UUID | None) -> None:
    if site_id:
        site = db.get(Site, site_id)
        if site is None or site.project_id != project_id:
            raise BusinessRuleError("Chantier hors projet")
    if lot_id:
        lot = db.get(Lot, lot_id)
        if lot is None or lot.project_id != project_id:
            raise BusinessRuleError("Lot hors projet")


# ============================================================================ demandes d'achat
class PRLineIn(BaseModel):
    stock_item_id: uuid.UUID | None = None
    supplier_product_id: uuid.UUID | None = None
    description: str = Field(min_length=2, max_length=300)
    quantity: Decimal = Field(gt=0)
    unit: str = Field(default="u", min_length=1, max_length=20)
    estimated_unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = Field(default=None, max_length=2000)


class PRIn(BaseModel):
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    zone: str | None = Field(default=None, max_length=120)
    lot_id: uuid.UUID | None = None
    category: str | None = Field(default=None, max_length=80)
    cost_center: str | None = Field(default=None, max_length=80)
    urgency: str = Field(default="normal", pattern="^(normal|urgent|critical)$")
    justification: str | None = Field(default=None, max_length=4000)
    needed_by: date | None = None
    budget_line_id: uuid.UUID | None = None
    source: str = Field(default="web", pattern="^(web|mobile|offline|desktop)$")
    lines: list[PRLineIn] = Field(min_length=1, max_length=200)
    submit: bool = False


class PRUpdate(BaseModel):
    site_id: uuid.UUID | None = None
    zone: str | None = Field(default=None, max_length=120)
    lot_id: uuid.UUID | None = None
    category: str | None = Field(default=None, max_length=80)
    cost_center: str | None = Field(default=None, max_length=80)
    urgency: str | None = Field(default=None, pattern="^(normal|urgent|critical)$")
    justification: str | None = Field(default=None, max_length=4000)
    needed_by: date | None = None
    lines: list[PRLineIn] | None = Field(default=None, min_length=1, max_length=200)


class DecisionIn(BaseModel):
    approve: bool
    comment: str | None = Field(default=None, max_length=2000)


def _pr_out(db: Session, pr: PurchaseRequest) -> dict[str, Any]:
    approvals = (
        db.execute(
            select(Approval)
            .where(Approval.entity_type == "purchase_request", Approval.entity_id == pr.id)
            .order_by(Approval.level, Approval.created_at)
        )
        .scalars()
        .all()
    )
    orders = db.execute(
        select(PurchaseOrder.id, PurchaseOrder.number, PurchaseOrder.status).where(
            PurchaseOrder.request_id == pr.id, PurchaseOrder.deleted_at.is_(None)
        )
    ).all()
    return jsonable(
        {
            **serialize(pr),
            "lines": [serialize(li) for li in pr.lines],
            "approvals": [serialize(a) for a in approvals],
            "orders": [{"id": o.id, "number": o.number, "status": o.status} for o in orders],
        }
    )


def _require_request_reader(access: Access) -> None:
    if not access.p.has_any("procurement:read", "procurement:request"):
        raise Forbidden("Permission manquante : procurement:read", code="PERMISSION_DENIED")


@router.get("/procurement/requests")
def list_requests(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    urgency: str | None = None,
    mine: bool = False,
    awaiting_my_approval: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    _require_request_reader(access)
    stmt = access.filter_by_project(
        select(PurchaseRequest).where(PurchaseRequest.deleted_at.is_(None)),
        PurchaseRequest.project_id,
        allow_null=False,
    )
    if project_id:
        stmt = stmt.where(PurchaseRequest.project_id == project_id)
    if status:
        stmt = stmt.where(PurchaseRequest.status == status)
    if urgency:
        stmt = stmt.where(PurchaseRequest.urgency == urgency)
    if mine or not access.has("procurement:read"):
        stmt = stmt.where(PurchaseRequest.requested_by_id == access.p.id)
    if awaiting_my_approval:
        pending = select(Approval.entity_id).where(
            Approval.entity_type == "purchase_request",
            Approval.status == "pending",
            Approval.approver_role.in_(list(access.p.roles) or [""]),
        )
        stmt = stmt.where(PurchaseRequest.id.in_(pending), PurchaseRequest.status == "submitted")
    return paginate(
        db,
        stmt,
        params,
        sort_fields={
            "created_at": PurchaseRequest.created_at,
            "needed_by": PurchaseRequest.needed_by,
            "total": PurchaseRequest.total_estimated,
        },
        default_sort=PurchaseRequest.created_at.desc(),
        search_columns=[PurchaseRequest.number, PurchaseRequest.justification],
        transform=lambda pr: _pr_out(db, pr),
    )


@router.post("/procurement/requests", status_code=201)
def create_request(
    data: PRIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency()),
) -> Any:
    if idem.replay is not None:
        return idem.replay
    access.require_project(data.project_id, "procurement:request")
    _check_scope(db, data.project_id, data.site_id, data.lot_id)
    pr = PurchaseRequest(
        number=next_number(db, "purchase_request"),
        project_id=data.project_id,
        site_id=data.site_id,
        zone=data.zone,
        lot_id=data.lot_id,
        requested_by_id=access.p.id,
        category=data.category,
        cost_center=data.cost_center,
        urgency=data.urgency,
        justification=data.justification,
        needed_by=data.needed_by,
        budget_line_id=data.budget_line_id,
        source=data.source,
    )
    for line in data.lines:
        pr.lines.append(PurchaseRequestLine(**line.model_dump()))
    pr.total_estimated = service.request_total(pr)
    db.add(pr)
    db.flush()
    audit.record(
        db,
        family="business",
        module="procurement",
        action="CREATE",
        resource_type="purchase_request",
        resource_id=pr.id,
        project_id=pr.project_id,
        diff={"number": pr.number, "lines": len(data.lines)},
    )
    if data.submit:
        service.submit_request(db, pr, user_id=access.p.id)
    result = _pr_out(db, pr)
    return idem.complete(db, result, status_code=201)


@router.get("/procurement/requests/{request_id}")
def get_request(
    request_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _require_request_reader(access)
    pr = _load(db, PurchaseRequest, request_id, "Demande d'achat")
    access.require_project(pr.project_id)
    if not access.has("procurement:read") and pr.requested_by_id != access.p.id:
        raise NotFound("Demande d'achat introuvable")
    return _pr_out(db, pr)


@router.patch("/procurement/requests/{request_id}")
def update_request(
    request_id: uuid.UUID, data: PRUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    pr = _load(db, PurchaseRequest, request_id, "Demande d'achat")
    access.require_project(pr.project_id, "procurement:request")
    if pr.status != "draft":
        raise BusinessRuleError("Seule une demande en brouillon est modifiable")
    if pr.requested_by_id != access.p.id and not access.has("procurement:approve"):
        raise Forbidden("Demande d'un autre utilisateur")
    values = data.model_dump(exclude_unset=True)
    _check_scope(db, pr.project_id, values.get("site_id", pr.site_id), values.get("lot_id", pr.lot_id))
    lines = values.pop("lines", None)
    for key, value in values.items():
        setattr(pr, key, value)
    if lines is not None:
        pr.lines.clear()
        db.flush()
        for line in lines:
            pr.lines.append(PurchaseRequestLine(**line))
    pr.total_estimated = service.request_total(pr)
    audit.record(
        db,
        family="business",
        module="procurement",
        action="UPDATE",
        resource_type="purchase_request",
        resource_id=pr.id,
        project_id=pr.project_id,
        diff={"fields": sorted(values), "lines": lines is not None},
    )
    db.commit()
    return _pr_out(db, pr)


@router.post("/procurement/requests/{request_id}/submit")
def submit_request(
    request_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    pr = _load(db, PurchaseRequest, request_id, "Demande d'achat")
    access.require_project(pr.project_id, "procurement:request")
    service.submit_request(db, pr, user_id=access.p.id)
    db.commit()
    return _pr_out(db, pr)


@router.post("/procurement/requests/{request_id}/decision")
def decide_request(
    request_id: uuid.UUID, data: DecisionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    pr = _load(db, PurchaseRequest, request_id, "Demande d'achat")
    access.require_project(pr.project_id, "procurement:approve")
    if not data.approve and not (data.comment or "").strip():
        raise BusinessRuleError("Motif de refus obligatoire", code="REASON_REQUIRED")
    service.decide_request(db, pr, principal=access.p, approve=data.approve, comment=data.comment)
    db.commit()
    return _pr_out(db, pr)


@router.post("/procurement/requests/{request_id}/cancel")
def cancel_request(
    request_id: uuid.UUID,
    data: DecisionIn | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    pr = _load(db, PurchaseRequest, request_id, "Demande d'achat")
    access.require_project(pr.project_id, "procurement:request")
    if pr.status in ("ordered", "cancelled"):
        raise BusinessRuleError("Demande déjà commandée ou annulée")
    if pr.requested_by_id != access.p.id and not access.has("procurement:approve"):
        raise Forbidden("Demande d'un autre utilisateur")
    pr.status = "cancelled"
    for approval in db.execute(
        select(Approval).where(
            Approval.entity_type == "purchase_request", Approval.entity_id == pr.id, Approval.status == "pending"
        )
    ).scalars():
        approval.status = "skipped"
    audit.record(
        db,
        family="business",
        module="procurement",
        action="CANCEL",
        resource_type="purchase_request",
        resource_id=pr.id,
        project_id=pr.project_id,
        reason=data.comment if data else None,
    )
    db.commit()
    return _pr_out(db, pr)


@router.get("/procurement/requests/{request_id}/suppliers")
def rank_request_suppliers(
    request_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    pr = _load(db, PurchaseRequest, request_id, "Demande d'achat")
    access.require_project(pr.project_id, "procurement:order")
    return jsonable(service.rank_suppliers(db, pr))


class OrderFromRequestIn(BaseModel):
    supplier_id: uuid.UUID
    prices: dict[str, Decimal] | None = None  # line_id → PU négocié
    expected_date: date | None = None
    notes: str | None = Field(default=None, max_length=4000)
    send: bool = False
    channel: str | None = Field(default=None, pattern="^(whatsapp|email|sms)$")


@router.post("/procurement/requests/{request_id}/order", status_code=201)
def order_from_request(
    request_id: uuid.UUID,
    data: OrderFromRequestIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency(required=True)),
) -> Any:
    if idem.replay is not None:
        return idem.replay
    pr = _load(db, PurchaseRequest, request_id, "Demande d'achat")
    access.require_project(pr.project_id, "procurement:order")
    ranking = service.rank_suppliers(db, pr)
    chosen = next((r for r in ranking if r["supplier_id"] == str(data.supplier_id)), None)
    reason = {
        "ranking": [
            {k: r[k] for k in ("supplier_id", "supplier", "score", "total", "lead_time_days", "breakdown")}
            for r in ranking[:5]
        ],
        "chosen_rank": (ranking.index(chosen) + 1) if chosen else None,
    }
    po = service.po_from_request(
        db,
        pr,
        supplier_id=data.supplier_id,
        user_id=access.p.id,
        prices={k: money(v) for k, v in (data.prices or {}).items()},
        expected_date=data.expected_date,
        reason=jsonable(reason),
    )
    po.notes = data.notes
    sent: dict[str, Any] | None = None
    if data.send:
        sent = service.send_po(db, po, user_id=access.p.id, channel=data.channel)
    return idem.complete(db, {**_po_out(db, po), "sent": sent}, status_code=201)


@router.get("/procurement/approvals/pending")
def pending_approvals(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("procurement:approve")
    rows = (
        db.execute(
            select(Approval)
            .where(Approval.status == "pending", Approval.approver_role.in_(list(access.p.roles) or [""]))
            .order_by(Approval.created_at)
        )
        .scalars()
        .all()
    )
    out = []
    for approval in rows:
        if approval.project_id and not access.can_access_project(approval.project_id):
            continue
        lower_pending = db.execute(
            select(func.count())
            .select_from(Approval)
            .where(
                Approval.entity_type == approval.entity_type,
                Approval.entity_id == approval.entity_id,
                Approval.status == "pending",
                Approval.level < approval.level,
            )
        ).scalar_one()
        if lower_pending:
            continue
        item: dict[str, Any] = {"approval": serialize(approval)}
        if approval.entity_type == "purchase_request":
            pr = db.get(PurchaseRequest, approval.entity_id)
            if pr is None or pr.status != "submitted":
                continue
            item["request"] = _pr_out(db, pr)
        out.append(item)
    return jsonable(out)


# ============================================================================ bons de commande
class POLineIn(BaseModel):
    supplier_product_id: uuid.UUID | None = None
    stock_item_id: uuid.UUID | None = None
    reference: str | None = Field(default=None, max_length=80)
    description: str = Field(min_length=2, max_length=300)
    quantity: Decimal = Field(gt=0)
    unit: str = Field(default="u", min_length=1, max_length=20)
    unit_price: Decimal = Field(ge=0)
    tax_rate: Decimal = Field(default=Decimal("19.25"), ge=0, le=100)


class POIn(BaseModel):
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    lot_id: uuid.UUID | None = None
    supplier_id: uuid.UUID
    urgent: bool = False
    expected_date: date | None = None
    delivery_address: str | None = Field(default=None, max_length=1000)
    payment_terms: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)
    justification: str = Field(min_length=10, max_length=2000)  # commande directe sans DA = exception tracée
    lines: list[POLineIn] = Field(min_length=1, max_length=200)


class POUpdate(BaseModel):
    expected_date: date | None = None
    delivery_address: str | None = Field(default=None, max_length=1000)
    payment_terms: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=4000)
    lines: list[POLineIn] | None = Field(default=None, min_length=1, max_length=200)


def _po_out(db: Session, po: PurchaseOrder, *, detail: bool = False) -> dict[str, Any]:
    supplier = db.get(Supplier, po.supplier_id)
    project = db.get(Project, po.project_id)
    out: dict[str, Any] = {
        **serialize(po),
        "lines": [serialize(li) for li in po.lines],
        "supplier": {
            "id": supplier.id,
            "legal_name": supplier.legal_name,
            "whatsapp": bool(supplier.whatsapp_number and supplier.whatsapp_opt_in),
            "email": supplier.email,
        }
        if supplier
        else None,
        "project": {"id": project.id, "code": project.code, "name": project.name} if project else None,
    }
    out.pop("portal_token_hash", None)
    if detail:
        out["messages"] = [
            serialize(m)
            for m in db.execute(
                select(SupplierMessage)
                .where(SupplierMessage.purchase_order_id == po.id)
                .order_by(SupplierMessage.created_at)
            ).scalars()
        ]
        out["deliveries"] = [
            serialize(d)
            for d in db.execute(
                select(Delivery).where(Delivery.purchase_order_id == po.id).order_by(Delivery.created_at)
            ).scalars()
        ]
        out["receipts"] = [
            {**serialize(g), "lines": [serialize(li) for li in g.lines]}
            for g in db.execute(
                select(GoodsReceipt).where(GoodsReceipt.purchase_order_id == po.id).order_by(GoodsReceipt.created_at)
            ).scalars()
        ]
        out["invoices"] = [
            serialize(i)
            for i in db.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.purchase_order_id == po.id, SupplierInvoice.deleted_at.is_(None)
                )
            ).scalars()
        ]
    return jsonable(out)


@router.get("/procurement/orders")
def list_orders(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    supplier_id: uuid.UUID | None = None,
    status: str | None = None,
    urgent: bool | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not access.p.has_any("procurement:read", "deliveries:read"):
        raise Forbidden("Permission manquante : procurement:read", code="PERMISSION_DENIED")
    stmt = access.filter_by_project(
        select(PurchaseOrder).where(PurchaseOrder.deleted_at.is_(None)), PurchaseOrder.project_id, allow_null=False
    )
    for col, value in (
        (PurchaseOrder.project_id, project_id),
        (PurchaseOrder.supplier_id, supplier_id),
        (PurchaseOrder.status, status),
        (PurchaseOrder.urgent, urgent),
    ):
        if value is not None and value != "":
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={
            "created_at": PurchaseOrder.created_at,
            "total": PurchaseOrder.total,
            "expected_date": PurchaseOrder.expected_date,
        },
        default_sort=PurchaseOrder.created_at.desc(),
        search_columns=[PurchaseOrder.number],
        transform=lambda po: _po_out(db, po),
    )


@router.post("/procurement/orders", status_code=201)
def create_order(
    data: POIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency(required=True)),
) -> Any:
    """Commande directe (sans DA) : exception tracée, approbation par un tiers obligatoire."""
    if idem.replay is not None:
        return idem.replay
    access.require_project(data.project_id, "procurement:order")
    _check_scope(db, data.project_id, data.site_id, data.lot_id)
    supplier = db.get(Supplier, data.supplier_id)
    if supplier is None or supplier.status != "active":
        raise BusinessRuleError("Fournisseur inactif ou inconnu")
    site = db.get(Site, data.site_id) if data.site_id else None
    po = PurchaseOrder(
        number=next_number(db, "purchase_order"),
        project_id=data.project_id,
        site_id=data.site_id,
        lot_id=data.lot_id,
        supplier_id=supplier.id,
        status="pending_approval",
        urgent=data.urgent,
        expected_date=data.expected_date,
        payment_terms=data.payment_terms or supplier.payment_terms,
        delivery_address=data.delivery_address or (site.address if site else None),
        notes=data.notes,
        created_by_id=access.p.id,
        selection_reason={"direct_order": True, "justification": data.justification},
    )
    for index, line in enumerate(data.lines):
        po.lines.append(PurchaseOrderLine(sort_order=index, **line.model_dump()))
    service.compute_po(po)
    db.add(po)
    db.flush()
    audit.record(
        db,
        family="business",
        module="procurement",
        action="CREATE_DIRECT",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        reason=data.justification,
        diff={"number": po.number, "total": str(po.total)},
        criticality="MEDIUM",
    )
    return idem.complete(db, _po_out(db, po), status_code=201)


@router.get("/procurement/orders/{order_id}")
def get_order(
    order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if not access.p.has_any("procurement:read", "deliveries:read"):
        raise Forbidden("Permission manquante : procurement:read", code="PERMISSION_DENIED")
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id)
    return _po_out(db, po, detail=True)


@router.patch("/procurement/orders/{order_id}")
def update_order(
    order_id: uuid.UUID, data: POUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id, "procurement:order")
    if po.status not in ("draft", "pending_approval"):
        raise BusinessRuleError(
            "Bon de commande verrouillé : créer une révision via contre-offre ou annuler", code="PO_LOCKED"
        )
    values = data.model_dump(exclude_unset=True)
    lines = values.pop("lines", None)
    for key, value in values.items():
        setattr(po, key, value)
    if lines is not None:
        po.lines.clear()
        db.flush()
        for index, line in enumerate(lines):
            po.lines.append(PurchaseOrderLine(sort_order=index, **line))
    service.compute_po(po)
    audit.record(
        db,
        family="business",
        module="procurement",
        action="UPDATE",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        diff={"fields": sorted(values), "total": str(po.total)},
    )
    db.commit()
    return _po_out(db, po)


@router.post("/procurement/orders/{order_id}/approve")
def approve_order(
    order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id, "procurement:approve")
    if po.status != "pending_approval":
        raise BusinessRuleError("Bon de commande non soumis à approbation")
    if po.created_by_id == access.p.id and "ADMIN" not in access.p.roles:
        raise Forbidden(
            "Séparation des tâches : l'émetteur ne peut pas approuver sa commande", code="SEGREGATION_OF_DUTIES"
        )
    po.status = "approved"
    po.approved_by_id = access.p.id
    po.approved_at = utcnow()
    audit.record(
        db,
        family="business",
        module="procurement",
        action="APPROVE",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        diff={"total": str(po.total)},
        criticality="MEDIUM",
    )
    db.commit()
    return _po_out(db, po)


class SendIn(BaseModel):
    channel: str | None = Field(default=None, pattern="^(whatsapp|email|sms)$")


@router.post("/procurement/orders/{order_id}/send")
def send_order(
    order_id: uuid.UUID, data: SendIn | None = None, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id, "procurement:order")
    result = service.send_po(db, po, user_id=access.p.id, channel=data.channel if data else None)
    service.record_price_history(db, po, user_id=access.p.id)
    db.commit()
    return {**_po_out(db, po), "sent": result}


@router.get("/procurement/orders/{order_id}/pdf")
def order_pdf(order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    if not access.p.has_any("procurement:read", "deliveries:read"):
        raise Forbidden("Permission manquante : procurement:read", code="PERMISSION_DENIED")
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id)
    if po.pdf_file_id:
        return file_response(db.get(StoredFile, po.pdf_file_id))
    return Response(
        service.po_pdf(db, po),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{po.number}.pdf"'},
    )


@router.get("/procurement/orders/{order_id}/qr")
def order_qr(order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    """QR de réception (scanné par le chef de chantier / magasinier à l'arrivée de la livraison)."""
    if not access.p.has_any("procurement:read", "deliveries:read"):
        raise Forbidden("Permission manquante : deliveries:read", code="PERMISSION_DENIED")
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id)
    buf = io.BytesIO()
    qrcode.make(f"GLOBUS:PO:{po.number}", box_size=8, border=2).save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


@router.post("/procurement/orders/{order_id}/accept-counter")
def accept_counter(
    order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id, "procurement:approve")
    service.accept_counter(db, po, user_id=access.p.id)
    db.commit()
    return _po_out(db, po)


class ReasonIn(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/procurement/orders/{order_id}/cancel")
def cancel_order(
    order_id: uuid.UUID, data: ReasonIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id, "procurement:order")
    if po.status in ("partially_received", "received", "invoiced", "closed", "cancelled"):
        raise BusinessRuleError("Commande déjà réceptionnée ou clôturée : annulation impossible (utiliser un retour)")
    previous = po.status
    po.status = "cancelled"
    po.portal_token_hash = None
    from app.modules.finance.models import Commitment

    commitment = db.execute(
        select(Commitment).where(Commitment.source_type == "purchase_order", Commitment.source_id == po.id)
    ).scalar_one_or_none()
    if commitment is not None:
        commitment.status = "cancelled"
    if po.request_id:
        pr = db.get(PurchaseRequest, po.request_id)
        if pr and pr.status == "ordered":
            pr.status = "approved"
    audit.record(
        db,
        family="business",
        module="procurement",
        action="CANCEL",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        reason=data.reason,
        diff={"from": previous},
        criticality="MEDIUM",
    )
    db.commit()
    return _po_out(db, po)


@router.post("/procurement/orders/{order_id}/close")
def close_order(
    order_id: uuid.UUID,
    data: ReasonIn | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id, "procurement:approve")
    invoices = (
        db.execute(
            select(SupplierInvoice).where(
                SupplierInvoice.purchase_order_id == po.id,
                SupplierInvoice.deleted_at.is_(None),
                SupplierInvoice.status != "rejected",
            )
        )
        .scalars()
        .all()
    )
    fully_paid = bool(invoices) and all(i.status == "paid" for i in invoices)
    if not fully_paid and data is None:
        raise BusinessRuleError("Clôture anticipée : motif obligatoire (factures non soldées)", code="REASON_REQUIRED")
    po.status = "closed"
    po.closed_at = utcnow()
    from app.modules.finance.models import Commitment

    commitment = db.execute(
        select(Commitment).where(Commitment.source_type == "purchase_order", Commitment.source_id == po.id)
    ).scalar_one_or_none()
    if commitment is not None and commitment.status != "closed":
        commitment.status = "closed"
    service.refresh_supplier_kpis(db, po.supplier_id)
    audit.record(
        db,
        family="business",
        module="procurement",
        action="CLOSE",
        resource_type="purchase_order",
        resource_id=po.id,
        project_id=po.project_id,
        reason=data.reason if data else None,
        diff={"fully_paid": fully_paid},
    )
    db.commit()
    return _po_out(db, po)


class ShipmentIn(BaseModel):
    eta: datetime
    carrier: str | None = Field(default=None, max_length=150)
    tracking_ref: str | None = Field(default=None, max_length=150)
    vehicle_plate: str | None = Field(default=None, max_length=30)
    driver_name: str | None = Field(default=None, max_length=150)
    driver_phone: str | None = Field(default=None, max_length=40)
    delivery_note_ref: str | None = Field(default=None, max_length=80)


@router.post("/procurement/orders/{order_id}/shipment", status_code=201)
def internal_shipment(
    order_id: uuid.UUID, data: ShipmentIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Saisie interne d'une expédition (information reçue par téléphone pro / e-mail du fournisseur)."""
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id, "procurement:order")
    delivery = service.announce_shipment(
        db,
        po,
        eta=data.eta,
        carrier=data.carrier,
        tracking=data.tracking_ref,
        vehicle=data.vehicle_plate,
        driver=data.driver_name,
        driver_phone=data.driver_phone,
        note_ref=data.delivery_note_ref,
        announced_by="internal",
    )
    db.commit()
    return jsonable(serialize(delivery))


class RatingIn(BaseModel):
    goods_receipt_id: uuid.UUID | None = None
    quality: int = Field(ge=1, le=5)
    timeliness: int = Field(ge=1, le=5)
    compliance: int = Field(ge=1, le=5)
    communication: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=2000)


@router.post("/procurement/orders/{order_id}/ratings", status_code=201)
def rate_order(
    order_id: uuid.UUID, data: RatingIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    po = _load(db, PurchaseOrder, order_id, "Bon de commande")
    access.require_project(po.project_id)
    if not access.p.has_any("procurement:order", "deliveries:receive", "procurement:approve"):
        raise Forbidden("Notation réservée aux acheteurs et réceptionnaires", code="PERMISSION_DENIED")
    rating = SupplierRating(
        supplier_id=po.supplier_id,
        purchase_order_id=po.id,
        goods_receipt_id=data.goods_receipt_id,
        quality=data.quality,
        timeliness=data.timeliness,
        compliance=data.compliance,
        communication=data.communication,
        comment=data.comment,
        rated_by_id=access.p.id,
    )
    db.add(rating)
    db.flush()
    service.refresh_supplier_kpis(db, po.supplier_id)
    db.commit()
    return jsonable(serialize(rating))


@router.get("/procurement/kpis")
def procurement_kpis(
    project_id: uuid.UUID | None = None,
    days: int = Query(default=90, ge=7, le=730),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """KPI achats (§8.1 étape 42) : délais de cycle, ponctualité, écarts, dépenses par fournisseur."""
    access.require("procurement:read")
    since = utcnow() - timedelta(days=days)
    po_stmt = access.filter_by_project(
        select(PurchaseOrder).where(PurchaseOrder.deleted_at.is_(None), PurchaseOrder.created_at >= since),
        PurchaseOrder.project_id,
        allow_null=False,
    )
    if project_id:
        po_stmt = po_stmt.where(PurchaseOrder.project_id == project_id)
    orders = db.execute(po_stmt).scalars().all()
    by_status: dict[str, int] = {}
    spend: dict[str, Decimal] = {}
    confirm_hours: list[float] = []
    on_time: list[bool] = []
    for po in orders:
        by_status[po.status] = by_status.get(po.status, 0) + 1
        if po.status not in ("cancelled", "refused", "draft", "pending_approval"):
            spend[str(po.supplier_id)] = spend.get(str(po.supplier_id), Decimal("0")) + Decimal(po.total)
        if po.sent_at and po.supplier_confirmed_at:
            confirm_hours.append((po.supplier_confirmed_at - po.sent_at).total_seconds() / 3600)
        if po.expected_date:
            first = db.execute(
                select(func.min(GoodsReceipt.received_at)).where(
                    GoodsReceipt.purchase_order_id == po.id, GoodsReceipt.status == "validated"
                )
            ).scalar()
            if first:
                on_time.append(first.date() <= po.expected_date)
    pr_stmt = access.filter_by_project(
        select(PurchaseRequest).where(PurchaseRequest.created_at >= since, PurchaseRequest.deleted_at.is_(None)),
        PurchaseRequest.project_id,
        allow_null=False,
    )
    if project_id:
        pr_stmt = pr_stmt.where(PurchaseRequest.project_id == project_id)
    requests = db.execute(pr_stmt).scalars().all()
    approval_hours = [
        (pr.approved_at - pr.submitted_at).total_seconds() / 3600
        for pr in requests
        if pr.approved_at and pr.submitted_at
    ]
    receipts = (
        db.execute(
            access.filter_by_project(
                select(GoodsReceipt).where(GoodsReceipt.created_at >= since), GoodsReceipt.project_id, allow_null=False
            )
        )
        .scalars()
        .all()
    )
    suppliers = {
        str(s.id): s.legal_name
        for s in db.execute(
            select(Supplier).where(Supplier.id.in_([uuid.UUID(k) for k in spend] or [uuid.uuid4()]))
        ).scalars()
    }
    top = sorted(spend.items(), key=lambda kv: kv[1], reverse=True)[:10]

    def avg(values: list[float]) -> float | None:
        return round(sum(values) / len(values), 1) if values else None

    return jsonable(
        {
            "period_days": days,
            "orders": len(orders),
            "orders_by_status": by_status,
            "requests": len(requests),
            "requests_pending": sum(1 for pr in requests if pr.status == "submitted"),
            "avg_approval_hours": avg(approval_hours),
            "avg_supplier_confirmation_hours": avg(confirm_hours),
            "on_time_delivery_rate": round(sum(on_time) * 100 / len(on_time), 1) if on_time else None,
            "receipts": len(receipts),
            "receipts_with_exceptions": sum(1 for r in receipts if r.has_exceptions),
            "spend_total": sum(spend.values(), Decimal("0")),
            "top_suppliers": [{"supplier_id": k, "supplier": suppliers.get(k, ""), "amount": v} for k, v in top],
        }
    )


# ============================================================================ livraisons attendues
@router.get("/deliveries")
def list_deliveries(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("deliveries:read")
    stmt = access.filter_by_project(select(Delivery), Delivery.project_id, allow_null=False)
    for col, value in ((Delivery.project_id, project_id), (Delivery.site_id, site_id), (Delivery.status, status)):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"eta": Delivery.eta, "created_at": Delivery.created_at},
        default_sort=Delivery.eta.asc(),
        search_columns=[Delivery.number, Delivery.tracking_ref],
        transform=lambda d: _delivery_out(db, d),
    )


def _delivery_out(db: Session, delivery: Delivery) -> dict[str, Any]:
    po = db.get(PurchaseOrder, delivery.purchase_order_id) if delivery.purchase_order_id else None
    supplier = db.get(Supplier, delivery.supplier_id) if delivery.supplier_id else None
    return jsonable(
        {
            **serialize(delivery),
            "po_number": po.number if po else None,
            "supplier": supplier.legal_name if supplier else None,
            "lines": [
                {
                    "id": li.id,
                    "description": li.description,
                    "quantity": li.quantity,
                    "unit": li.unit,
                    "received": li.quantity_received,
                }
                for li in (po.lines if po else [])
            ],
        }
    )


@router.get("/deliveries/expected")
def expected_deliveries(
    project_id: uuid.UUID | None = None,
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    """« Livraison attendue » (§8.1 étape 31) : commandes confirmées / expédiées à réceptionner."""
    access.require("deliveries:read")
    stmt = access.filter_by_project(
        select(PurchaseOrder).where(
            PurchaseOrder.deleted_at.is_(None), PurchaseOrder.status.in_(["confirmed", "shipped", "partially_received"])
        ),
        PurchaseOrder.project_id,
        allow_null=False,
    )
    if project_id:
        stmt = stmt.where(PurchaseOrder.project_id == project_id)
    horizon = date.today() + timedelta(days=days)
    out = []
    for po in db.execute(stmt.order_by(PurchaseOrder.expected_date.asc().nulls_last())).scalars():
        expected = po.eta.date() if po.eta else po.expected_date
        if expected and expected > horizon:
            continue
        supplier = db.get(Supplier, po.supplier_id)
        site = db.get(Site, po.site_id) if po.site_id else None
        out.append(
            {
                "purchase_order_id": po.id,
                "number": po.number,
                "status": po.status,
                "supplier": supplier.legal_name if supplier else "",
                "site": site.name if site else None,
                "expected_date": po.expected_date,
                "eta": po.eta,
                "carrier": po.carrier,
                "late": bool(expected and expected < date.today()),
                "urgent": po.urgent,
                "lines": [
                    {
                        "id": li.id,
                        "description": li.description,
                        "quantity": li.quantity,
                        "unit": li.unit,
                        "received": li.quantity_received,
                    }
                    for li in po.lines
                ],
            }
        )
    return jsonable(out)


@router.get("/deliveries/{delivery_id}")
def get_delivery(
    delivery_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Fiche livraison (lien des notifications « livraison annoncée »)."""
    delivery = _load(db, Delivery, delivery_id, "Livraison")
    access.require_project(delivery.project_id, "deliveries:read")
    data = _delivery_out(db, delivery)
    data["receipts"] = [
        _grn_out(db, g)
        for g in db.execute(
            select(GoodsReceipt).where(GoodsReceipt.delivery_id == delivery.id).order_by(GoodsReceipt.created_at)
        ).scalars()
    ]
    return data


class ArrivalIn(BaseModel):
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=2000)


@router.post("/deliveries/{delivery_id}/arrived")
def delivery_arrived(
    delivery_id: uuid.UUID, data: ArrivalIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    delivery = _load(db, Delivery, delivery_id, "Livraison")
    access.require_project(delivery.project_id, "deliveries:receive")
    if delivery.status not in ("announced", "in_transit"):
        raise BusinessRuleError("Livraison déjà arrivée ou réceptionnée")
    delivery.status = "arrived"
    delivery.arrived_at = utcnow()
    if data.notes:
        delivery.notes = data.notes
    audit.record(
        db,
        family="business",
        module="deliveries",
        action="ARRIVED",
        resource_type="delivery",
        resource_id=delivery.id,
        project_id=delivery.project_id,
        diff={"lat": data.latitude, "lng": data.longitude},
    )
    db.commit()
    return _delivery_out(db, delivery)


# ============================================================================ réceptions (GRN)
class GRNLineIn(BaseModel):
    po_line_id: uuid.UUID | None = None
    stock_item_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=300)
    unit: str | None = Field(default=None, max_length=20)
    unit_price: Decimal | None = Field(default=None, ge=0)
    quantity_received: Decimal = Field(ge=0)
    quantity_rejected: Decimal = Field(default=Decimal("0"), ge=0)
    rejection_reason: str | None = Field(default=None, pattern="^(damaged|different|missing|excess|quality)$")
    condition_notes: str | None = Field(default=None, max_length=2000)
    batch_number: str | None = Field(default=None, max_length=80)
    expiry_date: date | None = None
    is_substitution: bool = False


class GRNIn(BaseModel):
    purchase_order_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    supplier_id: uuid.UUID | None = None
    delivery_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    warehouse_id: uuid.UUID | None = None
    destination: str = Field(default="stock", pattern="^(stock|site_allocation)$")
    received_at: datetime | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    geo_accuracy_m: float | None = Field(default=None, ge=0)
    driver_name: str | None = Field(default=None, max_length=150)
    vehicle_plate: str | None = Field(default=None, max_length=30)
    delivery_note_ref: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=4000)
    photo_file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)
    delivery_note_file_id: uuid.UUID | None = None
    source: str = Field(default="web", pattern="^(web|mobile|offline|qr|desktop)$")
    lines: list[GRNLineIn] = Field(min_length=1, max_length=200)


def _grn_out(db: Session, receipt: GoodsReceipt) -> dict[str, Any]:
    po = db.get(PurchaseOrder, receipt.purchase_order_id) if receipt.purchase_order_id else None
    supplier = db.get(Supplier, receipt.supplier_id) if receipt.supplier_id else None
    return jsonable(
        {
            **serialize(receipt),
            "lines": [serialize(li) for li in receipt.lines],
            "po_number": po.number if po else None,
            "supplier": supplier.legal_name if supplier else None,
        }
    )


def _parse_code(code: str) -> str:
    code = code.strip()
    return code.split("GLOBUS:PO:", 1)[1] if code.startswith("GLOBUS:PO:") else code


@router.get("/goods-receipts/lookup")
def lookup_po(
    code: str = Query(min_length=3, max_length=120), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Réception par QR ou numéro de BC : retourne les reliquats à réceptionner."""
    access.require("deliveries:receive")
    po = db.execute(
        select(PurchaseOrder).where(PurchaseOrder.number == _parse_code(code), PurchaseOrder.deleted_at.is_(None))
    ).scalar_one_or_none()
    if po is None:
        raise NotFound("Bon de commande introuvable")
    access.require_project(po.project_id)
    out = _po_out(db, po)
    out["remaining"] = [
        {
            "po_line_id": li.id,
            "description": li.description,
            "unit": li.unit,
            "ordered": li.quantity,
            "received": li.quantity_received,
            "remaining": max(Decimal(li.quantity) - Decimal(li.quantity_received), Decimal("0")),
            "stock_item_id": li.stock_item_id,
        }
        for li in po.lines
    ]
    out["deliveries"] = [
        serialize(d)
        for d in db.execute(
            select(Delivery).where(
                Delivery.purchase_order_id == po.id, Delivery.status.in_(["announced", "in_transit", "arrived"])
            )
        ).scalars()
    ]
    return jsonable(out)


@router.get("/goods-receipts")
def list_receipts(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    purchase_order_id: uuid.UUID | None = None,
    supplier_id: uuid.UUID | None = None,
    has_exceptions: bool | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("deliveries:read")
    stmt = access.filter_by_project(select(GoodsReceipt), GoodsReceipt.project_id, allow_null=False)
    if supplier_id:
        stmt = stmt.where(GoodsReceipt.supplier_id == supplier_id)
    for col, value in (
        (GoodsReceipt.project_id, project_id),
        (GoodsReceipt.status, status),
        (GoodsReceipt.purchase_order_id, purchase_order_id),
        (GoodsReceipt.has_exceptions, has_exceptions),
    ):
        if value is not None and value != "":
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"received_at": GoodsReceipt.received_at},
        default_sort=GoodsReceipt.received_at.desc(),
        search_columns=[GoodsReceipt.number],
        transform=lambda r: _grn_out(db, r),
    )


@router.post("/goods-receipts", status_code=201)
def create_receipt(
    data: GRNIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency()),
) -> Any:
    if idem.replay is not None:
        return idem.replay
    po = _load(db, PurchaseOrder, data.purchase_order_id, "Bon de commande") if data.purchase_order_id else None
    project_id = po.project_id if po else data.project_id
    if project_id is None:
        raise BusinessRuleError("Projet requis pour une livraison sans bon de commande")
    access.require_project(project_id, "deliveries:receive")
    if po is None and not data.supplier_id:
        raise BusinessRuleError("Fournisseur requis pour une livraison sans bon de commande")
    for file_id in [*data.photo_file_ids, *([data.delivery_note_file_id] if data.delivery_note_file_id else [])]:
        stored = db.get(StoredFile, file_id)
        if stored is None or (stored.uploaded_by_id != access.p.id and not access.has("procurement:read")):
            raise BusinessRuleError("Pièce jointe inconnue")
    payload = data.model_dump(exclude={"lines", "purchase_order_id", "project_id"})
    receipt = service.create_receipt(
        db,
        po=po,
        project_id=project_id,
        user_id=access.p.id,
        lines=[line.model_dump() for line in data.lines],
        data=payload,
    )
    return idem.complete(db, _grn_out(db, receipt), status_code=201)


@router.get("/goods-receipts/{receipt_id}")
def get_receipt(
    receipt_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("deliveries:read")
    receipt = _load(db, GoodsReceipt, receipt_id, "Bon de réception")
    access.require_project(receipt.project_id)
    return _grn_out(db, receipt)


@router.post("/goods-receipts/{receipt_id}/attachments", status_code=201)
async def add_receipt_attachment(
    receipt_id: uuid.UUID,
    kind: str = Form(..., pattern="^(photo|delivery_note|invoice|signature)$"),
    file: UploadFile = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    receipt = _load(db, GoodsReceipt, receipt_id, "Bon de réception")
    access.require_project(receipt.project_id, "deliveries:receive")
    if receipt.status != "draft":
        raise BusinessRuleError("Bon de réception validé : pièces jointes verrouillées")
    upload = validate_upload(file.filename or kind, await file.read(), category="image" if kind == "photo" else "media")
    extra = {"geo": {"lat": latitude, "lng": longitude}} if latitude is not None and longitude is not None else None
    stored = store_private(
        db, upload, purpose="goods_receipts", classification="internal", uploaded_by_id=access.p.id, extra=extra
    )
    if kind == "photo":
        receipt.photo_file_ids = [*receipt.photo_file_ids, str(stored.id)]
    elif kind == "delivery_note":
        receipt.delivery_note_file_id = stored.id
    elif kind == "invoice":
        receipt.invoice_file_id = stored.id
    else:
        receipt.signature_file_id = stored.id
    db.commit()
    return jsonable({"file_id": stored.id, "kind": kind, "geo": stored.geo, "taken_at": stored.taken_at})


@router.get("/goods-receipts/{receipt_id}/files/{file_id}")
def receipt_file(
    receipt_id: uuid.UUID, file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("deliveries:read")
    receipt = _load(db, GoodsReceipt, receipt_id, "Bon de réception")
    access.require_project(receipt.project_id)
    allowed = {
        *receipt.photo_file_ids,
        *(str(x) for x in (receipt.delivery_note_file_id, receipt.invoice_file_id, receipt.signature_file_id) if x),
    }
    if str(file_id) not in allowed:
        raise NotFound("Fichier introuvable")
    return file_response(db.get(StoredFile, file_id))


@router.post("/goods-receipts/{receipt_id}/validate")
def validate_receipt(
    receipt_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    receipt = _load(db, GoodsReceipt, receipt_id, "Bon de réception")
    access.require_project(receipt.project_id, "deliveries:receive")
    service.validate_receipt(db, receipt, user_id=access.p.id)
    db.commit()
    return _grn_out(db, receipt)


class SubstitutionIn(BaseModel):
    approve: bool


@router.post("/goods-receipts/{receipt_id}/lines/{line_id}/substitution")
def decide_substitution(
    receipt_id: uuid.UUID,
    line_id: uuid.UUID,
    data: SubstitutionIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    receipt = _load(db, GoodsReceipt, receipt_id, "Bon de réception")
    access.require_project(receipt.project_id, "procurement:approve")
    line = db.get(GoodsReceiptLine, line_id)
    if line is None or line.receipt_id != receipt.id:
        raise NotFound("Ligne introuvable")
    if receipt.status != "draft":
        raise BusinessRuleError("Bon de réception déjà validé")
    service.approve_substitution(db, line, user_id=access.p.id, approve=data.approve)
    audit.record(
        db,
        family="business",
        module="deliveries",
        action="SUBSTITUTION_" + ("APPROVE" if data.approve else "REJECT"),
        resource_type="goods_receipt",
        resource_id=receipt.id,
        project_id=receipt.project_id,
        diff={"line": line.description},
        criticality="MEDIUM",
    )
    db.commit()
    return _grn_out(db, receipt)


class ReturnIn(BaseModel):
    reason: str = Field(pattern="^(damaged|different|excess|quality|other)$")


@router.post("/goods-receipts/{receipt_id}/returns", status_code=201)
def create_return(
    receipt_id: uuid.UUID, data: ReturnIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    receipt = _load(db, GoodsReceipt, receipt_id, "Bon de réception")
    access.require_project(receipt.project_id, "deliveries:receive")
    if not receipt.supplier_id:
        raise BusinessRuleError("Fournisseur inconnu pour cette réception")
    ret = service.create_return(db, receipt, user_id=access.p.id, reason=data.reason)
    db.commit()
    return jsonable(serialize(ret))


@router.get("/supplier-returns")
def list_returns(
    params: PageParams = Depends(),
    supplier_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("procurement:read")
    stmt = select(SupplierReturn)
    if supplier_id:
        stmt = stmt.where(SupplierReturn.supplier_id == supplier_id)
    if status:
        stmt = stmt.where(SupplierReturn.status == status)
    return paginate(
        db,
        stmt,
        params,
        default_sort=SupplierReturn.created_at.desc(),
        search_columns=[SupplierReturn.number],
        transform=lambda r: jsonable(serialize(r)),
    )


class ReturnStatusIn(BaseModel):
    status: str = Field(pattern="^(shipped|credited|closed)$")
    credit_note_id: uuid.UUID | None = None


@router.post("/supplier-returns/{return_id}/status")
def return_status(
    return_id: uuid.UUID, data: ReturnStatusIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("procurement:order")
    ret = _load(db, SupplierReturn, return_id, "Retour fournisseur")
    if data.status == "credited" and not data.credit_note_id:
        raise BusinessRuleError("Avoir fournisseur requis")
    ret.status = data.status
    if data.credit_note_id:
        ret.credit_note_id = data.credit_note_id
    audit.record(
        db,
        family="business",
        module="deliveries",
        action="RETURN_STATUS",
        resource_type="supplier_return",
        resource_id=ret.id,
        diff={"status": data.status},
    )
    db.commit()
    return jsonable(serialize(ret))


# ============================================================================ portail fournisseur (lien sécurisé)
@public.get("/{token}")
def portal_get(token: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    po = service.po_by_token(db, token)
    if po.supplier_viewed_at is None:
        po.supplier_viewed_at = utcnow()
        db.commit()
    return service.portal_view(db, po)


@public.get("/{token}/pdf")
def portal_pdf(token: str, db: Session = Depends(get_db)) -> Response:
    po = service.po_by_token(db, token)
    if po.pdf_file_id:
        return file_response(db.get(StoredFile, po.pdf_file_id), inline=False)
    return Response(
        service.po_pdf(db, po),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{po.number}.pdf"'},
    )


class CounterLineIn(BaseModel):
    line_id: uuid.UUID
    unit_price: Decimal | None = Field(default=None, ge=0)
    quantity: Decimal | None = Field(default=None, gt=0)


class CounterIn(BaseModel):
    lines: list[CounterLineIn] = Field(default_factory=list, max_length=200)
    expected_date: date | None = None
    message: str | None = Field(default=None, max_length=2000)


class PortalResponseIn(BaseModel):
    action: str = Field(pattern="^(confirm|refuse|counter)$")
    note: str | None = Field(default=None, max_length=2000)
    counter: CounterIn | None = None
    contact_name: str | None = Field(default=None, max_length=150)


@public.post("/{token}/respond")
def portal_respond(token: str, data: PortalResponseIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    po = service.po_by_token(db, token)
    if data.action == "refuse" and not (data.note or "").strip():
        raise BusinessRuleError("Merci d'indiquer le motif du refus", code="REASON_REQUIRED")
    if data.action == "counter" and (
        data.counter is None or (not data.counter.lines and not data.counter.expected_date)
    ):
        raise BusinessRuleError("Contre-offre vide : indiquer prix, quantités ou date")
    supplier = db.get(Supplier, po.supplier_id)
    label = f"{supplier.legal_name if supplier else 'Fournisseur'}" + (
        f" ({data.contact_name})" if data.contact_name else ""
    )
    service.supplier_respond(
        db,
        po,
        action=data.action,
        note=data.note,
        counter=jsonable(data.counter.model_dump()) if data.counter else None,
        actor_label=label,
    )
    db.commit()
    return service.portal_view(db, po)


@public.post("/{token}/shipment", status_code=201)
def portal_shipment(token: str, data: ShipmentIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    po = service.po_by_token(db, token)
    service.announce_shipment(
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
    return service.portal_view(db, po)


class PortalInvoiceLine(BaseModel):
    po_line_id: uuid.UUID
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


@public.post("/{token}/invoice", status_code=201)
async def portal_invoice(
    token: str,
    supplier_reference: str = Form(..., min_length=1, max_length=80),
    invoice_date: date = Form(...),
    due_date: date | None = Form(None),
    tax_amount: Decimal = Form(Decimal("0")),
    lines_json: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Dépôt de facture par le fournisseur : rapprochement 3 pièces automatique."""
    po = service.po_by_token(db, token)
    if po.status not in ("partially_received", "received", "invoiced"):
        raise BusinessRuleError("Facturation possible après réception de la marchandise", code="NOT_RECEIVED")
    try:
        raw_lines = [PortalInvoiceLine.model_validate(x) for x in json.loads(lines_json)]
    except (ValueError, ValidationError) as exc:
        raise BusinessRuleError("Lignes de facture invalides") from exc
    if not raw_lines:
        raise BusinessRuleError("Aucune ligne facturée")
    po_lines = {li.id: li for li in po.lines}
    lines = []
    for raw in raw_lines:
        po_line = po_lines.get(raw.po_line_id)
        if po_line is None:
            raise BusinessRuleError("Ligne hors bon de commande")
        lines.append(
            {
                "po_line_id": po_line.id,
                "description": po_line.description,
                "quantity": raw.quantity,
                "unit_price": raw.unit_price,
            }
        )
    billing.ensure_new_invoice(db, po.supplier_id, supplier_reference)
    upload = validate_upload(file.filename or "facture.pdf", await file.read(), category="media")
    stored = store_private(db, upload, purpose="supplier_invoices", classification="confidential")
    try:
        invoice = billing.register_supplier_invoice(
            db,
            supplier_id=po.supplier_id,
            reference=supplier_reference,
            po_id=po.id,
            invoice_date=invoice_date,
            due_date=due_date,
            lines=lines,
            tax_amount=tax_amount,
            file_id=stored.id,
            user_id=None,
            source="extranet",
        )
    except IntegrityError as exc:
        raise BusinessRuleError("Facture déjà déposée", code="DUPLICATE_INVOICE") from exc
    billing.three_way_match(db, invoice, user_id=None)
    db.commit()
    return service.portal_view(db, po)


# ============================================================================ webhook WhatsApp Business (Meta)
@whatsapp.get("")
def whatsapp_verify(
    mode: str | None = Query(default=None, alias="hub.mode"),
    verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    from app.core.secrets import get_secret

    expected = get_secret("META_WA_VERIFY_TOKEN") or settings.META_WA_VERIFY_TOKEN
    if mode == "subscribe" and expected and verify_token == expected and challenge:
        return PlainTextResponse(challenge)
    raise AppError("Vérification refusée", code="FORBIDDEN", status_code=403)


@whatsapp.post("")
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    from app.providers.messaging import parse_meta_webhook, verify_meta_signature

    body = await request.body()
    signature_ok = verify_meta_signature(body, request.headers.get("x-hub-signature-256"))
    if not signature_ok and not (settings.WHATSAPP_PROVIDER == "console" and not settings.is_production):
        audit.record_independent(
            family="security",
            module="communications",
            action="WEBHOOK_REJECTED",
            resource_type="webhook",
            resource_id="whatsapp",
            actor_type="webhook",
            result="FAIL",
            reason="Signature invalide",
            criticality="HIGH",
        )
        raise AppError("Signature invalide", code="INVALID_SIGNATURE", status_code=401)
    try:
        payload = json.loads(body or b"{}")
    except ValueError as exc:
        raise AppError("Corps JSON invalide", code="INVALID_PAYLOAD") from exc
    processed = 0
    for event in parse_meta_webhook(payload):
        event_id = f"{event.get('kind')}:{event.get('message_id')}:{event.get('status') or ''}"
        exists = db.execute(
            select(InboundWebhookEvent.id).where(
                InboundWebhookEvent.provider == "whatsapp", InboundWebhookEvent.event_id == event_id[:200]
            )
        ).first()
        if exists:
            continue
        record = InboundWebhookEvent(
            provider="whatsapp",
            event_id=event_id[:200],
            event_type=event.get("kind"),
            signature_valid=signature_ok,
            payload=jsonable(event),
            status="received",
        )
        db.add(record)
        db.flush()
        if event["kind"] == "status" and event.get("message_id"):
            for msg in db.execute(
                select(SupplierMessage).where(SupplierMessage.provider_message_id == event["message_id"])
            ).scalars():
                msg.status = event.get("status") or msg.status
                msg.status_at = utcnow()
                if event.get("errors"):
                    msg.error = json.dumps(event["errors"])[:2000]
            from app.modules.notifications.models import NotificationDelivery

            for delivery in db.execute(
                select(NotificationDelivery).where(NotificationDelivery.provider_message_id == event["message_id"])
            ).scalars():
                delivery.status = {"read": "read", "delivered": "delivered", "failed": "failed"}.get(
                    event.get("status") or "", delivery.status
                )
        elif event["kind"] == "message":
            if event.get("payload"):
                service.handle_whatsapp_inbound(db, event)
            else:
                sender = (event.get("from") or "").lstrip("+")
                supplier = next(
                    (
                        s
                        for s in db.execute(select(Supplier).where(Supplier.whatsapp_number.is_not(None))).scalars()
                        if (s.whatsapp_number or "").lstrip("+").replace(" ", "") == sender
                    ),
                    None,
                )
                if supplier is not None:
                    db.add(
                        SupplierMessage(
                            supplier_id=supplier.id,
                            channel="whatsapp",
                            direction="in",
                            recipient=None,
                            content=(event.get("body") or "")[:4000],
                            provider="meta",
                            provider_message_id=event.get("message_id"),
                            status="received",
                            status_at=utcnow(),
                        )
                    )
                else:
                    # clients et prospects : assistant WhatsApp (A1), traité par le worker (réponse hors requête)
                    from app.core.events import emit

                    emit(
                        db,
                        "assistant.whatsapp_inbound",
                        {"inbound_id": record.id},
                        aggregate_type="inbound_webhook",
                        aggregate_id=record.id,
                    )
        record.status = "processed"
        record.processed_at = utcnow()
        processed += 1
    db.commit()
    return {"status": "ok", "processed": processed}
