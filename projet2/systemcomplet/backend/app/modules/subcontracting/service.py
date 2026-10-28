"""Sous-traitance §9 (étapes 43 → 61) : qualification, consultation multi-lots, offres, comparatif, négociation,
attribution, contrat, mobilisation, situations (contrôle terrain, retenue, avance, pénalités, blocage au-delà du
contrat sans dérogation), facturation, paiement, litiges (§9.3), clôture, notation."""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import money, qty, utcnow
from app.modules.identity.models import User
from app.modules.projects.models import Project
from app.modules.subcontracting.models import (
    Bid,
    BidLine,
    BidNegotiation,
    Claim,
    Dispute,
    DisputeEvent,
    Mobilization,
    Retention,
    Situation,
    SituationLine,
    Subcontract,
    SubcontractItem,
    Subcontractor,
    SubcontractorInvoice,
    SubcontractorQualification,
    SubcontractorRating,
    Tender,
    TenderInvitation,
    TenderLot,
)
from app.modules.subcontracting.trades import DECENNALE_TRADES
from app.modules.system.models import ActionItem, Setting

log = logging.getLogger("globus.subcontracting")

ACTIVE_STATUSES = ("qualified", "approved")
DEFAULT_CRITERIA = [
    {"key": "prix", "weight": 50},
    {"key": "delai", "weight": 20},
    {"key": "technique", "weight": 20},
    {"key": "historique", "weight": 10},
]


def party_user_ids(db: Session, organization_id: uuid.UUID | None) -> list[uuid.UUID]:
    if not organization_id:
        return []
    return list(
        db.execute(select(User.id).where(User.organization_id == organization_id, User.is_active.is_(True))).scalars()
    )


# ============================================================================ qualification (43)
QUALIFICATION_WEIGHTS = {"references": 25, "capacite": 20, "securite": 20, "finances": 15, "qualite": 20}


def qualify(
    db: Session,
    sub: Subcontractor,
    *,
    trade: str,
    criteria: dict[str, Any],
    references: list[Any],
    document_file_ids: list[str],
    decision: str,
    comment: str | None,
    user_id: uuid.UUID,
    valid_months: int = 24,
) -> SubcontractorQualification:
    """Grille notée sur 5 par critère → score /100 ; approbation impossible avec assurances expirées."""
    score = Decimal("0")
    for key, weight in QUALIFICATION_WEIGHTS.items():
        value = Decimal(str(criteria.get(key, 0) or 0))
        if value < 0 or value > 5:
            raise BusinessRuleError(f"Critère {key} : note entre 0 et 5")
        score += value / 5 * weight
    today = date.today()
    if decision == "approved":
        if not sub.insurance_rc_until or sub.insurance_rc_until < today:
            raise BusinessRuleError("Assurance responsabilité civile absente ou expirée", code="INSURANCE_EXPIRED")
        if trade in DECENNALE_TRADES and (not sub.insurance_decennale_until or sub.insurance_decennale_until < today):
            raise BusinessRuleError("Assurance décennale requise pour ce corps d'état", code="INSURANCE_EXPIRED")
        if score < 50:
            raise BusinessRuleError("Score de qualification insuffisant (< 50/100)", code="SCORE_TOO_LOW")
    row = SubcontractorQualification(
        subcontractor_id=sub.id,
        trade=trade,
        criteria=criteria,
        score=money(score),
        references=references,
        document_file_ids=document_file_ids,
        decision=decision,
        valid_until=today + timedelta(days=30 * valid_months) if decision == "approved" else None,
        decided_by_id=user_id,
        decided_at=utcnow(),
        comment=comment,
    )
    db.add(row)
    if decision == "approved":
        sub.status = "approved" if sub.status in ("qualified", "approved") else "qualified"
        if trade not in (sub.trades or []):
            sub.trades = [*(sub.trades or []), trade]
    elif decision == "rejected" and sub.status == "prospect":
        sub.status = "prospect"
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="QUALIFY",
        resource_type="subcontractor",
        resource_id=sub.id,
        actor_id=user_id,
        diff={"trade": trade, "score": str(row.score), "decision": decision},
    )
    return row


# ============================================================================ consultation (44 → 48)
def invite(
    db: Session, tender: Tender, subcontractor_ids: list[uuid.UUID], *, user_id: uuid.UUID
) -> list[TenderInvitation]:
    if tender.status not in ("draft", "published"):
        raise BusinessRuleError("Consultation close : invitations impossibles")
    created = []
    for sid in subcontractor_ids:
        sub = db.get(Subcontractor, sid)
        if sub is None or sub.deleted_at is not None:
            raise NotFound("Sous-traitant introuvable")
        if sub.status not in ACTIVE_STATUSES:
            raise BusinessRuleError(f"{sub.legal_name} n'est pas qualifié (statut {sub.status})", code="NOT_QUALIFIED")
        exists = db.execute(
            select(TenderInvitation).where(
                TenderInvitation.tender_id == tender.id, TenderInvitation.subcontractor_id == sid
            )
        ).scalar_one_or_none()
        if exists:
            continue
        invitation = TenderInvitation(tender_id=tender.id, subcontractor_id=sid)
        db.add(invitation)
        created.append(invitation)
    db.flush()
    if tender.status == "published" and created:
        _notify_invitations(db, tender, created)
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="INVITE",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
        actor_id=user_id,
        diff={"invited": [str(i.subcontractor_id) for i in created]},
    )
    return created


def _notify_invitations(db: Session, tender: Tender, invitations: list[TenderInvitation]) -> None:
    from app.modules.notifications.service import queue_external

    user_ids: list[uuid.UUID] = []
    for invitation in invitations:
        sub = db.get(Subcontractor, invitation.subcontractor_id)
        if sub is None:
            continue
        users = party_user_ids(db, sub.organization_id)
        user_ids.extend(users)
        if not users and sub.email:
            queue_external(
                db,
                channel="email",
                recipient=sub.email,
                template_code="tender.invitation",
                context={
                    "number": tender.number,
                    "title": tender.title,
                    "deadline": tender.deadline,
                    "link": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/extranet/consultations/{tender.id}",
                },
            )
    emit(
        db,
        "tender.published",
        {
            "id": tender.id,
            "number": tender.number,
            "title": tender.title,
            "deadline": tender.deadline,
            "invited_user_ids": [str(u) for u in user_ids],
            "link": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/extranet/consultations/{tender.id}",
        },
        aggregate_type="tender",
        aggregate_id=tender.id,
        project_id=tender.project_id,
    )


def publish_tender(db: Session, tender: Tender, *, user_id: uuid.UUID) -> Tender:
    if tender.status != "draft":
        raise BusinessRuleError("Consultation déjà publiée")
    if not tender.lots or not any(lot.items for lot in tender.lots):
        raise BusinessRuleError("Au moins un lot avec métré est requis", code="TENDER_INCOMPLETE")
    if tender.deadline <= utcnow():
        raise BusinessRuleError("La date limite doit être future")
    invitations = db.execute(select(TenderInvitation).where(TenderInvitation.tender_id == tender.id)).scalars().all()
    if not invitations:
        raise BusinessRuleError("Inviter au moins un sous-traitant qualifié", code="NO_INVITATION")
    weights = sum(int(c.get("weight", 0)) for c in (tender.quality_criteria or DEFAULT_CRITERIA))
    if weights != 100:
        raise BusinessRuleError("La somme des pondérations des critères doit faire 100")
    tender.quality_criteria = tender.quality_criteria or DEFAULT_CRITERIA
    tender.status = "published"
    tender.published_at = utcnow()
    _notify_invitations(db, tender, list(invitations))
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="PUBLISH",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
        actor_id=user_id,
    )
    return tender


