"""Services projets : avancement pondéré, santé, décisions client irrévocables (OTP + version + impact),
avenants (change orders), journal de chantier, médias, passeport numérique, Trust Center, Tranquillité."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import jsonable, money, utcnow
from app.modules.projects.models import (
    ChangeOrder,
    DailyLog,
    Decision,
    Milestone,
    Phase,
    ProgressUpdate,
    Project,
    ProjectMember,
    Risk,
    Task,
    TranquilliteItem,
)


def get_project(db: Session, project_id: uuid.UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


# ---------------------------------------------------------------------------- avancement
def recompute_progress(db: Session, project: Project) -> Decimal:
    """Avancement pondéré par le coût prévu (à défaut la durée) des tâches feuilles."""
    tasks = (
        db.execute(
            select(Task).where(Task.project_id == project.id, Task.deleted_at.is_(None), Task.status != "cancelled")
        )
        .scalars()
        .all()
    )
    parents = {t.parent_id for t in tasks if t.parent_id}
    leaves = [t for t in tasks if t.id not in parents and not t.is_milestone]
    weights = [
        (Decimal(t.planned_cost or 0) or Decimal(max(1, t.duration_days or 1)), Decimal(t.progress_pct or 0))
        for t in leaves
    ]
    total = sum((w for w, _ in weights), Decimal("0"))
    progress = (
        (sum((w * p for w, p in weights), Decimal("0")) / total).quantize(Decimal("0.01")) if total else Decimal("0")
    )
    project.progress_pct = progress
    for phase in db.execute(select(Phase).where(Phase.project_id == project.id)).scalars():
        ph = [
            (Decimal(t.planned_cost or 0) or Decimal(max(1, t.duration_days or 1)), Decimal(t.progress_pct or 0))
            for t in leaves
            if t.phase_id == phase.id
        ]
        tot = sum((w for w, _ in ph), Decimal("0"))
        phase.progress_pct = (
            (sum((w * p for w, p in ph), Decimal("0")) / tot).quantize(Decimal("0.01")) if tot else Decimal("0")
        )
        phase.status = (
            "done" if phase.progress_pct >= 100 else ("in_progress" if phase.progress_pct > 0 else phase.status)
        )
    project.health = compute_health(db, project)
    db.flush()
    return progress


def compute_health(db: Session, project: Project) -> str:
    today = date.today()
    late_critical = db.execute(
        select(func.count())
        .select_from(Task)
        .where(
            Task.project_id == project.id,
            Task.deleted_at.is_(None),
            Task.status.not_in(["done", "cancelled"]),
            Task.end_planned < today,
            Task.priority.in_(["high", "critical"]),
        )
    ).scalar_one()
    late = db.execute(
        select(func.count())
        .select_from(Task)
        .where(
            Task.project_id == project.id,
            Task.deleted_at.is_(None),
            Task.status.not_in(["done", "cancelled"]),
            Task.end_planned < today,
        )
    ).scalar_one()
    high_risks = db.execute(
        select(func.count())
        .select_from(Risk)
        .where(
            Risk.project_id == project.id,
            Risk.status.in_(["identified", "monitored", "occurred"]),
            (Risk.probability * Risk.impact) >= 15,
        )
    ).scalar_one()
    if late_critical or (project.end_planned and project.end_planned < today and project.status == "execution"):
        return "critical"
    if late > 2 or high_risks:
        return "at_risk"
    return "on_track"


def update_task_progress(
    db: Session,
    task: Task,
    *,
    pct: Decimal,
    note: str | None,
    evidence: list[str],
    user_id: uuid.UUID,
    source: str = "web",
) -> ProgressUpdate:
    if pct < 0 or pct > 100:
        raise BusinessRuleError("Avancement entre 0 et 100 %")
    update = ProgressUpdate(
        project_id=task.project_id,
        task_id=task.id,
        previous_pct=task.progress_pct,
        new_pct=pct,
        note=note,
        evidence_file_ids=evidence,
        reported_by_id=user_id,
        source=source,
    )
    db.add(update)
    task.progress_pct = pct
    if pct >= 100:
        task.status = "done"
        task.end_actual = task.end_actual or date.today()
    elif pct > 0 and task.status == "todo":
        task.status = "in_progress"
        task.start_actual = task.start_actual or date.today()
    project = db.get(Project, task.project_id)
    if project:
        recompute_progress(db, project)
    audit.record(
        db,
        family="business",
        module="projects",
        action="PROGRESS",
        resource_type="task",
        resource_id=task.id,
        project_id=task.project_id,
        diff={"progress": [str(update.previous_pct), str(pct)]},
    )
    return update


# ---------------------------------------------------------------------------- décisions client
def decision_content_hash(decision: Decision) -> str:
    payload = {
        "title": decision.title,
        "description": decision.description,
        "options": decision.options,
        "selected_option": decision.selected_option,
        "price_impact": str(decision.price_impact),
        "delay_impact_days": decision.delay_impact_days,
        "reference_type": decision.reference_type,
        "reference_id": str(decision.reference_id) if decision.reference_id else None,
        "version_label": decision.version_label,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def request_decision(db: Session, *, project: Project, data: dict[str, Any], user_id: uuid.UUID) -> Decision:
    decision = Decision(
        number=next_number(db, "decision"),
        project_id=project.id,
        status="pending_client",
        requested_by_id=user_id,
        **data,
    )
    db.add(decision)
    db.flush()
    emit(
        db,
        "decision.requested",
        {
            "id": decision.id,
            "title": decision.title,
            "price_impact": decision.price_impact,
            "delay_impact_days": decision.delay_impact_days,
            "due_date": decision.due_date,
        },
        aggregate_type="decision",
        aggregate_id=decision.id,
        project_id=project.id,
    )
    audit.record(
        db,
        family="business",
        module="decisions",
        action="REQUEST",
        resource_type="decision",
        resource_id=decision.id,
        project_id=project.id,
        diff={"title": decision.title},
    )
    return decision


def validate_decision(
    db: Session,
    decision: Decision,
    *,
    user: Any,
    selected_option: str | None,
    otp: dict[str, Any],
    ip: str | None,
    user_agent: str | None,
) -> Decision:
    """Décision irrévocable : qui, quand, sur quelle version, avec quel impact prix/délai (§3.2, V4-3D-27)."""
    if decision.status != "pending_client":
        raise Conflict("Décision déjà traitée", code="DECISION_LOCKED")
    if decision.options and selected_option is not None:
        labels = {str(o.get("label") or o.get("key")) for o in decision.options}
        if selected_option not in labels:
            raise BusinessRuleError("Option inconnue")
        chosen = next(o for o in decision.options if str(o.get("label") or o.get("key")) == selected_option)
        decision.selected_option = selected_option
        decision.price_impact = money(chosen.get("price_impact", decision.price_impact))
        decision.delay_impact_days = int(chosen.get("delay_impact_days", decision.delay_impact_days) or 0)
    decision.content_hash = decision_content_hash(decision)
    decision.status = "validated"
    decision.validated_by_id = user.id
    decision.validated_at = utcnow()
    decision.validation_method = "otp"
    decision.validation_proof = {
        "otp": jsonable(otp),
        "ip": ip,
        "user_agent": (user_agent or "")[:300],
        "content_hash": decision.content_hash,
        "validated_by": user.full_name,
    }
    decision.locked_at = utcnow()
    if Decimal(decision.price_impact or 0) != 0 or decision.delay_impact_days:
        co = ChangeOrder(
            number=next_number(db, "change_order"),
            project_id=decision.project_id,
            title=f"Avenant — {decision.title}",
            description=decision.description,
            reason="client_request",
            origin="decision",
            decision_id=decision.id,
            cost_impact=decision.price_impact,
            delay_impact_days=decision.delay_impact_days,
            status="client_approved",
            client_approved_at=utcnow(),
            client_approved_by_id=user.id,
        )
        db.add(co)
        db.flush()
        decision.change_order_id = co.id
    from app.modules.configurator.service import on_decision_validated

    on_decision_validated(db, decision)
    emit(
        db,
        "decision.validated",
        {
            "id": decision.id,
            "title": decision.title,
            "validated_by": user.full_name,
            "validated_at": decision.validated_at,
            "method": "OTP",
            "requested_by_id": decision.requested_by_id,
            "project_id": decision.project_id,
        },
        aggregate_type="decision",
        aggregate_id=decision.id,
        project_id=decision.project_id,
    )
    audit.record(
        db,
        family="business",
        module="decisions",
        action="VALIDATE",
        resource_type="decision",
        resource_id=decision.id,
        project_id=decision.project_id,
        actor_id=user.id,
        diff={
            "option": decision.selected_option,
            "price_impact": str(decision.price_impact),
            "delay_days": decision.delay_impact_days,
            "hash": decision.content_hash,
        },
        criticality="HIGH",
    )
    return decision


def reject_decision(db: Session, decision: Decision, *, user: Any, reason: str) -> Decision:
    if decision.status != "pending_client":
        raise Conflict("Décision déjà traitée", code="DECISION_LOCKED")
    decision.status = "rejected"
    decision.rejection_reason = reason
    decision.validated_by_id = user.id
    decision.validated_at = utcnow()
    from app.modules.configurator.service import on_decision_rejected

    on_decision_rejected(db, decision)
    audit.record(
        db,
        family="business",
        module="decisions",
        action="REJECT",
        resource_type="decision",
        resource_id=decision.id,
        project_id=decision.project_id,
        actor_id=user.id,
        reason=reason,
    )
    return decision


# ---------------------------------------------------------------------------- avenants
CO_TRANSITIONS = {
    "draft": {"submitted", "cancelled"},
    "submitted": {"client_approved", "rejected", "draft"},
    "client_approved": {"approved", "rejected"},
}


def transition_change_order(
    db: Session, co: ChangeOrder, target: str, *, user_id: uuid.UUID, client: bool = False
) -> ChangeOrder:
    if target not in CO_TRANSITIONS.get(co.status, set()):
        raise BusinessRuleError(f"Transition {co.status} → {target} interdite", code="INVALID_TRANSITION")
    if client and target not in ("client_approved", "rejected"):
        raise BusinessRuleError("Action non permise au client")
    previous = co.status
    co.status = target
    if target == "submitted":
        co.submitted_at = utcnow()
        emit(
            db,
            "change_order.submitted",
            {
                "id": co.id,
                "number": co.number,
                "title": co.title,
                "cost_impact": co.cost_impact,
                "delay_impact_days": co.delay_impact_days,
            },
            aggregate_type="change_order",
            aggregate_id=co.id,
            project_id=co.project_id,
        )
    elif target == "client_approved":
        co.client_approved_at = utcnow()
        co.client_approved_by_id = user_id
    elif target == "approved":
        co.approved_at = utcnow()
        co.approved_by_id = user_id
        project = db.get(Project, co.project_id)
        if project:
            project.contract_amount = money(Decimal(project.contract_amount or 0) + Decimal(co.cost_impact or 0))
            if co.delay_impact_days and project.end_planned:
                project.end_planned = project.end_planned + timedelta(days=int(co.delay_impact_days))
        emit(
            db,
            "change_order.approved",
            {"id": co.id, "number": co.number, "title": co.title, "project_id": co.project_id},
            aggregate_type="change_order",
            aggregate_id=co.id,
            project_id=co.project_id,
        )
    audit.record(
        db,
        family="business",
        module="change_orders",
        action="TRANSITION",
        resource_type="change_order",
        resource_id=co.id,
        project_id=co.project_id,
        actor_id=user_id,
        diff={"status": [previous, target]},
        criticality="HIGH" if target == "approved" else "MEDIUM",
    )
    return co


# ---------------------------------------------------------------------------- journal de chantier
def submit_daily_log(db: Session, log: DailyLog, *, user_id: uuid.UUID) -> DailyLog:
    if log.status != "draft":
        raise BusinessRuleError("Journal déjà soumis")
    log.status = "submitted"
    if log.is_critical:
        project = db.get(Project, log.project_id)
        emit(
            db,
            "daily_log.critical",
            {
                "project_id": log.project_id,
                "project_name": project.name if project else "",
                "summary": (log.issues or log.activities or "")[:300],
            },
            aggregate_type="daily_log",
            aggregate_id=log.id,
            project_id=log.project_id,
        )
    audit.record(
        db,
        family="business",
        module="site_log",
        action="SUBMIT",
        resource_type="daily_log",
        resource_id=log.id,
        project_id=log.project_id,
        actor_id=user_id,
    )
    return log


# ---------------------------------------------------------------------------- vues de synthèse
def project_kpis(db: Session, project: Project) -> dict[str, Any]:
    from app.modules.billing.models import ClientInvoice
    from app.modules.finance.models import Budget, Commitment, Expense, FundsCall
    from app.modules.qhse.models import Incident

    budget = (
        db.execute(
            select(Budget)
            .where(Budget.project_id == project.id, Budget.status == "approved")
            .order_by(Budget.version_number.desc())
        )
        .scalars()
        .first()
        or db.execute(select(Budget).where(Budget.project_id == project.id).order_by(Budget.version_number.desc()))
        .scalars()
        .first()
    )
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
    invoiced = db.execute(
        select(func.coalesce(func.sum(ClientInvoice.total), 0)).where(
            ClientInvoice.project_id == project.id, ClientInvoice.status.not_in(["draft", "cancelled"])
        )
    ).scalar_one()
    collected = db.execute(
        select(func.coalesce(func.sum(ClientInvoice.amount_paid), 0)).where(ClientInvoice.project_id == project.id)
    ).scalar_one()
    calls_due = db.execute(
        select(func.coalesce(func.sum(FundsCall.amount - FundsCall.amount_paid), 0)).where(
            FundsCall.project_id == project.id, FundsCall.status.in_(["issued", "partially_paid", "overdue"])
        )
    ).scalar_one()
    tasks_total = db.execute(
        select(func.count()).select_from(Task).where(Task.project_id == project.id, Task.deleted_at.is_(None))
    ).scalar_one()
    tasks_late = db.execute(
        select(func.count())
        .select_from(Task)
        .where(
            Task.project_id == project.id,
            Task.deleted_at.is_(None),
            Task.status.not_in(["done", "cancelled"]),
            Task.end_planned < date.today(),
        )
    ).scalar_one()
    incidents_open = db.execute(
        select(func.count()).select_from(Incident).where(Incident.project_id == project.id, Incident.status != "closed")
    ).scalar_one()
    next_milestones = (
        db.execute(
            select(Milestone)
            .where(Milestone.project_id == project.id, Milestone.status == "planned")
            .order_by(Milestone.due_date)
            .limit(5)
        )
        .scalars()
        .all()
    )
    budget_total = Decimal(budget.total) if budget else Decimal("0")
    revenue = Decimal(project.contract_amount or 0)
    cost_forecast = max(Decimal(committed), Decimal(spent))
    return jsonable(
        {
            "progress_pct": project.progress_pct,
            "health": project.health,
            "budget": budget_total,
            "budget_version": budget.version_number if budget else None,
            "committed": committed,
            "spent": spent,
            "remaining_to_commit": budget_total - Decimal(committed),
            "remaining_to_pay": Decimal(committed) - Decimal(spent),
            "budget_consumption_pct": round(float(Decimal(spent) * 100 / budget_total), 1) if budget_total else 0,
            "contract_amount": revenue,
            "invoiced": invoiced,
            "collected": collected,
            "funds_calls_due": calls_due,
            "gross_margin": revenue - cost_forecast,
            "gross_margin_pct": round(float((revenue - cost_forecast) * 100 / revenue), 1) if revenue else None,
            "tasks_total": tasks_total,
            "tasks_late": tasks_late,
            "incidents_open": incidents_open,
            "next_milestones": [{"id": m.id, "name": m.name, "due_date": m.due_date} for m in next_milestones],
        }
    )


def members_of(db: Session, project_id: uuid.UUID, roles: list[str] | None = None) -> list[uuid.UUID]:
    stmt = select(ProjectMember.user_id).where(ProjectMember.project_id == project_id)
    if roles:
        stmt = stmt.where(ProjectMember.project_role.in_(roles))
    return list(db.execute(stmt).scalars())


def tranquillite_verify(
    db: Session, item: TranquilliteItem, *, user_id: uuid.UUID, status: str, notes: str | None, anchor: bool = False
) -> TranquilliteItem:
    """Vérification d'une pièce du dossier foncier/administratif (+ ancrage optionnel de l'empreinte, P2)."""
    from app.modules.documents.models import Document, DocumentVersion

    item.status = status
    item.verification_notes = notes
    item.verified_by_id = user_id
    item.verified_at = utcnow()
    if anchor and item.document_ids:
        hashes = []
        for doc_id in item.document_ids:
            doc = db.get(Document, uuid.UUID(str(doc_id)))
            if doc and doc.current_version_id:
                version = db.get(DocumentVersion, doc.current_version_id)
                if version:
                    hashes.append(version.checksum_sha256)
        if hashes:
            from app.providers.anchoring import anchor_digest

            digest = hashlib.sha256("".join(sorted(hashes)).encode()).hexdigest()
            item.anchor_hash = digest
            item.anchor_receipt = anchor_digest(digest)
            item.anchored_at = utcnow()
    audit.record(
        db,
        family="business",
        module="tranquillite",
        action="VERIFY",
        resource_type="tranquillite_item",
        resource_id=item.id,
        project_id=item.project_id,
        actor_id=user_id,
        diff={"status": status},
        criticality="HIGH",
    )
    return item
