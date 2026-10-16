"""Facturation — cycle de vie des factures clients (brouillon, envoi, annulation), avoirs fournisseurs, relances
d'échéance automatiques et manuelles, pilotage (synthèse, balance âgée) et export comptable."""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, Conflict
from app.core.events import emit
from app.core.utils import jsonable, money, utcnow
from app.modules.billing.models import ClientInvoice, ClientInvoiceLine, CreditNote, PaymentReminder, SupplierInvoice
from app.modules.billing.service import compute_invoice, issue_credit_note
from app.modules.suppliers.models import Supplier
from app.modules.system.models import ActionItem

UNPAID_STATUSES = ("sent", "partially_paid", "overdue")


# ---------------------------------------------------------------------------- cycle de vie des factures clients
def update_draft_invoice(
    db: Session,
    invoice: ClientInvoice,
    *,
    values: dict[str, Any],
    lines: list[dict[str, Any]] | None,
    user_id: uuid.UUID,
) -> ClientInvoice:
    """Modification d'un brouillon (une facture validée est figée : correction par avoir)."""
    if invoice.status != "draft":
        raise BusinessRuleError("Seul un brouillon est modifiable ; une facture validée se corrige par un avoir")
    for key, value in values.items():
        setattr(invoice, key, value)
    if lines is not None:
        if not lines:
            raise BusinessRuleError("Facture sans ligne")
        invoice.lines.clear()
        db.flush()
        for index, line in enumerate(lines):
            invoice.lines.append(ClientInvoiceLine(sort_order=index, **line))
    compute_invoice(invoice)
    audit.record(
        db,
        family="business",
        module="billing",
        action="UPDATE",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        diff={"fields": sorted(values) + (["lines"] if lines is not None else []), "total": str(invoice.total)},
    )
    return invoice


def send_invoice(db: Session, invoice: ClientInvoice, *, user_id: uuid.UUID) -> ClientInvoice:
    """Émission au client : notification (espace client, e-mail, push) avec lien de paiement en ligne."""
    from app.modules.projects.models import Project

    if invoice.status != "validated":
        raise BusinessRuleError("Validez la facture avant envoi")
    invoice.status = "sent"
    invoice.sent_at = invoice.sent_at or utcnow()
    project = db.get(Project, invoice.project_id) if invoice.project_id else None
    emit(
        db,
        "client_invoice.sent",
        {
            "id": invoice.id,
            "number": invoice.number,
            "label": invoice.title,
            "amount": invoice.total,
            "due_date": invoice.due_date,
            "project_name": project.name if project else "",
            "link": "/espace-client/finances",
        },
        aggregate_type="client_invoice",
        aggregate_id=invoice.id,
        project_id=invoice.project_id,
    )
    audit.record(
        db,
        family="business",
        module="billing",
        action="SEND",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
    )
    return invoice


def cancel_invoice(db: Session, invoice: ClientInvoice, *, reason: str, user_id: uuid.UUID) -> ClientInvoice:
    """Annulation d'une facture non émise ; une facture envoyée au client s'annule par un avoir (traçabilité)."""
    if invoice.status not in ("draft", "validated"):
        raise BusinessRuleError("Facture déjà émise : établissez un avoir pour l'annuler", code="CREDIT_NOTE_REQUIRED")
    if Decimal(invoice.amount_paid or 0) > 0:
        raise BusinessRuleError("Facture partiellement réglée : établissez un avoir")
    invoice.status = "cancelled"
    invoice.notes = "\n".join(filter(None, [invoice.notes, f"Annulée : {reason}"]))
    audit.record(
        db,
        family="business",
        module="billing",
        action="CANCEL",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        reason=reason,
        criticality="MEDIUM",
    )
    return invoice


def register_supplier_credit_note(
    db: Session,
    invoice: SupplierInvoice,
    *,
    amount: Decimal,
    reason: str,
    supplier_reference: str | None,
    user_id: uuid.UUID,
) -> CreditNote:
    """Avoir fournisseur (retour, écart de prix ou de quantité) imputé sur la facture : réduit le reste à payer."""
    from app.modules.finance.payments import outstanding

    if invoice.status == "rejected":
        raise BusinessRuleError("Facture rejetée : aucun avoir à imputer")
    note = issue_credit_note(
        db,
        side="supplier",
        amount=amount,
        reason=reason,
        user_id=user_id,
        supplier_invoice=invoice,
        supplier_reference=supplier_reference,
    )
    if outstanding(invoice) <= 0 and invoice.status in ("approved_for_payment", "partially_paid", "validated"):
        invoice.status = "paid"
    return note


