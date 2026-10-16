"""Paiement par jalon sous séquestre (innovation R1).

Principe « vous ne payez que ce qui est construit » :
  1. le projet dispose d'un compte de séquestre chez un établissement partenaire agréé (convention) ;
  2. chaque appel de fonds rattaché à un jalon est payé par le client (MoMo, Orange Money, carte) : le montant est
     enregistré « sous séquestre » (registre des mouvements) ;
  3. jalon atteint → demande de libération appuyée sur des preuves : PV publié, photos du chantier certifiées
     (preuves opposables R4) ;
  4. le client valide par code à usage unique — ou conteste (médiation Direction) ; sans réponse dans le délai
     prévu, la Direction est alertée (aucune libération automatique) ;
  5. libération exécutée après double validation interne (Finance + Direction, deux personnes différentes),
     avec la référence de l'ordre transmis au partenaire.

Tant qu'aucun partenaire n'est contractualisé, le compte reste « en attente de partenaire » et l'interface le dit.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import jsonable, money, utcnow
from app.modules.escrow.models import EscrowAccount, EscrowItem, EscrowMovement

log = logging.getLogger("globus.escrow")
PROOF_WINDOW_DAYS = 21


def account_for(db: Session, project_id: uuid.UUID) -> EscrowAccount | None:
    return db.execute(select(EscrowAccount).where(EscrowAccount.project_id == project_id)).scalar_one_or_none()


def setup(
    db: Session, project: Any, *, partner_name: str, partner_reference: str | None, review_days: int, terms: str | None
) -> EscrowAccount:
    account = account_for(db, project.id)
    if account is None:
        account = EscrowAccount(project_id=project.id, partner_name=partner_name)
        db.add(account)
    account.partner_name = partner_name
    account.partner_reference = partner_reference
    account.review_days = review_days
    account.terms = terms
    db.flush()
    return account


def activate(db: Session, account: EscrowAccount, *, user_id: uuid.UUID) -> None:
    if not account.partner_reference:
        raise BusinessRuleError("Référence de la convention de séquestre requise", code="ESCROW_PARTNER_MISSING")
    account.status = "active"
    account.activated_by_id = user_id
    account.activated_at = utcnow()


def attach(db: Session, account: EscrowAccount, *, funds_call: Any, milestone: Any) -> EscrowItem:
    if funds_call.project_id != account.project_id or milestone.project_id != account.project_id:
        raise BusinessRuleError("Appel de fonds et jalon doivent appartenir au projet")
    if Decimal(funds_call.amount_paid or 0) > 0:
        raise BusinessRuleError("Appel de fonds déjà (partiellement) réglé : rattachez-le avant tout paiement")
    item = EscrowItem(
        number=next_number(db, "escrow_release"),
        account_id=account.id,
        project_id=account.project_id,
        funds_call_id=funds_call.id,
        milestone_id=milestone.id,
        amount=money(funds_call.amount),
    )
    db.add(item)
    db.flush()
    return item


def _movement(db: Session, item: EscrowItem, kind: str, amount: Decimal, **extra: Any) -> None:
    db.add(EscrowMovement(account_id=item.account_id, item_id=item.id, kind=kind, amount=money(amount), **extra))


def on_funds_call_payment(db: Session, funds_call: Any, amount: Decimal, payment_id: uuid.UUID | None) -> None:
    """Appelé à l'imputation d'un encaissement sur un appel de fonds : la somme passe sous séquestre."""
    item = db.execute(select(EscrowItem).where(EscrowItem.funds_call_id == funds_call.id)).scalar_one_or_none()
    if item is None:
        return
    account = db.get(EscrowAccount, item.account_id)
    item.held_amount = money(Decimal(item.held_amount or 0) + Decimal(amount))
    account.balance_held = money(Decimal(account.balance_held or 0) + Decimal(amount))
    _movement(db, item, "deposit", amount, payment_id=payment_id)
    if item.status == "awaiting_payment" and item.held_amount >= item.amount:
        item.status = "held"
    emit(
        db,
        "escrow.deposit",
        {"id": item.id, "number": item.number, "amount": amount, "project_id": item.project_id},
        aggregate_type="escrow_item",
        aggregate_id=item.id,
        project_id=item.project_id,
    )


def request_release(db: Session, item: EscrowItem, *, pv_document_id: uuid.UUID, user_id: uuid.UUID) -> EscrowItem:
    from app.modules.documents.models import Document
    from app.modules.projects.models import Milestone, Project
    from app.modules.proofs.models import Proof

    account = db.get(EscrowAccount, item.account_id)
    if account.status != "active":
        raise BusinessRuleError("Compte de séquestre non actif (partenaire à contractualiser)", code="ESCROW_INACTIVE")
    if item.status != "held":
        raise BusinessRuleError("Fonds non encore intégralement sous séquestre ou déjà traités", code="ESCROW_STATUS")
    milestone = db.get(Milestone, item.milestone_id)
    if milestone is None or milestone.status != "achieved":
        raise BusinessRuleError(
            "Le jalon doit être déclaré atteint avant toute demande de libération", code="MILESTONE_NOT_ACHIEVED"
        )
    pv = db.get(Document, pv_document_id)
    if (
        pv is None
        or pv.project_id != item.project_id
        or pv.doc_type != "pv"
        or not pv.published_version_id
        or pv.deleted_at
    ):
        raise BusinessRuleError("Procès-verbal publié du projet requis (type « PV »)", code="PV_REQUIRED")
    since = utcnow() - timedelta(days=PROOF_WINDOW_DAYS)
    proofs = (
        db.execute(
            select(Proof).where(
                Proof.project_id == item.project_id,
                Proof.subject_type == "photo_day",
                Proof.revoked_at.is_(None),
                Proof.created_at >= since,
            )
        )
        .scalars()
        .all()
    )
    if not proofs:
        raise BusinessRuleError(
            f"Photos du chantier certifiées des {PROOF_WINDOW_DAYS} derniers jours requises (preuves opposables)",
            code="PHOTO_PROOF_REQUIRED",
        )
    pv_proof = db.execute(
        select(Proof).where(Proof.subject_type == "document_version", Proof.subject_id == str(pv.published_version_id))
    ).scalar_one_or_none()
    item.evidence = jsonable(
        {
            "milestone": milestone.name,
            "achieved_at": milestone.achieved_at,
            "pv_document_id": pv.id,
            "pv_title": pv.title,
            "pv_proof_code": pv_proof.public_code if pv_proof else None,
            "photo_proofs": [
                {"number": p.number, "code": p.public_code, "photos": len(p.leaves or [])} for p in proofs
            ],
        }
    )
    item.status = "release_requested"
    item.requested_by_id = user_id
    item.requested_at = utcnow()
    project = db.get(Project, item.project_id)
    emit(
        db,
        "escrow.release_requested",
        {
            "id": item.id,
            "number": item.number,
            "milestone": milestone.name,
            "amount": item.held_amount,
            "project_id": item.project_id,
            "project_name": project.name if project else "",
            "review_days": account.review_days,
            "link": "/espace-client/finances",
        },
        aggregate_type="escrow_item",
        aggregate_id=item.id,
        project_id=item.project_id,
    )
    return item


def client_approve(db: Session, item: EscrowItem, *, user: Any, proof: dict[str, Any]) -> None:
    if item.status != "release_requested":
        raise BusinessRuleError("Aucune demande de libération en attente", code="ESCROW_STATUS")
    item.status = "approved"
    item.client_decision = jsonable({"decision": "approved", "by": user.full_name, "at": utcnow(), "otp": proof})
    emit(
        db,
        "escrow.release_approved",
        {
            "id": item.id,
            "number": item.number,
            "amount": item.held_amount,
            "project_id": item.project_id,
            "link": "/erp/finances/sequestre",
        },
        aggregate_type="escrow_item",
        aggregate_id=item.id,
        project_id=item.project_id,
    )


def client_dispute(db: Session, item: EscrowItem, *, user: Any, reason: str) -> None:
    if item.status not in ("release_requested", "held"):
        raise BusinessRuleError("Contestation impossible à ce stade", code="ESCROW_STATUS")
    item.status = "disputed"
    item.dispute_reason = reason
    item.client_decision = jsonable({"decision": "disputed", "by": user.full_name, "at": utcnow(), "reason": reason})
    emit(
        db,
        "escrow.disputed",
        {
            "id": item.id,
            "number": item.number,
            "reason": reason[:300],
            "project_id": item.project_id,
            "link": "/erp/finances/sequestre",
        },
        aggregate_type="escrow_item",
        aggregate_id=item.id,
        project_id=item.project_id,
    )


def approve_release(db: Session, item: EscrowItem, *, principal: Any, reference: str | None) -> bool:
    """Double validation interne (Finance + Direction, deux personnes) ; la 2e validation exécute la libération."""
    if item.status != "approved":
        raise BusinessRuleError("Libération non validée par le client", code="ESCROW_STATUS")
    roles = set(principal.roles)
    role = (
        "DIRECTION"
        if "DIRECTION" in roles
        else "FINANCE"
        if "FINANCE" in roles
        else "ADMIN"
        if "ADMIN" in roles
        else None
    )
    if role is None:
        raise BusinessRuleError("Validation réservée à la Finance et à la Direction", code="APPROVAL_ROLE_REQUIRED")
    if any(a["user_id"] == str(principal.id) for a in item.approvals):
        raise BusinessRuleError(
            "Séparation des tâches : une seconde personne doit valider", code="SEGREGATION_OF_DUTIES"
        )
    item.approvals = [
        *item.approvals,
        {"user_id": str(principal.id), "name": principal.user.full_name, "role": role, "at": utcnow().isoformat()},
    ]
    audit.record(
        db,
        family="security",
        module="escrow",
        action="RELEASE_APPROVAL",
        resource_type="escrow_item",
        resource_id=item.id,
        project_id=item.project_id,
        criticality="HIGH",
    )
    if len(item.approvals) < 2:
        return False
    if not reference:
        raise BusinessRuleError(
            "Référence de l'ordre de libération transmis au partenaire requise", code="REFERENCE_REQUIRED"
        )
    account = db.get(EscrowAccount, item.account_id)
    amount = Decimal(item.held_amount or 0)
    account.balance_held = money(Decimal(account.balance_held) - amount)
    account.balance_released = money(Decimal(account.balance_released) + amount)
    _movement(db, item, "release", amount, reference=reference, actor_id=principal.id)
    item.status = "released"
    item.released_at = utcnow()
    item.release_reference = reference
    emit(
        db,
        "escrow.released",
        {
            "id": item.id,
            "number": item.number,
            "amount": amount,
            "project_id": item.project_id,
            "milestone": item.evidence.get("milestone"),
            "link": "/espace-client/finances",
        },
        aggregate_type="escrow_item",
        aggregate_id=item.id,
        project_id=item.project_id,
    )
    return True


def resolve_dispute(db: Session, item: EscrowItem, *, decision: str, note: str, principal: Any) -> None:
    """Médiation Direction : reprise du circuit de libération ou restitution au client."""
    if item.status != "disputed":
        raise BusinessRuleError("Aucune contestation en cours", code="ESCROW_STATUS")
    item.resolution_note = note
    if decision == "release":
        item.status = "approved"
        item.approvals = []
    else:
        account = db.get(EscrowAccount, item.account_id)
        amount = Decimal(item.held_amount or 0)
        account.balance_held = money(Decimal(account.balance_held) - amount)
        account.balance_refunded = money(Decimal(account.balance_refunded) + amount)
        _movement(db, item, "refund", amount, actor_id=principal.id, reference=note[:120])
        item.status = "refunded"
    audit.record(
        db,
        family="security",
        module="escrow",
        action="DISPUTE_RESOLVE",
        resource_type="escrow_item",
        resource_id=item.id,
        project_id=item.project_id,
        reason=note,
        diff={"decision": decision},
        criticality="HIGH",
    )


def overdue_reviews(db: Session) -> dict[str, Any]:
    """Job : demande de libération sans réponse du client dans le délai → alerte Direction (pas d'auto-libération)."""
    count = 0
    for item, account in db.execute(
        select(EscrowItem, EscrowAccount)
        .join(EscrowAccount, EscrowAccount.id == EscrowItem.account_id)
        .where(EscrowItem.status == "release_requested")
    ).all():
        if item.requested_at and item.requested_at + timedelta(days=account.review_days) < utcnow():
            if (item.evidence or {}).get("overdue_alerted"):
                continue
            item.evidence = {**item.evidence, "overdue_alerted": utcnow().isoformat()}
            emit(
                db,
                "escrow.review_overdue",
                {
                    "id": item.id,
                    "number": item.number,
                    "project_id": item.project_id,
                    "days": account.review_days,
                    "link": "/erp/finances/sequestre",
                },
                aggregate_type="escrow_item",
                aggregate_id=item.id,
                project_id=item.project_id,
            )
            count += 1
    return {"items": count}


def get_item(db: Session, item_id: uuid.UUID) -> EscrowItem:
    item = db.get(EscrowItem, item_id)
    if item is None:
        raise NotFound("Élément de séquestre introuvable")
    return item


def overview(db: Session, project_id: uuid.UUID, *, internal: bool) -> dict[str, Any]:
    from app.modules.finance.models import FundsCall
    from app.modules.projects.models import Milestone

    account = account_for(db, project_id)
    if account is None:
        return {"account": None, "items": []}
    items = (
        db.execute(select(EscrowItem).where(EscrowItem.account_id == account.id).order_by(EscrowItem.created_at))
        .scalars()
        .all()
    )
    out_items = []
    for item in items:
        call = db.get(FundsCall, item.funds_call_id)
        milestone = db.get(Milestone, item.milestone_id)
        data = {
            "id": item.id,
            "number": item.number,
            "funds_call": {"id": call.id, "number": call.number, "label": call.label, "status": call.status}
            if call
            else None,
            "milestone": {
                "id": milestone.id,
                "name": milestone.name,
                "status": milestone.status,
                "due_date": milestone.due_date,
            }
            if milestone
            else None,
            "amount": item.amount,
            "held_amount": item.held_amount,
            "status": item.status,
            "evidence": item.evidence,
            "requested_at": item.requested_at,
            "client_decision": item.client_decision or None,
            "dispute_reason": item.dispute_reason,
            "released_at": item.released_at,
        }
        if internal:
            data.update(
                {
                    "approvals": item.approvals,
                    "release_reference": item.release_reference,
                    "resolution_note": item.resolution_note,
                }
            )
        out_items.append(data)
    return jsonable(
        {
            "account": {
                "id": account.id,
                "partner_name": account.partner_name,
                "partner_reference": account.partner_reference if internal else None,
                "status": account.status,
                "review_days": account.review_days,
                "balance_held": account.balance_held,
                "balance_released": account.balance_released,
                "balance_refunded": account.balance_refunded,
                "terms": account.terms,
                "activated_at": account.activated_at,
            },
            "items": out_items,
        }
    )


__all__ = [
    "account_for",
    "activate",
    "approve_release",
    "attach",
    "client_approve",
    "client_dispute",
    "on_funds_call_payment",
    "overdue_reviews",
    "overview",
    "request_release",
    "resolve_dispute",
    "setup",
]
