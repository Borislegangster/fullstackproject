"""Finance (§16) : budget versionné, engagé, consommé, reste à engager / à payer, cashflow, petite caisse,
appels de fonds, factures clients et avoirs, rapprochements bancaires, marge par projet et par lot."""

from __future__ import annotations

import csv
import hashlib
import io
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.security import random_token
from app.core.utils import money, utcnow
from app.modules.billing.models import ClientInvoice, ClientInvoiceLine, SupplierInvoice
from app.modules.finance.models import (
    PETTY_CASH_CATEGORIES,
    BankTransaction,
    Budget,
    BudgetLine,
    CashForecastEntry,
    Commitment,
    Expense,
    FundsCall,
    Payment,
    PettyCashFund,
    PettyCashTransaction,
)


# ---------------------------------------------------------------------------- budgets
def new_budget_version(
    db: Session,
    *,
    project_id: uuid.UUID,
    label: str,
    lines: list[dict[str, Any]],
    notes: str | None,
    user_id: uuid.UUID,
    revenue_target: Decimal | None,
) -> Budget:
    current = db.execute(select(func.max(Budget.version_number)).where(Budget.project_id == project_id)).scalar() or 0
    budget = Budget(
        project_id=project_id,
        version_number=current + 1,
        label=label,
        status="draft",
        notes=notes,
        created_by_id=user_id,
        revenue_target=revenue_target or Decimal("0"),
    )
    for line in lines:
        budget.lines.append(
            BudgetLine(
                lot_id=line.get("lot_id"),
                category=line.get("category", "materiaux"),
                label=line["label"],
                amount=money(line["amount"]),
            )
        )
    budget.total = money(sum((Decimal(line["amount"]) for line in lines), Decimal("0")))
    db.add(budget)
    db.flush()
    audit.record(
        db,
        family="business",
        module="finance",
        action="BUDGET_VERSION",
        resource_type="budget",
        resource_id=budget.id,
        project_id=project_id,
        diff={"version": budget.version_number, "total": str(budget.total)},
    )
    return budget


def approve_budget(db: Session, budget: Budget, *, user_id: uuid.UUID, principal: Any = None) -> Budget:
    from app.core.sod import require_other_person

    if budget.status != "draft":
        raise BusinessRuleError("Seul un budget en brouillon peut être approuvé")
    message = "Séparation des tâches : un budget est approuvé par une autre personne que son auteur"
    if principal is not None:
        require_other_person(
            db,
            principal,
            budget.created_by_id,
            message,
            resource_type="budget",
            resource_id=budget.id,
            project_id=budget.project_id,
        )
    elif budget.created_by_id and budget.created_by_id == user_id:
        raise BusinessRuleError(message, code="SEGREGATION_OF_DUTIES")
    for previous in db.execute(
        select(Budget).where(Budget.project_id == budget.project_id, Budget.status == "approved")
    ).scalars():
        previous.status = "superseded"
    budget.status = "approved"
    budget.approved_by_id = user_id
    budget.approved_at = utcnow()
    audit.record(
        db,
        family="business",
        module="finance",
        action="BUDGET_APPROVE",
        resource_type="budget",
        resource_id=budget.id,
        project_id=budget.project_id,
        criticality="HIGH",
        diff={"version": budget.version_number, "total": str(budget.total)},
    )
    return budget


def current_budget(db: Session, project_id: uuid.UUID) -> Budget | None:
    return (
        db.execute(
            select(Budget)
            .where(Budget.project_id == project_id, Budget.status == "approved")
            .order_by(Budget.version_number.desc())
        )
        .scalars()
        .first()
    )


