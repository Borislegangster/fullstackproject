"""API Facturation : factures clients et avoirs, factures fournisseurs et rapprochement 3 pièces, relances,
balance âgée, export comptable. Chemins historiques conservés (/client-invoices, /supplier-invoices…)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, NotFound
from app.core.files import store_private, validate_upload
from app.core.idempotency import Idempotency, idempotency
from app.core.numbering import next_number
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable
from app.modules.billing import lifecycle, service
from app.modules.billing.models import (
    ClientInvoice,
    ClientInvoiceLine,
    CreditNote,
    InvoiceMatch,
    PaymentReminder,
    SupplierInvoice,
)
from app.modules.finance.models import FundsCall
from app.modules.finance.service import allocated_payments
from app.modules.procurement.models import PurchaseOrder
from app.modules.suppliers.models import Supplier
from app.modules.system.models import StoredFile

router = APIRouter(tags=["Facturation"])


def _require_project_finance(access: Access, project_id: uuid.UUID | None, *perms: str) -> None:
    access.require(*perms)
    if project_id:
        access.require_project(project_id)


def _load(db: Session, model: Any, obj_id: uuid.UUID, label: str) -> Any:
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "deleted_at", None) is not None:
        raise NotFound(f"{label} introuvable")
    return obj


# ============================================================================ factures clients & avoirs
class InvoiceLineIn(BaseModel):
    designation: str = Field(min_length=1, max_length=300)
    unit: str = "u"
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class InvoiceIn(BaseModel):
    project_id: uuid.UUID | None = None
    organization_id: uuid.UUID | None = None
    contract_id: uuid.UUID | None = None
    kind: str = Field(default="invoice", pattern="^(invoice|deposit|progress|final)$")
    title: str = Field(min_length=2, max_length=250)
    issue_date: date
    due_date: date | None = None
    tax_rate: Decimal = Decimal("19.25")
    currency: str = "XAF"
    notes: str | None = None
    lines: list[InvoiceLineIn] = Field(min_length=1, max_length=500)


def _client_invoice_out(i: ClientInvoice) -> dict[str, Any]:
    return jsonable({**serialize(i), "lines": [serialize(line) for line in i.lines], "balance_due": i.balance_due})


@router.get("/client-invoices")
def list_invoices(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("billing:read")
    stmt = access.filter_by_project(
        select(ClientInvoice).where(ClientInvoice.deleted_at.is_(None)), ClientInvoice.project_id
    )
    if project_id:
        stmt = stmt.where(ClientInvoice.project_id == project_id)
    if status:
        stmt = stmt.where(ClientInvoice.status == status)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"issue_date": ClientInvoice.issue_date, "total": ClientInvoice.total},
        default_sort=ClientInvoice.issue_date.desc(),
        search_columns=[ClientInvoice.number, ClientInvoice.title],
        transform=_client_invoice_out,
    )


@router.post("/client-invoices", status_code=201)
def create_invoice(
    data: InvoiceIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _require_project_finance(access, data.project_id, "billing:write")
    invoice = ClientInvoice(
        number=next_number(db, "client_invoice"),
        status="draft",
        created_by_id=access.p.id,
        **data.model_dump(exclude={"lines"}),
    )
    for index, line in enumerate(data.lines):
        invoice.lines.append(ClientInvoiceLine(sort_order=index, **line.model_dump()))
    service.compute_invoice(invoice)
    db.add(invoice)
    db.flush()
    audit.record(
        db,
        family="business",
        module="billing",
        action="CREATE",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        diff={"total": str(invoice.total)},
    )
    db.commit()
    return _client_invoice_out(invoice)


@router.post("/client-invoices/{invoice_id}/validate")
def validate_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = db.get(ClientInvoice, invoice_id)
    if invoice is None:
        raise NotFound("Facture introuvable")
    _require_project_finance(access, invoice.project_id, "billing:validate")
    service.validate_invoice(db, invoice, user_id=access.p.id)
    db.commit()
    return _client_invoice_out(invoice)


@router.post("/client-invoices/{invoice_id}/send")
def send_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = _load(db, ClientInvoice, invoice_id, "Facture")
    _require_project_finance(access, invoice.project_id, "billing:write")
    lifecycle.send_invoice(db, invoice, user_id=access.p.id)
    db.commit()
    return _client_invoice_out(invoice)


class InvoiceUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=250)
    issue_date: date | None = None
    due_date: date | None = None
    tax_rate: Decimal | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=4000)
    lines: list[InvoiceLineIn] | None = Field(default=None, max_length=500)


@router.patch("/client-invoices/{invoice_id}")
def update_invoice(
    invoice_id: uuid.UUID, data: InvoiceUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = _load(db, ClientInvoice, invoice_id, "Facture")
    _require_project_finance(access, invoice.project_id, "billing:write")
    values = data.model_dump(exclude_unset=True, exclude={"lines"})
    lines = [line.model_dump() for line in data.lines] if data.lines is not None else None
    lifecycle.update_draft_invoice(db, invoice, values=values, lines=lines, user_id=access.p.id)
    db.commit()
    return _client_invoice_out(invoice)


class CancelIn(BaseModel):
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/client-invoices/{invoice_id}/cancel")
def cancel_invoice(
    invoice_id: uuid.UUID, data: CancelIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = _load(db, ClientInvoice, invoice_id, "Facture")
    _require_project_finance(access, invoice.project_id, "billing:validate")
    lifecycle.cancel_invoice(db, invoice, reason=data.reason, user_id=access.p.id)
    db.commit()
    return _client_invoice_out(invoice)


@router.post("/client-invoices/{invoice_id}/remind", status_code=201)
def remind_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Relance manuelle du client (espace client, e-mail, push) — une par jour."""
    invoice = _load(db, ClientInvoice, invoice_id, "Facture")
    _require_project_finance(access, invoice.project_id, "billing:write")
    reminder = lifecycle.remind_now(db, invoice, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(reminder))