# ---------------------------------------------------------------------------- relances d'échéance
REMINDER_STAGES: list[tuple[str, int, str]] = [
    ("before_3", -3, "échéance dans 3 jours"),
    ("after_1", 1, "échéance dépassée"),
    ("after_7", 7, "7 jours de retard"),
    ("after_15", 15, "15 jours de retard"),
    ("after_30", 30, "30 jours de retard"),
]


def _remind(
    db: Session, invoice: ClientInvoice, *, stage: str, label: str, user_id: uuid.UUID | None
) -> PaymentReminder:
    due = money(invoice.balance_due)
    reminder = PaymentReminder(
        target_type="client_invoice", target_id=invoice.id, stage=stage, amount_due=due, sent_by_id=user_id
    )
    db.add(reminder)
    db.flush()
    from app.modules.billing.collections import create_pay_link

    _, pay_link = create_pay_link(
        db, target_type="client_invoice", target_id=invoice.id, channel="reminder", created_by_id=user_id
    )
    emit(
        db,
        "billing.payment_reminder",
        {
            "id": invoice.id,
            "number": invoice.number,
            "label": invoice.title,
            "amount": due,
            "due_date": invoice.due_date,
            "stage": stage,
            "stage_label": label,
            "link": "/espace-client/finances",
            "pay_link": pay_link,
        },
        aggregate_type="client_invoice",
        aggregate_id=invoice.id,
        project_id=invoice.project_id,
    )
    return reminder


def _reminded(db: Session, invoice_id: uuid.UUID, stage: str) -> bool:
    return (
        db.execute(
            select(PaymentReminder.id).where(
                PaymentReminder.target_type == "client_invoice",
                PaymentReminder.target_id == invoice_id,
                PaymentReminder.stage == stage,
            )
        ).first()
        is not None
    )


def send_payment_reminders(db: Session, today: date | None = None) -> dict[str, Any]:
    """Job quotidien : relances J-3, J+1, J+7, J+15, J+30 (une seule par palier et par facture, seul le palier
    courant est envoyé) ; escalade finance à J+15 (tâche de relance téléphonique). Aucune relance sur une facture
    soldée, annulée ou couverte par un avoir."""
    today = today or date.today()
    sent = escalated = 0
    invoices = db.execute(
        select(ClientInvoice).where(
            ClientInvoice.status.in_(UNPAID_STATUSES),
            ClientInvoice.due_date.is_not(None),
            ClientInvoice.deleted_at.is_(None),
        )
    ).scalars()
    from app.modules.billing.collections import has_active_plan

    for invoice in invoices:
        if invoice.balance_due <= 0 or has_active_plan(db, "client_invoice", invoice.id):
            continue  # un échéancier accepté remplace les relances de la facture (relances par échéance)
        days = (today - invoice.due_date).days
        current = [(code, label, offset) for code, offset, label in REMINDER_STAGES if days >= offset]
        if not current:
            continue
        code, label, offset = current[-1]
        if offset < 0 and days >= 0:
            continue  # jour de l'échéance : le palier « avant » est passé, le palier « après » pas encore atteint
        if _reminded(db, invoice.id, code):
            continue
        _remind(db, invoice, stage=code, label=label, user_id=None)
        sent += 1
        if code == "after_15":
            db.add(
                ActionItem(
                    title=f"Relance téléphonique — facture {invoice.number}",
                    description=f"{money(invoice.balance_due)} {invoice.currency} impayés depuis 15 jours.",
                    module="billing",
                    entity_type="client_invoice",
                    entity_id=str(invoice.id),
                    project_id=invoice.project_id,
                    assignee_role="FINANCE",
                    priority="high",
                    source="system",
                )
            )
            escalated += 1
    db.flush()
    return {"items": sent, "reminders": sent, "escalated": escalated}


def remind_now(db: Session, invoice: ClientInvoice, *, user_id: uuid.UUID) -> PaymentReminder:
    """Relance manuelle (une par jour et par facture)."""
    if invoice.status not in UNPAID_STATUSES or invoice.balance_due <= 0:
        raise BusinessRuleError("Aucun montant exigible sur cette facture")
    stage = f"manual-{date.today().isoformat()}"
    if _reminded(db, invoice.id, stage):
        raise Conflict("Client déjà relancé aujourd'hui pour cette facture", code="ALREADY_REMINDED")
    reminder = _remind(db, invoice, stage=stage, label="relance de notre service comptable", user_id=user_id)
    audit.record(
        db,
        family="business",
        module="billing",
        action="REMIND",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
    )
    return reminder


