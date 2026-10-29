"""Espace client (§6) : dashboard, passeport projet (§6.1), chantier (timeline publiée), planning, finances et
paiement en ligne, documents publiés, immersion (BIM / 360 / drone / configurateur), dossier Tranquillité (§6.2),
validations OTP (décisions, avenants), confiance (journal des validations). Ne renvoie que des données publiées
au client ; aucune donnée interne (coûts, marges, notes) n'y figure."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.downloads import signed_url, watermark_label
from app.core.errors import BusinessRuleError, NotFound
from app.core.idempotency import Idempotency, idempotency
from app.core.middleware import client_ip
from app.core.utils import jsonable, money
from app.modules.billing.models import ClientInvoice, CreditNote
from app.modules.finance.models import FundsCall, Payment, PaymentAllocation
from app.modules.projects.models import (
    ChangeOrder,
    ClientDigest,
    Decision,
    ImmersiveContent,
    Milestone,
    Project,
    SiteMedia,
    Task,
    TranquilliteItem,
    Warranty,
)

router = APIRouter(prefix="/client", tags=["Espace client"])


def _client(access: Access) -> None:
    access.require("client:portal")


def _project(db: Session, access: Access, project_id: uuid.UUID) -> Project:
    _client(access)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None or not project.client_visible:
        raise NotFound("Projet introuvable")
    access.require_project(project.id)
    return project


def _my_projects(db: Session, access: Access) -> list[Project]:
    _client(access)
    scope = access.project_scope()
    stmt = select(Project).where(Project.deleted_at.is_(None), Project.client_visible.is_(True))
    if scope is not None:
        stmt = stmt.where(Project.id.in_(scope or [uuid.uuid4()]))
    return list(db.execute(stmt.order_by(Project.created_at.desc())).scalars())


def _finance_summary(db: Session, project: Project) -> dict[str, Any]:
    calls = (
        db.execute(select(FundsCall).where(FundsCall.project_id == project.id, FundsCall.status != "draft"))
        .scalars()
        .all()
    )
    invoices = (
        db.execute(
            select(ClientInvoice).where(
                ClientInvoice.project_id == project.id,
                ClientInvoice.status.not_in(["draft", "cancelled"]),
                ClientInvoice.deleted_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    from app.modules.projects.service import approved_changes_total

    contract = Decimal(project.contract_amount or 0)
    approved_changes = approved_changes_total(db, project.id)
    paid = sum((Decimal(c.amount_paid) for c in calls), Decimal("0"))
    called = sum((Decimal(c.amount) for c in calls), Decimal("0"))
    due = sum(
        (
            Decimal(c.amount) - Decimal(c.amount_paid)
            for c in calls
            if c.status in ("issued", "partially_paid", "overdue")
        ),
        Decimal("0"),
    )
    overdue = [c for c in calls if c.status == "overdue"]
    return {
        # Montant du contrat signé, avenants NON inclus ; les avenants approuvés sont suivis (et facturés) à part.
        "contract_amount": money(contract),
        "approved_changes": approved_changes,
        "total_with_changes": money(contract + approved_changes),
        "called": money(called),
        "paid": money(paid),
        "due": money(due),
        "overdue_count": len(overdue),
        "remaining_to_call": money(max(contract - called, Decimal("0"))),
        "invoices": len(invoices),
        "currency": project.currency,
    }


# ============================================================================ projets & dashboard
@router.get("/projects")
def projects(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    return [
        jsonable(
            {
                "id": p.id,
                "code": p.code,
                "name": p.name,
                "status": p.status,
                "health": p.health,
                "progress_pct": p.progress_pct,
                "city": p.city,
                "universe": p.universe,
                "start_planned": p.start_planned,
                "end_planned": p.end_planned,
            }
        )
        for p in _my_projects(db, access)
    ]


@router.get("/projects/{project_id}/dashboard")
def dashboard(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id)
    milestones = (
        db.execute(
            select(Milestone)
            .where(Milestone.project_id == project.id, Milestone.client_visible.is_(True))
            .order_by(Milestone.due_date)
        )
        .scalars()
        .all()
    )
    decisions = (
        db.execute(
            select(Decision)
            .where(Decision.project_id == project.id, Decision.status == "pending_client")
            .order_by(Decision.due_date.asc().nulls_last())
        )
        .scalars()
        .all()
    )
    changes = (
        db.execute(select(ChangeOrder).where(ChangeOrder.project_id == project.id, ChangeOrder.status == "submitted"))
        .scalars()
        .all()
    )
    digest = (
        db.execute(
            select(ClientDigest).where(ClientDigest.project_id == project.id).order_by(ClientDigest.generated_at.desc())
        )
        .scalars()
        .first()
    )
    media = (
        db.execute(
            select(SiteMedia)
            .where(SiteMedia.project_id == project.id, SiteMedia.published_to_client.is_(True))
            .order_by(SiteMedia.created_at.desc())
            .limit(6)
        )
        .scalars()
        .all()
    )
    finance = _finance_summary(db, project)
    alerts = []
    if finance["overdue_count"]:
        alerts.append({"kind": "payment_overdue", "message": f"{finance['overdue_count']} appel(s) de fonds en retard"})
    if decisions:
        alerts.append(
            {"kind": "decision_pending", "message": f"{len(decisions)} décision(s) en attente de votre validation"}
        )
    if changes:
        alerts.append({"kind": "change_order_pending", "message": f"{len(changes)} avenant(s) à examiner"})
    late = [m for m in milestones if m.status == "planned" and m.due_date < date.today()]
    if late:
        alerts.append(
            {"kind": "milestone_late", "message": f"{len(late)} jalon(s) en retard — votre chef de projet vous informe"}
        )
    return jsonable(
        {
            "project": {
                "id": project.id,
                "code": project.code,
                "name": project.name,
                "status": project.status,
                "health": project.health,
                "progress_pct": project.progress_pct,
                "start_planned": project.start_planned,
                "end_planned": project.end_planned,
                "city": project.city,
            },
            "milestones": [serialize(m) for m in milestones],
            "finance": finance,
            "alerts": alerts,
            "pending_decisions": [
                {
                    "id": d.id,
                    "title": d.title,
                    "due_date": d.due_date,
                    "price_impact": d.price_impact,
                    "delay_impact_days": d.delay_impact_days,
                }
                for d in decisions
            ],
            "digest": {"summary": digest.summary, "period_start": digest.period_start, "period_end": digest.period_end}
            if digest
            else None,
            "recent_media": [_media(m, access) for m in media],
        }
    )


def _media(media: SiteMedia, access: Access) -> dict[str, Any]:
    return {
        "id": media.id,
        "type": media.media_type,
        "caption": media.caption,
        "stage": media.stage,
        "taken_at": media.taken_at,
        "url": signed_url(media.file_id, user_id=access.p.id, ttl=3600),
    }


# ============================================================================ passeport projet (§6.1)
@router.get("/projects/{project_id}/passport")
def passport(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.crm.models import Contract
    from app.modules.documents.models import Document, DocumentVersion
    from app.modules.finance.models import Expense
    from app.modules.support.models import Ticket

    project = _project(db, access, project_id)
    contract = db.get(Contract, project.contract_id) if project.contract_id else None
    changes = (
        db.execute(
            select(ChangeOrder)
            .where(
                ChangeOrder.project_id == project.id,
                ChangeOrder.status.in_(["submitted", "client_approved", "approved", "rejected"]),
            )
            .order_by(ChangeOrder.created_at)
        )
        .scalars()
        .all()
    )
    milestones = (
        db.execute(
            select(Milestone)
            .where(Milestone.project_id == project.id, Milestone.client_visible.is_(True))
            .order_by(Milestone.due_date)
        )
        .scalars()
        .all()
    )
    plans = []
    for doc in db.execute(
        select(Document).where(
            Document.project_id == project.id,
            Document.client_visible.is_(True),
            Document.deleted_at.is_(None),
            Document.doc_type.in_(["plan", "maquette_bim"]),
        )
    ).scalars():
        versions = (
            db.execute(
                select(DocumentVersion)
                .where(DocumentVersion.document_id == doc.id, DocumentVersion.status.in_(["published", "obsolete"]))
                .order_by(DocumentVersion.version_major.desc(), DocumentVersion.version_minor.desc())
            )
            .scalars()
            .all()
        )
        plans.append(
            {
                "title": doc.title,
                "versions": [
                    {
                        "label": f"v{v.version_major}.{v.version_minor}",
                        "status": v.status,
                        "published_at": v.published_at,
                        "obsolete_at": v.obsolete_at,
                    }
                    for v in versions
                ],
            }
        )
    decisions = (
        db.execute(select(Decision).where(Decision.project_id == project.id).order_by(Decision.created_at))
        .scalars()
        .all()
    )
    expenses = (
        db.execute(
            select(Expense)
            .where(Expense.project_id == project.id, Expense.client_visible.is_(True), Expense.deleted_at.is_(None))
            .order_by(Expense.expense_date.desc())
            .limit(200)
        )
        .scalars()
        .all()
    )
    payments = (
        db.execute(
            select(Payment)
            .where(Payment.project_id == project.id, Payment.direction == "in", Payment.status == "succeeded")
            .order_by(Payment.paid_at)
        )
        .scalars()
        .all()
    )
    warranties = db.execute(select(Warranty).where(Warranty.project_id == project.id)).scalars().all()
    tickets = db.execute(select(Ticket).where(Ticket.project_id == project.id)).scalars().all()
    subcontractors = []
    if (project.settings or {}).get("show_subcontractors"):
        from app.modules.subcontracting.models import Subcontract, Subcontractor

        for sub_contract, sub in db.execute(
            select(Subcontract, Subcontractor)
            .join(Subcontractor, Subcontractor.id == Subcontract.subcontractor_id)
            .where(
                Subcontract.project_id == project.id,
                Subcontract.status.in_(["signed", "mobilized", "in_progress", "completed", "closed"]),
            )
        ).all():
            subcontractors.append(
                {"name": sub.trade_name or sub.legal_name, "trades": sub.trades, "scope": sub_contract.title}
            )
    return jsonable(
        {
            "identity": {
                "code": project.code,
                "name": project.name,
                "universe": project.universe,
                "type": project.project_type,
                "address": project.address,
                "city": project.city,
                "surface_m2": project.surface_m2,
                "levels": project.levels,
                "status": project.status,
            },
            "contract": {
                "number": contract.number,
                "title": contract.title,
                "signed_at": contract.signed_at,
                "amount": contract.amount,
            }
            if contract
            else None,
            "change_orders": [
                {
                    "number": c.number,
                    "title": c.title,
                    "cost_impact": c.cost_impact,
                    "delay_impact_days": c.delay_impact_days,
                    "status": c.status,
                }
                for c in changes
            ],
            "finance": _finance_summary(db, project),
            "payments": [
                {"number": p.number, "amount": p.amount, "paid_at": p.paid_at, "method": p.method} for p in payments
            ],
            "planning": {
                "start_planned": project.start_planned,
                "end_planned": project.end_planned,
                "milestones": [serialize(m) for m in milestones],
            },
            "plans": plans,
            "decisions": [
                {
                    "number": d.number,
                    "title": d.title,
                    "status": d.status,
                    "selected_option": d.selected_option,
                    "price_impact": d.price_impact,
                    "delay_impact_days": d.delay_impact_days,
                    "validated_at": d.validated_at,
                    "validation_method": d.validation_method,
                    "content_hash": d.content_hash,
                }
                for d in decisions
            ],
            "deliveries_and_expenses": [
                {"label": e.label, "category": e.category, "amount": e.amount, "date": e.expense_date} for e in expenses
            ],
            "subcontractors": subcontractors,
            "warranties": [serialize(w) for w in warranties],
            "after_sales": {
                "tickets": len(tickets),
                "open": sum(1 for t in tickets if t.status not in ("closed", "cancelled")),
            },
            "validation_journal": [
                {"what": d.title, "when": d.validated_at, "how": d.validation_method, "hash": d.content_hash}
                for d in decisions
                if d.validated_at
            ],
        }
    )


# ============================================================================ chantier & planning
@router.get("/projects/{project_id}/timeline")
def timeline(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.qhse.models import Incident

    project = _project(db, access, project_id)
    media = (
        db.execute(
            select(SiteMedia)
            .where(SiteMedia.project_id == project.id, SiteMedia.published_to_client.is_(True))
            .order_by(SiteMedia.taken_at.desc().nulls_last(), SiteMedia.created_at.desc())
            .limit(300)
        )
        .scalars()
        .all()
    )
    incidents = (
        db.execute(
            select(Incident)
            .where(Incident.project_id == project.id, Incident.published_to_client.is_(True))
            .order_by(Incident.occurred_at.desc())
        )
        .scalars()
        .all()
    )
    milestones = (
        db.execute(
            select(Milestone)
            .where(Milestone.project_id == project.id, Milestone.client_visible.is_(True))
            .order_by(Milestone.due_date)
        )
        .scalars()
        .all()
    )
    return jsonable(
        {
            "progress_pct": project.progress_pct,
            "media": [_media(m, access) for m in media],
            "incidents": [{"date": i.occurred_at, "summary": i.client_summary} for i in incidents],
            "milestones": [serialize(m) for m in milestones],
        }
    )


@router.get("/projects/{project_id}/planning")
def planning(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.agenda.models import CalendarEvent

    project = _project(db, access, project_id)
    tasks = (
        db.execute(
            select(Task)
            .where(Task.project_id == project.id, Task.client_visible.is_(True), Task.deleted_at.is_(None))
            .order_by(Task.start_planned)
        )
        .scalars()
        .all()
    )
    events = (
        db.execute(
            select(CalendarEvent)
            .where(
                CalendarEvent.project_id == project.id,
                CalendarEvent.client_visible.is_(True),
                CalendarEvent.status != "cancelled",
            )
            .order_by(CalendarEvent.starts_at)
        )
        .scalars()
        .all()
    )
    milestones = (
        db.execute(
            select(Milestone)
            .where(Milestone.project_id == project.id, Milestone.client_visible.is_(True))
            .order_by(Milestone.due_date)
        )
        .scalars()
        .all()
    )
    return jsonable(
        {
            "tasks": [
                {
                    "id": t.id,
                    "name": t.title,
                    "start": t.start_planned,
                    "end": t.end_planned,
                    "progress_pct": t.progress_pct,
                    "status": t.status,
                }
                for t in tasks
            ],
            "milestones": [serialize(m) for m in milestones],
            "meetings": [
                {
                    "id": e.id,
                    "title": e.title,
                    "starts_at": e.starts_at,
                    "ends_at": e.ends_at,
                    "location": e.location,
                    "kind": e.kind,
                }
                for e in events
            ],
        }
    )


# ============================================================================ finances & paiement
@router.get("/projects/{project_id}/finances")
def finances(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id)
    calls = (
        db.execute(
            select(FundsCall)
            .where(FundsCall.project_id == project.id, FundsCall.status != "draft")
            .order_by(FundsCall.due_date)
        )
        .scalars()
        .all()
    )
    invoices = (
        db.execute(
            select(ClientInvoice)
            .where(
                ClientInvoice.project_id == project.id,
                ClientInvoice.status.not_in(["draft", "cancelled"]),
                ClientInvoice.deleted_at.is_(None),
            )
            .order_by(ClientInvoice.issue_date)
        )
        .scalars()
        .all()
    )
    payments = (
        db.execute(
            select(Payment)
            .where(
                Payment.project_id == project.id,
                Payment.direction == "in",
                # encaissement hors ligne : visible du client une fois approuvé (double regard)
                or_(Payment.provider != "manual", Payment.status == "succeeded"),
            )
            .order_by(Payment.created_at.desc())
        )
        .scalars()
        .all()
    )
    from app.providers.payments import available_payment_methods

    return jsonable(
        {
            "summary": _finance_summary(db, project),
            "funds_calls": [
                {
                    "id": c.id,
                    "number": c.number,
                    "label": c.label,
                    "amount": c.amount,
                    "amount_paid": c.amount_paid,
                    "due_date": c.due_date,
                    "status": c.status,
                    "invoice_id": c.client_invoice_id,
                }
                for c in calls
            ],
            "invoices": [
                {
                    "id": i.id,
                    "number": i.number,
                    "title": i.title,
                    "total": i.total,
                    "amount_paid": i.amount_paid,
                    "status": i.status,
                    "issue_date": i.issue_date,
                    "due_date": i.due_date,
                    "kind": i.kind,
                    "pdf_url": signed_url(i.pdf_file_id, user_id=access.p.id, ttl=900) if i.pdf_file_id else None,
                }
                for i in invoices
            ],
            # Factures d'avoir (notes de crédit) émises sur mes factures.
            "credit_notes": [
                {
                    "id": n.id,
                    "number": n.number,
                    "amount": n.amount,
                    "currency": n.currency,
                    "issue_date": n.issue_date,
                    "reason": n.reason,
                    "invoice_number": next((i.number for i in invoices if i.id == n.client_invoice_id), None),
                    "pdf_url": f"/api/v1/credit-notes/{n.id}/pdf",
                }
                for n in db.execute(
                    select(CreditNote)
                    .where(
                        CreditNote.project_id == project.id,
                        CreditNote.side == "client",
                        CreditNote.status != "cancelled",
                    )
                    .order_by(CreditNote.issue_date)
                ).scalars()
            ],
            "payments": [
                {
                    "id": p.id,
                    "number": p.number,
                    "amount": p.amount,
                    "status": p.status,
                    "method": p.method,
                    "provider": p.provider,
                    "paid_at": p.paid_at,
                    "value_date": p.value_date,
                    "receipt_url": signed_url(p.receipt_file_id, user_id=access.p.id, ttl=900)
                    if p.receipt_file_id
                    else None,
                }
                for p in payments
            ],
            "payment_methods": available_payment_methods(),
        }
    )


@router.get("/projects/{project_id}/trust")
def project_trust(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Indice de confiance de mon chantier : constats en langage clair, sans donnée financière interne."""
    from app.modules.projects.trust import trust_payload

    return trust_payload(db, _project(db, access, project_id), internal=False)


