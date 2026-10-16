"""SAV §18 : ticket → SLA → diagnostic → intervention → preuve → validation client → clôture → satisfaction ;
garanties (parfait achèvement, biennale, décennale), recours fournisseur / sous-traitant, surveillance SLA."""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import money, utcnow
from app.modules.crm.models import SlaPolicy
from app.modules.support.models import Intervention, Ticket, TicketMessage, WarrantyClaim

# Catégorie → garanties susceptibles de couvrir le désordre (ordre de priorité).
WARRANTY_MAP = {
    "fissure": ["decennale", "parfait_achevement"],
    "etancheite": ["decennale", "parfait_achevement"],
    "plomberie": ["biennale", "parfait_achevement"],
    "electricite": ["biennale", "parfait_achevement"],
    "menuiserie": ["biennale", "parfait_achevement"],
    "equipement": ["equipement", "biennale", "parfait_achevement"],
    "peinture": ["parfait_achevement"],
    "autre": ["parfait_achevement"],
}
OPEN_STATUSES = ("new", "assigned", "diagnosis", "scheduled", "in_progress", "reopened")
REOPEN_DAYS = 15


def _sla(db: Session, priority: str) -> SlaPolicy | None:
    key = "urgent" if priority in ("urgent", "high") else "normal"
    return (
        db.execute(
            select(SlaPolicy).where(
                SlaPolicy.entity == "ticket", SlaPolicy.priority == key, SlaPolicy.is_active.is_(True)
            )
        )
        .scalars()
        .first()
    )


def _warranty(db: Session, project_id: uuid.UUID | None, category: str) -> tuple[Any, bool | None]:
    if project_id is None:
        return None, None
    from app.modules.projects.models import Warranty

    today = date.today()
    warranties = db.execute(select(Warranty).where(Warranty.project_id == project_id)).scalars().all()
    if not warranties:
        return None, None
    for kind in WARRANTY_MAP.get(category, ["parfait_achevement"]):
        for warranty in warranties:
            if warranty.kind == kind and warranty.start_date <= today <= warranty.end_date:
                return warranty, True
    return None, False


def create_ticket(db: Session, *, data: dict[str, Any], requester: Any | None, channel: str) -> Ticket:
    priority = data.get("priority", "normal")
    policy = _sla(db, priority)
    now = utcnow()
    warranty, covered = _warranty(db, data.get("project_id"), data.get("category", "autre"))
    name, email, phone = (
        data.pop("requester_name", None),
        data.pop("requester_email", None),
        data.pop("requester_phone", None),
    )
    ticket = Ticket(
        number=next_number(db, "ticket"),
        channel=channel,
        status="new",
        requester_id=requester.id if requester else None,
        requester_name=requester.full_name if requester else name,
        requester_email=requester.email if requester else email,
        requester_phone=requester.phone if requester else phone,
        organization_id=requester.organization_id if requester else None,
        sla_policy_id=policy.id if policy else None,
        response_due_at=now + timedelta(minutes=policy.response_minutes) if policy else None,
        resolution_due_at=now + timedelta(minutes=policy.resolution_minutes)
        if policy and policy.resolution_minutes
        else None,
        warranty_id=warranty.id if warranty else None,
        within_warranty=covered,
        **data,
    )
    db.add(ticket)
    db.flush()
    emit(
        db,
        "ticket.created",
        {"id": ticket.id, "number": ticket.number, "subject": ticket.subject, "priority": ticket.priority},
        aggregate_type="ticket",
        aggregate_id=ticket.id,
        project_id=ticket.project_id,
    )
    audit.record(
        db,
        family="business",
        module="support",
        action="TICKET_CREATE",
        resource_type="ticket",
        resource_id=ticket.id,
        project_id=ticket.project_id,
        actor_id=requester.id if requester else None,
        actor_type="user" if requester else "visitor",
        diff={"category": ticket.category, "priority": ticket.priority, "warranty": covered},
    )
    return ticket


def _client_update(db: Session, ticket: Ticket, message: str) -> None:
    if ticket.requester_id:
        emit(
            db,
            "ticket.client_update",
            {"id": ticket.id, "number": ticket.number, "message": message, "requester_id": ticket.requester_id},
            aggregate_type="ticket",
            aggregate_id=ticket.id,
            project_id=ticket.project_id,
        )


def assign(db: Session, ticket: Ticket, *, assignee_id: uuid.UUID, user_id: uuid.UUID) -> Ticket:
    if ticket.status in ("closed", "cancelled"):
        raise BusinessRuleError("Ticket clos")
    ticket.assigned_to_id = assignee_id
    if ticket.status in ("new", "reopened"):
        ticket.status = "assigned"
    emit(
        db,
        "ticket.assigned",
        {"id": ticket.id, "number": ticket.number, "subject": ticket.subject, "assigned_to_id": assignee_id},
        aggregate_type="ticket",
        aggregate_id=ticket.id,
        project_id=ticket.project_id,
    )
    audit.record(
        db,
        family="business",
        module="support",
        action="TICKET_ASSIGN",
        resource_type="ticket",
        resource_id=ticket.id,
        actor_id=user_id,
        diff={"assignee": str(assignee_id)},
    )
    return ticket


