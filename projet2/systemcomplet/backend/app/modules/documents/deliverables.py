"""Livrables d'études payants (parcours « études d'abord »).

Plans, rendus 3D et notes d'études marqués « livrable payant » : le client les consulte en aperçu filigrané et les
valide (décisions) ; l'original ne lui est remis — téléchargement sans filigrane — qu'une fois la facture d'études
liée réglée. Le règlement de cette facture déclenche la remise : date tracée, audit, notification du client.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.utils import utcnow
from app.modules.documents.models import Document

PREVIEW_MIMES = ("application/pdf", "image/jpeg", "image/png", "image/webp")


def _invoice(db: Session, invoice_id: uuid.UUID | None) -> Any:
    from app.modules.billing.models import ClientInvoice

    return db.get(ClientInvoice, invoice_id) if invoice_id else None


def is_locked(db: Session, doc: Document) -> bool:
    """Verrouillé tant que le livrable est payant et que sa facture d'études n'est pas entièrement réglée."""
    if not doc.paid_deliverable:
        return False
    invoice = _invoice(db, doc.unlock_invoice_id)
    return invoice is None or invoice.status != "paid"


def state(db: Session, doc: Document) -> dict[str, Any]:
    invoice = _invoice(db, doc.unlock_invoice_id)
    return {
        "paid_deliverable": doc.paid_deliverable,
        "locked": is_locked(db, doc),
        "invoice_id": invoice.id if invoice else None,
        "invoice_number": invoice.number if invoice else None,
        "invoice_status": invoice.status if invoice else None,
        "delivered_at": doc.delivered_at,
    }


def locked_document_for_file(db: Session, file_id: uuid.UUID | None) -> Document | None:
    """Livrable verrouillé dont une version porte ce fichier (contenus immersifs réutilisant un fichier de la GED)."""
    from app.modules.documents.models import DocumentVersion

    if not file_id:
        return None
    for doc in db.execute(
        select(Document)
        .join(DocumentVersion, DocumentVersion.document_id == Document.id)
        .where(DocumentVersion.file_id == file_id, Document.paid_deliverable.is_(True))
    ).scalars():
        if is_locked(db, doc):
            return doc
    return None


def preview_label(db: Session, doc: Document, user: Any) -> str:
    invoice = _invoice(db, doc.unlock_invoice_id)
    ref = f"de la facture {invoice.number}" if invoice else "de la facture d'études"
    name = getattr(user, "full_name", "") or ""
    return f"APERÇU — livrable remis après règlement {ref} — {name} — GLOBUS ENGINEERING"


def link_invoice(
    db: Session, *, project_id: uuid.UUID, invoice_id: uuid.UUID, user_id: uuid.UUID, document_ids: list[uuid.UUID]
) -> int:
    """Rattache les livrables d'études du projet (tous ceux sans facture, ou la sélection) à la facture d'études."""
    invoice = _invoice(db, invoice_id)
    if invoice is None or invoice.deleted_at is not None:
        raise NotFound("Facture introuvable")
    if invoice.project_id != project_id:
        raise BusinessRuleError("La facture appartient à un autre projet")
    if invoice.status in ("cancelled", "credited"):
        raise BusinessRuleError("Facture annulée : choisissez une facture d'études valide")
    stmt = select(Document).where(
        Document.project_id == project_id, Document.paid_deliverable.is_(True), Document.deleted_at.is_(None)
    )
    stmt = (
        stmt.where(Document.id.in_(document_ids)) if document_ids else stmt.where(Document.unlock_invoice_id.is_(None))
    )
    count = 0
    for doc in db.execute(stmt).scalars():
        doc.unlock_invoice_id = invoice.id
        count += 1
    audit.record(
        db,
        family="business",
        module="documents",
        action="DELIVERABLES_LINK_INVOICE",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=project_id,
        actor_id=user_id,
        diff={"documents": count, "invoice": invoice.number},
    )
    if invoice.status == "paid":
        deliver_for_invoice(db, invoice)
    return count


def deliver_for_invoice(db: Session, invoice: Any) -> int:
    """Facture d'études réglée : remise des livrables liés (originaux téléchargeables), tracée et notifiée."""
    if invoice.status != "paid":
        return 0
    docs = (
        db.execute(
            select(Document).where(
                Document.unlock_invoice_id == invoice.id,
                Document.paid_deliverable.is_(True),
                Document.delivered_at.is_(None),
                Document.deleted_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    if not docs:
        return 0
    now = utcnow()
    for doc in docs:
        doc.delivered_at = now
    audit.record(
        db,
        family="business",
        module="documents",
        action="DELIVERABLES_RELEASED",
        resource_type="client_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        diff={"documents": [d.title for d in docs], "invoice": invoice.number},
        criticality="MEDIUM",
    )
    emit(
        db,
        "deliverables.released",
        {
            "invoice_id": invoice.id,
            "number": invoice.number,
            "count": len(docs),
            "titles": ", ".join(d.title for d in docs),
        },
        aggregate_type="client_invoice",
        aggregate_id=invoice.id,
        project_id=invoice.project_id,
    )
    return len(docs)