# ---------------------------------------------------------------------------- engagements
def upsert_commitment(
    db: Session,
    *,
    project_id: uuid.UUID,
    lot_id: uuid.UUID | None,
    category: str,
    source_type: str,
    source_id: uuid.UUID,
    label: str,
    amount: Decimal,
) -> Commitment:
    row = db.execute(
        select(Commitment).where(Commitment.source_type == source_type, Commitment.source_id == source_id)
    ).scalar_one_or_none()
    if row is None:
        row = Commitment(
            project_id=project_id,
            lot_id=lot_id,
            category=category,
            source_type=source_type,
            source_id=source_id,
            label=label,
            amount=money(amount),
            status="open",
        )
        db.add(row)
    else:
        row.amount = money(amount)
        row.label = label
    db.flush()
    return row


def consume_commitment(db: Session, *, source_type: str, source_id: uuid.UUID, amount: Decimal) -> None:
    row = db.execute(
        select(Commitment).where(Commitment.source_type == source_type, Commitment.source_id == source_id)
    ).scalar_one_or_none()
    if row is None:
        return
    row.consumed = money(Decimal(row.consumed or 0) + amount)
    row.status = "closed" if row.consumed >= row.amount else "partially_consumed"


def record_expense(
    db: Session,
    *,
    project_id: uuid.UUID,
    lot_id: uuid.UUID | None,
    category: str,
    label: str,
    amount: Decimal,
    expense_date: date,
    source_type: str,
    source_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    file_id: uuid.UUID | None = None,
    commitment_source: tuple[str, uuid.UUID] | None = None,
    client_visible: bool = False,
) -> Expense:
    commitment = None
    if commitment_source:
        commitment = db.execute(
            select(Commitment).where(
                Commitment.source_type == commitment_source[0], Commitment.source_id == commitment_source[1]
            )
        ).scalar_one_or_none()
        consume_commitment(db, source_type=commitment_source[0], source_id=commitment_source[1], amount=amount)
    expense = Expense(
        project_id=project_id,
        lot_id=lot_id,
        category=category,
        label=label[:250],
        amount=money(amount),
        expense_date=expense_date,
        source_type=source_type,
        source_id=source_id,
        commitment_id=commitment.id if commitment else None,
        created_by_id=user_id,
        file_id=file_id,
        client_visible=client_visible,
    )
    db.add(expense)
    db.flush()
    return expense


# ---------------------------------------------------------------------------- petite caisse
def petty_cash_movement(
    db: Session,
    fund: PettyCashFund,
    *,
    kind: str,
    amount: Decimal,
    purpose: str,
    category: str,
    lot_id: uuid.UUID | None,
    receipt_file_id: uuid.UUID | None,
    user_id: uuid.UUID,
    transaction_date: date,
) -> PettyCashTransaction:
    amount = money(amount)
    if amount <= 0:
        raise BusinessRuleError("Montant positif requis")
    if category not in PETTY_CASH_CATEGORIES:
        raise BusinessRuleError(
            "Rubrique de caisse inconnue : choisissez-la dans la liste proposée", code="INVALID_VALUE"
        )
    if kind == "out" and amount > Decimal(fund.balance):
        raise BusinessRuleError("Solde de caisse insuffisant", code="INSUFFICIENT_CASH")
    if kind == "in" and fund.ceiling and Decimal(fund.balance) + amount > Decimal(fund.ceiling):
        raise BusinessRuleError("Plafond de caisse dépassé", code="CASH_CEILING")
    if kind == "out" and not receipt_file_id:
        raise BusinessRuleError("Justificatif obligatoire pour une sortie de caisse", code="RECEIPT_REQUIRED")
    tx = PettyCashTransaction(
        fund_id=fund.id,
        kind=kind,
        amount=amount,
        purpose=purpose,
        category=category,
        lot_id=lot_id,
        receipt_file_id=receipt_file_id,
        created_by_id=user_id,
        transaction_date=transaction_date,
        status="pending",
    )
    db.add(tx)
    db.flush()
    return tx