def add_message(
    db: Session, ticket: Ticket, *, author: Any, body: str, internal: bool, from_staff: bool
) -> TicketMessage:
    if ticket.status in ("closed", "cancelled") and not from_staff:
        raise BusinessRuleError("Ticket clos : rouvrir la demande")
    message = TicketMessage(ticket_id=ticket.id, author_id=author.id, body=body, internal=internal and from_staff)
    db.add(message)
    if from_staff and not message.internal:
        if ticket.first_response_at is None:
            ticket.first_response_at = utcnow()
        _client_update(db, ticket, body[:300])
    db.flush()
    return message


def diagnose(db: Session, ticket: Ticket, *, diagnosis: str, user_id: uuid.UUID) -> Ticket:
    ticket.diagnosis = diagnosis
    ticket.status = "diagnosis"
    ticket.first_response_at = ticket.first_response_at or utcnow()
    _client_update(db, ticket, "Diagnostic réalisé : une intervention va être planifiée.")
    audit.record(
        db,
        family="business",
        module="support",
        action="TICKET_DIAGNOSIS",
        resource_type="ticket",
        resource_id=ticket.id,
        actor_id=user_id,
    )
    return ticket


def decide_warranty(
    db: Session,
    ticket: Ticket,
    *,
    decision: str,
    reason: str,
    responsible_party: str | None,
    responsible_party_id: uuid.UUID | None,
    user_id: uuid.UUID,
) -> WarrantyClaim:
    claim = db.execute(select(WarrantyClaim).where(WarrantyClaim.ticket_id == ticket.id)).scalar_one_or_none()
    if claim is None:
        claim = WarrantyClaim(ticket_id=ticket.id, warranty_id=ticket.warranty_id)
        db.add(claim)
    claim.decision = decision
    claim.reason = reason
    claim.responsible_party = responsible_party
    claim.responsible_party_id = responsible_party_id
    claim.decided_by_id = user_id
    claim.decided_at = utcnow()
    ticket.within_warranty = decision in ("covered", "partial")
    _client_update(
        db,
        ticket,
        {
            "covered": "Prise en charge au titre de la garantie.",
            "partial": "Prise en charge partielle au titre de la garantie.",
            "not_covered": f"Hors garantie : {reason}",
        }.get(decision, reason),
    )
    audit.record(
        db,
        family="business",
        module="support",
        action="WARRANTY_DECISION",
        resource_type="ticket",
        resource_id=ticket.id,
        actor_id=user_id,
        diff={"decision": decision, "responsible": responsible_party},
        reason=reason,
        criticality="MEDIUM",
    )
    db.flush()
    return claim


def schedule_intervention(
    db: Session, ticket: Ticket, *, technician_id: uuid.UUID | None, scheduled_at: Any, user_id: uuid.UUID
) -> Intervention:
    if ticket.status in ("closed", "cancelled", "resolved"):
        raise BusinessRuleError("Ticket clos ou résolu")
    intervention = Intervention(
        number=next_number(db, "intervention"),
        ticket_id=ticket.id,
        technician_id=technician_id,
        scheduled_at=scheduled_at,
    )
    db.add(intervention)
    ticket.status = "scheduled"
    db.flush()
    _client_update(db, ticket, f"Intervention {intervention.number} planifiée le {scheduled_at:%d/%m/%Y à %H:%M}.")
    return intervention


def start_intervention(db: Session, intervention: Intervention, ticket: Ticket) -> Intervention:
    if intervention.status != "planned":
        raise BusinessRuleError("Intervention déjà démarrée ou close")
    intervention.status = "in_progress"
    intervention.started_at = utcnow()
    ticket.status = "in_progress"
    return intervention


def finish_intervention(
    db: Session,
    intervention: Intervention,
    ticket: Ticket,
    *,
    report: str,
    hours: Decimal,
    materials: list[dict[str, Any]],
    labor_cost: Decimal,
    material_cost: Decimal,
    proof_file_ids: list[str],
    user_id: uuid.UUID,
) -> Intervention:
    if intervention.status not in ("planned", "in_progress"):
        raise BusinessRuleError("Intervention déjà close")
    if not proof_file_ids:
        raise BusinessRuleError("Preuve d'intervention requise (photos avant / après)", code="PROOF_REQUIRED")
    intervention.status = "done"
    intervention.finished_at = utcnow()
    intervention.started_at = intervention.started_at or intervention.finished_at
    intervention.report = report
    intervention.time_spent_hours = hours
    intervention.materials = materials
    intervention.labor_cost = money(labor_cost)
    intervention.material_cost = money(material_cost)
    intervention.proof_file_ids = proof_file_ids
    ticket.total_cost = money(Decimal(ticket.total_cost or 0) + labor_cost + material_cost)
    ticket.status = "resolved"
    ticket.resolved_at = utcnow()
    ticket.resolution = report
    _client_update(db, ticket, "Intervention terminée : merci de valider et d'évaluer la prestation.")
    audit.record(
        db,
        family="business",
        module="support",
        action="INTERVENTION_DONE",
        resource_type="intervention",
        resource_id=intervention.id,
        actor_id=user_id,
        diff={"cost": str(ticket.total_cost)},
    )
    return intervention


