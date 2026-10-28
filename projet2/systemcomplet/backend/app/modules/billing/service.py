"""Facturation (§16, §8.1 étapes 39-41) : factures clients (brouillon → validation → envoi → encaissement), avoirs
clients et fournisseurs, factures fournisseurs et rapprochement 3 pièces PO / GRN / facture avec tolérances,
validation finance, relances d'échéance, balance âgée, export comptable."""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, Conflict
from app.core.events import emit
from app.core.numbering import next_number
from app.core.security import random_token
from app.core.utils import money, qty, utcnow
from app.modules.billing.models import (
    ClientInvoice,
    CreditNote,
    InvoiceMatch,
    SupplierInvoice,
    SupplierInvoiceLine,
)
from app.modules.procurement.models import GoodsReceipt, PurchaseOrder, PurchaseOrderLine
from app.modules.suppliers.models import Supplier, SupplierIncident
from app.modules.system.models import ActionItem

log = logging.getLogger("globus.billing")


# ---------------------------------------------------------------------------- factures clients & avoirs
def compute_invoice(invoice: ClientInvoice) -> None:
    subtotal = Decimal("0")
    for line in invoice.lines:
        line.total = money(Decimal(line.quantity) * Decimal(line.unit_price))
        subtotal += line.total
    invoice.subtotal = money(subtotal)
    invoice.tax_amount = money(subtotal * Decimal(invoice.tax_rate or 0) / 100)
    invoice.total = money(subtotal + invoice.tax_amount)


INVOICE_TITLES = {
    "deposit": "FACTURE D'ACOMPTE",
    "progress": "FACTURE DE SITUATION",
    "final": "FACTURE DE SOLDE",
    "studies": "FACTURE D'ÉTUDES",
}


def invoice_pdf(db: Session, invoice: ClientInvoice) -> None:
    from app.core.files import store_generated
    from app.core.pdf import (
        PdfDocument,
        amount_in_words,
        company_party,
        fmt_date,
        fmt_money,
        fmt_qty,
        organization_lines,
        project_label,
        render,
    )
    from app.modules.crm.models import Contract
    from app.modules.identity.models import Organization
    from app.modules.projects.models import Project

    org = db.get(Organization, invoice.organization_id) if invoice.organization_id else None
    project = db.get(Project, invoice.project_id) if invoice.project_id else None
    contract = db.get(Contract, invoice.contract_id) if invoice.contract_id else None
    settled = Decimal(invoice.amount_paid or 0) + Decimal(invoice.amount_credited or 0)
    balance = [
        ("Déjà réglé", fmt_money(invoice.amount_paid, invoice.currency)),
        *(
            [("Avoirs imputés", fmt_money(invoice.amount_credited, invoice.currency))]
            if invoice.amount_credited
            else []
        ),
        ("Reste à payer", fmt_money(max(Decimal(invoice.total or 0) - settled, Decimal(0)), invoice.currency)),
    ]
    doc = PdfDocument(
        title=INVOICE_TITLES.get(invoice.kind, "FACTURE"),
        number=invoice.number,
        issued_on=invoice.issue_date,
        parties=[("Client", organization_lines(org)), company_party()],
        meta=[
            ("Objet", invoice.title),
            ("Projet", project_label(project)),
            *([("Contrat", f"{contract.number} — {contract.title}")] if contract else []),
            ("Date d'émission", fmt_date(invoice.issue_date)),
            ("Échéance", fmt_date(invoice.due_date)),
            ("Devise", "Franc CFA (XAF)" if invoice.currency == "XAF" else invoice.currency),
        ],
        columns=["Désignation", "Unité", "Qté", "PU HT", "Total HT"],
        col_widths=[230, 50, 40, 80, 90],
        rows=[
            [
                li.designation,
                li.unit,
                fmt_qty(li.quantity),
                fmt_money(li.unit_price, invoice.currency),
                fmt_money(li.total, invoice.currency),
            ]
            for li in invoice.lines
        ],
        totals=[
            ("Total HT", fmt_money(invoice.subtotal, invoice.currency)),
            (f"TVA {fmt_qty(invoice.tax_rate)} %", fmt_money(invoice.tax_amount, invoice.currency)),
            ("Total TTC", fmt_money(invoice.total, invoice.currency)),
            *(balance if settled else []),
        ],
        amount_words=amount_in_words(invoice.total, invoice.currency),
        amount_words_label="Arrêtée la présente facture à la somme de",
        paragraphs=[
            (
                "Modalités de paiement",
                f"Règlement avant le {fmt_date(invoice.due_date)} en rappelant la référence {invoice.number} : "
                "paiement en ligne (Mobile Money, carte) depuis votre espace client GLOBUS, ou virement bancaire. "
                "Un reçu vous est remis à chaque règlement.",
            ),
            *([("Observations", invoice.notes)] if invoice.notes else []),
        ],
        signature_blocks=["Pour GLOBUS ENGINEERING — la Direction financière"],
        verify_token=invoice.authenticity_token,
        footer_note="Facture authentifiable : scannez le QR code ou saisissez la référence sur notre site.",
    )
    stored = store_generated(
        db,
        render(doc),
        filename=f"{invoice.number}.pdf",
        mime="application/pdf",
        purpose="invoices",
        classification="confidential",
    )
    invoice.pdf_file_id = stored.id