def submit_bid(
    db: Session,
    tender: Tender,
    *,
    tender_lot_id: uuid.UUID,
    subcontractor: Subcontractor,
    lines: list[dict[str, Any]],
    duration_days: int | None,
    is_variant: bool,
    variant_description: str | None,
    exclusions: str | None,
    memo_file_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
) -> Bid:
    """Dépôt d'offre (V4-SUB-14) : uniquement sur invitation, avant la date limite, prix par ligne de métré."""
    if tender.status != "published":
        raise BusinessRuleError("Consultation non ouverte aux offres")
    if tender.deadline < utcnow():
        raise BusinessRuleError("Date limite de remise dépassée", code="DEADLINE_PASSED")
    invitation = db.execute(
        select(TenderInvitation).where(
            TenderInvitation.tender_id == tender.id, TenderInvitation.subcontractor_id == subcontractor.id
        )
    ).scalar_one_or_none()
    if invitation is None or invitation.status == "declined":
        raise Forbidden("Aucune invitation active pour cette consultation", code="NOT_INVITED")
    lot = next((lt for lt in tender.lots if lt.id == tender_lot_id), None)
    if lot is None:
        raise NotFound("Lot introuvable")
    if is_variant and not tender.variants_allowed:
        raise BusinessRuleError("Variantes non autorisées pour cette consultation")
    existing = db.execute(
        select(Bid).where(
            Bid.tender_lot_id == lot.id,
            Bid.subcontractor_id == subcontractor.id,
            Bid.is_variant.is_(is_variant),
            Bid.status.in_(["draft", "submitted"]),
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.status = "withdrawn"
    items = {str(i.id): i for i in lot.items}
    priced = {str(raw["tender_item_id"]): raw for raw in lines if raw.get("tender_item_id")}
    missing = [i.designation for i in lot.items if str(i.id) not in priced]
    if missing and not is_variant:
        raise BusinessRuleError(
            "Toutes les lignes du métré doivent être chiffrées",
            code="INCOMPLETE_BID",
            details={"missing": missing[:20]},
        )
    bid = Bid(
        tender_id=tender.id,
        tender_lot_id=lot.id,
        subcontractor_id=subcontractor.id,
        duration_days=duration_days,
        is_variant=is_variant,
        variant_description=variant_description,
        exclusions=exclusions,
        technical_memo_file_id=memo_file_id,
        status="submitted",
        submitted_at=utcnow(),
    )
    total = Decimal("0")
    for key, raw in priced.items():
        item = items.get(key)
        if item is None:
            raise BusinessRuleError("Ligne hors métré du lot")
        price = money(raw["unit_price"])
        if price < 0:
            raise BusinessRuleError("Prix unitaire invalide")
        line_total = money(Decimal(item.quantity) * price)
        bid.lines.append(
            BidLine(
                tender_item_id=item.id,
                designation=item.designation,
                unit=item.unit,
                quantity=item.quantity,
                unit_price=price,
                total=line_total,
            )
        )
        total += line_total
    for raw in lines:
        if not raw.get("tender_item_id") and is_variant:
            line_total = money(Decimal(str(raw["quantity"])) * Decimal(str(raw["unit_price"])))
            bid.lines.append(
                BidLine(
                    designation=raw["designation"],
                    unit=raw.get("unit", "u"),
                    quantity=qty(raw["quantity"]),
                    unit_price=money(raw["unit_price"]),
                    total=line_total,
                )
            )
            total += line_total
    bid.amount = money(total)
    db.add(bid)
    invitation.status = "submitted"
    invitation.responded_at = utcnow()
    db.flush()
    project = db.get(Project, tender.project_id)
    emit(
        db,
        "bid.submitted",
        {
            "id": bid.id,
            "tender_id": tender.id,
            "tender_number": tender.number,
            "subcontractor": subcontractor.legal_name,
            "amount": bid.amount,
            "lot": lot.name,
            "project_name": project.name if project else "",
        },
        aggregate_type="bid",
        aggregate_id=bid.id,
        project_id=tender.project_id,
    )
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="BID_SUBMIT",
        resource_type="bid",
        resource_id=bid.id,
        project_id=tender.project_id,
        actor_id=user_id,
        actor_type="user",
        diff={"amount": str(bid.amount), "lot": lot.code, "variant": is_variant},
    )
    return bid


def partner_history(db: Session, sub: Subcontractor) -> dict[str, Any]:
    contracts = db.execute(
        select(func.count())
        .select_from(Subcontract)
        .where(Subcontract.subcontractor_id == sub.id, Subcontract.status.in_(["completed", "closed"]))
    ).scalar_one()
    ratings = (
        db.execute(select(SubcontractorRating).where(SubcontractorRating.subcontractor_id == sub.id)).scalars().all()
    )
    return {
        "completed_contracts": contracts,
        "score": sub.score,
        "on_time_rate": sub.on_time_rate,
        "dispute_rate": sub.dispute_rate,
        "rating_average": round(sum(r.average for r in ratings) / len(ratings), 2) if ratings else None,
    }


def compare_bids(db: Session, tender: Tender, tender_lot_id: uuid.UUID) -> dict[str, Any]:
    """Comparatif (46) : montants, écart à l'estimation, prix ligne à ligne, délais, historique, score pondéré."""
    lot = next((lt for lt in tender.lots if lt.id == tender_lot_id), None)
    if lot is None:
        raise NotFound("Lot introuvable")
    bids = (
        db.execute(
            select(Bid).where(
                Bid.tender_lot_id == lot.id, Bid.status.in_(["submitted", "shortlisted", "awarded", "rejected"])
            )
        )
        .scalars()
        .all()
    )
    criteria = {c["key"]: Decimal(str(c["weight"])) for c in (tender.quality_criteria or DEFAULT_CRITERIA)}
    amounts = [Decimal(b.final_amount or b.amount) for b in bids if Decimal(b.final_amount or b.amount) > 0]
    durations = [b.duration_days for b in bids if b.duration_days]
    best_amount = min(amounts) if amounts else None
    best_duration = min(durations) if durations else None
    rows = []
    for bid in bids:
        sub = db.get(Subcontractor, bid.subcontractor_id)
        amount = Decimal(bid.final_amount or bid.amount)
        history = partner_history(db, sub) if sub else {}
        price_score = (best_amount / amount * 100) if best_amount and amount else Decimal("0")
        delay_score = (
            (Decimal(best_duration) / Decimal(bid.duration_days) * 100)
            if best_duration and bid.duration_days
            else Decimal("50")
        )
        tech_score = Decimal(bid.technical_score or 0)
        history_score = Decimal(str(sub.score or 0)) if sub else Decimal("0")
        total = (
            price_score * criteria.get("prix", 0)
            + delay_score * criteria.get("delai", 0)
            + tech_score * criteria.get("technique", 0)
            + history_score * criteria.get("historique", 0)
        ) / 100
        bid.total_score = money(total)
        rows.append(
            {
                "bid_id": bid.id,
                "subcontractor_id": bid.subcontractor_id,
                "subcontractor": sub.legal_name if sub else "",
                "amount": bid.amount,
                "final_amount": bid.final_amount,
                "duration_days": bid.duration_days,
                "is_variant": bid.is_variant,
                "exclusions": bid.exclusions,
                "status": bid.status,
                "technical_score": bid.technical_score,
                "total_score": bid.total_score,
                "delta_vs_estimate_pct": round(
                    float((amount - Decimal(lot.estimated_amount)) * 100 / Decimal(lot.estimated_amount)), 1
                )
                if Decimal(lot.estimated_amount or 0) > 0
                else None,
                "history": history,
                "breakdown": {
                    "prix": round(float(price_score), 1),
                    "delai": round(float(delay_score), 1),
                    "technique": float(tech_score),
                    "historique": float(history_score),
                },
            }
        )
    items = []
    for item in lot.items:
        prices = [
            (bid.subcontractor_id, line.unit_price)
            for bid in bids
            for line in bid.lines
            if line.tender_item_id == item.id
        ]
        values = [Decimal(p) for _, p in prices]
        items.append(
            {
                "item_id": item.id,
                "designation": item.designation,
                "unit": item.unit,
                "quantity": item.quantity,
                "min": min(values) if values else None,
                "max": max(values) if values else None,
                "avg": money(sum(values) / len(values)) if values else None,
                "prices": [{"subcontractor_id": s, "unit_price": p} for s, p in prices],
            }
        )
    db.flush()
    return {
        "lot": {"id": lot.id, "code": lot.code, "name": lot.name, "estimated_amount": lot.estimated_amount},
        "criteria": tender.quality_criteria or DEFAULT_CRITERIA,
        "bids": sorted(rows, key=lambda r: r["total_score"] or 0, reverse=True),
        "items": items,
    }


def negotiate(
    db: Session,
    bid: Bid,
    *,
    proposed_by: str,
    amount: Decimal,
    duration_days: int | None,
    comment: str | None,
    author_id: uuid.UUID | None,
) -> BidNegotiation:
    """Négociation (47) : propositions / contre-propositions historisées."""
    if bid.status not in ("submitted", "shortlisted"):
        raise BusinessRuleError("Offre non négociable dans son état actuel")
    last = (
        db.execute(select(BidNegotiation).where(BidNegotiation.bid_id == bid.id).order_by(BidNegotiation.round.desc()))
        .scalars()
        .first()
    )
    if last is not None and last.status == "proposed":
        if last.proposed_by == proposed_by:
            raise BusinessRuleError("En attente de la réponse de l'autre partie")
        last.status = "countered"
    round_no = (last.round + 1) if last else 1
    row = BidNegotiation(
        bid_id=bid.id,
        round=round_no,
        proposed_by=proposed_by,
        amount=money(amount),
        duration_days=duration_days,
        comment=comment,
        author_id=author_id,
    )
    db.add(row)
    bid.status = "shortlisted"
    db.flush()
    return row


def accept_negotiation(db: Session, bid: Bid, *, accepted_by: str) -> BidNegotiation:
    last = (
        db.execute(select(BidNegotiation).where(BidNegotiation.bid_id == bid.id).order_by(BidNegotiation.round.desc()))
        .scalars()
        .first()
    )
    if last is None or last.status != "proposed":
        raise BusinessRuleError("Aucune proposition en attente")
    if last.proposed_by == accepted_by:
        raise BusinessRuleError("Une partie ne peut accepter sa propre proposition")
    last.status = "accepted"
    bid.final_amount = last.amount
    if last.duration_days:
        bid.duration_days = last.duration_days
    return last


def award(
    db: Session,
    tender: Tender,
    bid: Bid,
    *,
    user_id: uuid.UUID,
    title: str | None,
    retention_pct: Decimal,
    advance_amount: Decimal,
    advance_recovery_pct: Decimal,
    penalty_per_day: Decimal,
    start_date: date | None,
    end_date: date | None,
    terms: str | None,
    penalty_cap_pct: Decimal = Decimal("10"),
    tax_rate: Decimal = Decimal("0"),
) -> Subcontract:
    """Attribution (48) → contrat (49) : lignes reprises de l'offre (prix négociés au prorata)."""
    if bid.tender_id != tender.id or bid.status not in ("submitted", "shortlisted"):
        raise BusinessRuleError("Offre non attribuable")
    if tender.status not in ("published", "closed"):
        raise BusinessRuleError("Consultation non attribuable")
    lot = db.get(TenderLot, bid.tender_lot_id)
    already = db.execute(select(Bid.id).where(Bid.tender_lot_id == bid.tender_lot_id, Bid.status == "awarded")).first()
    if already:
        raise Conflict("Lot déjà attribué", code="LOT_ALREADY_AWARDED")
    sub = db.get(Subcontractor, bid.subcontractor_id)
    if sub is None or sub.status not in ACTIVE_STATUSES:
        raise BusinessRuleError("Sous-traitant non qualifié ou suspendu", code="NOT_QUALIFIED")
    final = Decimal(bid.final_amount or bid.amount)
    ratio = final / Decimal(bid.amount) if Decimal(bid.amount) > 0 else Decimal("1")
    contract = Subcontract(
        number=next_number(db, "subcontract"),
        tender_id=tender.id,
        bid_id=bid.id,
        project_id=tender.project_id,
        lot_id=lot.lot_id if lot else None,
        subcontractor_id=sub.id,
        title=title or f"{tender.title} — {lot.name if lot else ''}",
        retention_pct=retention_pct,
        advance_amount=money(advance_amount),
        advance_recovery_pct=advance_recovery_pct,
        penalty_per_day=money(penalty_per_day),
        penalty_cap_pct=penalty_cap_pct,
        start_date=start_date,
        end_date=end_date,
        terms=terms,
        status="draft",
        created_by_id=user_id,
        tax_rate=tax_rate,
    )
    total = Decimal("0")
    for index, line in enumerate(bid.lines):
        price = money(Decimal(line.unit_price) * ratio)
        line_total = money(Decimal(line.quantity) * price)
        contract.items.append(
            SubcontractItem(
                sort_order=index,
                designation=line.designation,
                unit=line.unit,
                quantity=line.quantity,
                unit_price=price,
                total=line_total,
            )
        )
        total += line_total
    contract.amount = money(total)
    db.add(contract)
    bid.status = "awarded"
    for other in db.execute(
        select(Bid).where(
            Bid.tender_lot_id == bid.tender_lot_id, Bid.id != bid.id, Bid.status.in_(["submitted", "shortlisted"])
        )
    ).scalars():
        other.status = "rejected"
    lots_awarded = {
        row
        for row in db.execute(
            select(Bid.tender_lot_id).where(Bid.tender_id == tender.id, Bid.status == "awarded")
        ).scalars()
    }
    if all(lt.id in lots_awarded for lt in tender.lots):
        tender.status = "awarded"
        tender.closed_at = tender.closed_at or utcnow()
    db.flush()
    emit(
        db,
        "bid.awarded",
        {
            "id": bid.id,
            "tender_number": tender.number,
            "lot": lot.name if lot else "",
            "subcontract_id": contract.id,
            "subcontractor_user_ids": [str(u) for u in party_user_ids(db, sub.organization_id)],
        },
        aggregate_type="bid",
        aggregate_id=bid.id,
        project_id=tender.project_id,
    )
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="AWARD",
        resource_type="tender",
        resource_id=tender.id,
        project_id=tender.project_id,
        actor_id=user_id,
        diff={"bid": str(bid.id), "subcontractor": sub.legal_name, "amount": str(contract.amount)},
        criticality="HIGH",
    )
    return contract


