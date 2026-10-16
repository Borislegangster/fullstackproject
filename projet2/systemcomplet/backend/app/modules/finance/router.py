"""API Finance & Facturation (ERP) + webhooks de paiement + bac à sable de paiement (dev)."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import AppError, BusinessRuleError, NotFound
from app.core.files import store_private, validate_upload
from app.core.idempotency import Idempotency, idempotency
from app.core.numbering import next_number
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable
from app.modules.billing.models import ClientInvoice, SupplierInvoice
from app.modules.finance import payments, service
from app.modules.finance.models import (
    BankAccount,
    BankTransaction,
    Budget,
    CashForecastEntry,
    Commitment,
    Expense,
    FundsCall,
    Payment,
    PaymentTransaction,
    PettyCashFund,
    PettyCashTransaction,
)
from app.modules.system.models import StoredFile
from app.providers.base import ProviderError
from app.providers.payments import PROVIDERS, InvalidWebhookSignature, available_payment_methods, payout_providers

router = APIRouter(tags=["Finance & facturation"])
webhooks = APIRouter(prefix="/payments", tags=["Paiements (webhooks)"])


def _require_project_finance(access: Access, project_id: uuid.UUID | None, *perms: str) -> None:
    access.require(*perms)
    if project_id:
        access.require_project(project_id)


# ---------------------------------------------------------------------------- budgets
class BudgetLineIn(BaseModel):
    lot_id: uuid.UUID | None = None
    category: str = Field(
        default="materiaux", pattern="^(materiaux|main_oeuvre|sous_traitance|materiel|etudes|frais_generaux|autre)$"
    )
    label: str = Field(min_length=1, max_length=250)
    amount: Decimal = Field(ge=0)


class BudgetIn(BaseModel):
    project_id: uuid.UUID
    label: str = Field(min_length=2, max_length=150)
    notes: str | None = None
    revenue_target: Decimal | None = None
    lines: list[BudgetLineIn] = Field(min_length=1, max_length=1000)


def _budget_out(b: Budget) -> dict[str, Any]:
    return jsonable({**serialize(b), "lines": [serialize(line) for line in b.lines]})


@router.get("/budgets")
def list_budgets(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _require_project_finance(access, project_id, "finance:read")
    rows = db.execute(
        select(Budget).where(Budget.project_id == project_id).order_by(Budget.version_number.desc())
    ).scalars()
    return [_budget_out(b) for b in rows]


@router.post("/budgets", status_code=201)
def create_budget(
    data: BudgetIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _require_project_finance(access, data.project_id, "finance:write")
    budget = service.new_budget_version(
        db,
        project_id=data.project_id,
        label=data.label,
        lines=[line.model_dump() for line in data.lines],
        notes=data.notes,
        user_id=access.p.id,
        revenue_target=data.revenue_target,
    )
    db.commit()
    return _budget_out(budget)


@router.post("/budgets/{budget_id}/approve")
def approve_budget(
    budget_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    budget = db.get(Budget, budget_id)
    if budget is None:
        raise NotFound("Budget introuvable")
    _require_project_finance(access, budget.project_id, "finance:approve")
    service.approve_budget(db, budget, user_id=access.p.id)
    db.commit()
    return _budget_out(budget)


# ---------------------------------------------------------------------------- engagements & dépenses
@router.get("/commitments")
def list_commitments(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("finance:read")
    stmt = access.filter_by_project(select(Commitment), Commitment.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(Commitment.project_id == project_id)
    if status:
        stmt = stmt.where(Commitment.status == status)
    return paginate(
        db, stmt, params, default_sort=Commitment.created_at.desc(), transform=lambda c: jsonable(serialize(c))
    )


router.include_router(
    make_crud_router(
        Expense,
        prefix="/expenses",
        tags=["Finance & facturation"],
        module="finance",
        read_perm="finance:read",
        write_perm="finance:write",
        label="Dépense",
        project_attr="project_id",
        filters=["project_id", "lot_id", "category", "source_type"],
        sort=["expense_date", "amount", "created_at"],
        default_sort="expense_date",
        search=["label"],
        creator_attr="created_by_id",
        exclude_in={"commitment_id"},
    )
)
router.include_router(
    make_crud_router(
        CashForecastEntry,
        prefix="/cash-forecast-entries",
        tags=["Finance & facturation"],
        module="finance",
        read_perm="finance:read",
        write_perm="finance:write",
        label="Prévision de trésorerie",
        filters=["project_id", "direction"],
        sort=["expected_date"],
        default_sort="expected_date",
    )
)
router.include_router(
    make_crud_router(
        BankAccount,
        prefix="/bank-accounts",
        tags=["Finance & facturation"],
        module="finance",
        read_perm="finance:read",
        write_perm="finance:reconcile",
        label="Compte bancaire",
        exclude_out={"account_number"},
    )
)


@router.get("/finance/cashflow")
def get_cashflow(
    project_id: uuid.UUID | None = None,
    months: int = 6,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    _require_project_finance(access, project_id, "finance:read")
    return jsonable(service.cashflow(db, project_id=project_id, months=max(1, min(months, 24))))


@router.get("/finance/margins")
def get_margins(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("finance:read")
    scope = access.project_scope()
    return jsonable(service.margins(db, list(scope) if scope is not None else None))


@router.get("/finance/receivables")
def receivables(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    access.require("finance:read")
    return jsonable(service.overdue_receivables(db))


# ---------------------------------------------------------------------------- petite caisse
router.include_router(
    make_crud_router(
        PettyCashFund,
        prefix="/petty-cash-funds",
        tags=["Finance & facturation"],
        module="finance",
        read_perm="finance:read",
        write_perm="finance:write",
        label="Caisse",
        project_attr="project_id",
        filters=["project_id", "custodian_id", "is_active"],
        exclude_in={"balance"},
        allow_delete=False,
    )
)


@router.get("/petty-cash-funds/{fund_id}/transactions")
def list_cash_tx(
    fund_id: uuid.UUID,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    fund = db.get(PettyCashFund, fund_id)
    if fund is None:
        raise NotFound("Caisse introuvable")
    _require_project_finance(access, fund.project_id, "finance:read")
    return paginate(
        db,
        select(PettyCashTransaction).where(PettyCashTransaction.fund_id == fund_id),
        params,
        default_sort=PettyCashTransaction.created_at.desc(),
        transform=lambda t: jsonable(serialize(t)),
    )


@router.post("/petty-cash-funds/{fund_id}/transactions", status_code=201)
async def add_cash_tx(
    fund_id: uuid.UUID,
    kind: str = Form(...),
    amount: Decimal = Form(...),
    purpose: str = Form(...),
    category: str = Form("autre"),
    lot_id: uuid.UUID | None = Form(None),
    transaction_date: date = Form(...),
    receipt: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    fund = db.get(PettyCashFund, fund_id)
    if fund is None:
        raise NotFound("Caisse introuvable")
    if fund.custodian_id != access.p.id:
        _require_project_finance(access, fund.project_id, "finance:write")
    if kind not in ("in", "out"):
        raise BusinessRuleError("Sens invalide (in/out)")
    receipt_id = None
    if receipt is not None:
        upload = validate_upload(receipt.filename or "justificatif", await receipt.read(), category="media")
        receipt_id = store_private(
            db, upload, purpose="petty_cash", classification="confidential", uploaded_by_id=access.p.id
        ).id
    tx = service.petty_cash_movement(
        db,
        fund,
        kind=kind,
        amount=amount,
        purpose=purpose,
        category=category,
        lot_id=lot_id,
        receipt_file_id=receipt_id,
        user_id=access.p.id,
        transaction_date=transaction_date,
    )
    audit.record(
        db,
        family="business",
        module="finance",
        action="PETTY_CASH_DECLARE",
        resource_type="petty_cash_transaction",
        resource_id=tx.id,
        project_id=fund.project_id,
        diff={"amount": str(amount), "kind": kind},
    )
    db.commit()
    return jsonable(serialize(tx))


@router.post("/petty-cash-transactions/{tx_id}/validate")
def validate_cash_tx(
    tx_id: uuid.UUID, data: dict[str, bool], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tx = db.get(PettyCashTransaction, tx_id)
    if tx is None:
        raise NotFound("Opération introuvable")
    fund = db.get(PettyCashFund, tx.fund_id)
    _require_project_finance(access, fund.project_id if fund else None, "finance:approve")
    service.validate_petty_cash(db, tx, user_id=access.p.id, approve=bool(data.get("approve", True)))
    db.commit()
    return jsonable(serialize(tx))


# ---------------------------------------------------------------------------- appels de fonds
class FundsCallIn(BaseModel):
    project_id: uuid.UUID
    milestone_id: uuid.UUID | None = None
    label: str = Field(min_length=2, max_length=250)
    amount: Decimal = Field(gt=0)
    currency: str = "XAF"
    due_date: date | None = None


@router.get("/funds-calls")
def list_funds_calls(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("finance:read")
    stmt = access.filter_by_project(select(FundsCall), FundsCall.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(FundsCall.project_id == project_id)
    if status:
        stmt = stmt.where(FundsCall.status == status)
    return paginate(
        db, stmt, params, default_sort=FundsCall.due_date.asc().nullslast(), transform=lambda c: jsonable(serialize(c))
    )


@router.post("/funds-calls", status_code=201)
def create_funds_call(
    data: FundsCallIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _require_project_finance(access, data.project_id, "billing:write")
    call = FundsCall(
        number=next_number(db, "funds_call"), status="draft", created_by_id=access.p.id, **data.model_dump()
    )
    db.add(call)
    db.flush()
    audit.record(
        db,
        family="business",
        module="finance",
        action="CREATE",
        resource_type="funds_call",
        resource_id=call.id,
        project_id=call.project_id,
        diff={"amount": str(call.amount)},
    )
    db.commit()
    return jsonable(serialize(call))


@router.post("/funds-calls/{call_id}/issue")
def issue_funds_call(
    call_id: uuid.UUID,
    data: dict[str, Any] | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    call = db.get(FundsCall, call_id)
    if call is None:
        raise NotFound("Appel de fonds introuvable")
    _require_project_finance(access, call.project_id, "billing:write")
    service.issue_funds_call(
        db, call, user_id=access.p.id, tax_rate=Decimal(str((data or {}).get("tax_rate", "19.25")))
    )
    db.commit()
    return jsonable(serialize(call))


# ---------------------------------------------------------------------------- paiements
@router.get("/payments")
def list_payments(
    params: PageParams = Depends(),
    direction: str | None = None,
    status: str | None = None,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("finance:read")
    stmt = access.filter_by_project(select(Payment), Payment.project_id)
    for col, value in ((Payment.direction, direction), (Payment.status, status), (Payment.project_id, project_id)):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"created_at": Payment.created_at, "amount": Payment.amount},
        default_sort=Payment.created_at.desc(),
        search_columns=[Payment.number, Payment.counterparty_label],
        transform=lambda p: jsonable({**serialize(p), "allocations": [serialize(a) for a in p.allocations]}),
    )


@router.get("/payments/methods")
def payment_methods() -> list[dict[str, Any]]:
    return available_payment_methods()


@router.get("/payments/payout-providers")
def payout_providers_list(access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    """Prestataires activés capables d'exécuter un paiement sortant (MTN MoMo Disbursements, Flutterwave)."""
    access.require("finance:pay")
    return [{"provider": name, "label": PROVIDERS[name].label} for name in payout_providers()]