@router.get("/projects/{project_id}/proofs")
def project_proofs(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    """Preuves certifiées de mon chantier (décisions, documents, photos du jour) avec lien de vérification."""
    from app.modules.proofs.models import Proof
    from app.modules.proofs.service import proof_out

    project = _project(db, access, project_id)
    rows = (
        db.execute(
            select(Proof)
            .where(Proof.project_id == project.id, Proof.client_visible.is_(True))
            .order_by(Proof.created_at.desc())
            .limit(200)
        )
        .scalars()
        .all()
    )
    out = []
    for proof in rows:
        data = proof_out(proof)
        data.pop("anchor_error", None)
        out.append(data)
    return out


class CheckoutIn(BaseModel):
    target_type: str = Field(pattern="^(funds_call|client_invoice)$")
    target_id: uuid.UUID
    provider: str = Field(min_length=3, max_length=20)
    method: str = Field(min_length=2, max_length=30)
    amount: Decimal | None = Field(default=None, gt=0)
    payer_phone: str | None = Field(default=None, max_length=30)  # numéro Mobile Money débité (MTN MoMo)


@router.post("/checkout", status_code=201)
def checkout(
    data: CheckoutIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency(required=True)),
) -> Any:
    """Paiement en ligne (carte / Mobile Money) d'un appel de fonds ou d'une facture — idempotent."""
    from app.core.config import settings
    from app.modules.finance.payments import start_client_checkout

    if idem.replay is not None:
        return idem.replay
    access.require("client:pay")
    if data.provider not in settings.PAYMENT_PROVIDERS:
        raise BusinessRuleError("Prestataire de paiement non disponible")
    target = db.get(FundsCall if data.target_type == "funds_call" else ClientInvoice, data.target_id)
    if target is None or not target.project_id:
        raise NotFound("Pièce introuvable")
    _project(db, access, target.project_id)
    result = start_client_checkout(
        db,
        user=access.p.user,
        target_type=data.target_type,
        target_id=data.target_id,
        provider_name=data.provider,
        method=data.method,
        amount=data.amount,
        idempotency_key=idem.key or "",
        payer_phone=data.payer_phone,
    )
    return idem.complete(db, jsonable(result), status_code=201)