# ============================================================================ contrat & mobilisation (49 → 50)
def compute_contract(contract: Subcontract) -> None:
    total = Decimal("0")
    for item in contract.items:
        item.total = money(Decimal(item.quantity) * Decimal(item.unit_price))
        total += item.total
    contract.amount = money(total)


def contract_pdf(db: Session, contract: Subcontract) -> bytes:
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

    sub = db.get(Subcontractor, contract.subcontractor_id)
    project = db.get(Project, contract.project_id)
    doc = PdfDocument(
        title="MARCHÉ DE SOUS-TRAITANCE",
        number=contract.number,
        issued_on=date.today(),
        parties=[company_party("Entreprise principale"), ("Sous-traitant", organization_lines(sub))],
        meta=[
            ("Projet", project_label(project)),
            ("Objet", contract.title),
            ("Période", f"du {fmt_date(contract.start_date)} au {fmt_date(contract.end_date)}"),
            ("Retenue de garantie", f"{contract.retention_pct} %"),
            ("Avance", fmt_money(contract.advance_amount, contract.currency)),
            ("Récupération de l'avance", f"{contract.advance_recovery_pct} % par situation"),
            (
                "Pénalités de retard",
                f"{fmt_money(contract.penalty_per_day, contract.currency)} / jour "
                f"(plafond {contract.penalty_cap_pct} %)",
            ),
        ],
        columns=["Désignation", "Unité", "Quantité", "PU HT", "Total HT"],
        col_widths=[200, 50, 70, 85, 85],
        rows=[
            [
                i.designation,
                i.unit,
                fmt_qty(i.quantity),
                fmt_money(i.unit_price, contract.currency),
                fmt_money(i.total, contract.currency),
            ]
            for i in contract.items
        ],
        totals=[("Montant du marché HT", fmt_money(contract.amount, contract.currency))],
        paragraphs=[
            (
                "Conditions",
                contract.terms
                or "Conditions générales de sous-traitance GLOBUS ENGINEERING. "
                "Les situations sont validées après constat terrain ; toute quantité au-delà du marché exige "
                "un avenant ou une dérogation écrite.",
            )
        ],
        amount_words=amount_in_words(contract.amount, contract.currency),
        amount_words_label="Arrêté le présent marché à la somme hors taxes de",
        signature_blocks=["Pour GLOBUS ENGINEERING", f"Pour {sub.legal_name}" if sub else "Le sous-traitant"],
    )
    return render(doc)


def send_contract(db: Session, contract: Subcontract, *, user_id: uuid.UUID) -> Subcontract:
    from app.core.files import store_generated

    if contract.status not in ("draft", "sent"):
        raise BusinessRuleError("Contrat déjà signé")
    if not contract.items or Decimal(contract.amount) <= 0:
        raise BusinessRuleError("Contrat sans bordereau de prix")
    stored = store_generated(
        db,
        contract_pdf(db, contract),
        filename=f"{contract.number}.pdf",
        mime="application/pdf",
        purpose="subcontracts",
        classification="confidential",
        uploaded_by_id=user_id,
    )
    contract.document_id = stored.id
    contract.status = "sent"
    sub = db.get(Subcontractor, contract.subcontractor_id)
    emit(
        db,
        "signature.requested",
        {
            "title": f"Marché {contract.number}",
            "link": f"/extranet/marches/{contract.id}",
            "signer_ids": [str(u) for u in party_user_ids(db, sub.organization_id if sub else None)],
        },
        aggregate_type="subcontract",
        aggregate_id=contract.id,
        project_id=contract.project_id,
    )
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CONTRACT_SEND",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        actor_id=user_id,
    )
    return contract


def sign_contract(
    db: Session, contract: Subcontract, *, signer_name: str, user_id: uuid.UUID | None, otp: dict[str, Any] | None
) -> Subcontract:
    """Signature (OTP du représentant du sous-traitant) → engagement budgétaire + compte de retenue."""
    from app.modules.finance.service import upsert_commitment

    if contract.status != "sent":
        raise BusinessRuleError("Contrat non transmis pour signature")
    contract.status = "signed"
    contract.signed_at = utcnow()
    contract.signed_by_name = signer_name
    sub = db.get(Subcontractor, contract.subcontractor_id)
    upsert_commitment(
        db,
        project_id=contract.project_id,
        lot_id=contract.lot_id,
        category="sous_traitance",
        source_type="subcontract",
        source_id=contract.id,
        label=f"Marché {contract.number} — {sub.legal_name if sub else ''}",
        amount=Decimal(contract.amount),
    )
    if db.execute(select(Retention.id).where(Retention.subcontract_id == contract.id)).first() is None:
        db.add(Retention(subcontract_id=contract.id))
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CONTRACT_SIGN",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        actor_id=user_id,
        actor_type="user",
        diff={"signer": signer_name, "otp": otp or {}},
        criticality="HIGH",
    )
    return contract


def mobilize(db: Session, contract: Subcontract, *, data: dict[str, Any], user_id: uuid.UUID) -> Mobilization:
    if contract.status not in ("signed", "mobilized", "in_progress"):
        raise BusinessRuleError("Contrat non signé : mobilisation impossible", code="CONTRACT_NOT_SIGNED")
    row = Mobilization(subcontract_id=contract.id, **data)
    db.add(row)
    if row.site_access_granted and row.safety_induction_done and contract.status == "signed":
        contract.status = "mobilized"
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="MOBILIZE",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        actor_id=user_id,
        diff={"team_size": row.team_size, "induction": row.safety_induction_done},
    )
    return row