def _allocation_label(db: Session, target_type: str, target_id: uuid.UUID) -> dict[str, Any]:
    """Libellé et lien ERP de la pièce réglée par une allocation de paiement."""
    from app.modules.referrals.models import Referral
    from app.modules.subcontracting.models import SubcontractorInvoice

    model, link = {
        "client_invoice": (ClientInvoice, None),
        "funds_call": (FundsCall, None),
        "supplier_invoice": (SupplierInvoice, "/erp/facturation/fournisseurs/{id}"),
        "subcontractor_invoice": (SubcontractorInvoice, None),
        "referral_reward": (Referral, "/erp/crm/ambassadeurs"),
    }.get(target_type, (None, None))
    obj = db.get(model, target_id) if model is not None else None
    if obj is None:
        return {"label": None, "link": None}
    label = getattr(obj, "number", None)
    extra = getattr(obj, "supplier_reference", None) or getattr(obj, "reference", None) or getattr(obj, "label", None)
    return {
        "label": f"{label} - {extra}" if label and extra else label,
        "link": link.format(id=obj.id) if link else None,
    }


@router.get("/payments/{payment_id}")
def get_payment(
    payment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise NotFound("Paiement introuvable")
    access.require("finance:read")
    if payment.project_id:
        access.require_project(payment.project_id)
    transactions = (
        db.execute(
            select(PaymentTransaction)
            .where(PaymentTransaction.payment_id == payment.id)
            .order_by(PaymentTransaction.created_at)
        )
        .scalars()
        .all()
    )
    bank_rows = db.execute(select(BankTransaction).where(BankTransaction.matched_payment_id == payment.id)).scalars()
    data = serialize(payment)
    data.pop("idempotency_key", None)
    return jsonable(
        {
            **data,
            "allocations": [
                {**serialize(a), **_allocation_label(db, a.target_type, a.target_id)} for a in payment.allocations
            ],
            "transactions": [
                {k: v for k, v in serialize(t).items() if k not in ("checkout_url", "customer_email", "customer_phone")}
                for t in transactions
            ],
            "bank_matches": [serialize(b) for b in bank_rows],
            "approval_role": payments.required_approval_role(db, Decimal(payment.amount))
            if payment.status == "awaiting_approval"
            else None,
        }
    )


class OutgoingIn(BaseModel):
    target_type: str = Field(pattern="^(supplier_invoice|subcontractor_invoice|referral_reward)$")
    target_id: uuid.UUID
    amount: Decimal | None = Field(default=None, gt=0)
    method: str = Field(default="bank_transfer", pattern="^(bank_transfer|mobile_money|cheque|cash)$")
    notes: str | None = None


@router.post("/payments/outgoing", status_code=201)
def create_outgoing(
    data: OutgoingIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency(required=True)),
) -> Any:
    if idem.replay is not None:
        return idem.replay
    access.require("finance:pay")
    payment = payments.create_outgoing(
        db,
        user_id=access.p.id,
        target_type=data.target_type,
        target_id=data.target_id,
        amount=data.amount,
        method=data.method,
        idempotency_key=idem.key or "",
        notes=data.notes,
    )
    return idem.complete(db, jsonable(serialize(payment)), status_code=201)


