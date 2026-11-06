"""Documents émis signables à la main : pour chaque nature (devis, contrat, facture, reçu…), comment retrouver
l'enregistrement, rendre son PDF à jour, conserver la nouvelle édition, qui peut signer (entreprise, client) et ce que
la signature déclenche.

Le PDF est toujours rendu par `documents.seals.sealed_pdf` : cachet de l'entreprise, signatures valables et empreinte
du contenu (`DocumentSeal.content_hash`) y sont gérés de façon uniforme.
"""

from __future__ import annotations

import importlib
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

COMPANY = "company"
CLIENT = "client"


@dataclass(frozen=True)
class Signable:
    kind: str  # nature du sceau (DocumentSeal.kind) = Signature.entity_type
    label: str
    model: str  # « module:Classe » de l'enregistrement d'origine
    entity_type: str  # DocumentSeal.entity_type
    render: Callable[[Session, Any], bytes]
    erp_link: str  # page ERP du document ({id})
    reference: Callable[[Any], str]
    title: Callable[[Any], str]
    read_perm: str  # consulter le document dans l'ERP
    persist: Callable[[Session, Any, bytes], None] | None = None  # remplace le PDF conservé (s'il existe)
    company_block: Callable[[Session, Any], str | None] = lambda db, entity: None  # raison de refus, sinon None
    client_block: Callable[[Session, Any], str | None] | None = None  # None = le client ne signe pas ce document
    client_scope: Callable[[Any, Any], bool] | None = None  # (access, entity) → document du client ?
    contact: Callable[[Session, Any], tuple[str | None, str | None]] | None = None  # (nom, e-mail) du client
    on_signed: Callable[[Session, Any, Any], None] | None = None  # (db, entity, signature)

    @property
    def parties(self) -> tuple[str, ...]:
        return (CLIENT, COMPANY) if self.client_block is not None else (COMPANY,)

    def load(self, db: Session, entity_id: uuid.UUID) -> Any:
        module, name = self.model.split(":")
        entity = db.get(getattr(importlib.import_module(module), name), entity_id)
        if entity is None or getattr(entity, "deleted_at", None) is not None:
            return None
        return entity


def _store(db: Session, data: bytes, *, filename: str, purpose: str, classification: str = "confidential") -> Any:
    from app.core.files import store_generated

    return store_generated(
        db, data, filename=filename, mime="application/pdf", purpose=purpose, classification=classification
    )


def _client_owns(access: Any, entity: Any) -> bool:
    """Document d'un projet du client, ou de son organisation."""
    if access.p.is_internal or not access.has("client:portal"):
        return False
    project_id = getattr(entity, "project_id", None)
    if project_id and access.can_access_project(project_id):
        return True
    org_id = getattr(entity, "organization_id", None)
    return bool(org_id and access.p.organization_id and org_id == access.p.organization_id)


def _contact(db: Session, entity: Any) -> tuple[str | None, str | None]:
    from app.modules.crm.models import Contact

    contact = db.get(Contact, entity.contact_id) if getattr(entity, "contact_id", None) else None
    if contact is None:
        return None, None
    return f"{contact.first_name} {contact.last_name or ''}".strip(), contact.email


# ------------------------------------------------------------------------------------------------ devis
def _quote_render(db: Session, quote: Any) -> bytes:
    from app.modules.crm.service import quote_pdf

    return quote_pdf(db, quote)


def _quote_persist(db: Session, quote: Any, data: bytes) -> None:
    if quote.pdf_file_id:  # devis déjà envoyé : la pièce jointe et le lien public servent la nouvelle édition
        quote.pdf_file_id = _store(db, data, filename=f"{quote.number}-r{quote.revision}.pdf", purpose="quotes").id


def _quote_company(db: Session, quote: Any) -> str | None:
    if quote.status in ("superseded", "rejected", "expired"):
        return "Devis remplacé, refusé ou expiré : il ne peut plus être signé"
    return None


def _quote_client(db: Session, quote: Any) -> str | None:
    if quote.status == "accepted":
        return "Devis déjà accepté"
    if quote.status not in ("sent", "viewed"):
        return "Ce devis n'est pas (ou plus) ouvert à l'acceptation"
    if quote.valid_until and quote.valid_until < date.today():
        return "Devis expiré : demandez une nouvelle proposition"
    return None


