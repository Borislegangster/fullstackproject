"""Sceaux d'authenticité des documents émis par la plateforme (QR code des PDF → /verification/{code}).

Chaque document (reçu, devis, proforma, avoir, bon de commande, marché, bulletin, rapport, passeport…) reçoit un code
unique et stable ; la page publique de vérification affiche ses données essentielles (n°, date, montant, partie
masquée) et son statut à jour. Les factures définitives gardent leur propre code (`authenticity_token`).
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import random_token
from app.core.utils import jsonable, utcnow
from app.modules.documents.models import DocumentSeal

KIND_LABELS = {
    "receipt": "Reçu de paiement",
    "payment_notice": "Avis de paiement",
    "quote": "Devis",
    "proforma": "Facture proforma",
    "credit_note": "Facture d'avoir",
    "purchase_order": "Bon de commande",
    "subcontract": "Marché de sous-traitance",
    "payslip": "Bulletin de paie",
    "executive_report": "Rapport de direction",
    "building_passport": "Passeport du bâtiment",
}

NOTES = {
    "proforma": "Facture proforma : document provisoire, sans valeur comptable. Seule la facture définitive "
    "(numérotée, avec son propre QR code) est exigible.",
    "quote": "Devis : offre de prix, engageante seulement après acceptation.",
}


def seal(
    db: Session,
    *,
    kind: str,
    entity_type: str,
    entity_id: uuid.UUID,
    reference: str | None = None,
    title: str | None = None,
    issued_on: date | None = None,
    amount: Decimal | None = None,
    currency: str | None = None,
    party: str | None = None,
) -> DocumentSeal:
    """Code d'authenticité du document (créé une fois, mis à jour à chaque nouvelle édition du PDF)."""
    row = db.execute(
        select(DocumentSeal).where(
            DocumentSeal.entity_type == entity_type, DocumentSeal.entity_id == entity_id, DocumentSeal.kind == kind
        )
    ).scalar_one_or_none()
    if row is None:
        row = DocumentSeal(token=random_token(24), kind=kind, entity_type=entity_type, entity_id=entity_id)
        db.add(row)
    row.reference = str(reference)[:80] if reference else None
    row.title = str(title)[:250] if title else None
    row.issued_on = issued_on
    row.amount = amount
    row.currency = currency
    row.party = str(party)[:250] if party else None
    row.revoked_at = None
    db.flush()
    return row


def sealed_pdf(db: Session, doc: Any, **seal_fields: Any) -> bytes:
    """Rend le PDF avec le QR d'authenticité de son sceau et enregistre l'empreinte SHA-256 du fichier produit."""
    from app.core.pdf import render

    row = seal(db, **seal_fields)
    doc.verify_token = row.token
    data = render(doc)
    row.sha256 = hashlib.sha256(data).hexdigest()
    return data


def revoke(db: Session, *, entity_type: str, entity_id: uuid.UUID) -> None:
    """Document annulé : la vérification indique qu'il n'est plus valable."""
    for row in db.execute(
        select(DocumentSeal).where(DocumentSeal.entity_type == entity_type, DocumentSeal.entity_id == entity_id)
    ).scalars():
        row.revoked_at = row.revoked_at or utcnow()


def mask(party: str | None) -> str | None:
    """Partie masquée sur la page publique : premier mot entier, initiales ensuite (« Famille M. »)."""
    if not party:
        return None
    words = party.split()
    return " ".join([words[0], *(f"{w[0]}." for w in words[1:] if w)])


def _status(db: Session, row: DocumentSeal) -> str | None:
    """Statut à jour du document (annulé, payé, accepté…) lu dans son enregistrement d'origine."""
    from app.modules.billing.models import ClientInvoice, CreditNote
    from app.modules.crm.models import Quote
    from app.modules.finance.models import Payment
    from app.modules.hr.models import PayrollItem, PayrollRun
    from app.modules.procurement.models import PurchaseOrder
    from app.modules.subcontracting.models import Subcontract

    models = {
        "payment": Payment,
        "quote": Quote,
        "client_invoice": ClientInvoice,
        "credit_note": CreditNote,
        "purchase_order": PurchaseOrder,
        "subcontract": Subcontract,
    }
    if row.entity_type == "payroll_item":
        item = db.get(PayrollItem, row.entity_id)
        run = db.get(PayrollRun, item.run_id) if item else None
        return run.status if run else None
    model = models.get(row.entity_type)
    obj = db.get(model, row.entity_id) if model else None
    return getattr(obj, "status", None) if obj is not None else None


def public_payload(db: Session, token: str) -> dict[str, Any] | None:
    row = db.execute(select(DocumentSeal).where(DocumentSeal.token == token)).scalar_one_or_none()
    if row is None:
        return None
    status = _status(db, row)
    note = NOTES.get(row.kind)
    if row.kind == "proforma" and status and status not in ("draft", "cancelled"):
        note = "Cette proforma a été remplacée par la facture définitive correspondante."
    return jsonable(
        {
            "valid": True,
            "type": "sealed",
            "kind": row.kind,
            "kind_label": KIND_LABELS.get(row.kind, "Document GLOBUS"),
            "number": row.reference,
            "title": row.title,
            "issued_on": row.issued_on,
            "amount": row.amount,
            "currency": row.currency,
            "party": mask(row.party),
            "status": status,
            "revoked": row.revoked_at is not None or status == "cancelled",
            "sha256": row.sha256,
            "note": note,
        }
    )