class ApproveIn(BaseModel):
    override_reason: str | None = Field(default=None, max_length=1000)  # dérogation au contrôle interne (Direction)


@router.post("/payments/{payment_id}/approve")
def approve_payment(
    payment_id: uuid.UUID,
    data: ApproveIn | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise NotFound("Paiement introuvable")
    access.require("finance:approve")
    try:
        payments.approve_outgoing(
            db, payment, principal=access.p, override_reason=data.override_reason if data else None
        )
    except BusinessRuleError:
        db.commit()  # les anomalies détectées au filtrage restent enregistrées même si l'approbation est refusée
        raise
    db.commit()
    return jsonable(serialize(payment))


@router.post("/payments/{payment_id}/execute")
async def execute_payment(
    payment_id: uuid.UUID,
    bank_reference: str | None = Form(None),
    provider: str | None = Form(None, max_length=20),
    proof: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise NotFound("Paiement introuvable")
    access.require("finance:pay")
    proof_id = None
    if proof is not None:
        upload = validate_upload(proof.filename or "preuve", await proof.read(), category="media")
        proof_id = store_private(
            db, upload, purpose="payment_proofs", classification="confidential", uploaded_by_id=access.p.id
        ).id
    if provider and provider not in payout_providers():
        raise BusinessRuleError("Prestataire non activé pour les paiements sortants")
    try:
        payments.execute_outgoing(
            db,
            payment,
            principal=access.p,
            proof_file_id=proof_id,
            bank_reference=bank_reference,
            provider_name=provider or None,
        )
    except ProviderError as exc:
        raise AppError(f"Prestataire de paiement : {exc}", code="PROVIDER_ERROR", status_code=502) from exc
    db.commit()
    return jsonable(serialize(payment))


@router.post("/payments/{payment_id}/refresh")
def refresh_payment(
    payment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Relit immédiatement auprès du prestataire le statut des opérations en attente du paiement."""
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise NotFound("Paiement introuvable")
    access.require("finance:read")
    if payment.project_id:
        access.require_project(payment.project_id)
    pending = (
        db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.payment_id == payment.id, PaymentTransaction.status == "pending"
            )
        )
        .scalars()
        .all()
    )
    for tx in pending:
        payments.refresh_transaction(db, tx, min_interval_s=0, confirmed_by="reconciliation")
    db.commit()
    db.refresh(payment)
    return jsonable(serialize(payment))


@router.get("/payments/{payment_id}/receipt")
def payment_receipt(
    payment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    payment = db.get(Payment, payment_id)
    if payment is None or not payment.receipt_file_id:
        raise NotFound("Reçu indisponible")
    if access.p.is_client:
        access.require_project(payment.project_id)
    else:
        access.require("finance:read")
    return file_response(db.get(StoredFile, payment.receipt_file_id))


@router.get("/payments/{payment_id}/proof")
def payment_proof(
    payment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    """Preuve d'exécution (ordre de virement, reçu Mobile Money) jointe au paiement sortant."""
    payment = db.get(Payment, payment_id)
    if payment is None or not payment.proof_file_id:
        raise NotFound("Preuve indisponible")
    access.require("finance:read")
    if payment.project_id:
        access.require_project(payment.project_id)
    return file_response(db.get(StoredFile, payment.proof_file_id))


# ---------------------------------------------------------------------------- rapprochement bancaire
@router.post("/bank-accounts/{account_id}/import")
async def import_statement(
    account_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, int]:
    access.require("finance:reconcile")
    if db.get(BankAccount, account_id) is None:
        raise NotFound("Compte introuvable")
    content = (await file.read()).decode("utf-8-sig", errors="replace")
    result = service.import_bank_statement(db, bank_account_id=account_id, content=content, user_id=access.p.id)
    db.commit()
    return result


@router.get("/bank-accounts/{account_id}/transactions")
def bank_transactions(
    account_id: uuid.UUID,
    params: PageParams = Depends(),
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("finance:reconcile")
    stmt = select(BankTransaction).where(BankTransaction.bank_account_id == account_id)
    if status:
        stmt = stmt.where(BankTransaction.status == status)
    return paginate(
        db, stmt, params, default_sort=BankTransaction.value_date.desc(), transform=lambda t: jsonable(serialize(t))
    )


@router.post("/bank-transactions/{row_id}/match")
def match_transaction(
    row_id: uuid.UUID, data: dict[str, str], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("finance:reconcile")
    row = db.get(BankTransaction, row_id)
    payment = db.get(Payment, uuid.UUID(data.get("payment_id", ""))) if data.get("payment_id") else None
    if row is None or payment is None:
        raise NotFound("Ligne ou paiement introuvable")
    service.manual_match(db, row, payment, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(row))


# ---------------------------------------------------------------------------- factures fournisseurs (lecture)


# ============================================================================ notifications prestataires
@webhooks.post("/webhooks/{provider}")
async def payment_webhook(provider: str, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Notifications des prestataires : authentifiées (signature, URL signée, jeton), idempotentes."""
    return await _webhook(provider, request, db)


@webhooks.put("/webhooks/{provider}")
async def payment_webhook_put(provider: str, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Rappels MTN MoMo (envoyés en PUT) : même traitement que les notifications POST."""
    return await _webhook(provider, request, db)


async def _webhook(provider: str, request: Request, db: Session) -> dict[str, Any]:
    body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    query = dict(request.query_params)
    try:
        result = payments.process_webhook(db, provider, headers, body, query)
    except InvalidWebhookSignature as exc:
        from app.core import metrics

        db.rollback()
        metrics.webhook_events.labels(provider, "invalid_signature").inc()
        audit.record_independent(
            family="security",
            module="payments",
            action="WEBHOOK_REJECTED",
            resource_type="webhook",
            resource_id=provider,
            actor_type="webhook",
            result="FAIL",
            reason="Signature invalide",
            criticality="HIGH",
        )
        raise AppError("Signature invalide", code="INVALID_SIGNATURE", status_code=401) from exc
    db.commit()
    return result


@webhooks.get("/transactions/{transaction_id}")
def transaction_status(
    transaction_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    tx = db.get(PaymentTransaction, transaction_id)
    if tx is None:
        raise NotFound("Transaction introuvable")
    payment = db.get(Payment, tx.payment_id)
    if payment and payment.initiated_by_id != access.p.id:
        access.require("finance:read")
    if tx.status == "pending":
        # Validation sur téléphone (MTN MoMo) ou rappel manqué : relecture auprès du prestataire (limitée).
        payments.refresh_transaction(db, tx, confirmed_by="polling")
        db.commit()
        db.refresh(tx)
        if payment:
            db.refresh(payment)
    return jsonable(
        {
            "transaction_id": tx.id,
            "provider": tx.provider,
            "flow": getattr(PROVIDERS.get(tx.provider), "flow", "redirect"),
            "instructions": payments.instructions_for(tx),
            "expires_at": tx.expires_at,
            "status": tx.status,
            "payment_status": payment.status if payment else None,
            "amount": tx.amount,
            "currency": tx.currency,
            "failure_reason": tx.failure_reason,
            "payment_number": payment.number if payment else None,
            "receipt_available": bool(payment and payment.receipt_file_id),
            "payment_id": payment.id if payment else None,
        }
    )