def _quote_signed(db: Session, quote: Any, signature: Any) -> None:
    """Signature du client = acceptation du devis (« Bon pour accord »)."""
    from app.modules.crm.service import accept_quote

    if signature.party != CLIENT:
        return
    cert = signature.certificate or {}
    accept_quote(
        db,
        quote,
        accepted_by_name=signature.signer_name,
        proof={
            "method": "signature_manuscrite_otp",
            "signature_id": str(signature.id),
            "email": signature.signer_email,
            "otp_channel": signature.otp_channel,
            "otp_verified_at": cert.get("otp_verified_at"),
            "ip": signature.ip,
            "user_agent": signature.user_agent,
            "content_hash": signature.signed_hash,
            "total": str(quote.total),
            "revision": quote.revision,
        },
    )


# ------------------------------------------------------------------------------------------------ contrat client
def _contract_render(db: Session, contract: Any) -> bytes:
    from app.modules.crm.service import contract_pdf

    return contract_pdf(db, contract)


def _contract_company(db: Session, contract: Any) -> str | None:
    return "Contrat annulé" if contract.status == "cancelled" else None


def _contract_client(db: Session, contract: Any) -> str | None:
    if contract.status == "draft":
        return "Contrat pas encore envoyé pour signature"
    if contract.status != "sent":
        return "Contrat déjà signé ou clos"
    return None


def _contract_signed(db: Session, contract: Any, signature: Any) -> None:
    """Contrat signé dès que le client ET GLOBUS ENGINEERING ont signé le même contenu."""
    from app.modules.crm.service import sign_contract
    from app.modules.documents.seals import signatures_of

    if contract.status not in ("draft", "sent"):
        return
    latest: dict[str, Any] = {}
    for sig in signatures_of(db, kind="contract", entity_id=contract.id):
        latest.setdefault(sig.party, sig)
    client, company = latest.get(CLIENT), latest.get(COMPANY)
    if client is None or company is None or client.signed_hash != company.signed_hash:
        return
    sign_contract(
        db,
        contract,
        signed_by_name=client.signer_name,
        proof={
            "method": "electronique",
            "signatures": {
                CLIENT: {"id": str(client.id), "name": client.signer_name, "email": client.signer_email},
                COMPANY: {"id": str(company.id), "name": company.signer_name},
            },
            "content_hash": client.signed_hash,
            "signed_on": date.today().isoformat(),
        },
        user_id=company.signer_id,
    )


# ------------------------------------------------------------------------------------------------ factures
def _invoice_render(db: Session, invoice: Any) -> bytes:
    from app.modules.billing.service import invoice_bytes

    return invoice_bytes(db, invoice)


def _invoice_persist(db: Session, invoice: Any, data: bytes) -> None:
    from app.modules.billing.service import invoice_pdf

    invoice_pdf(db, invoice, data)


def _invoice_company(db: Session, invoice: Any) -> str | None:
    if invoice.status == "draft":
        return "Facture encore en proforma : validez-la d'abord (ou signez la proforma)"
    return "Facture annulée" if invoice.status == "cancelled" else None


def _proforma_render(db: Session, invoice: Any) -> bytes:
    from app.modules.billing.service import proforma_pdf

    return proforma_pdf(db, invoice)


def _proforma_company(db: Session, invoice: Any) -> str | None:
    return None if invoice.status == "draft" else "Proforma remplacée par la facture définitive"


def _credit_render(db: Session, note: Any) -> bytes:
    from app.core.errors import BusinessRuleError
    from app.modules.billing.service import credit_note_bytes

    data = credit_note_bytes(db, note)
    if data is None:
        raise BusinessRuleError("Avoir sans facture d'origine : aucun PDF à signer")
    return data


def _credit_persist(db: Session, note: Any, data: bytes) -> None:
    from app.modules.billing.service import credit_note_pdf

    credit_note_pdf(db, note, data)


# ------------------------------------------------------------------------------------------------ reçus
def _receipt_render(db: Session, payment: Any) -> bytes:
    from app.modules.finance.payments import receipt_bytes

    return receipt_bytes(db, payment)


def _receipt_persist(db: Session, payment: Any, data: bytes) -> None:
    from app.modules.finance.payments import _receipt

    _receipt(db, payment, data)