def advance_invoice(db: Session, contract: Subcontract, *, user_id: uuid.UUID) -> SubcontractorInvoice:
    if Decimal(contract.advance_amount) <= 0:
        raise BusinessRuleError("Aucune avance prévue au marché")
    if contract.status not in ("signed", "mobilized", "in_progress"):
        raise BusinessRuleError("Avance payable après signature")
    exists = db.execute(
        select(SubcontractorInvoice.id).where(
            SubcontractorInvoice.subcontract_id == contract.id, SubcontractorInvoice.kind == "advance"
        )
    ).first()
    if exists:
        raise Conflict("Avance déjà facturée")
    invoice = SubcontractorInvoice(
        number=next_number(db, "subcontractor_invoice"),
        reference=f"AVANCE-{contract.number}",
        kind="advance",
        subcontractor_id=contract.subcontractor_id,
        subcontract_id=contract.id,
        project_id=contract.project_id,
        invoice_date=date.today(),
        due_date=date.today(),
        amount_ht=contract.advance_amount,
        amount=contract.advance_amount,
        status="approved_for_payment",
        source="system",
        validated_by_id=user_id,
        validated_at=utcnow(),
    )
    db.add(invoice)
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="ADVANCE",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        actor_id=user_id,
        diff={"amount": str(contract.advance_amount)},
        criticality="MEDIUM",
    )
    return invoice


# ============================================================================ situations (52 → 55)
def _previous_quantities(
    db: Session, contract: Subcontract, exclude_id: uuid.UUID | None = None
) -> dict[uuid.UUID, Decimal]:
    rows = db.execute(
        select(SituationLine.item_id, SituationLine.checked_quantity, SituationLine.period_quantity, Situation.id)
        .join(Situation, Situation.id == SituationLine.situation_id)
        .where(
            Situation.subcontract_id == contract.id, Situation.status.in_(["validated", "invoiced", "paid", "disputed"])
        )
    ).all()
    out: dict[uuid.UUID, Decimal] = {}
    for item_id, checked, period, situation_id in rows:
        if exclude_id and situation_id == exclude_id:
            continue
        out[item_id] = out.get(item_id, Decimal("0")) + Decimal(checked if checked is not None else period)
    return out


def _advance_recovered_total(db: Session, contract: Subcontract, exclude_id: uuid.UUID | None = None) -> Decimal:
    stmt = select(func.coalesce(func.sum(Situation.advance_recovered), 0)).where(
        Situation.subcontract_id == contract.id, Situation.status.in_(["validated", "invoiced", "paid", "disputed"])
    )
    if exclude_id:
        stmt = stmt.where(Situation.id != exclude_id)
    return Decimal(db.execute(stmt).scalar_one())


def _penalties_total(db: Session, contract: Subcontract, exclude_id: uuid.UUID | None = None) -> Decimal:
    stmt = select(func.coalesce(func.sum(Situation.penalties), 0)).where(
        Situation.subcontract_id == contract.id, Situation.status.in_(["validated", "invoiced", "paid", "disputed"])
    )
    if exclude_id:
        stmt = stmt.where(Situation.id != exclude_id)
    return Decimal(db.execute(stmt).scalar_one())


def compute_situation(
    db: Session, situation: Situation, contract: Subcontract, *, penalties_override: Decimal | None = None
) -> None:
    """Cumul, reste à faire, brut, avance récupérée, retenue de garantie, pénalités, net ; détection du dépassement."""
    previous = _previous_quantities(db, contract, exclude_id=situation.id)
    items = {i.id: i for i in contract.items}
    gross = Decimal("0")
    cumulative_total = Decimal("0")
    exceeds = False
    for line in situation.lines:
        item = items[line.item_id]
        quantity = Decimal(line.checked_quantity if line.checked_quantity is not None else line.period_quantity)
        line.previous_quantity = qty(previous.get(item.id, Decimal("0")))
        line.cumulative_quantity = qty(Decimal(line.previous_quantity) + quantity)
        line.remaining_quantity = qty(Decimal(item.quantity) - Decimal(line.cumulative_quantity))
        line.progress_pct = (
            (Decimal(line.cumulative_quantity) * 100 / Decimal(item.quantity)).quantize(Decimal("0.01"))
            if Decimal(item.quantity) > 0
            else Decimal("0")
        )
        line.amount = money(quantity * Decimal(item.unit_price))
        line.cumulative_amount = money(Decimal(line.cumulative_quantity) * Decimal(item.unit_price))
        if Decimal(line.cumulative_quantity) > Decimal(item.quantity):
            exceeds = True
        gross += Decimal(line.amount)
    for item_id, quantity in previous.items():
        item = items.get(item_id)
        if item and item_id not in {line.item_id for line in situation.lines}:
            cumulative_total += quantity * Decimal(item.unit_price)
    cumulative_total += sum((Decimal(line.cumulative_amount) for line in situation.lines), Decimal("0"))
    situation.gross_amount = money(gross)
    situation.cumulative_amount = money(cumulative_total)
    situation.previous_cumulative_amount = money(cumulative_total - gross)
    if cumulative_total > Decimal(contract.amount):
        exceeds = True
    situation.exceeds_contract = exceeds
    advance_left = Decimal(contract.advance_amount) - _advance_recovered_total(db, contract, exclude_id=situation.id)
    situation.advance_recovered = money(
        max(Decimal("0"), min(advance_left, gross * Decimal(contract.advance_recovery_pct) / 100))
    )
    situation.retention_amount = money(gross * Decimal(contract.retention_pct) / 100)
    if penalties_override is not None:
        penalties = Decimal(penalties_override)
    else:
        penalties = Decimal("0")
        if contract.end_date and situation.period_end > contract.end_date and Decimal(contract.penalty_per_day) > 0:
            late_days = (situation.period_end - max(situation.period_start, contract.end_date)).days
            penalties = Decimal(late_days) * Decimal(contract.penalty_per_day)
    cap = Decimal(contract.amount) * Decimal(contract.penalty_cap_pct) / 100 - _penalties_total(
        db, contract, exclude_id=situation.id
    )
    situation.penalties = money(max(Decimal("0"), min(penalties, cap)))
    situation.net_amount = money(
        gross
        - Decimal(situation.advance_recovered)
        - Decimal(situation.retention_amount)
        - Decimal(situation.penalties)
    )


def create_situation(
    db: Session,
    contract: Subcontract,
    *,
    period_start: date,
    period_end: date,
    lines: list[dict[str, Any]],
    user_id: uuid.UUID | None,
) -> Situation:
    if contract.status not in ("signed", "mobilized", "in_progress"):
        raise BusinessRuleError("Situations possibles sur un marché signé et mobilisé", code="CONTRACT_NOT_ACTIVE")
    if period_end < period_start:
        raise BusinessRuleError("Période invalide")
    open_one = db.execute(
        select(Situation.id).where(
            Situation.subcontract_id == contract.id, Situation.status.in_(["draft", "submitted", "field_checked"])
        )
    ).first()
    if open_one:
        raise Conflict("Une situation est déjà en cours d'instruction", code="SITUATION_IN_PROGRESS")
    sequence = (
        db.execute(
            select(func.coalesce(func.max(Situation.sequence), 0)).where(Situation.subcontract_id == contract.id)
        ).scalar_one()
        or 0
    ) + 1
    situation = Situation(
        number=next_number(db, "situation"),
        subcontract_id=contract.id,
        sequence=sequence,
        period_start=period_start,
        period_end=period_end,
        status="draft",
        submitted_by_id=user_id,
    )
    items = {str(i.id): i for i in contract.items}
    seen = set()
    for raw in lines:
        key = str(raw["item_id"])
        if key not in items:
            raise BusinessRuleError("Ligne hors bordereau du marché", code="ITEM_NOT_IN_CONTRACT")
        if key in seen:
            raise BusinessRuleError("Ligne en double")
        seen.add(key)
        period_quantity = qty(raw["period_quantity"])
        if period_quantity < 0:
            raise BusinessRuleError("Quantité négative")
        situation.lines.append(SituationLine(item_id=items[key].id, period_quantity=period_quantity))
    if not situation.lines:
        raise BusinessRuleError("Situation vide")
    db.add(situation)
    db.flush()
    compute_situation(db, situation, contract)
    if contract.status in ("signed", "mobilized"):
        contract.status = "in_progress"
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="SITUATION_CREATE",
        resource_type="situation",
        resource_id=situation.id,
        project_id=contract.project_id,
        actor_id=user_id,
        diff={"gross": str(situation.gross_amount), "exceeds": situation.exceeds_contract},
    )
    return situation