# ---------------------------------------------------------------------------- pilotage : synthèse, balance âgée, export
BUCKETS: tuple[tuple[str, int | None, int | None], ...] = (
    ("not_due", None, 0),
    ("d1_30", 1, 30),
    ("d31_60", 31, 60),
    ("d61_90", 61, 90),
    ("d90_plus", 91, None),
)


def _bucket(days_late: int) -> str:
    for name, low, high in BUCKETS:
        if low is None:
            if days_late <= 0:
                return name
        elif days_late >= low and (high is None or days_late <= high):
            return name
    return "not_due"


def aging(db: Session, *, side: str, project_ids: list[uuid.UUID] | None, as_of: date | None = None) -> dict[str, Any]:
    """Balance âgée des créances clients ou des dettes fournisseurs (reste dû par tranche de retard)."""
    from app.modules.finance.payments import outstanding

    as_of = as_of or date.today()
    if side == "client":
        stmt: Any = select(ClientInvoice).where(
            ClientInvoice.status.in_(UNPAID_STATUSES), ClientInvoice.deleted_at.is_(None)
        )
        project_col = ClientInvoice.project_id
    else:
        stmt = select(SupplierInvoice).where(
            SupplierInvoice.status.in_(("matched", "exception", "validated", "approved_for_payment", "partially_paid")),
            SupplierInvoice.deleted_at.is_(None),
        )
        project_col = SupplierInvoice.project_id
    if project_ids is not None:
        stmt = stmt.where(project_col.in_(project_ids))
    totals = {name: Decimal("0") for name, *_ in BUCKETS}
    parties: dict[str, dict[str, Any]] = {}
    for doc in db.execute(stmt).scalars():
        due = outstanding(doc)
        if due <= 0:
            continue
        reference_date = doc.due_date or getattr(doc, "issue_date", None) or getattr(doc, "invoice_date", None)
        bucket = _bucket((as_of - reference_date).days if reference_date else 0)
        totals[bucket] += due
        key = str(getattr(doc, "organization_id", None) or getattr(doc, "supplier_id", None) or "")
        row = parties.setdefault(
            key, {"party_id": key or None, "total": Decimal("0"), **{n: Decimal("0") for n, *_ in BUCKETS}}
        )
        row[bucket] += due
        row["total"] += due
    labels = _party_labels(db, side, [k for k in parties if k])
    rows = sorted(parties.values(), key=lambda r: r["total"], reverse=True)[:50]
    for row in rows:
        row["party"] = labels.get(row["party_id"] or "", "Sans tiers")
    return jsonable(
        {"side": side, "as_of": as_of, "totals": {**totals, "total": sum(totals.values(), Decimal("0"))}, "rows": rows}
    )


def _party_labels(db: Session, side: str, ids: list[str]) -> dict[str, str]:
    valid = [uuid.UUID(value) for value in ids]
    if not valid:
        return {}
    if side == "client":
        from app.modules.identity.models import Organization

        rows = db.execute(select(Organization.id, Organization.name).where(Organization.id.in_(valid))).all()
    else:
        rows = db.execute(select(Supplier.id, Supplier.legal_name).where(Supplier.id.in_(valid))).all()
    return {str(i): name for i, name in rows}


def summary(db: Session, *, project_ids: list[uuid.UUID] | None) -> dict[str, Any]:
    """Indicateurs de facturation : émis / encaissé du mois, créances, retards, factures en anomalie, dettes."""
    from app.modules.finance.models import Payment
    from app.modules.finance.payments import outstanding

    today = date.today()
    month_start = today.replace(day=1)

    def scoped(stmt: Any, column: Any) -> Any:
        return stmt.where(column.in_(project_ids)) if project_ids is not None else stmt

    issued = db.execute(
        scoped(
            select(func.coalesce(func.sum(ClientInvoice.total), 0)).where(
                ClientInvoice.issue_date >= month_start,
                ClientInvoice.status.not_in(("draft", "cancelled")),
                ClientInvoice.deleted_at.is_(None),
            ),
            ClientInvoice.project_id,
        )
    ).scalar_one()
    collected = db.execute(
        scoped(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.direction == "in", Payment.status == "succeeded", Payment.paid_at >= month_start
            ),
            Payment.project_id,
        )
    ).scalar_one()
    open_invoices = (
        db.execute(
            scoped(
                select(ClientInvoice).where(
                    ClientInvoice.status.in_(UNPAID_STATUSES), ClientInvoice.deleted_at.is_(None)
                ),
                ClientInvoice.project_id,
            )
        )
        .scalars()
        .all()
    )
    overdue = [i for i in open_invoices if i.due_date and i.due_date < today and outstanding(i) > 0]
    supplier_open = (
        db.execute(
            scoped(
                select(SupplierInvoice).where(
                    SupplierInvoice.status.not_in(("paid", "rejected")), SupplierInvoice.deleted_at.is_(None)
                ),
                SupplierInvoice.project_id,
            )
        )
        .scalars()
        .all()
    )
    return jsonable(
        {
            "month_start": month_start,
            "issued_this_month": money(Decimal(issued)),
            "collected_this_month": money(Decimal(collected)),
            "receivables": money(sum((outstanding(i) for i in open_invoices), Decimal("0"))),
            "overdue_amount": money(sum((outstanding(i) for i in overdue), Decimal("0"))),
            "overdue_count": len(overdue),
            "supplier_exceptions": sum(1 for i in supplier_open if i.status == "exception"),
            "supplier_to_validate": sum(1 for i in supplier_open if i.status in ("received", "matching", "matched")),
            "supplier_payables": money(sum((outstanding(i) for i in supplier_open), Decimal("0"))),
        }
    )