def _receipt_company(db: Session, payment: Any) -> str | None:
    return None if payment.receipt_file_id else "Reçu pas encore émis (paiement non confirmé)"


# ---------------------------------------------------------------------------------------- achats, sous-traitance
def _po_render(db: Session, po: Any) -> bytes:
    from app.modules.procurement.service import po_pdf

    return po_pdf(db, po)


def _po_persist(db: Session, po: Any, data: bytes) -> None:
    if po.pdf_file_id:
        po.pdf_file_id = _store(db, data, filename=f"{po.number}.pdf", purpose="purchase_orders").id


def _po_company(db: Session, po: Any) -> str | None:
    if po.status in ("draft", "pending_approval", "rejected", "cancelled"):
        return "Bon de commande non approuvé ou annulé"
    return None


def _subcontract_render(db: Session, contract: Any) -> bytes:
    from app.modules.subcontracting.service import contract_pdf

    return contract_pdf(db, contract)


def _subcontract_persist(db: Session, contract: Any, data: bytes) -> None:
    if contract.document_id:
        contract.document_id = _store(db, data, filename=f"{contract.number}.pdf", purpose="subcontracts").id


def _subcontract_company(db: Session, contract: Any) -> str | None:
    return "Marché résilié" if contract.status == "terminated" else None


# ---------------------------------------------------------------------------------- paie, rapports, passeport
def _payslip_run(db: Session, item: Any) -> Any:
    from app.modules.hr.models import PayrollRun

    return db.get(PayrollRun, item.run_id)


def _payslip_render(db: Session, item: Any) -> bytes:
    from app.modules.hr.service import payslip_pdf

    return payslip_pdf(db, _payslip_run(db, item), item)


def _payslip_persist(db: Session, item: Any, data: bytes) -> None:
    from sqlalchemy import select

    from app.modules.hr.models import HRDocument

    if not item.payslip_file_id:
        return
    run = _payslip_run(db, item)
    stored = _store(
        db, data, filename=f"bulletin-{run.period}.pdf", purpose="payslips", classification="very_sensitive"
    )
    for doc in db.execute(select(HRDocument).where(HRDocument.file_id == item.payslip_file_id)).scalars():
        doc.file_id = stored.id  # dossier du salarié : bulletin signé
    item.payslip_file_id = stored.id


def _payslip_company(db: Session, item: Any) -> str | None:
    run = _payslip_run(db, item)
    return None if run is not None and run.status in ("validated", "paid") else "Paie non validée"


def _payslip_reference(item: Any) -> str:
    return f"Bulletin {str(item.id)[:8]}"


def _report_render(db: Session, report: Any) -> bytes:
    from app.modules.reports.executive import report_bytes

    return report_bytes(db, report)


def _report_persist(db: Session, report: Any, data: bytes) -> None:
    from app.modules.reports.executive import _pdf

    report.pdf_file_id = _pdf(db, report, data).id


def _passport_render(db: Session, project: Any) -> bytes:
    from app.modules.maintenance.service import passport_pdf

    return passport_pdf(db, project)