def submit_situation(
    db: Session, situation: Situation, contract: Subcontract, *, user_id: uuid.UUID | None
) -> Situation:
    if situation.status != "draft":
        raise BusinessRuleError("Situation déjà soumise")
    if not situation.photo_file_ids:
        raise BusinessRuleError("Photos probatoires obligatoires", code="PROOF_REQUIRED")
    compute_situation(db, situation, contract)
    situation.status = "submitted"
    situation.submitted_at = utcnow()
    situation.submitted_by_id = user_id or situation.submitted_by_id
    sub = db.get(Subcontractor, contract.subcontractor_id)
    project = db.get(Project, contract.project_id)
    emit(
        db,
        "situation.submitted",
        {
            "id": situation.id,
            "number": situation.number,
            "subcontractor": sub.legal_name if sub else "",
            "gross_amount": situation.gross_amount,
            "project_name": project.name if project else "",
        },
        aggregate_type="situation",
        aggregate_id=situation.id,
        project_id=contract.project_id,
    )
    if situation.exceeds_contract and not situation.derogation_granted:
        _blocked(db, situation, contract)
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="SITUATION_SUBMIT",
        resource_type="situation",
        resource_id=situation.id,
        project_id=contract.project_id,
        actor_id=user_id,
    )
    return situation


def _blocked(db: Session, situation: Situation, contract: Subcontract) -> None:
    already = db.execute(
        select(ActionItem.id).where(
            ActionItem.entity_type == "situation",
            ActionItem.entity_id == str(situation.id),
            ActionItem.status == "open",
        )
    ).first()
    if already:
        return
    excess = max(Decimal("0"), Decimal(situation.cumulative_amount) - Decimal(contract.amount))
    emit(
        db,
        "situation.blocked",
        {"id": situation.id, "number": situation.number, "excess": excess},
        aggregate_type="situation",
        aggregate_id=situation.id,
        project_id=contract.project_id,
    )
    db.add(
        ActionItem(
            title=f"Situation {situation.number} au-delà du marché",
            module="subcontracting",
            entity_type="situation",
            entity_id=str(situation.id),
            project_id=contract.project_id,
            assignee_role="DIRECTION",
            priority="high",
            description="Dépassement contractuel : avenant ou dérogation motivée requise avant validation.",
        )
    )


def field_check(
    db: Session,
    situation: Situation,
    contract: Subcontract,
    *,
    checked: dict[str, Decimal],
    notes: str | None,
    user_id: uuid.UUID,
) -> Situation:
    """Constat terrain (54) : quantités constatées par le conducteur / chef de chantier."""
    if situation.status != "submitted":
        raise BusinessRuleError("Situation non soumise")
    by_id = {str(line.id): line for line in situation.lines}
    for line_id, value in checked.items():
        line = by_id.get(str(line_id))
        if line is None:
            raise BusinessRuleError("Ligne inconnue")
        if Decimal(value) < 0:
            raise BusinessRuleError("Quantité constatée invalide")
        line.checked_quantity = qty(value)
    for line in situation.lines:
        if line.checked_quantity is None:
            line.checked_quantity = line.period_quantity
    compute_situation(db, situation, contract)
    situation.status = "field_checked"
    situation.field_check_notes = notes
    situation.field_checked_by_id = user_id
    situation.field_checked_at = utcnow()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="SITUATION_FIELD_CHECK",
        resource_type="situation",
        resource_id=situation.id,
        project_id=contract.project_id,
        actor_id=user_id,
        diff={"gross": str(situation.gross_amount), "notes": notes},
    )
    return situation


def grant_derogation(
    db: Session, situation: Situation, contract: Subcontract, *, user_id: uuid.UUID, reason: str
) -> Situation:
    if not situation.exceeds_contract:
        raise BusinessRuleError("Aucun dépassement à déroger")
    if len(reason.strip()) < 15:
        raise BusinessRuleError("Justification détaillée requise")
    situation.derogation_granted = True
    situation.derogation_by_id = user_id
    situation.derogation_reason = reason
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="SITUATION_DEROGATION",
        resource_type="situation",
        resource_id=situation.id,
        project_id=contract.project_id,
        actor_id=user_id,
        reason=reason,
        criticality="HIGH",
    )
    return situation


def validate_situation(
    db: Session,
    situation: Situation,
    contract: Subcontract,
    *,
    user_id: uuid.UUID,
    penalties_override: Decimal | None = None,
    penalties_reason: str | None = None,
) -> Situation:
    """Validation (55) : bloquée au-delà du marché sans dérogation (V4-SUB-15) ; retenue et coût projet constatés."""
    from app.modules.finance.service import record_expense

    if situation.status != "field_checked":
        raise BusinessRuleError("Le constat terrain doit précéder la validation", code="FIELD_CHECK_REQUIRED")
    if penalties_override is not None and not (penalties_reason or "").strip():
        raise BusinessRuleError("Motif requis pour modifier les pénalités")
    compute_situation(db, situation, contract, penalties_override=penalties_override)
    if situation.exceeds_contract and not situation.derogation_granted:
        _blocked(db, situation, contract)
        raise BusinessRuleError(
            "Situation au-delà du marché : dérogation ou avenant requis",
            code="SITUATION_EXCEEDS_CONTRACT",
            details={"contract_amount": str(contract.amount), "cumulative_amount": str(situation.cumulative_amount)},
        )
    situation.status = "validated"
    situation.validated_by_id = user_id
    situation.validated_at = utcnow()
    retention = db.execute(select(Retention).where(Retention.subcontract_id == contract.id)).scalar_one_or_none()
    if retention is None:
        retention = Retention(subcontract_id=contract.id)
        db.add(retention)
    retention.amount_retained = money(Decimal(retention.amount_retained or 0) + Decimal(situation.retention_amount))
    record_expense(
        db,
        project_id=contract.project_id,
        lot_id=contract.lot_id,
        category="sous_traitance",
        label=f"Situation {situation.number}",
        amount=Decimal(situation.gross_amount),
        expense_date=situation.period_end,
        source_type="situation",
        source_id=situation.id,
        user_id=user_id,
        commitment_source=("subcontract", contract.id),
    )
    sub = db.get(Subcontractor, contract.subcontractor_id)
    emit(
        db,
        "situation.validated",
        {
            "id": situation.id,
            "number": situation.number,
            "net_amount": situation.net_amount,
            "subcontractor_user_ids": [str(u) for u in party_user_ids(db, sub.organization_id if sub else None)],
        },
        aggregate_type="situation",
        aggregate_id=situation.id,
        project_id=contract.project_id,
    )
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="SITUATION_VALIDATE",
        resource_type="situation",
        resource_id=situation.id,
        project_id=contract.project_id,
        actor_id=user_id,
        diff={
            "gross": str(situation.gross_amount),
            "net": str(situation.net_amount),
            "penalties": str(situation.penalties),
            "penalties_reason": penalties_reason,
        },
        criticality="MEDIUM",
    )
    return situation


def reject_situation(
    db: Session, situation: Situation, contract: Subcontract, *, user_id: uuid.UUID, reason: str
) -> Situation:
    if situation.status not in ("submitted", "field_checked"):
        raise BusinessRuleError("Situation non rejetable dans son état actuel")
    situation.status = "rejected"
    situation.rejection_reason = reason
    sub = db.get(Subcontractor, contract.subcontractor_id)
    emit(
        db,
        "situation.rejected",
        {
            "id": situation.id,
            "number": situation.number,
            "reason": reason,
            "subcontractor_user_ids": [str(u) for u in party_user_ids(db, sub.organization_id if sub else None)],
        },
        aggregate_type="situation",
        aggregate_id=situation.id,
        project_id=contract.project_id,
    )
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="SITUATION_REJECT",
        resource_type="situation",
        resource_id=situation.id,
        project_id=contract.project_id,
        actor_id=user_id,
        reason=reason,
    )
    return situation


# ============================================================================ facturation (56 → 58)
def expected_invoice_amount(situation: Situation, contract: Subcontract) -> Decimal:
    """Montant attendu de la facture : net à payer de la situation + TVA du marché sur le montant brut."""
    tax = money(Decimal(situation.gross_amount or 0) * Decimal(contract.tax_rate or 0) / 100)
    return money(Decimal(situation.net_amount or 0) + tax)


def submit_invoice(
    db: Session,
    situation: Situation,
    contract: Subcontract,
    *,
    reference: str,
    invoice_date: date,
    amount: Decimal,
    file_id: uuid.UUID | None,
    user_id: uuid.UUID | None,
    source: str = "extranet",
) -> SubcontractorInvoice:
    """Facture sous-traitant (V4-SUB-14) : uniquement sur situation validée, montant = net (+ TVA du marché)."""
    if situation.status != "validated":
        raise BusinessRuleError("Facturation possible uniquement sur situation validée", code="SITUATION_NOT_VALIDATED")
    duplicate = db.execute(
        select(SubcontractorInvoice.id).where(
            SubcontractorInvoice.subcontractor_id == contract.subcontractor_id,
            SubcontractorInvoice.reference == reference,
        )
    ).first()
    if duplicate:
        raise Conflict("Référence de facture déjà utilisée", code="DUPLICATE_INVOICE")
    expected = expected_invoice_amount(situation, contract)
    if abs(money(amount) - expected) > Decimal("1"):
        raise BusinessRuleError(
            f"Montant facturé différent du net validé ({expected})",
            code="INVOICE_AMOUNT_MISMATCH",
            details={"expected": str(expected)},
        )
    sub = db.get(Subcontractor, contract.subcontractor_id)
    invoice = SubcontractorInvoice(
        number=next_number(db, "subcontractor_invoice"),
        reference=reference,
        kind="situation",
        subcontractor_id=contract.subcontractor_id,
        subcontract_id=contract.id,
        situation_id=situation.id,
        project_id=contract.project_id,
        currency=contract.currency,
        invoice_date=invoice_date,
        due_date=invoice_date + timedelta(days=30),
        amount_ht=situation.net_amount,
        tax_amount=money(expected - Decimal(situation.net_amount)),
        amount=expected,
        status="received",
        file_id=file_id,
        source=source,
    )
    db.add(invoice)
    situation.status = "invoiced"
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="INVOICE_SUBMIT",
        resource_type="subcontractor_invoice",
        resource_id=invoice.id,
        project_id=contract.project_id,
        actor_id=user_id,
        diff={"amount": str(invoice.amount), "reference": reference, "subcontractor": sub.legal_name if sub else ""},
    )
    return invoice