def validate_petty_cash(
    db: Session, tx: PettyCashTransaction, *, user_id: uuid.UUID, approve: bool, principal: Any = None
) -> PettyCashTransaction:
    from app.core.sod import require_other_person

    if tx.status != "pending":
        raise BusinessRuleError("Opération déjà traitée")
    message = "Séparation des tâches : validation par une autre personne"
    if principal is not None:
        require_other_person(
            db, principal, tx.created_by_id, message, resource_type="petty_cash_transaction", resource_id=tx.id
        )
    elif tx.created_by_id == user_id:
        raise BusinessRuleError(message, code="SEGREGATION_OF_DUTIES")
    fund = db.get(PettyCashFund, tx.fund_id)
    tx.status = "validated" if approve else "rejected"
    tx.validated_by_id = user_id
    tx.validated_at = utcnow()
    if approve and fund:
        if tx.kind == "out":
            if Decimal(fund.balance) < Decimal(tx.amount):
                raise BusinessRuleError("Solde de caisse insuffisant", code="INSUFFICIENT_CASH")
            fund.balance = money(Decimal(fund.balance) - Decimal(tx.amount))
            if fund.project_id:
                record_expense(
                    db,
                    project_id=fund.project_id,
                    lot_id=tx.lot_id,
                    category=PETTY_CASH_CATEGORIES.get(tx.category, "autre"),
                    label=tx.purpose,
                    amount=Decimal(tx.amount),
                    expense_date=tx.transaction_date,
                    source_type="petty_cash",
                    source_id=tx.id,
                    user_id=user_id,
                    file_id=tx.receipt_file_id,
                )
        else:
            fund.balance = money(Decimal(fund.balance) + Decimal(tx.amount))
    audit.record(
        db,
        family="business",
        module="finance",
        action="PETTY_CASH_" + ("APPROVE" if approve else "REJECT"),
        resource_type="petty_cash_transaction",
        resource_id=tx.id,
        project_id=fund.project_id if fund else None,
        diff={"amount": str(tx.amount), "kind": tx.kind},
    )
    return tx


# ---------------------------------------------------------------------------- appels de fonds


def issue_funds_call(
    db: Session, call: FundsCall, *, user_id: uuid.UUID, tax_rate: Decimal, principal: Any = None
) -> FundsCall:
    """Émission (double regard) : une autre personne que l'auteur de l'appel de fonds l'émet ; la facture
    définitive et son PDF sont produits à cette étape."""
    from app.core.sod import require_other_person
    from app.modules.billing.service import compute_invoice, invoice_pdf
    from app.modules.projects.models import Project

    if call.status != "draft":
        raise BusinessRuleError("Appel de fonds déjà émis")
    if principal is not None:
        require_other_person(
            db,
            principal,
            call.created_by_id,
            "Double regard : l'appel de fonds est émis par une autre personne que celle qui l'a préparé",
            resource_type="funds_call",
            resource_id=call.id,
            project_id=call.project_id,
        )
    project = db.get(Project, call.project_id)
    if project is None:
        raise NotFound("Projet introuvable")
    invoice = ClientInvoice(
        number=next_number(db, "client_invoice"),
        project_id=project.id,
        organization_id=project.client_organization_id,
        contract_id=project.contract_id,
        kind="progress",
        title=call.label,
        issue_date=date.today(),
        due_date=call.due_date,
        tax_rate=tax_rate,
        currency=call.currency,
        status="sent",
        sent_at=utcnow(),
        validated_by_id=user_id,
        validated_at=utcnow(),
        authenticity_token=random_token(24),
        created_by_id=user_id,
    )
    ht = money(Decimal(call.amount) / (1 + Decimal(tax_rate) / 100))
    invoice.lines.append(
        ClientInvoiceLine(designation=call.label, unit="forfait", quantity=Decimal("1"), unit_price=ht)
    )
    compute_invoice(invoice)
    invoice.total = money(call.amount)  # le montant appelé est TTC
    invoice.tax_amount = money(Decimal(call.amount) - invoice.subtotal)
    db.add(invoice)
    db.flush()
    invoice_pdf(db, invoice)
    call.client_invoice_id = invoice.id
    call.status = "issued"
    call.issued_at = utcnow()
    emit(
        db,
        "funds_call.issued",
        {
            "id": call.id,
            "number": call.number,
            "label": call.label,
            "amount": call.amount,
            "due_date": call.due_date,
            "project_name": project.name,
            "link": "/espace-client/finances",
        },
        aggregate_type="funds_call",
        aggregate_id=call.id,
        project_id=project.id,
    )
    audit.record(
        db,
        family="business",
        module="finance",
        action="ISSUE",
        resource_type="funds_call",
        resource_id=call.id,
        project_id=project.id,
        diff={"amount": str(call.amount), "invoice": invoice.number},
    )
    return call