SIGNABLES: dict[str, Signable] = {
    s.kind: s
    for s in (
        Signable(
            kind="quote",
            label="Devis",
            model="app.modules.crm.models:Quote",
            entity_type="quote",
            render=_quote_render,
            persist=_quote_persist,
            erp_link="/erp/crm/devis/{id}",
            reference=lambda q: f"{q.number} rév. {q.revision}",
            title=lambda q: q.title,
            read_perm="crm:read",
            company_block=_quote_company,
            client_block=_quote_client,
            client_scope=_client_owns,
            contact=_contact,
            on_signed=_quote_signed,
        ),
        Signable(
            kind="contract",
            label="Contrat",
            model="app.modules.crm.models:Contract",
            entity_type="contract",
            render=_contract_render,
            erp_link="/erp/crm/contrats/{id}",
            reference=lambda c: c.number,
            title=lambda c: c.title,
            read_perm="crm:read",
            company_block=_contract_company,
            client_block=_contract_client,
            client_scope=_client_owns,
            contact=_contact,
            on_signed=_contract_signed,
        ),
        Signable(
            kind="invoice",
            label="Facture",
            model="app.modules.billing.models:ClientInvoice",
            entity_type="client_invoice",
            render=_invoice_render,
            persist=_invoice_persist,
            erp_link="/erp/facturation?invoice={id}",
            reference=lambda i: i.number,
            title=lambda i: i.title,
            read_perm="billing:read",
            company_block=_invoice_company,
        ),
        Signable(
            kind="proforma",
            label="Facture proforma",
            model="app.modules.billing.models:ClientInvoice",
            entity_type="client_invoice",
            render=_proforma_render,
            erp_link="/erp/facturation?invoice={id}",
            reference=lambda i: f"{i.number} (proforma)",
            title=lambda i: i.title,
            read_perm="billing:read",
            company_block=_proforma_company,
        ),
        Signable(
            kind="credit_note",
            label="Facture d'avoir",
            model="app.modules.billing.models:CreditNote",
            entity_type="credit_note",
            render=_credit_render,
            persist=_credit_persist,
            erp_link="/erp/facturation",
            reference=lambda n: n.number,
            title=lambda n: n.reason or "Avoir",
            read_perm="billing:read",
            company_block=lambda db, n: "Avoir annulé" if n.status == "cancelled" else None,
        ),
        Signable(
            kind="receipt",
            label="Reçu de paiement",
            model="app.modules.finance.models:Payment",
            entity_type="payment",
            render=_receipt_render,
            persist=_receipt_persist,
            erp_link="/erp/finances/paiements/{id}",
            reference=lambda p: p.number,
            title=lambda p: p.counterparty_label or "Encaissement",
            read_perm="finance:read",
            company_block=_receipt_company,
        ),
        Signable(
            kind="payment_notice",
            label="Avis de paiement",
            model="app.modules.finance.models:Payment",
            entity_type="payment",
            render=_receipt_render,
            persist=_receipt_persist,
            erp_link="/erp/finances/paiements/{id}",
            reference=lambda p: p.number,
            title=lambda p: p.counterparty_label or "Paiement",
            read_perm="finance:read",
            company_block=_receipt_company,
        ),
        Signable(
            kind="purchase_order",
            label="Bon de commande",
            model="app.modules.procurement.models:PurchaseOrder",
            entity_type="purchase_order",
            render=_po_render,
            persist=_po_persist,
            erp_link="/erp/achats/commandes/{id}",
            reference=lambda po: po.number,
            title=lambda po: po.title if getattr(po, "title", None) else po.number,
            read_perm="procurement:read",
            company_block=_po_company,
        ),
        Signable(
            kind="subcontract",
            label="Marché de sous-traitance",
            model="app.modules.subcontracting.models:Subcontract",
            entity_type="subcontract",
            render=_subcontract_render,
            persist=_subcontract_persist,
            erp_link="/erp/sous-traitants/marches/{id}",
            reference=lambda c: c.number,
            title=lambda c: c.title,
            read_perm="subcontracting:read",
            company_block=_subcontract_company,
        ),
        Signable(
            kind="payslip",
            label="Bulletin de paie",
            model="app.modules.hr.models:PayrollItem",
            entity_type="payroll_item",
            render=_payslip_render,
            persist=_payslip_persist,
            erp_link="/erp/rh/paie",
            reference=_payslip_reference,
            title=lambda item: "Bulletin de paie",
            read_perm="hr:payroll",
            company_block=_payslip_company,
        ),
        Signable(
            kind="executive_report",
            label="Rapport de direction",
            model="app.modules.reports.models:ExecutiveReport",
            entity_type="executive_report",
            render=_report_render,
            persist=_report_persist,
            erp_link="/erp/direction/rapports/{id}",
            reference=lambda r: r.number,
            title=lambda r: f"Rapport du {r.period_start:%d/%m/%Y} au {r.period_end:%d/%m/%Y}",
            read_perm="dashboard:direction",
        ),
        Signable(
            kind="building_passport",
            label="Passeport du bâtiment",
            model="app.modules.projects.models:Project",
            entity_type="project",
            render=_passport_render,
            erp_link="/erp/chantiers/{id}",
            reference=lambda p: p.code,
            title=lambda p: f"Passeport du bâtiment — {p.name}",
            read_perm="projects:read",
        ),
    )
}


def get(kind: str) -> Signable:
    from app.core.errors import NotFound

    signable = SIGNABLES.get(kind)
    if signable is None:
        raise NotFound("Type de document non signable")
    return signable


__all__ = ["CLIENT", "COMPANY", "SIGNABLES", "Signable", "get"]