def validate_invoice(db: Session, invoice: ClientInvoice, *, user_id: uuid.UUID) -> ClientInvoice:
    if invoice.status != "draft":
        raise BusinessRuleError("Facture déjà validée")
    if not invoice.lines:
        raise BusinessRuleError("Facture sans ligne")
    compute_invoice(invoice)
    invoice.status = "validated"
    invoice.validated_by_id = user_id
    invoice.validated_at = utcnow()
    invoice.authenticity_token = invoice.authenticity_token or random_token(24)
    invoice_pdf(db, invoice)
    audit.record(
        db,
        family="business",
        module="billing",
        action="VALIDATE",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        diff={"total": str(invoice.total)},
        criticality="MEDIUM",
    )
    return invoice


def issue_credit_note(
    db: Session,
    *,
    side: str,
    amount: Decimal,
    reason: str,
    user_id: uuid.UUID,
    client_invoice: ClientInvoice | None = None,
    supplier_invoice: SupplierInvoice | None = None,
    supplier_id: uuid.UUID | None = None,
    supplier_reference: str | None = None,
) -> CreditNote:
    amount = money(amount)
    if amount <= 0:
        raise BusinessRuleError("Montant d'avoir invalide")
    note = CreditNote(
        number=next_number(db, "credit_note"),
        side=side,
        amount=amount,
        reason=reason,
        issue_date=date.today(),
        created_by_id=user_id,
        supplier_id=supplier_id,
        supplier_reference=supplier_reference,
    )
    if client_invoice is not None:
        from app.modules.finance.payments import outstanding

        if amount > outstanding(client_invoice) + Decimal(client_invoice.amount_paid or 0):
            raise BusinessRuleError("Avoir supérieur au montant facturé")
        note.client_invoice_id = client_invoice.id
        note.project_id = client_invoice.project_id
        client_invoice.amount_credited = money(Decimal(client_invoice.amount_credited or 0) + amount)
        if Decimal(client_invoice.amount_credited) >= Decimal(client_invoice.total):
            client_invoice.status = "credited"
    if supplier_invoice is not None:
        from app.modules.finance.payments import outstanding

        if amount > outstanding(supplier_invoice):
            raise BusinessRuleError("Avoir supérieur au reste à payer de la facture fournisseur")
        note.supplier_invoice_id = supplier_invoice.id
        note.supplier_id = supplier_invoice.supplier_id
        note.project_id = supplier_invoice.project_id
        supplier_invoice.amount_credited = money(Decimal(supplier_invoice.amount_credited or 0) + amount)
    db.add(note)
    db.flush()
    audit.record(
        db,
        family="business",
        module="billing",
        action="CREDIT_NOTE",
        resource_type="credit_note",
        resource_id=note.id,
        project_id=note.project_id,
        diff={"amount": str(amount), "side": side},
        reason=reason,
        criticality="MEDIUM",
    )
    return note


# ============================================================================ facture & rapprochement 3 pièces
def ensure_new_invoice(db: Session, supplier_id: uuid.UUID, reference: str) -> None:
    existing = db.execute(
        select(SupplierInvoice.id).where(
            SupplierInvoice.supplier_id == supplier_id, SupplierInvoice.supplier_reference == reference
        )
    ).first()
    if existing is not None:
        raise Conflict("Facture déjà enregistrée pour ce fournisseur (doublon)", code="DUPLICATE_INVOICE")