CLIENT_COLUMNS = ["Date", "Numéro", "Client", "Projet", "Objet", "HT", "TVA", "TTC", "Réglé", "Avoirs", "Solde"]
SUPPLIER_COLUMNS = ["Date", "Numéro interne", "N° fournisseur", "Fournisseur", "Projet", "HT", "TVA", "TTC"]


def export_journal(
    db: Session, *, kind: str, date_from: date, date_to: date, project_ids: list[uuid.UUID] | None
) -> str:
    """Journal des ventes ou des achats (CSV « ; » UTF-8 avec BOM, ouvert directement par Excel) — comptabilité."""
    from app.modules.finance.payments import outstanding
    from app.modules.identity.models import Organization
    from app.modules.projects.models import Project

    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer, delimiter=";")
    if kind == "client":
        writer.writerow([*CLIENT_COLUMNS, "Échéance", "Statut"])
        stmt: Any = select(ClientInvoice).where(
            ClientInvoice.issue_date.between(date_from, date_to),
            ClientInvoice.status.not_in(("draft", "cancelled")),
            ClientInvoice.deleted_at.is_(None),
        )
        if project_ids is not None:
            stmt = stmt.where(ClientInvoice.project_id.in_(project_ids))
        for inv in db.execute(stmt.order_by(ClientInvoice.issue_date, ClientInvoice.number)).scalars():
            org = db.get(Organization, inv.organization_id) if inv.organization_id else None
            project = db.get(Project, inv.project_id) if inv.project_id else None
            writer.writerow(
                [
                    inv.issue_date.isoformat(),
                    inv.number,
                    org.name if org else "",
                    project.code if project else "",
                    inv.title,
                    _fr(inv.subtotal),
                    _fr(inv.tax_amount),
                    _fr(inv.total),
                    _fr(inv.amount_paid),
                    _fr(inv.amount_credited),
                    _fr(outstanding(inv)),
                    inv.due_date.isoformat() if inv.due_date else "",
                    inv.status,
                ]
            )
        return buffer.getvalue()
    writer.writerow([*SUPPLIER_COLUMNS, "Réglé", "Avoirs", "Solde", "Échéance", "Statut"])
    stmt = select(SupplierInvoice).where(
        SupplierInvoice.invoice_date.between(date_from, date_to), SupplierInvoice.deleted_at.is_(None)
    )
    if project_ids is not None:
        stmt = stmt.where(SupplierInvoice.project_id.in_(project_ids))
    for inv in db.execute(stmt.order_by(SupplierInvoice.invoice_date, SupplierInvoice.number)).scalars():
        supplier = db.get(Supplier, inv.supplier_id)
        project = db.get(Project, inv.project_id) if inv.project_id else None
        writer.writerow(
            [
                inv.invoice_date.isoformat(),
                inv.number,
                inv.supplier_reference,
                supplier.legal_name if supplier else "",
                project.code if project else "",
                _fr(inv.subtotal),
                _fr(inv.tax_amount),
                _fr(inv.total),
                _fr(inv.amount_paid),
                _fr(inv.amount_credited),
                _fr(outstanding(inv)),
                inv.due_date.isoformat() if inv.due_date else "",
                inv.status,
            ]
        )
    return buffer.getvalue()


def _fr(value: Any) -> str:
    return f"{Decimal(value or 0):.2f}".replace(".", ",")