def validate_invoice(db: Session, invoice: SubcontractorInvoice, *, user_id: uuid.UUID) -> SubcontractorInvoice:
    if invoice.status != "received":
        raise BusinessRuleError("Facture déjà traitée")
    situation = db.get(Situation, invoice.situation_id) if invoice.situation_id else None
    if invoice.kind == "situation" and (situation is None or situation.status not in ("invoiced",)):
        raise BusinessRuleError("Situation associée non validée")
    invoice.status = "approved_for_payment"
    invoice.validated_by_id = user_id
    invoice.validated_at = utcnow()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="INVOICE_VALIDATE",
        resource_type="subcontractor_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        criticality="MEDIUM",
    )
    return invoice


def reject_invoice(
    db: Session, invoice: SubcontractorInvoice, *, user_id: uuid.UUID, reason: str
) -> SubcontractorInvoice:
    if invoice.status not in ("received",):
        raise BusinessRuleError("Facture non rejetable")
    invoice.status = "rejected"
    invoice.rejection_reason = reason
    if invoice.situation_id:
        situation = db.get(Situation, invoice.situation_id)
        if situation and situation.status == "invoiced":
            situation.status = "validated"
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="INVOICE_REJECT",
        resource_type="subcontractor_invoice",
        resource_id=invoice.id,
        project_id=invoice.project_id,
        actor_id=user_id,
        reason=reason,
    )
    return invoice


def release_retention(
    db: Session, contract: Subcontract, *, amount: Decimal | None, user_id: uuid.UUID, reason: str
) -> SubcontractorInvoice:
    """Libération de la retenue de garantie (après réception / levée des réserves, hors litige ouvert)."""
    retention = db.execute(select(Retention).where(Retention.subcontract_id == contract.id)).scalar_one_or_none()
    if retention is None:
        raise NotFound("Aucune retenue pour ce marché")
    if retention.status == "frozen":
        raise BusinessRuleError("Retenue gelée par un litige", code="RETENTION_FROZEN")
    open_dispute = db.execute(
        select(Dispute.id).where(
            Dispute.party_type == "subcontractor",
            Dispute.party_id == contract.subcontractor_id,
            Dispute.status.not_in(["RESOLU"]),
        )
    ).first()
    if open_dispute:
        raise BusinessRuleError("Litige ouvert avec ce sous-traitant", code="OPEN_DISPUTE")
    available = Decimal(retention.amount_retained) - Decimal(retention.amount_released)
    value = money(amount) if amount else money(available)
    if value <= 0 or value > available:
        raise BusinessRuleError(f"Montant libérable : {available}")
    retention.amount_released = money(Decimal(retention.amount_released) + value)
    retention.status = "released" if retention.amount_released >= retention.amount_retained else "partially_released"
    retention.release_date = date.today()
    invoice = SubcontractorInvoice(
        number=next_number(db, "subcontractor_invoice"),
        reference=f"RG-{contract.number}-{uuid.uuid4().hex[:4].upper()}",
        kind="retention_release",
        subcontractor_id=contract.subcontractor_id,
        subcontract_id=contract.id,
        project_id=contract.project_id,
        invoice_date=date.today(),
        due_date=date.today(),
        amount_ht=value,
        amount=value,
        status="approved_for_payment",
        source="system",
        validated_by_id=user_id,
        validated_at=utcnow(),
    )
    db.add(invoice)
    db.flush()
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="RETENTION_RELEASE",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        actor_id=user_id,
        reason=reason,
        diff={"amount": str(value)},
        criticality="HIGH",
    )
    return invoice


def close_contract(db: Session, contract: Subcontract, *, user_id: uuid.UUID) -> Subcontract:
    """Clôture (60) : toutes les situations soldées ou rejetées, aucun litige ouvert."""
    from app.modules.finance.models import Commitment

    pending = (
        db.execute(
            select(Situation.number).where(
                Situation.subcontract_id == contract.id, Situation.status.not_in(["paid", "rejected"])
            )
        )
        .scalars()
        .all()
    )
    if pending:
        raise BusinessRuleError("Situations non soldées : " + ", ".join(pending), code="SITUATIONS_PENDING")
    open_dispute = db.execute(
        select(Dispute.id).where(
            Dispute.related_type == "subcontract", Dispute.related_id == contract.id, Dispute.status != "RESOLU"
        )
    ).first()
    if open_dispute:
        raise BusinessRuleError("Litige ouvert sur ce marché", code="OPEN_DISPUTE")
    contract.status = "closed"
    contract.closed_at = utcnow()
    commitment = db.execute(
        select(Commitment).where(Commitment.source_type == "subcontract", Commitment.source_id == contract.id)
    ).scalar_one_or_none()
    if commitment is not None:
        commitment.status = "closed"
    retention = db.execute(select(Retention).where(Retention.subcontract_id == contract.id)).scalar_one_or_none()
    if retention is not None and retention.status == "held":
        retention.release_date = date.today() + timedelta(days=365)
        retention.notes = "Libération prévue à l'issue de l'année de garantie de parfait achèvement"
    refresh_kpis(db, contract.subcontractor_id)
    audit.record(
        db,
        family="business",
        module="subcontracting",
        action="CONTRACT_CLOSE",
        resource_type="subcontract",
        resource_id=contract.id,
        project_id=contract.project_id,
        actor_id=user_id,
        criticality="MEDIUM",
    )
    return contract


# ============================================================================ notation (61) & KPI
def rate(
    db: Session,
    contract: Subcontract | None,
    sub: Subcontractor,
    *,
    scores: dict[str, int],
    comment: str | None,
    user_id: uuid.UUID,
) -> SubcontractorRating:
    for key in ("quality", "delay", "safety", "cleanliness", "compliance", "cooperation"):
        if not 1 <= int(scores.get(key, 0)) <= 5:
            raise BusinessRuleError(f"Note {key} entre 1 et 5")
    row = SubcontractorRating(
        subcontractor_id=sub.id,
        subcontract_id=contract.id if contract else None,
        comment=comment,
        rated_by_id=user_id,
        **{k: int(v) for k, v in scores.items()},
    )
    db.add(row)
    db.flush()
    refresh_kpis(db, sub.id)
    return row


def refresh_kpis(db: Session, subcontractor_id: uuid.UUID) -> Subcontractor:
    sub = db.get(Subcontractor, subcontractor_id)
    if sub is None:
        raise NotFound("Sous-traitant introuvable")
    ratings = (
        db.execute(select(SubcontractorRating).where(SubcontractorRating.subcontractor_id == sub.id)).scalars().all()
    )
    if ratings:
        sub.score = Decimal(str(round(sum(r.average for r in ratings) / len(ratings) * 20, 2)))
    contracts = (
        db.execute(
            select(Subcontract).where(
                Subcontract.subcontractor_id == sub.id, Subcontract.status.in_(["completed", "closed"])
            )
        )
        .scalars()
        .all()
    )
    if contracts:
        on_time = 0
        for contract in contracts:
            last = db.execute(
                select(func.max(Situation.period_end)).where(Situation.subcontract_id == contract.id)
            ).scalar()
            if contract.end_date is None or last is None or last <= contract.end_date:
                on_time += 1
        sub.on_time_rate = Decimal(str(round(on_time * 100 / len(contracts), 2)))
    total_contracts = db.execute(
        select(func.count())
        .select_from(Subcontract)
        .where(Subcontract.subcontractor_id == sub.id, Subcontract.status.not_in(["draft"]))
    ).scalar_one()
    disputes = db.execute(
        select(func.count())
        .select_from(Dispute)
        .where(Dispute.party_type == "subcontractor", Dispute.party_id == sub.id)
    ).scalar_one()
    if total_contracts:
        sub.dispute_rate = Decimal(str(round(min(100.0, disputes * 100 / total_contracts), 2)))
    return sub


# ============================================================================ réclamations & litiges (59, §9.3)
DISPUTE_TRANSITIONS = {
    "OUVERT": {"EN_ANALYSE", "ESCALADE"},
    "EN_ANALYSE": {"EN_NEGOCIATION", "DECISION", "ESCALADE"},
    "EN_NEGOCIATION": {"DECISION", "ESCALADE"},
    "ESCALADE": {"EN_NEGOCIATION", "DECISION"},
    "DECISION": {"RESOLU", "ESCALADE"},
    "RESOLU": set(),
}