def client_validate(db: Session, ticket: Ticket, *, rating: int, comment: str | None, user_id: uuid.UUID) -> Ticket:
    if ticket.status != "resolved":
        raise BusinessRuleError("Ticket non résolu")
    if not 1 <= rating <= 5:
        raise BusinessRuleError("Note entre 1 et 5")
    for intervention in db.execute(
        select(Intervention).where(Intervention.ticket_id == ticket.id, Intervention.status == "done")
    ).scalars():
        intervention.client_validated = True
        intervention.client_validated_at = utcnow()
    ticket.status = "closed"
    ticket.closed_at = utcnow()
    ticket.satisfaction_rating = rating
    ticket.satisfaction_comment = comment
    ticket.satisfaction_at = utcnow()
    audit.record(
        db,
        family="business",
        module="support",
        action="TICKET_CLOSE",
        resource_type="ticket",
        resource_id=ticket.id,
        actor_id=user_id,
        diff={"rating": rating},
    )
    return ticket


def reopen(db: Session, ticket: Ticket, *, reason: str, user_id: uuid.UUID) -> Ticket:
    if ticket.status not in ("resolved", "closed"):
        raise BusinessRuleError("Ticket non résolu")
    reference = ticket.closed_at or ticket.resolved_at
    if reference and utcnow() - reference > timedelta(days=REOPEN_DAYS):
        raise BusinessRuleError(f"Réouverture possible pendant {REOPEN_DAYS} jours : créer une nouvelle demande")
    ticket.status = "reopened"
    ticket.closed_at = None
    db.add(TicketMessage(ticket_id=ticket.id, author_id=user_id, body=f"Réouverture : {reason}", internal=False))
    emit(
        db,
        "ticket.created",
        {
            "id": ticket.id,
            "number": ticket.number,
            "subject": f"[Réouvert] {ticket.subject}",
            "priority": ticket.priority,
        },
        aggregate_type="ticket",
        aggregate_id=ticket.id,
        project_id=ticket.project_id,
    )
    return ticket


def monitor_sla(db: Session) -> dict[str, Any]:
    """Job : dépassements de délai de réponse / résolution → indicateurs + alerte (une seule fois)."""
    now = utcnow()
    count = 0
    for ticket in db.execute(select(Ticket).where(Ticket.status.in_(OPEN_STATUSES))).scalars():
        breached = False
        if (
            not ticket.response_breached
            and ticket.first_response_at is None
            and ticket.response_due_at
            and ticket.response_due_at < now
        ):
            ticket.response_breached = True
            breached = True
        if not ticket.resolution_breached and ticket.resolution_due_at and ticket.resolution_due_at < now:
            ticket.resolution_breached = True
            breached = True
        if breached:
            emit(
                db,
                "ticket.sla_breached",
                {
                    "id": ticket.id,
                    "number": ticket.number,
                    "subject": ticket.subject,
                    "assigned_to_id": ticket.assigned_to_id,
                },
                aggregate_type="ticket",
                aggregate_id=ticket.id,
                project_id=ticket.project_id,
            )
            count += 1
    return {"items": count}


def statistics(db: Session, *, since: Any) -> dict[str, Any]:
    tickets = db.execute(select(Ticket).where(Ticket.created_at >= since)).scalars().all()
    resolved = [t for t in tickets if t.resolved_at]
    rated = [t.satisfaction_rating for t in tickets if t.satisfaction_rating]
    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for ticket in tickets:
        by_status[ticket.status] = by_status.get(ticket.status, 0) + 1
        by_category[ticket.category] = by_category.get(ticket.category, 0) + 1
    with_sla = [t for t in tickets if t.response_due_at]
    return {
        "total": len(tickets),
        "by_status": by_status,
        "by_category": by_category,
        "sla_response_compliance": round(sum(1 for t in with_sla if not t.response_breached) * 100 / len(with_sla), 1)
        if with_sla
        else None,
        "avg_resolution_hours": round(
            sum((t.resolved_at - t.created_at).total_seconds() for t in resolved) / 3600 / len(resolved), 1
        )
        if resolved
        else None,
        "satisfaction_avg": round(sum(rated) / len(rated), 2) if rated else None,
        "within_warranty": sum(1 for t in tickets if t.within_warranty),
        "total_cost": money(sum((Decimal(t.total_cost or 0) for t in tickets), Decimal("0"))),
    }