@router.get("/payments/{payment_id}")
def payment_status(
    payment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _client(access)
    payment = db.get(Payment, payment_id)
    if payment is None or payment.direction != "in" or payment.project_id is None:
        raise NotFound("Paiement introuvable")
    _project(db, access, payment.project_id)
    allocations = (
        db.execute(select(PaymentAllocation).where(PaymentAllocation.payment_id == payment.id)).scalars().all()
    )
    return jsonable(
        {
            "number": payment.number,
            "status": payment.status,
            "amount": payment.amount,
            "paid_at": payment.paid_at,
            "failure_reason": payment.failure_reason,
            "allocations": [serialize(a) for a in allocations],
            "receipt_url": signed_url(payment.receipt_file_id, user_id=access.p.id, ttl=900)
            if payment.receipt_file_id
            else None,
        }
    )


# ============================================================================ documents publiés
@router.get("/projects/{project_id}/documents")
def documents(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    from app.modules.documents import deliverables
    from app.modules.documents.models import Document, DocumentVersion

    project = _project(db, access, project_id)
    out = []
    for doc in db.execute(
        select(Document)
        .where(
            Document.project_id == project.id,
            Document.client_visible.is_(True),
            Document.deleted_at.is_(None),
            Document.published_version_id.is_not(None),
        )
        .order_by(Document.doc_type, Document.title)
    ).scalars():
        version = db.get(DocumentVersion, doc.published_version_id)
        if version is None:
            continue
        deliverable = deliverables.state(db, doc)
        if deliverable["locked"]:
            # Livrable d'études non réglé : aperçu filigrané seulement (PDF, images), aucun original téléchargeable.
            previewable = version.mime_type in deliverables.PREVIEW_MIMES
            url = (
                signed_url(
                    version.file_id,
                    user_id=access.p.id,
                    ttl=900,
                    watermark_text=deliverables.preview_label(db, doc, access.p.user),
                    preview=True,
                )
                if previewable
                else None
            )
        else:
            url = signed_url(
                version.file_id,
                user_id=access.p.id,
                ttl=900,
                watermark_text=watermark_label(access.p.user)
                if version.mime_type == "application/pdf" and not doc.paid_deliverable
                else None,
            )
        out.append(
            {
                "id": doc.id,
                "title": doc.title,
                "type": doc.doc_type,
                "discipline": doc.discipline,
                "version": f"v{version.version_major}.{version.version_minor}",
                "published_at": version.published_at,
                "size": version.size_bytes,
                "mime": version.mime_type,
                "filename": version.original_name,
                "authenticity_url": f"/verification/{version.authenticity_token}",
                "url": url,
                "deliverable": deliverable,
            }
        )
    return jsonable(out)


# ============================================================================ immersion
def _immersive_url(db: Session, access: Access, file_id: uuid.UUID | None) -> str | None:
    """Fichier d'un contenu immersif ; s'il provient d'un livrable d'études non réglé : aperçu filigrané seulement."""
    from app.modules.documents import deliverables

    if not file_id:
        return None
    locked = deliverables.locked_document_for_file(db, file_id)
    if locked is None:
        return signed_url(file_id, user_id=access.p.id, ttl=3600)
    return signed_url(
        file_id,
        user_id=access.p.id,
        ttl=900,
        watermark_text=deliverables.preview_label(db, locked, access.p.user),
        preview=True,
    )


@router.get("/projects/{project_id}/immersion")
def immersion(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.bim.service import federation
    from app.modules.configurator.models import ConfiguratorModel

    project = _project(db, access, project_id)
    contents = (
        db.execute(
            select(ImmersiveContent)
            .where(ImmersiveContent.project_id == project.id, ImmersiveContent.published_to_client.is_(True))
            .order_by(ImmersiveContent.captured_at.desc().nulls_last())
        )
        .scalars()
        .all()
    )
    configurators = (
        db.execute(
            select(ConfiguratorModel).where(
                ConfiguratorModel.project_id == project.id, ConfiguratorModel.published_to_client.is_(True)
            )
        )
        .scalars()
        .all()
    )
    return jsonable(
        {
            "bim": federation(db, project.id, client_only=True),
            "contents": [
                {
                    "id": c.id,
                    "kind": c.kind,
                    "title": c.title,
                    "description": c.description,
                    "captured_at": c.captured_at,
                    "comparison_group": c.comparison_group,
                    "url": c.external_url or _immersive_url(db, access, c.file_id),
                }
                for c in contents
            ],
            "configurators": [
                {"id": m.id, "name": m.name, "lock_date": m.lock_date, "has_model": bool(m.file_id)}
                for m in configurators
            ],
        }
    )


# ============================================================================ dossier Tranquillité (§6.2)
@router.get("/projects/{project_id}/tranquillite")
def tranquillite(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    from app.modules.identity.models import User

    project = _project(db, access, project_id)
    out = []
    for item in db.execute(
        select(TranquilliteItem)
        .where(TranquilliteItem.project_id == project.id, TranquilliteItem.client_visible.is_(True))
        .order_by(TranquilliteItem.category, TranquilliteItem.due_date)
    ).scalars():
        responsible = db.get(User, item.responsible_id) if item.responsible_id else None
        reference = item.reference_number or ""
        out.append(
            {
                "id": item.id,
                "category": item.category,
                "title": item.title,
                "authority": item.authority,
                "status": item.status,
                "issued_date": item.issued_date,
                "expiry_date": item.expiry_date,
                "due_date": item.due_date,
                "responsible": responsible.full_name if responsible else None,
                "reference_masked": ("•" * max(0, len(reference) - 4) + reference[-4:]) if reference else None,
                "verified_at": item.verified_at,
                "anchored": bool(item.anchor_hash),
                "proofs": len(item.document_ids or []),
            }
        )
    return jsonable(out)


# ============================================================================ validations (décisions & avenants)
@router.get("/decisions")
def decisions(
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    projects_ = [p.id for p in _my_projects(db, access)]
    stmt = select(Decision).where(Decision.project_id.in_(projects_ or [uuid.uuid4()]))
    if project_id:
        stmt = stmt.where(Decision.project_id == project_id)
    if status:
        stmt = stmt.where(Decision.status == status)
    return [
        jsonable({k: v for k, v in serialize(d).items() if k not in ("requested_by_id",)})
        for d in db.execute(stmt.order_by(Decision.created_at.desc())).scalars()
    ]


def _decision(db: Session, access: Access, decision_id: uuid.UUID) -> Decision:
    decision = db.get(Decision, decision_id)
    if decision is None:
        raise NotFound("Décision introuvable")
    _project(db, access, decision.project_id)
    access.require("client:decide")
    return decision


@router.post("/decisions/{decision_id}/otp")
def decision_otp(
    decision_id: uuid.UUID, channel: str = "email", db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import issue_otp

    decision = _decision(db, access, decision_id)
    if decision.status != "pending_client":
        raise BusinessRuleError("Décision déjà traitée")
    if channel not in ("email", "sms", "whatsapp"):
        raise BusinessRuleError("Canal inconnu")
    result = issue_otp(
        db,
        access.p.user,
        purpose="decision",
        channel=channel,
        payload={"decision_id": str(decision.id), "label": f"Validation : {decision.title}"},
    )
    db.commit()
    return result


class DecisionValidateIn(BaseModel):
    otp_token: str = Field(min_length=10, max_length=200)
    code: str = Field(min_length=4, max_length=10)
    selected_option: str | None = Field(default=None, max_length=200)


@router.post("/decisions/{decision_id}/validate")
def validate_decision(
    decision_id: uuid.UUID,
    data: DecisionValidateIn,
    request: Request,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Décision irrévocable (V4-3D-27) : OTP, horodatage, empreinte du contenu ; avenant créé si impact."""
    from app.modules.identity.service import verify_otp
    from app.modules.projects.service import validate_decision as do_validate

    decision = _decision(db, access, decision_id)
    proof = verify_otp(db, access.p.user, purpose="decision", otp_token=data.otp_token, code=data.code)
    if proof["payload"].get("decision_id") != str(decision.id):
        raise BusinessRuleError("Code émis pour une autre décision", code="OTP_INVALID")
    do_validate(
        db,
        decision,
        user=access.p.user,
        selected_option=data.selected_option,
        otp={"verified_at": proof["verified_at"], "channel": proof["channel"], "token_id": proof["token_id"]},
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    return jsonable(serialize(decision))


class RejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=4000)


@router.post("/decisions/{decision_id}/reject")
def reject_decision(
    decision_id: uuid.UUID, data: RejectIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.projects.service import reject_decision as do_reject

    decision = _decision(db, access, decision_id)
    do_reject(db, decision, user=access.p.user, reason=data.reason)
    db.commit()
    return jsonable(serialize(decision))


@router.get("/change-orders")
def change_orders(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    project = _project(db, access, project_id)
    rows = db.execute(
        select(ChangeOrder)
        .where(
            ChangeOrder.project_id == project.id,
            ChangeOrder.status.in_(["submitted", "client_approved", "approved", "rejected"]),
        )
        .order_by(ChangeOrder.created_at.desc())
    ).scalars()
    return [
        jsonable({k: v for k, v in serialize(c).items() if k not in ("created_by_id", "approved_by_id")}) for c in rows
    ]


@router.post("/change-orders/{change_order_id}/otp")
def change_order_otp(
    change_order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.identity.service import issue_otp

    co = db.get(ChangeOrder, change_order_id)
    if co is None:
        raise NotFound("Avenant introuvable")
    _project(db, access, co.project_id)
    access.require("client:decide")
    if co.status != "submitted":
        raise BusinessRuleError("Avenant non soumis à votre validation")
    result = issue_otp(
        db,
        access.p.user,
        purpose="change_order",
        payload={"change_order_id": str(co.id), "label": f"Avenant {co.number}"},
    )
    db.commit()
    return result


class ChangeOrderDecisionIn(BaseModel):
    approve: bool
    otp_token: str | None = Field(default=None, max_length=200)
    code: str | None = Field(default=None, max_length=10)
    reason: str | None = Field(default=None, max_length=4000)


@router.post("/change-orders/{change_order_id}/decision")
def change_order_decision(
    change_order_id: uuid.UUID,
    data: ChangeOrderDecisionIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    from app.core import audit
    from app.modules.identity.service import verify_otp
    from app.modules.projects.service import transition_change_order

    co = db.get(ChangeOrder, change_order_id)
    if co is None:
        raise NotFound("Avenant introuvable")
    _project(db, access, co.project_id)
    access.require("client:decide")
    if data.approve:
        if not data.otp_token or not data.code:
            raise BusinessRuleError("Code OTP requis pour approuver un avenant", code="OTP_REQUIRED")
        proof = verify_otp(db, access.p.user, purpose="change_order", otp_token=data.otp_token, code=data.code)
        if proof["payload"].get("change_order_id") != str(co.id):
            raise BusinessRuleError("Code émis pour un autre avenant", code="OTP_INVALID")
        transition_change_order(db, co, "client_approved", user_id=access.p.id, client=True)
        audit.record(
            db,
            family="business",
            module="change_orders",
            action="CLIENT_APPROVE",
            resource_type="change_order",
            resource_id=co.id,
            project_id=co.project_id,
            diff={"otp": {"verified_at": proof["verified_at"], "channel": proof["channel"]}},
            criticality="HIGH",
        )
    else:
        if not (data.reason or "").strip():
            raise BusinessRuleError("Motif du refus requis", code="REASON_REQUIRED")
        transition_change_order(db, co, "rejected", user_id=access.p.id, client=True)
        audit.record(
            db,
            family="business",
            module="change_orders",
            action="CLIENT_REJECT",
            resource_type="change_order",
            resource_id=co.id,
            project_id=co.project_id,
            reason=data.reason,
        )
    db.commit()
    return jsonable(serialize(co))


# ============================================================================ compte & confiance
@router.get("/trust")
def trust_center(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Centre de confiance : sécurité du compte, consentements, journal de mes validations."""
    from app.modules.identity.models import MFAFactor, UserSession
    from app.modules.system.models import ConsentRecord

    _client(access)
    user = access.p.user
    sessions = (
        db.execute(
            select(UserSession)
            .where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
            .order_by(UserSession.created_at.desc())
        )
        .scalars()
        .all()
    )
    factors = db.execute(select(MFAFactor).where(MFAFactor.user_id == user.id)).scalars().all()
    consents = (
        db.execute(
            select(ConsentRecord)
            .where(ConsentRecord.subject_ref.in_([user.email, str(user.id)]))
            .order_by(ConsentRecord.created_at.desc())
        )
        .scalars()
        .all()
    )
    decisions = (
        db.execute(select(Decision).where(Decision.validated_by_id == user.id).order_by(Decision.validated_at.desc()))
        .scalars()
        .all()
    )
    return jsonable(
        {
            "mfa_enabled": bool(user.mfa_enabled),
            "factors": [
                {"type": f.type, "name": f.name, "confirmed_at": f.confirmed_at, "last_used_at": f.last_used_at}
                for f in factors
                if f.disabled_at is None
            ],
            "active_sessions": len(sessions),
            "consents": [
                {
                    "purposes": c.purposes,
                    "policy_version": c.policy_version,
                    "source": c.source,
                    "created_at": c.created_at,
                    "withdrawn_at": c.withdrawn_at,
                }
                for c in consents
            ],
            "my_validations": [
                {"title": d.title, "validated_at": d.validated_at, "status": d.status, "content_hash": d.content_hash}
                for d in decisions
            ],
        }
    )