# ---------------------------------------------------------------------------- rapprochement bancaire
def import_bank_statement(
    db: Session, *, bank_account_id: uuid.UUID, content: str, user_id: uuid.UUID
) -> dict[str, int]:
    """Import CSV (date;libellé;référence;montant) puis rapprochement automatique par référence et montant."""
    batch = f"imp-{utcnow():%Y%m%d%H%M%S}"
    delimiter = ";" if content.count(";") >= content.count(",") else ","
    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
    created = duplicates = 0
    for row in reader:
        if len(row) < 4 or not row[0].strip() or row[0].strip().lower() in ("date", "date_valeur"):
            continue
        try:
            raw_date = row[0].strip()
            value_date = (
                datetime.strptime(raw_date, "%d/%m/%Y").date() if "/" in raw_date else date.fromisoformat(raw_date)
            )
            amount = Decimal(row[3].strip().replace(" ", "").replace(",", "."))
        except (ValueError, InvalidOperation):
            continue
        fp = hashlib.sha256(f"{value_date}|{row[1].strip()}|{row[2].strip()}|{amount}".encode()).hexdigest()
        if db.execute(
            select(BankTransaction.id).where(
                BankTransaction.bank_account_id == bank_account_id, BankTransaction.fingerprint == fp
            )
        ).first():
            duplicates += 1
            continue
        db.add(
            BankTransaction(
                bank_account_id=bank_account_id,
                import_batch=batch,
                value_date=value_date,
                label=row[1].strip()[:400],
                reference=row[2].strip()[:200] or None,
                amount=money(amount),
                fingerprint=fp,
            )
        )
        created += 1
    db.flush()
    matched = auto_match(db, bank_account_id)
    audit.record(
        db,
        family="business",
        module="finance",
        action="BANK_IMPORT",
        resource_type="bank_account",
        resource_id=bank_account_id,
        actor_id=user_id,
        diff={"created": created, "duplicates": duplicates, "matched": matched},
    )
    return {"created": created, "duplicates": duplicates, "matched": matched}