def register_supplier_invoice(
    db: Session,
    *,
    supplier_id: uuid.UUID,
    reference: str,
    po_id: uuid.UUID | None,
    invoice_date: date,
    due_date: date | None,
    lines: list[dict[str, Any]],
    tax_amount: Decimal,
    file_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    source: str = "manual",
) -> SupplierInvoice:
    ensure_new_invoice(db, supplier_id, reference)
    po = db.get(PurchaseOrder, po_id) if po_id else None
    if po is not None and po.supplier_id != supplier_id:
        raise BusinessRuleError("Le bon de commande appartient à un autre fournisseur")
    supplier = db.get(Supplier, supplier_id)
    invoice = SupplierInvoice(
        number=next_number(db, "supplier_invoice"),
        supplier_reference=reference,
        supplier_id=supplier_id,
        purchase_order_id=po.id if po else None,
        project_id=po.project_id if po else None,
        invoice_date=invoice_date,
        due_date=due_date or invoice_date + timedelta(days=supplier.payment_terms_days if supplier else 30),
        tax_amount=money(tax_amount),
        status="received",
        file_id=file_id,
        source=source,
    )
    subtotal = Decimal("0")
    for raw in lines:
        total = money(Decimal(str(raw["quantity"])) * Decimal(str(raw["unit_price"])))
        invoice.lines.append(
            SupplierInvoiceLine(
                po_line_id=raw.get("po_line_id"),
                description=raw["description"],
                quantity=qty(raw["quantity"]),
                unit_price=money(raw["unit_price"]),
                total=total,
            )
        )
        subtotal += total
    invoice.subtotal = money(subtotal)
    invoice.total = money(subtotal + Decimal(tax_amount))
    db.add(invoice)
    db.flush()
    audit.record(
        db,
        family="business",
        module="billing",
        action="RECEIVE",
        resource_type="supplier_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        actor_type="user" if user_id else "supplier",
        diff={"reference": reference, "total": str(invoice.total)},
    )
    return invoice


def match_settings(db: Session) -> tuple[Decimal, Decimal]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "three_way_match")
    value = row.value if row else {}
    return Decimal(str(value.get("qty_tolerance_pct", 0))), Decimal(str(value.get("price_tolerance_pct", 2)))