@router.get("/client-invoices/{invoice_id}/reminders")
def invoice_reminders(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    invoice = _load(db, ClientInvoice, invoice_id, "Facture")
    _require_project_finance(access, invoice.project_id, "billing:read")
    rows = db.execute(
        select(PaymentReminder)
        .where(PaymentReminder.target_type == "client_invoice", PaymentReminder.target_id == invoice.id)
        .order_by(PaymentReminder.created_at.desc())
    ).scalars()
    return [jsonable(serialize(r)) for r in rows]


@router.get("/client-invoices/{invoice_id}/pdf")
def invoice_pdf(invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    invoice = db.get(ClientInvoice, invoice_id)
    if invoice is None or not invoice.pdf_file_id:
        raise NotFound("PDF indisponible")
    if access.p.is_client:
        access.require_project(invoice.project_id)
    else:
        _require_project_finance(access, invoice.project_id, "billing:read")
    return file_response(db.get(StoredFile, invoice.pdf_file_id))


@router.get("/client-invoices/{invoice_id}")
def get_client_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = db.get(ClientInvoice, invoice_id)
    if invoice is None or invoice.deleted_at is not None:
        raise NotFound("Facture introuvable")
    _require_project_finance(access, invoice.project_id, "billing:read")
    out = _client_invoice_out(invoice)
    out["credit_notes"] = [
        jsonable(serialize(n))
        for n in db.execute(
            select(CreditNote).where(CreditNote.client_invoice_id == invoice.id).order_by(CreditNote.created_at)
        ).scalars()
    ]
    calls = db.execute(select(FundsCall.id).where(FundsCall.client_invoice_id == invoice.id)).scalars().all()
    out["payments"] = jsonable(
        allocated_payments(db, "client_invoice", invoice.id)
        + [p for call_id in calls for p in allocated_payments(db, "funds_call", call_id)]  # facture d'appel de fonds
    )
    out["reminders"] = [
        jsonable(serialize(r))
        for r in db.execute(
            select(PaymentReminder)
            .where(PaymentReminder.target_type == "client_invoice", PaymentReminder.target_id == invoice.id)
            .order_by(PaymentReminder.created_at.desc())
        ).scalars()
    ]
    return out


class CreditNoteIn(BaseModel):
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/client-invoices/{invoice_id}/credit-notes", status_code=201)
def credit_client_invoice(
    invoice_id: uuid.UUID, data: CreditNoteIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    invoice = db.get(ClientInvoice, invoice_id)
    if invoice is None:
        raise NotFound("Facture introuvable")
    _require_project_finance(access, invoice.project_id, "billing:validate")
    note = service.issue_credit_note(
        db, side="client", amount=data.amount, reason=data.reason, user_id=access.p.id, client_invoice=invoice
    )
    db.commit()
    return jsonable(serialize(note))


@router.get("/credit-notes")
def list_credit_notes(
    params: PageParams = Depends(),
    side: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("billing:read")
    stmt = select(CreditNote)
    if side:
        stmt = stmt.where(CreditNote.side == side)
    return paginate(
        db, stmt, params, default_sort=CreditNote.created_at.desc(), transform=lambda n: jsonable(serialize(n))
    )


@router.get("/supplier-invoices")
def list_supplier_invoices(
    params: PageParams = Depends(),
    status: str | None = None,
    supplier_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("billing:read")
    stmt = access.filter_by_project(
        select(SupplierInvoice).where(SupplierInvoice.deleted_at.is_(None)), SupplierInvoice.project_id
    )
    for col, value in (
        (SupplierInvoice.status, status),
        (SupplierInvoice.supplier_id, supplier_id),
        (SupplierInvoice.project_id, project_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        default_sort=SupplierInvoice.invoice_date.desc(),
        search_columns=[SupplierInvoice.number, SupplierInvoice.supplier_reference],
        transform=lambda i: jsonable({**serialize(i), "lines": [serialize(line) for line in i.lines]}),
    )


# ============================================================================ factures fournisseurs & 3 pièces
class SupplierInvoiceLineIn(BaseModel):
    po_line_id: uuid.UUID | None = None
    description: str = Field(min_length=1, max_length=300)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class SupplierInvoiceIn(BaseModel):
    supplier_id: uuid.UUID
    supplier_reference: str = Field(min_length=1, max_length=80)
    purchase_order_id: uuid.UUID | None = None
    invoice_date: date
    due_date: date | None = None
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0)
    file_id: uuid.UUID | None = None
    lines: list[SupplierInvoiceLineIn] = Field(min_length=1, max_length=300)
    auto_match: bool = True


def _supplier_invoice_out(db: Session, invoice: SupplierInvoice) -> dict[str, Any]:
    match = db.get(InvoiceMatch, invoice.match_id) if invoice.match_id else None
    supplier = db.get(Supplier, invoice.supplier_id)
    po = db.get(PurchaseOrder, invoice.purchase_order_id) if invoice.purchase_order_id else None
    return jsonable(
        {
            **serialize(invoice),
            "lines": [serialize(li) for li in invoice.lines],
            "match": serialize(match) if match else None,
            "supplier": supplier.legal_name if supplier else None,
            "po_number": po.number if po else None,
        }
    )


@router.post("/supplier-invoices", status_code=201)
def register_invoice(
    data: SupplierInvoiceIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency()),
) -> Any:
    if idem.replay is not None:
        return idem.replay
    access.require("billing:write")
    if data.purchase_order_id:
        po = _load(db, PurchaseOrder, data.purchase_order_id, "Bon de commande")
        access.require_project(po.project_id)
    try:
        invoice = service.register_supplier_invoice(
            db,
            supplier_id=data.supplier_id,
            reference=data.supplier_reference,
            po_id=data.purchase_order_id,
            invoice_date=data.invoice_date,
            due_date=data.due_date,
            lines=[li.model_dump() for li in data.lines],
            tax_amount=data.tax_amount,
            file_id=data.file_id,
            user_id=access.p.id,
        )
    except IntegrityError as exc:
        raise BusinessRuleError(
            "Facture déjà enregistrée pour ce fournisseur (doublon)", code="DUPLICATE_INVOICE"
        ) from exc
    if data.auto_match:
        service.three_way_match(db, invoice, user_id=access.p.id)
    return idem.complete(db, _supplier_invoice_out(db, invoice), status_code=201)


@router.post("/supplier-invoices/upload", status_code=201)
async def upload_invoice_file(
    file: UploadFile = File(...), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("billing:write")
    upload = validate_upload(file.filename or "facture.pdf", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="supplier_invoices", classification="confidential", uploaded_by_id=access.p.id
    )
    db.commit()
    return jsonable({"file_id": stored.id, "filename": stored.original_name})


@router.get("/supplier-invoices/{invoice_id}")
def get_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.finance.service import allocated_payments

    access.require("billing:read")
    invoice = _load(db, SupplierInvoice, invoice_id, "Facture fournisseur")
    if invoice.project_id:
        access.require_project(invoice.project_id)
    return {
        **_supplier_invoice_out(db, invoice),
        "payments": jsonable(allocated_payments(db, "supplier_invoice", invoice.id)),
    }


@router.get("/supplier-invoices/{invoice_id}/file")
def get_invoice_file(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("billing:read")
    invoice = _load(db, SupplierInvoice, invoice_id, "Facture fournisseur")
    if invoice.project_id:
        access.require_project(invoice.project_id)
    if not invoice.file_id:
        raise NotFound("Aucun fichier")
    return file_response(db.get(StoredFile, invoice.file_id))


@router.post("/supplier-invoices/{invoice_id}/match")
def match_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("billing:write")
    invoice = _load(db, SupplierInvoice, invoice_id, "Facture fournisseur")
    if invoice.status not in ("received", "exception", "matching"):
        raise BusinessRuleError("Facture déjà rapprochée ou traitée")
    service.three_way_match(db, invoice, user_id=access.p.id)
    db.commit()
    return _supplier_invoice_out(db, invoice)


class ResolveIn(BaseModel):
    decision: str = Field(pattern="^(accept|reject)$")
    justification: str = Field(min_length=5, max_length=4000)


@router.post("/supplier-invoices/{invoice_id}/resolve")
def resolve_invoice(
    invoice_id: uuid.UUID, data: ResolveIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("finance:approve")
    invoice = _load(db, SupplierInvoice, invoice_id, "Facture fournisseur")
    service.resolve_match_exception(
        db, invoice, user_id=access.p.id, decision=data.decision, justification=data.justification
    )
    db.commit()
    return _supplier_invoice_out(db, invoice)


@router.post("/supplier-invoices/{invoice_id}/validate")
def validate_supplier_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("billing:validate")
    invoice = _load(db, SupplierInvoice, invoice_id, "Facture fournisseur")
    service.finance_validate(db, invoice, user_id=access.p.id)
    db.commit()
    return _supplier_invoice_out(db, invoice)


class SupplierCreditNoteIn(BaseModel):
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=5, max_length=2000)
    supplier_reference: str | None = Field(default=None, max_length=80)


@router.post("/supplier-invoices/{invoice_id}/credit-notes", status_code=201)
def credit_supplier_invoice(
    invoice_id: uuid.UUID,
    data: SupplierCreditNoteIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Avoir fournisseur (retour marchandise, écart de prix / quantité) imputé sur la facture."""
    invoice = _load(db, SupplierInvoice, invoice_id, "Facture fournisseur")
    _require_project_finance(access, invoice.project_id, "billing:validate")
    note = lifecycle.register_supplier_credit_note(
        db,
        invoice,
        amount=data.amount,
        reason=data.reason,
        supplier_reference=data.supplier_reference,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(note))


# ============================================================================ pilotage & comptabilité
def _scope(access: Access) -> list[uuid.UUID] | None:
    """Périmètre projets de l'utilisateur (None = tous les projets)."""
    scope = access.project_scope()
    return None if scope is None else list(scope)


@router.get("/billing/summary")
def billing_summary(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("billing:read")
    return lifecycle.summary(db, project_ids=_scope(access))


@router.get("/billing/aging")
def billing_aging(
    side: str = Query("client", pattern="^(client|supplier)$"),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Balance âgée : créances clients ou dettes fournisseurs par tranche de retard."""
    access.require("billing:read")
    return lifecycle.aging(db, side=side, project_ids=_scope(access))


@router.get("/billing/export")
def billing_export(
    kind: str = Query("client", pattern="^(client|supplier)$"),
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> Response:
    """Journal des ventes / achats au format CSV (Excel) pour la comptabilité."""
    access.require("reports:export")
    access.require("billing:read")
    if date_to < date_from or (date_to - date_from).days > 366:
        raise BusinessRuleError("Période invalide (un an maximum)")
    content = lifecycle.export_journal(db, kind=kind, date_from=date_from, date_to=date_to, project_ids=_scope(access))
    audit.record(
        db,
        family="business",
        module="billing",
        action="EXPORT",
        resource_type="journal",
        resource_id=kind,
        diff={"from": date_from.isoformat(), "to": date_to.isoformat()},
    )
    db.commit()
    name = f"journal-{'ventes' if kind == 'client' else 'achats'}-{date_from.isoformat()}-{date_to.isoformat()}.csv"
    return Response(
        content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
