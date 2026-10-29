"""QHSE §17.1 : EPI, inspections (grilles pondérées), incidents (photos, gravité, enquête), quart d'heure sécurité,
actions correctives (responsable, échéance, preuves, vérification), clôture, statistiques (TF, TG)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import utcnow
from app.modules.projects.models import Project, Site
from app.modules.qhse.models import (
    CorrectiveAction,
    Incident,
    Inspection,
    InspectionTemplate,
    PPEDistribution,
    PPEItem,
    SafetyTalk,
)

LOST_TIME_KINDS = ("accident",)


# ============================================================================ EPI
def distribute_ppe(
    db: Session,
    *,
    item: PPEItem,
    employee_id: uuid.UUID | None,
    worker_name: str | None,
    project_id: uuid.UUID | None,
    quantity: int,
    distributed_at: date,
    signature_file_id: uuid.UUID | None,
    warehouse_id: uuid.UUID | None,
    user_id: uuid.UUID,
) -> PPEDistribution:
    if not employee_id and not worker_name:
        raise BusinessRuleError("Bénéficiaire requis (employé ou nom de l'intervenant)")
    row = PPEDistribution(
        ppe_item_id=item.id,
        employee_id=employee_id,
        worker_name=worker_name,
        project_id=project_id,
        quantity=quantity,
        distributed_at=distributed_at,
        signature_file_id=signature_file_id,
        distributed_by_id=user_id,
        expected_replacement=distributed_at + timedelta(days=item.lifespan_days) if item.lifespan_days else None,
    )
    db.add(row)
    db.flush()
    if item.stock_item_id and warehouse_id:
        from app.modules.inventory import service as stock
        from app.modules.inventory.models import StockItem

        stock_item = db.get(StockItem, item.stock_item_id)
        if stock_item is not None:
            stock.issue(
                db,
                item=stock_item,
                warehouse_id=warehouse_id,
                quantity=Decimal(quantity),
                user_id=user_id,
                project_id=project_id,
                reason=f"Dotation EPI {item.name}",
                reference_type="ppe",
                reference_id=row.id,
            )
    audit.record(
        db,
        family="business",
        module="qhse",
        action="PPE_DISTRIBUTE",
        resource_type="ppe_distribution",
        resource_id=row.id,
        project_id=project_id,
        actor_id=user_id,
        diff={"item": item.name, "quantity": quantity},
    )
    return row


def ppe_due_replacements(db: Session, days: int = 15) -> list[PPEDistribution]:
    horizon = date.today() + timedelta(days=days)
    return list(
        db.execute(
            select(PPEDistribution).where(
                PPEDistribution.returned_at.is_(None),
                PPEDistribution.expected_replacement.is_not(None),
                PPEDistribution.expected_replacement <= horizon,
            )
        ).scalars()
    )


# ============================================================================ inspections
def start_inspection(
    db: Session,
    *,
    template: InspectionTemplate | None,
    project_id: uuid.UUID,
    site_id: uuid.UUID | None,
    zone_id: uuid.UUID | None,
    category: str,
    inspection_date: date,
    user_id: uuid.UUID,
) -> Inspection:
    checklist = template.checklist if template else []
    inspection = Inspection(
        number=next_number(db, "inspection"),
        template_id=template.id if template else None,
        project_id=project_id,
        site_id=site_id,
        zone_id=zone_id,
        category=template.category if template else category,
        inspector_id=user_id,
        inspection_date=inspection_date,
        status="draft",
        results=[
            {
                "key": c["key"],
                "label": c["label"],
                "weight": c.get("weight", 1),
                "status": None,
                "comment": None,
                "photo_file_id": None,
            }
            for c in checklist
        ],
    )
    db.add(inspection)
    db.flush()
    return inspection


def complete_inspection(
    db: Session,
    inspection: Inspection,
    *,
    results: list[dict[str, Any]],
    findings: str | None,
    user_id: uuid.UUID,
    action_due_days: int = 7,
) -> Inspection:
    """Score pondéré (ok / applicable) ; chaque point non conforme ouvre une action corrective."""
    if inspection.status != "draft":
        raise BusinessRuleError("Inspection déjà terminée")
    by_key = {r["key"]: r for r in inspection.results}
    for entry in results:
        key = entry.get("key")
        if key not in by_key:
            by_key[key] = {"key": key, "label": entry.get("label") or key, "weight": entry.get("weight", 1)}
        if entry.get("status") not in ("ok", "nok", "na"):
            raise BusinessRuleError(f"Statut invalide pour « {by_key[key]['label']} » (ok / nok / na)")
        by_key[key].update(
            {"status": entry["status"], "comment": entry.get("comment"), "photo_file_id": entry.get("photo_file_id")}
        )
    missing = [r["label"] for r in by_key.values() if r.get("status") not in ("ok", "nok", "na")]
    if missing:
        raise BusinessRuleError("Points non renseignés : " + ", ".join(missing[:10]), code="INSPECTION_INCOMPLETE")
    applicable = [r for r in by_key.values() if r["status"] != "na"]
    total = sum(Decimal(str(r.get("weight", 1))) for r in applicable)
    ok = sum(Decimal(str(r.get("weight", 1))) for r in applicable if r["status"] == "ok")
    inspection.results = list(by_key.values())
    inspection.score = (ok * 100 / total).quantize(Decimal("0.01")) if total > 0 else Decimal("100")
    inspection.findings = findings
    inspection.status = "completed"
    site = db.get(Site, inspection.site_id) if inspection.site_id else None
    responsible = site.site_manager_id if site and site.site_manager_id else user_id
    for result in applicable:
        if result["status"] == "nok":
            create_action(
                db,
                project_id=inspection.project_id,
                source_type="inspection",
                source_id=inspection.id,
                title=f"{inspection.number} — {result['label']}"[:250],
                description=result.get("comment"),
                responsible_id=responsible,
                due_date=date.today() + timedelta(days=action_due_days),
                user_id=user_id,
            )
    audit.record(
        db,
        family="business",
        module="qhse",
        action="INSPECTION_COMPLETE",
        resource_type="inspection",
        resource_id=inspection.id,
        project_id=inspection.project_id,
        actor_id=user_id,
        diff={"score": str(inspection.score)},
    )
    return inspection


# ============================================================================ incidents
def declare_incident(db: Session, *, data: dict[str, Any], user_id: uuid.UUID | None) -> Incident:
    incident = Incident(number=next_number(db, "incident"), reported_by_id=user_id, status="declared", **data)
    db.add(incident)
    db.flush()
    project = db.get(Project, incident.project_id)
    site = db.get(Site, incident.site_id) if incident.site_id else None
    emit(
        db,
        "incident.declared",
        {
            "id": incident.id,
            "number": incident.number,
            "title": incident.title,
            "severity": incident.severity,
            "kind": incident.kind,
            "site_name": site.name if site else None,
            "project_name": project.name if project else "",
        },
        aggregate_type="incident",
        aggregate_id=incident.id,
        project_id=incident.project_id,
    )
    audit.record(
        db,
        family="business",
        module="qhse",
        action="INCIDENT_DECLARE",
        resource_type="incident",
        resource_id=incident.id,
        project_id=incident.project_id,
        actor_id=user_id,
        diff={"severity": incident.severity, "kind": incident.kind},
        criticality="HIGH" if incident.severity in ("high", "critical") else "MEDIUM",
    )
    return incident


def investigate(
    db: Session,
    incident: Incident,
    *,
    root_cause: str,
    immediate_actions: str | None,
    lost_time_days: int | None,
    user_id: uuid.UUID,
) -> Incident:
    if incident.status == "closed":
        raise BusinessRuleError("Incident clos")
    incident.root_cause = root_cause
    if immediate_actions:
        incident.immediate_actions = immediate_actions
    if lost_time_days is not None:
        incident.lost_time_days = lost_time_days
    incident.status = "investigating" if incident.status == "declared" else incident.status
    audit.record(
        db,
        family="business",
        module="qhse",
        action="INCIDENT_INVESTIGATE",
        resource_type="incident",
        resource_id=incident.id,
        project_id=incident.project_id,
        actor_id=user_id,
    )
    return incident


def close_incident(db: Session, incident: Incident, *, user_id: uuid.UUID) -> Incident:
    if incident.status == "closed":
        raise BusinessRuleError("Incident déjà clos")
    if not incident.root_cause:
        raise BusinessRuleError("Analyse des causes requise avant clôture", code="ROOT_CAUSE_REQUIRED")
    pending = (
        db.execute(
            select(CorrectiveAction.number).where(
                CorrectiveAction.source_type == "incident",
                CorrectiveAction.source_id == incident.id,
                CorrectiveAction.status.in_(["open", "in_progress", "done"]),
            )
        )
        .scalars()
        .all()
    )
    if pending:
        raise BusinessRuleError("Actions correctives non vérifiées : " + ", ".join(pending), code="ACTIONS_PENDING")
    incident.status = "closed"
    incident.closed_at = utcnow()
    incident.closed_by_id = user_id
    audit.record(
        db,
        family="business",
        module="qhse",
        action="INCIDENT_CLOSE",
        resource_type="incident",
        resource_id=incident.id,
        project_id=incident.project_id,
        actor_id=user_id,
    )
    return incident


def publish_incident(db: Session, incident: Incident, *, summary: str, user_id: uuid.UUID) -> Incident:
    """Information client maîtrisée (transparence) : résumé rédigé, jamais le rapport interne."""
    incident.published_to_client = True
    incident.client_summary = summary
    emit(
        db,
        "incident.client_published",
        {"id": incident.id, "client_summary": summary},
        aggregate_type="incident",
        aggregate_id=incident.id,
        project_id=incident.project_id,
    )
    audit.record(
        db,
        family="business",
        module="qhse",
        action="INCIDENT_PUBLISH",
        resource_type="incident",
        resource_id=incident.id,
        project_id=incident.project_id,
        actor_id=user_id,
    )
    return incident


# ============================================================================ actions correctives
def create_action(
    db: Session,
    *,
    project_id: uuid.UUID | None,
    source_type: str,
    source_id: uuid.UUID | None,
    title: str,
    description: str | None,
    responsible_id: uuid.UUID | None,
    due_date: date | None,
    user_id: uuid.UUID | None,
) -> CorrectiveAction:
    action = CorrectiveAction(
        number=next_number(db, "corrective_action"),
        project_id=project_id,
        source_type=source_type,
        source_id=source_id,
        title=title,
        description=description,
        responsible_id=responsible_id,
        due_date=due_date,
    )
    db.add(action)
    db.flush()
    if source_type == "incident" and source_id:
        incident = db.get(Incident, source_id)
        if incident is not None and incident.status in ("declared", "investigating"):
            incident.status = "action_plan"
    if responsible_id:
        from app.modules.notifications.service import notify_users

        notify_users(
            db,
            [responsible_id],
            category="qhse",
            title=f"Action corrective {action.number}",
            body=f"{title} — échéance {due_date:%d/%m/%Y}" if due_date else title,
            link=f"/erp/qhse/actions/{action.id}",
            priority="high",
            channels=("in_app", "push"),
            entity_type="corrective_action",
            event_type="corrective_action.assigned",
            entity_id=str(action.id),
            project_id=project_id,
        )
    audit.record(
        db,
        family="business",
        module="qhse",
        action="ACTION_CREATE",
        resource_type="corrective_action",
        resource_id=action.id,
        project_id=project_id,
        actor_id=user_id,
        diff={"source": source_type, "due": str(due_date) if due_date else None},
    )
    return action


def complete_action(
    db: Session, action: CorrectiveAction, *, note: str, evidence: list[str], user_id: uuid.UUID
) -> CorrectiveAction:
    if action.status not in ("open", "in_progress"):
        raise BusinessRuleError("Action non ouverte")
    if not evidence:
        raise BusinessRuleError("Preuve de réalisation requise (photo, document)", code="PROOF_REQUIRED")
    action.status = "done"
    action.closure_note = note
    action.closure_evidence_file_ids = evidence
    action.completed_at = utcnow()
    audit.record(
        db,
        family="business",
        module="qhse",
        action="ACTION_DONE",
        resource_type="corrective_action",
        resource_id=action.id,
        project_id=action.project_id,
        actor_id=user_id,
    )
    return action


def verify_action(
    db: Session,
    action: CorrectiveAction,
    *,
    accept: bool,
    comment: str | None,
    user_id: uuid.UUID,
    principal: Any = None,
) -> CorrectiveAction:
    from app.core.sod import require_other_person

    if action.status != "done":
        raise BusinessRuleError("Action non réalisée")
    message = "Vérification par une personne distincte du responsable"
    if principal is not None:
        require_other_person(
            db, principal, action.responsible_id, message, resource_type="corrective_action", resource_id=action.id
        )
    elif action.responsible_id == user_id:
        raise BusinessRuleError(message, code="SEGREGATION_OF_DUTIES")
    if accept:
        action.status = "verified"
        action.verified_by_id = user_id
        action.verified_at = utcnow()
    else:
        action.status = "in_progress"
        action.closure_note = f"{action.closure_note or ''}\nRefus de vérification : {comment or ''}".strip()
    audit.record(
        db,
        family="business",
        module="qhse",
        action="ACTION_VERIFY" if accept else "ACTION_REOPEN",
        resource_type="corrective_action",
        resource_id=action.id,
        project_id=action.project_id,
        actor_id=user_id,
        reason=comment,
    )
    return action


# ============================================================================ statistiques
def statistics(db: Session, *, project_ids: list[uuid.UUID] | None, start: date, end: date) -> dict[str, Any]:
    """TF = accidents avec arrêt × 10⁶ / heures travaillées ; TG = jours perdus × 10³ / heures travaillées."""
    from app.modules.hr.models import Attendance

    def scoped(stmt: Any, column: Any) -> Any:
        return stmt.where(column.in_(project_ids)) if project_ids is not None else stmt

    incidents = (
        db.execute(
            scoped(
                select(Incident).where(
                    func.date(Incident.occurred_at) >= start, func.date(Incident.occurred_at) <= end
                ),
                Incident.project_id,
            )
        )
        .scalars()
        .all()
    )
    hours = Decimal(
        db.execute(
            scoped(
                select(func.coalesce(func.sum(Attendance.hours_worked), 0)).where(
                    Attendance.work_date >= start, Attendance.work_date <= end
                ),
                Attendance.project_id,
            )
        ).scalar_one()
    )
    lost_time = [i for i in incidents if i.kind in LOST_TIME_KINDS and (i.lost_time_days or 0) > 0]
    lost_days = sum(i.lost_time_days or 0 for i in incidents)
    by_kind: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    by_month: dict[str, int] = {}
    for incident in incidents:
        by_kind[incident.kind] = by_kind.get(incident.kind, 0) + 1
        by_severity[incident.severity] = by_severity.get(incident.severity, 0) + 1
        month = incident.occurred_at.strftime("%Y-%m")
        by_month[month] = by_month.get(month, 0) + 1
    inspections = (
        db.execute(
            scoped(
                select(Inspection).where(
                    Inspection.inspection_date >= start, Inspection.inspection_date <= end, Inspection.status != "draft"
                ),
                Inspection.project_id,
            )
        )
        .scalars()
        .all()
    )
    actions = db.execute(scoped(select(CorrectiveAction), CorrectiveAction.project_id)).scalars().all()
    talks = (
        db.execute(
            scoped(
                select(SafetyTalk).where(SafetyTalk.talk_date >= start, SafetyTalk.talk_date <= end),
                SafetyTalk.project_id,
            )
        )
        .scalars()
        .all()
    )
    last_accident = db.execute(
        scoped(select(func.max(Incident.occurred_at)).where(Incident.kind == "accident"), Incident.project_id)
    ).scalar()
    today = date.today()
    return {
        "period": {"start": start, "end": end},
        "hours_worked": hours,
        "incidents": len(incidents),
        "lost_time_accidents": len(lost_time),
        "lost_days": lost_days,
        "frequency_rate": round(float(Decimal(len(lost_time)) * 1_000_000 / hours), 2) if hours > 0 else None,
        "severity_rate": round(float(Decimal(lost_days) * 1000 / hours), 2) if hours > 0 else None,
        "by_kind": by_kind,
        "by_severity": by_severity,
        "by_month": dict(sorted(by_month.items())),
        "inspections": len(inspections),
        "inspection_avg_score": round(float(sum(Decimal(i.score or 0) for i in inspections) / len(inspections)), 1)
        if inspections
        else None,
        "actions_open": sum(1 for a in actions if a.status in ("open", "in_progress")),
        "actions_overdue": sum(
            1 for a in actions if a.status in ("open", "in_progress") and a.due_date and a.due_date < today
        ),
        "actions_verified": sum(1 for a in actions if a.status == "verified"),
        "safety_talks": len(talks),
        "safety_talk_attendees": sum(t.attendee_count for t in talks),
        "days_without_accident": (today - last_accident.date()).days if isinstance(last_accident, datetime) else None,
    }


def get_incident(db: Session, incident_id: uuid.UUID) -> Incident:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise NotFound("Incident introuvable")
    return incident