def _dispute_party(db: Session, party_type: str, party_id: uuid.UUID) -> tuple[str, uuid.UUID | None]:
    from app.modules.identity.models import Organization
    from app.modules.suppliers.models import Supplier

    if party_type == "subcontractor":
        sub = db.get(Subcontractor, party_id)
        if sub is None:
            raise NotFound("Sous-traitant introuvable")
        return sub.legal_name, sub.organization_id
    if party_type == "supplier":
        supplier = db.get(Supplier, party_id)
        if supplier is None:
            raise NotFound("Fournisseur introuvable")
        return supplier.legal_name, supplier.organization_id
    org = db.get(Organization, party_id)
    if org is None:
        raise NotFound("Client introuvable")
    return org.name, org.id


def _related(db: Session, related_type: str | None, related_id: uuid.UUID | None) -> Any:
    from app.modules.billing.models import SupplierInvoice
    from app.modules.procurement.models import GoodsReceipt, PurchaseOrder

    if not related_type or not related_id:
        return None
    model = {
        "situation": Situation,
        "subcontractor_invoice": SubcontractorInvoice,
        "supplier_invoice": SupplierInvoice,
        "purchase_order": PurchaseOrder,
        "goods_receipt": GoodsReceipt,
        "subcontract": Subcontract,
    }.get(related_type)
    if model is None:
        raise BusinessRuleError("Type d'objet lié inconnu")
    obj = db.get(model, related_id)
    if obj is None:
        raise NotFound("Objet lié introuvable")
    return obj


def _escalation_target(db: Session, amount: Decimal) -> str:
    row = db.get(Setting, "dispute_escalation")
    value = row.value if row and isinstance(row.value, dict) else {}
    legal = Decimal(str(value.get("legal_threshold", 20_000_000)))
    return "juridique" if amount >= legal else "direction"


def _event(
    db: Session,
    dispute: Dispute,
    *,
    kind: str,
    content: str | None,
    author_id: uuid.UUID | None,
    side: str = "globus",
    amount: Decimal | None = None,
    files: list[str] | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
) -> DisputeEvent:
    row = DisputeEvent(
        dispute_id=dispute.id,
        kind=kind,
        content=content,
        author_id=author_id,
        author_side=side,
        amount=money(amount) if amount is not None else None,
        file_ids=files or [],
        from_status=from_status,
        to_status=to_status,
    )
    db.add(row)
    db.flush()
    return row


def open_dispute(
    db: Session,
    *,
    party_type: str,
    party_id: uuid.UUID,
    related_type: str | None,
    related_id: uuid.UUID | None,
    title: str,
    description: str | None,
    amount_disputed: Decimal,
    freeze: bool,
    owner_id: uuid.UUID | None,
    opened_by_id: uuid.UUID | None,
    by_party: bool,
    project_id: uuid.UUID | None,
    files: list[str] | None = None,
) -> Dispute:
    """OUVERT : gèle si nécessaire le montant contesté, crée une tâche au responsable."""
    label, _organization_id = _dispute_party(db, party_type, party_id)
    related = _related(db, related_type, related_id)
    project_id = project_id or getattr(related, "project_id", None)
    dispute = Dispute(
        number=next_number(db, "dispute"),
        project_id=project_id,
        party_type=party_type,
        party_id=party_id,
        party_label=label,
        related_type=related_type,
        related_id=related_id,
        title=title,
        description=description,
        amount_disputed=money(amount_disputed),
        status="OUVERT",
        owner_id=owner_id,
        opened_by_id=opened_by_id,
        opened_by_party=by_party,
    )
    db.add(dispute)
    db.flush()
    frozen = Decimal("0")
    if freeze and related is not None and hasattr(related, "amount_frozen"):
        from app.modules.finance.payments import outstanding

        frozen = min(money(amount_disputed), outstanding(related))
        if frozen > 0:
            related.amount_frozen = money(Decimal(related.amount_frozen or 0) + frozen)
    if freeze and related_type == "subcontract":
        retention = db.execute(select(Retention).where(Retention.subcontract_id == related_id)).scalar_one_or_none()
        if retention is not None:
            retention.status = "frozen"
    if isinstance(related, Situation) and related.status in ("submitted", "field_checked", "validated"):
        related.status = "disputed"
    dispute.amount_frozen = money(frozen)
    _event(
        db,
        dispute,
        kind="status",
        content=description,
        author_id=opened_by_id,
        side="party" if by_party else "globus",
        to_status="OUVERT",
        amount=dispute.amount_disputed,
        files=files,
    )
    db.add(
        ActionItem(
            title=f"Litige {dispute.number} : {title}"[:250],
            module="disputes",
            entity_type="dispute",
            entity_id=str(dispute.id),
            project_id=project_id,
            assignee_id=owner_id,
            assignee_role=None if owner_id else "DIRECTION",
            priority="high",
            description=f"{label} — montant contesté {dispute.amount_disputed} FCFA",
        )
    )
    emit(
        db,
        "dispute.opened",
        {
            "id": dispute.id,
            "number": dispute.number,
            "title": title,
            "amount": dispute.amount_disputed,
            "owner_id": owner_id,
        },
        aggregate_type="dispute",
        aggregate_id=dispute.id,
        project_id=project_id,
    )
    audit.record(
        db,
        family="business",
        module="disputes",
        action="OPEN",
        resource_type="dispute",
        resource_id=dispute.id,
        project_id=project_id,
        actor_id=opened_by_id,
        diff={"party": label, "amount": str(dispute.amount_disputed), "frozen": str(frozen)},
        criticality="HIGH",
    )
    return dispute


def transition_dispute(
    db: Session,
    dispute: Dispute,
    *,
    to_status: str,
    content: str | None,
    user_id: uuid.UUID,
    files: list[str] | None = None,
) -> Dispute:
    allowed = DISPUTE_TRANSITIONS.get(dispute.status, set())
    if to_status not in allowed:
        raise BusinessRuleError(f"Transition {dispute.status} → {to_status} interdite", code="INVALID_TRANSITION")
    if to_status == "DECISION":
        raise BusinessRuleError("Utiliser la décision formelle (montants acceptés/refusés)")
    if to_status == "RESOLU":
        raise BusinessRuleError("Utiliser la résolution")
    previous = dispute.status
    if to_status == "ESCALADE":
        dispute.escalation_level += 1
        dispute.escalated_to = _escalation_target(db, Decimal(dispute.amount_disputed))
        emit(
            db,
            "dispute.escalated",
            {"id": dispute.id, "number": dispute.number, "title": dispute.title, "escalated_to": dispute.escalated_to},
            aggregate_type="dispute",
            aggregate_id=dispute.id,
            project_id=dispute.project_id,
        )
    dispute.status = to_status
    _event(
        db,
        dispute,
        kind="escalation" if to_status == "ESCALADE" else "status",
        content=content,
        author_id=user_id,
        from_status=previous,
        to_status=to_status,
        files=files,
    )
    _notify_update(db, dispute, f"{previous} → {to_status}")
    audit.record(
        db,
        family="business",
        module="disputes",
        action="TRANSITION",
        resource_type="dispute",
        resource_id=dispute.id,
        project_id=dispute.project_id,
        actor_id=user_id,
        diff={"from": previous, "to": to_status},
        reason=content,
    )
    return dispute


def _notify_update(db: Session, dispute: Dispute, summary: str) -> None:
    _, organization_id = _dispute_party(db, dispute.party_type, dispute.party_id)
    emit(
        db,
        "dispute.updated",
        {
            "id": dispute.id,
            "number": dispute.number,
            "status": dispute.status,
            "summary": summary,
            "owner_id": dispute.owner_id,
            "party_user_ids": [str(u) for u in party_user_ids(db, organization_id)],
        },
        aggregate_type="dispute",
        aggregate_id=dispute.id,
        project_id=dispute.project_id,
    )


def add_dispute_event(
    db: Session,
    dispute: Dispute,
    *,
    kind: str,
    content: str | None,
    amount: Decimal | None,
    files: list[str] | None,
    user_id: uuid.UUID | None,
    side: str,
) -> DisputeEvent:
    """Preuves, commentaires, propositions / contre-propositions / accords (historisés)."""
    if dispute.status == "RESOLU":
        raise BusinessRuleError("Litige clos")
    if kind in ("proposal", "counter_proposal", "agreement"):
        if dispute.status != "EN_NEGOCIATION":
            raise BusinessRuleError("Négociation non ouverte", code="NOT_IN_NEGOTIATION")
        if amount is None and kind != "agreement":
            raise BusinessRuleError("Montant proposé requis")
    if kind == "evidence" and not files:
        raise BusinessRuleError("Pièce justificative requise")
    if kind == "agreement":
        last = (
            db.execute(
                select(DisputeEvent)
                .where(DisputeEvent.dispute_id == dispute.id, DisputeEvent.kind.in_(["proposal", "counter_proposal"]))
                .order_by(DisputeEvent.created_at.desc())
            )
            .scalars()
            .first()
        )
        if last is None:
            raise BusinessRuleError("Aucune proposition à accepter")
        if last.author_side == side:
            raise BusinessRuleError("Une partie ne peut accepter sa propre proposition")
        amount = last.amount
    row = _event(db, dispute, kind=kind, content=content, author_id=user_id, side=side, amount=amount, files=files)
    _notify_update(db, dispute, f"{kind} {amount or ''}".strip())
    audit.record(
        db,
        family="business",
        module="disputes",
        action=kind.upper(),
        resource_type="dispute",
        resource_id=dispute.id,
        project_id=dispute.project_id,
        actor_id=user_id,
        actor_type="user",
        diff={"amount": str(amount) if amount is not None else None, "side": side},
    )
    return row