def three_way_match(db: Session, invoice: SupplierInvoice, *, user_id: uuid.UUID | None) -> InvoiceMatch:
    """Rapprochement BC / bons de réception / facture avec tolérances (V4-SUP-13)."""
    qty_tol, price_tol = match_settings(db)
    po = db.get(PurchaseOrder, invoice.purchase_order_id) if invoice.purchase_order_id else None
    exceptions: list[dict[str, Any]] = []
    line_results: list[dict[str, Any]] = []
    grn_ids: list[str] = []
    received_total = Decimal("0")
    if po is None:
        exceptions.append({"type": "no_po", "message": "Facture sans bon de commande"})
    else:
        grns = (
            db.execute(
                select(GoodsReceipt).where(GoodsReceipt.purchase_order_id == po.id, GoodsReceipt.status == "validated")
            )
            .scalars()
            .all()
        )
        grn_ids = [str(g.id) for g in grns]
        if not grns:
            exceptions.append({"type": "missing_grn", "message": "Aucune réception validée pour ce bon de commande"})
        po_lines = {li.id: li for li in po.lines}
        previous_invoiced: dict[uuid.UUID, Decimal] = {}
        for other in db.execute(
            select(SupplierInvoice).where(
                SupplierInvoice.purchase_order_id == po.id,
                SupplierInvoice.id != invoice.id,
                SupplierInvoice.status.not_in(["rejected"]),
            )
        ).scalars():
            for ol in other.lines:
                if ol.po_line_id:
                    previous_invoiced[ol.po_line_id] = previous_invoiced.get(ol.po_line_id, Decimal("0")) + Decimal(
                        ol.quantity
                    )
        for inv_line in invoice.lines:
            po_line = po_lines.get(inv_line.po_line_id) if inv_line.po_line_id else None
            if po_line is None:
                exceptions.append(
                    {
                        "type": "unknown_line",
                        "line": inv_line.description,
                        "message": "Ligne facturée absente du bon de commande",
                    }
                )
                continue
            accepted = Decimal(po_line.quantity_accepted)
            received_total += accepted * Decimal(po_line.unit_price)
            invoiced_qty = previous_invoiced.get(po_line.id, Decimal("0")) + Decimal(inv_line.quantity)
            qty_limit = accepted * (1 + qty_tol / 100)
            price_limit = Decimal(po_line.unit_price) * (1 + price_tol / 100)
            status = "ok"
            if invoiced_qty > qty_limit:
                status = "qty_exceeds_received"
                exceptions.append(
                    {
                        "type": "qty_variance",
                        "line": inv_line.description,
                        "invoiced": str(invoiced_qty),
                        "received": str(accepted),
                    }
                )
            if Decimal(inv_line.unit_price) > price_limit:
                status = "price_variance"
                exceptions.append(
                    {
                        "type": "price_variance",
                        "line": inv_line.description,
                        "invoice_price": str(inv_line.unit_price),
                        "po_price": str(po_line.unit_price),
                    }
                )
            line_results.append(
                {
                    "po_line_id": str(po_line.id),
                    "description": po_line.description,
                    "ordered": str(po_line.quantity),
                    "received": str(accepted),
                    "invoiced": str(invoiced_qty),
                    "po_price": str(po_line.unit_price),
                    "invoice_price": str(inv_line.unit_price),
                    "status": status,
                }
            )
        if Decimal(invoice.subtotal) > Decimal(po.subtotal) * (1 + price_tol / 100):
            exceptions.append(
                {
                    "type": "invoice_above_po",
                    "message": "Montant facturé supérieur au bon de commande",
                    "invoice": str(invoice.subtotal),
                    "po": str(po.subtotal),
                }
            )
    result = "matched" if not exceptions else "exception"
    match = InvoiceMatch(
        supplier_invoice_id=invoice.id,
        purchase_order_id=po.id if po else None,
        goods_receipt_ids=grn_ids,
        result=result,
        tolerance_qty_pct=qty_tol,
        tolerance_price_pct=price_tol,
        line_results=line_results,
        exceptions=exceptions,
        po_total=po.subtotal if po else Decimal("0"),
        received_total=money(received_total),
        invoice_total=invoice.subtotal,
        performed_by_id=user_id,
    )
    db.add(match)
    db.flush()
    invoice.match_status = result
    invoice.match_id = match.id
    invoice.status = "matched" if result == "matched" else "exception"
    if result == "matched":
        for inv_line in invoice.lines:
            if inv_line.po_line_id:
                po_line = db.get(PurchaseOrderLine, inv_line.po_line_id)
                if po_line:
                    po_line.quantity_invoiced = qty(Decimal(po_line.quantity_invoiced) + Decimal(inv_line.quantity))
        if po and all(Decimal(li.quantity_invoiced) >= Decimal(li.quantity_accepted) for li in po.lines):
            po.status = "invoiced"
        emit(
            db,
            "supplier_invoice.matched",
            {"id": invoice.id, "number": invoice.number},
            aggregate_type="supplier_invoice",
            aggregate_id=invoice.id,
            project_id=invoice.project_id,
        )
    else:
        summary = "; ".join(e["type"] for e in exceptions)
        db.add(
            ActionItem(
                title=f"Facture {invoice.number} en anomalie",
                description=summary,
                module="billing",
                entity_type="supplier_invoice",
                entity_id=str(invoice.id),
                project_id=invoice.project_id,
                assignee_role="FINANCE",
                priority="high",
            )
        )
        if invoice.supplier_id:
            db.add(
                SupplierIncident(
                    supplier_id=invoice.supplier_id,
                    kind="invoice",
                    purchase_order_id=po.id if po else None,
                    description=summary,
                    created_by_id=user_id,
                )
            )
        emit(
            db,
            "supplier_invoice.match_exception",
            {"id": invoice.id, "number": invoice.number, "summary": summary},
            aggregate_type="supplier_invoice",
            aggregate_id=invoice.id,
            project_id=invoice.project_id,
        )
    audit.record(
        db,
        family="business",
        module="billing",
        action="THREE_WAY_MATCH",
        resource_type="supplier_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        diff={"result": result, "exceptions": [e["type"] for e in exceptions]},
        criticality="MEDIUM" if exceptions else "LOW",
    )
    return match