def auto_match(db: Session, bank_account_id: uuid.UUID) -> int:
    matched = 0
    rows = (
        db.execute(
            select(BankTransaction).where(
                BankTransaction.bank_account_id == bank_account_id, BankTransaction.status == "unmatched"
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        direction = "in" if row.amount > 0 else "out"
        stmt = select(Payment).where(
            Payment.direction == direction,
            Payment.amount == abs(row.amount),
            Payment.status.in_(["succeeded", "processing", "pending"]),
        )
        candidates = db.execute(stmt).scalars().all()
        exact = [
            p
            for p in candidates
            if (p.provider_reference and row.reference and p.provider_reference in row.reference)
            or (p.number in (row.label + " " + (row.reference or "")))
        ]
        choice = exact[0] if len(exact) == 1 else (candidates[0] if len(candidates) == 1 else None)
        if choice is not None:
            already = db.execute(
                select(BankTransaction.id).where(BankTransaction.matched_payment_id == choice.id)
            ).first()
            if already:
                continue
            row.status = "matched"
            row.matched_payment_id = choice.id
            row.matched_at = utcnow()
            if choice.status != "succeeded" and choice.direction == "in":
                from app.modules.finance.models import PaymentTransaction
                from app.modules.finance.payments import apply_transaction_status

                tx = (
                    db.execute(select(PaymentTransaction).where(PaymentTransaction.payment_id == choice.id))
                    .scalars()
                    .first()
                )
                if tx:
                    apply_transaction_status(
                        db,
                        tx,
                        "succeeded",
                        provider_transaction_id=row.reference,
                        reason=None,
                        confirmed_by="reconciliation",
                    )
            matched += 1
    db.flush()
    return matched


def manual_match(db: Session, row: BankTransaction, payment: Payment, *, user_id: uuid.UUID) -> BankTransaction:
    if row.status == "matched":
        raise Conflict("Ligne déjà rapprochée")
    if abs(Decimal(row.amount)) != Decimal(payment.amount):
        raise BusinessRuleError("Montants différents : rapprochement refusé", code="AMOUNT_MISMATCH")
    row.status = "matched"
    row.matched_payment_id = payment.id
    row.matched_by_id = user_id
    row.matched_at = utcnow()
    audit.record(
        db,
        family="business",
        module="finance",
        action="RECONCILE",
        resource_type="bank_transaction",
        resource_id=row.id,
        diff={"payment": payment.number},
    )
    return row


# ---------------------------------------------------------------------------- trésorerie & marges
def cashflow(db: Session, *, project_id: uuid.UUID | None, months: int = 6) -> dict[str, Any]:
    from app.modules.subcontracting.models import SubcontractorInvoice

    start = date.today().replace(day=1)
    buckets = [
        (start.replace(year=start.year + (start.month - 1 + i) // 12, month=(start.month - 1 + i) % 12 + 1))
        for i in range(months)
    ]

    def bucket_of(day: date | None) -> int | None:
        if day is None:
            return 0
        for i in range(len(buckets) - 1, -1, -1):
            if day >= buckets[i]:
                return i
        return 0

    inflow = [Decimal("0")] * months
    outflow = [Decimal("0")] * months
    calls = select(FundsCall).where(FundsCall.status.in_(["issued", "partially_paid", "overdue", "draft"]))
    if project_id:
        calls = calls.where(FundsCall.project_id == project_id)
    for c in db.execute(calls).scalars():
        idx = bucket_of(c.due_date)
        if idx is not None:
            inflow[idx] += Decimal(c.amount) - Decimal(c.amount_paid)
    sup = select(SupplierInvoice).where(
        SupplierInvoice.status.not_in(["paid", "rejected"]), SupplierInvoice.deleted_at.is_(None)
    )
    if project_id:
        sup = sup.where(SupplierInvoice.project_id == project_id)
    for inv in db.execute(sup).scalars():
        idx = bucket_of(inv.due_date)
        if idx is not None:
            outflow[idx] += Decimal(inv.total) - Decimal(inv.amount_paid)
    sub = select(SubcontractorInvoice).where(SubcontractorInvoice.status.not_in(["paid", "rejected"]))
    for inv in db.execute(sub).scalars():
        idx = bucket_of(inv.due_date)
        if idx is not None:
            outflow[idx] += Decimal(inv.amount) - Decimal(inv.amount_paid)
    entries = select(CashForecastEntry)
    if project_id:
        entries = entries.where(CashForecastEntry.project_id == project_id)
    for e in db.execute(entries).scalars():
        idx = bucket_of(e.expected_date)
        if idx is not None:
            value = Decimal(e.amount) * Decimal(e.probability) / 100
            if e.direction == "in":
                inflow[idx] += value
            else:
                outflow[idx] += value
    cumulative = Decimal("0")
    series = []
    for i, month in enumerate(buckets):
        net = inflow[i] - outflow[i]
        cumulative += net
        series.append(
            {
                "month": month.isoformat()[:7],
                "inflow": money(inflow[i]),
                "outflow": money(outflow[i]),
                "net": money(net),
                "cumulative": money(cumulative),
            }
        )
    return {"series": series}


def margins(db: Session, project_ids: list[uuid.UUID] | None) -> list[dict[str, Any]]:
    from app.modules.projects.models import ChangeOrder, Lot, Project

    stmt = select(Project).where(Project.deleted_at.is_(None))
    if project_ids is not None:
        stmt = stmt.where(Project.id.in_(project_ids))
    out = []
    for project in db.execute(stmt).scalars():
        approved_co = db.execute(
            select(func.coalesce(func.sum(ChangeOrder.cost_impact), 0)).where(
                ChangeOrder.project_id == project.id, ChangeOrder.status == "approved"
            )
        ).scalar_one()
        contract = Decimal(project.contract_amount or 0)
        revenue = contract + Decimal(approved_co)  # contrat (avenants non inclus) + avenants approuvés
        committed = db.execute(
            select(func.coalesce(func.sum(Commitment.amount), 0)).where(
                Commitment.project_id == project.id, Commitment.status != "cancelled"
            )
        ).scalar_one()
        spent = db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.project_id == project.id, Expense.deleted_at.is_(None)
            )
        ).scalar_one()
        budget = current_budget(db, project.id)
        forecast_cost = max(Decimal(committed), Decimal(spent), Decimal(budget.total) if budget else Decimal("0"))
        lots = []
        for lot in db.execute(select(Lot).where(Lot.project_id == project.id).order_by(Lot.sort_order)).scalars():
            lot_spent = db.execute(
                select(func.coalesce(func.sum(Expense.amount), 0)).where(
                    Expense.lot_id == lot.id, Expense.deleted_at.is_(None)
                )
            ).scalar_one()
            lot_committed = db.execute(
                select(func.coalesce(func.sum(Commitment.amount), 0)).where(
                    Commitment.lot_id == lot.id, Commitment.status != "cancelled"
                )
            ).scalar_one()
            lot_budget = Decimal(lot.budget_amount or 0)
            lots.append(
                {
                    "lot_id": lot.id,
                    "code": lot.code,
                    "name": lot.name,
                    "budget": lot_budget,
                    "committed": lot_committed,
                    "spent": lot_spent,
                    "variance": lot_budget - max(Decimal(lot_committed), Decimal(lot_spent)),
                }
            )
        out.append(
            {
                "project_id": project.id,
                "code": project.code,
                "name": project.name,
                "contract_amount": contract,
                "approved_change_orders": approved_co,
                "revenue": revenue,
                "budget": budget.total if budget else None,
                "committed": committed,
                "spent": spent,
                "forecast_cost": forecast_cost,
                "gross_margin": revenue - forecast_cost,
                "gross_margin_pct": round(float((revenue - forecast_cost) * 100 / revenue), 1) if revenue else None,
                "lots": lots,
            }
        )
    return out


def overdue_receivables(db: Session) -> list[dict[str, Any]]:
    rows = (
        db.execute(select(FundsCall).where(FundsCall.status == "overdue").order_by(FundsCall.due_date)).scalars().all()
    )
    return [
        {
            "id": r.id,
            "number": r.number,
            "project_id": r.project_id,
            "amount_due": Decimal(r.amount) - Decimal(r.amount_paid),
            "due_date": r.due_date,
            "days_late": (date.today() - r.due_date).days if r.due_date else None,
        }
        for r in rows
    ]


_ = timedelta


def allocated_payments(db: Session, target_type: str, target_id: uuid.UUID) -> list[dict[str, Any]]:
    """Règlements imputés sur une pièce (facture client, appel de fonds, facture fournisseur ou sous-traitant)."""
    from app.modules.finance.models import PaymentAllocation

    rows = db.execute(
        select(Payment, PaymentAllocation.amount)
        .join(PaymentAllocation, PaymentAllocation.payment_id == Payment.id)
        .where(PaymentAllocation.target_type == target_type, PaymentAllocation.target_id == target_id)
        .order_by(Payment.created_at)
    ).all()
    return [
        {
            "id": p.id,
            "number": p.number,
            "status": p.status,
            "method": p.method,
            "provider": p.provider,
            "allocated": amount,
            "paid_at": p.paid_at,
            "created_at": p.created_at,
        }
        for p, amount in rows
    ]