def decide_dispute(
    db: Session,
    dispute: Dispute,
    *,
    amount_accepted: Decimal,
    amount_refused: Decimal,
    summary: str,
    files: list[str] | None,
    user_id: uuid.UUID,
) -> Dispute:
    """DÉCISION : décision formelle, montant accepté / refusé, justificatif."""
    if dispute.status not in ("EN_ANALYSE", "EN_NEGOCIATION", "ESCALADE"):
        raise BusinessRuleError("Décision possible après analyse / négociation")
    if money(amount_accepted) + money(amount_refused) != money(dispute.amount_disputed):
        raise BusinessRuleError("Montants accepté + refusé ≠ montant contesté", code="AMOUNTS_MISMATCH")
    if not files and len(summary.strip()) < 20:
        raise BusinessRuleError("Justificatif ou motivation détaillée requis", code="JUSTIFICATION_REQUIRED")
    previous = dispute.status
    dispute.status = "DECISION"
    dispute.amount_accepted = money(amount_accepted)
    dispute.amount_refused = money(amount_refused)
    dispute.decision_summary = summary
    dispute.decided_by_id = user_id
    dispute.decided_at = utcnow()
    _event(
        db,
        dispute,
        kind="decision",
        content=summary,
        author_id=user_id,
        amount=money(amount_accepted),
        files=files,
        from_status=previous,
        to_status="DECISION",
    )
    _notify_update(db, dispute, f"Décision : {amount_accepted} accepté / {amount_refused} refusé")
    audit.record(
        db,
        family="business",
        module="disputes",
        action="DECIDE",
        resource_type="dispute",
        resource_id=dispute.id,
        project_id=dispute.project_id,
        actor_id=user_id,
        diff={"accepted": str(amount_accepted), "refused": str(amount_refused)},
        criticality="HIGH",
    )
    return dispute


def resolve_dispute(db: Session, dispute: Dispute, *, user_id: uuid.UUID, comment: str | None) -> Dispute:
    """RÉSOLU : clôture, dégel, application du refus (avoir / réduction), libération éventuelle de la retenue."""
    from app.modules.billing.models import SupplierInvoice
    from app.modules.billing.service import issue_credit_note

    if dispute.status != "DECISION":
        raise BusinessRuleError("Une décision formelle doit précéder la résolution", code="DECISION_REQUIRED")
    related = _related(db, dispute.related_type, dispute.related_id)
    refused = Decimal(dispute.amount_refused or 0)
    if related is not None and hasattr(related, "amount_frozen"):
        related.amount_frozen = money(
            max(Decimal("0"), Decimal(related.amount_frozen or 0) - Decimal(dispute.amount_frozen))
        )
        if refused > 0 and isinstance(related, SupplierInvoice):
            issue_credit_note(
                db,
                side="supplier",
                amount=refused,
                reason=f"Litige {dispute.number} : {dispute.decision_summary}",
                user_id=user_id,
                supplier_invoice=related,
            )
        elif refused > 0 and isinstance(related, SubcontractorInvoice):
            related.amount_credited = money(Decimal(related.amount_credited or 0) + refused)
    if isinstance(related, Situation) and related.status == "disputed":
        related.status = "validated" if related.validated_at else "submitted"
    if dispute.related_type == "subcontract":
        retention = db.execute(
            select(Retention).where(Retention.subcontract_id == dispute.related_id)
        ).scalar_one_or_none()
        if retention is not None and retention.status == "frozen":
            retention.status = "held" if Decimal(retention.amount_released) == 0 else "partially_released"
    dispute.status = "RESOLU"
    dispute.resolved_at = utcnow()
    for item in db.execute(
        select(ActionItem).where(
            ActionItem.entity_type == "dispute", ActionItem.entity_id == str(dispute.id), ActionItem.status == "open"
        )
    ).scalars():
        item.status = "done"
        item.completed_at = utcnow()
        item.completed_by_id = user_id
    _event(db, dispute, kind="status", content=comment, author_id=user_id, from_status="DECISION", to_status="RESOLU")
    if dispute.party_type == "subcontractor":
        refresh_kpis(db, dispute.party_id)
    _notify_update(db, dispute, "Litige résolu")
    audit.record(
        db,
        family="business",
        module="disputes",
        action="RESOLVE",
        resource_type="dispute",
        resource_id=dispute.id,
        project_id=dispute.project_id,
        actor_id=user_id,
        reason=comment,
        diff={"refused": str(refused)},
        criticality="HIGH",
    )
    return dispute


def create_claim(
    db: Session,
    *,
    subcontract: Subcontract | None,
    subcontractor_id: uuid.UUID | None,
    supplier_id: uuid.UUID | None,
    title: str,
    description: str | None,
    amount: Decimal,
    user_id: uuid.UUID | None,
) -> Claim:
    claim = Claim(
        subcontract_id=subcontract.id if subcontract else None,
        subcontractor_id=subcontractor_id,
        supplier_id=supplier_id,
        title=title,
        description=description,
        amount=money(amount),
        created_by_id=user_id,
    )
    db.add(claim)
    db.flush()
    audit.record(
        db,
        family="business",
        module="disputes",
        action="CLAIM",
        resource_type="claim",
        resource_id=claim.id,
        project_id=subcontract.project_id if subcontract else None,
        actor_id=user_id,
        diff={"amount": str(claim.amount)},
    )
    return claim


def answer_claim(db: Session, claim: Claim, *, decision: str, response: str, user_id: uuid.UUID) -> Claim | Dispute:
    if claim.status != "submitted":
        raise BusinessRuleError("Réclamation déjà traitée")
    claim.response = response
    if decision == "escalate":
        claim.status = "escalated"
        party_type = "subcontractor" if claim.subcontractor_id else "supplier"
        party_id = claim.subcontractor_id or claim.supplier_id
        if party_id is None:
            raise BusinessRuleError("Partie inconnue")
        contract = db.get(Subcontract, claim.subcontract_id) if claim.subcontract_id else None
        return open_dispute(
            db,
            party_type=party_type,
            party_id=party_id,
            related_type="subcontract" if contract else None,
            related_id=contract.id if contract else None,
            title=claim.title,
            description=claim.description,
            amount_disputed=Decimal(claim.amount),
            freeze=False,
            owner_id=user_id,
            opened_by_id=user_id,
            by_party=False,
            project_id=contract.project_id if contract else None,
        )
    claim.status = "accepted" if decision == "accept" else "rejected"
    audit.record(
        db,
        family="business",
        module="disputes",
        action=f"CLAIM_{claim.status.upper()}",
        resource_type="claim",
        resource_id=claim.id,
        actor_id=user_id,
        reason=response,
    )
    return claim


def subcontract_summary(db: Session, contract: Subcontract) -> dict[str, Any]:
    situations = (
        db.execute(select(Situation).where(Situation.subcontract_id == contract.id).order_by(Situation.sequence))
        .scalars()
        .all()
    )
    valid = [s for s in situations if s.status in ("validated", "invoiced", "paid", "disputed")]
    retention = db.execute(select(Retention).where(Retention.subcontract_id == contract.id)).scalar_one_or_none()
    invoices = (
        db.execute(select(SubcontractorInvoice).where(SubcontractorInvoice.subcontract_id == contract.id))
        .scalars()
        .all()
    )
    cumulative = Decimal(valid[-1].cumulative_amount) if valid else Decimal("0")
    return {
        "cumulative_validated": cumulative,
        "progress_pct": round(float(cumulative * 100 / Decimal(contract.amount)), 1)
        if Decimal(contract.amount) > 0
        else 0,
        "remaining_amount": money(Decimal(contract.amount) - cumulative),
        "advance_recovered": money(sum((Decimal(s.advance_recovered) for s in valid), Decimal("0"))),
        "penalties": money(sum((Decimal(s.penalties) for s in valid), Decimal("0"))),
        "retention_held": money(Decimal(retention.amount_retained) - Decimal(retention.amount_released))
        if retention
        else Decimal("0"),
        "retention_status": retention.status if retention else None,
        "invoiced": money(sum((Decimal(i.amount) for i in invoices if i.status != "rejected"), Decimal("0"))),
        "paid": money(sum((Decimal(i.amount_paid) for i in invoices), Decimal("0"))),
        "situations": len(situations),
    }


def ensure_party_access(principal: Any, sub: Subcontractor) -> None:
    if principal.is_internal:
        return
    if not principal.organization_id or sub.organization_id != principal.organization_id:
        raise Forbidden("Ressource d'un autre sous-traitant", code="ORGANIZATION_ACCESS_DENIED")


def deadline_reached(tender: Tender) -> bool:
    deadline = tender.deadline
    return bool(deadline and deadline <= utcnow())