def resolve_match_exception(
    db: Session, invoice: SupplierInvoice, *, user_id: uuid.UUID, decision: str, justification: str
) -> SupplierInvoice:
    """Dérogation explicite d'un responsable (traçée) ou rejet de la facture."""
    if invoice.status != "exception":
        raise BusinessRuleError("Facture sans anomalie de rapprochement")
    match = db.get(InvoiceMatch, invoice.match_id) if invoice.match_id else None
    if decision == "accept":
        if len(justification) < 15:
            raise BusinessRuleError("Justification détaillée requise pour une dérogation")
        invoice.status = "matched"
        if match:
            match.resolved_by_id = user_id
            match.resolved_at = utcnow()
            match.resolution = f"Dérogation : {justification}"
        for inv_line in invoice.lines:
            if inv_line.po_line_id:
                po_line = db.get(PurchaseOrderLine, inv_line.po_line_id)
                if po_line:
                    po_line.quantity_invoiced = qty(Decimal(po_line.quantity_invoiced) + Decimal(inv_line.quantity))
    elif decision == "reject":
        invoice.status = "rejected"
        if match:
            match.resolved_by_id = user_id
            match.resolved_at = utcnow()
            match.resolution = f"Rejet : {justification}"
    else:
        raise BusinessRuleError("Décision inconnue (accept / reject)")
    audit.record(
        db,
        family="business",
        module="billing",
        action="MATCH_RESOLUTION",
        resource_type="supplier_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        reason=justification,
        diff={"decision": decision},
        criticality="HIGH",
    )
    return invoice


def finance_validate(db: Session, invoice: SupplierInvoice, *, user_id: uuid.UUID) -> SupplierInvoice:
    """Validation finance (§8.1 étape 39) : la facture devient payable et la dépense est constatée."""
    from app.modules.finance.service import record_expense

    if invoice.status != "matched":
        raise BusinessRuleError(
            "Le rapprochement 3 pièces doit être conforme (ou dérogé) avant validation", code="MATCH_REQUIRED"
        )
    invoice.status = "approved_for_payment"
    invoice.validated_by_id = user_id
    invoice.validated_at = utcnow()
    po = db.get(PurchaseOrder, invoice.purchase_order_id) if invoice.purchase_order_id else None
    # Marchandise entrée en stock = actif (coût imputé au chantier à la sortie de stock, au CMUP) ;
    # affectation directe au chantier = charge du projet dès la validation de la facture.
    stock_share = Decimal("0")
    if po is not None:
        values = {"stock": Decimal("0"), "site": Decimal("0")}
        for grn in db.execute(
            select(GoodsReceipt).where(GoodsReceipt.purchase_order_id == po.id, GoodsReceipt.status == "validated")
        ).scalars():
            key = "stock" if grn.destination == "stock" else "site"
            values[key] += sum(
                (Decimal(li.quantity_accepted) * Decimal(li.unit_price) for li in grn.lines), Decimal("0")
            )
        received = values["stock"] + values["site"]
        if received > 0:
            stock_share = values["stock"] / received
    project_amount = money(Decimal(invoice.subtotal) * (1 - stock_share))
    if invoice.project_id and project_amount > 0:
        record_expense(
            db,
            project_id=invoice.project_id,
            lot_id=po.lot_id if po else None,
            category="materiaux",
            label=f"Facture {invoice.supplier_reference}",
            amount=project_amount,
            expense_date=invoice.invoice_date,
            source_type="supplier_invoice",
            source_id=invoice.id,
            user_id=user_id,
            file_id=invoice.file_id,
            commitment_source=("purchase_order", po.id) if po else None,
            client_visible=True,
        )
    if po is not None and stock_share > 0:
        from app.modules.finance.service import consume_commitment

        consume_commitment(
            db, source_type="purchase_order", source_id=po.id, amount=money(Decimal(invoice.subtotal) - project_amount)
        )
    audit.record(
        db,
        family="business",
        module="billing",
        action="FINANCE_VALIDATE",
        resource_type="supplier_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        criticality="MEDIUM",
    )
    return invoice
