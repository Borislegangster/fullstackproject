"""Matériel §17.2 : parc, affectation chantier, état, maintenance préventive / corrective, documents, incidents,
coût d'utilisation imputé au projet, localisation selon politique."""

from __future__ import annotations

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
from app.core.security import random_token
from app.core.utils import money, utcnow
from app.modules.equipment.models import (
    Equipment,
    EquipmentAssignment,
    EquipmentIncident,
    EquipmentUsage,
    MaintenanceOrder,
    MaintenancePlan,
)
from app.modules.projects.models import Site


def create_equipment(db: Session, *, data: dict[str, Any], user_id: uuid.UUID) -> Equipment:
    equipment = Equipment(
        code=data.pop("code", None) or next_number(db, "equipment"), qr_token=random_token(24), **data
    )
    db.add(equipment)
    db.flush()
    audit.record(
        db,
        family="business",
        module="equipment",
        action="CREATE",
        resource_type="equipment",
        resource_id=equipment.id,
        actor_id=user_id,
        diff={"code": equipment.code, "name": equipment.name},
    )
    return equipment


def by_qr(db: Session, code: str) -> Equipment:
    token = code.split("GLOBUS:EQP:", 1)[1] if code.startswith("GLOBUS:EQP:") else code
    equipment = db.execute(
        select(Equipment).where(
            (Equipment.qr_token == token) | (Equipment.code == token), Equipment.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if equipment is None:
        raise NotFound("Matériel introuvable")
    return equipment


def assign(
    db: Session,
    equipment: Equipment,
    *,
    project_id: uuid.UUID,
    site_id: uuid.UUID | None,
    operator_id: uuid.UUID | None,
    start: date,
    end: date | None,
    notes: str | None,
    user_id: uuid.UUID,
) -> EquipmentAssignment:
    if equipment.status in ("maintenance", "broken", "retired"):
        raise BusinessRuleError(f"Matériel indisponible ({equipment.status})", code="EQUIPMENT_UNAVAILABLE")
    active = db.execute(
        select(EquipmentAssignment).where(
            EquipmentAssignment.equipment_id == equipment.id, EquipmentAssignment.status == "active"
        )
    ).scalar_one_or_none()
    if active is not None:
        raise Conflict("Matériel déjà affecté : enregistrer d'abord le retour", code="ALREADY_ASSIGNED")
    if site_id:
        site = db.get(Site, site_id)
        if site is None or site.project_id != project_id:
            raise BusinessRuleError("Chantier hors projet")
    if equipment.insurance_until and equipment.insurance_until < start and equipment.category in ("engin", "vehicule"):
        raise BusinessRuleError("Assurance expirée : affectation refusée", code="INSURANCE_EXPIRED")
    row = EquipmentAssignment(
        equipment_id=equipment.id,
        project_id=project_id,
        site_id=site_id,
        operator_id=operator_id,
        start_date=start,
        end_date=end,
        status="active" if start <= date.today() else "planned",
        assigned_by_id=user_id,
        notes=notes,
    )
    db.add(row)
    if row.status == "active":
        equipment.status = "assigned"
        equipment.current_project_id = project_id
        equipment.current_site_id = site_id
    db.flush()
    audit.record(
        db,
        family="business",
        module="equipment",
        action="ASSIGN",
        resource_type="equipment",
        resource_id=equipment.id,
        project_id=project_id,
        actor_id=user_id,
        diff={"site": str(site_id) if site_id else None, "operator": str(operator_id) if operator_id else None},
    )
    return row


def return_equipment(
    db: Session, equipment: Equipment, *, condition: str | None, notes: str | None, user_id: uuid.UUID
) -> EquipmentAssignment:
    active = db.execute(
        select(EquipmentAssignment).where(
            EquipmentAssignment.equipment_id == equipment.id, EquipmentAssignment.status == "active"
        )
    ).scalar_one_or_none()
    if active is None:
        raise BusinessRuleError("Aucune affectation active")
    active.status = "returned"
    active.returned_at = utcnow()
    active.end_date = active.end_date or date.today()
    if notes:
        active.notes = f"{active.notes or ''}\nRetour : {notes}".strip()
    if condition:
        equipment.condition = condition
    equipment.status = "available" if equipment.status == "assigned" else equipment.status
    equipment.current_project_id = None
    equipment.current_site_id = None
    audit.record(
        db,
        family="business",
        module="equipment",
        action="RETURN",
        resource_type="equipment",
        resource_id=equipment.id,
        project_id=active.project_id,
        actor_id=user_id,
        diff={"condition": condition},
    )
    return active


def log_usage(
    db: Session,
    equipment: Equipment,
    *,
    usage_date: date,
    hours: Decimal,
    km: Decimal,
    fuel_liters: Decimal,
    fuel_cost: Decimal,
    project_id: uuid.UUID | None,
    site_id: uuid.UUID | None,
    operator_id: uuid.UUID | None,
    notes: str | None,
    user_id: uuid.UUID,
) -> EquipmentUsage:
    """Relevé d'utilisation → coût imputé au projet (heures × coût horaire, ou forfait journalier) + carburant."""
    project_id = project_id or equipment.current_project_id
    if hours > 0 and Decimal(equipment.hourly_cost) > 0:
        base = hours * Decimal(equipment.hourly_cost)
    elif hours > 0 or km > 0:
        base = Decimal(equipment.daily_cost)
    else:
        base = Decimal("0")
    cost = money(base + fuel_cost)
    row = EquipmentUsage(
        equipment_id=equipment.id,
        project_id=project_id,
        site_id=site_id or equipment.current_site_id,
        usage_date=usage_date,
        hours=hours,
        km=km,
        fuel_liters=fuel_liters,
        fuel_cost=money(fuel_cost),
        operator_id=operator_id,
        cost=cost,
        notes=notes,
    )
    db.add(row)
    equipment.meter_hours = Decimal(equipment.meter_hours) + hours
    equipment.meter_km = Decimal(equipment.meter_km) + km
    db.flush()
    if project_id and cost > 0:
        from app.modules.finance.service import record_expense

        record_expense(
            db,
            project_id=project_id,
            lot_id=None,
            category="materiel",
            label=f"Utilisation {equipment.code} — {equipment.name}",
            amount=cost,
            expense_date=usage_date,
            source_type="equipment",
            source_id=row.id,
            user_id=user_id,
        )
    check_maintenance(db, equipment)
    return row


def plan_next_due(plan: MaintenancePlan) -> date | None:
    if plan.interval_days and plan.last_done_at:
        return plan.last_done_at + timedelta(days=plan.interval_days)
    if plan.interval_days and not plan.last_done_at:
        return date.today()
    return plan.next_due_date


def check_maintenance(db: Session, equipment: Equipment) -> list[MaintenancePlan]:
    """Plans arrivés à échéance (calendrier ou compteur horaire) → alerte, sans doublon d'ordre planifié."""
    due = []
    for plan in db.execute(
        select(MaintenancePlan).where(MaintenancePlan.equipment_id == equipment.id, MaintenancePlan.is_active.is_(True))
    ).scalars():
        by_hours = plan.interval_hours and (
            Decimal(equipment.meter_hours) - Decimal(plan.last_done_hours or 0) >= Decimal(plan.interval_hours)
        )
        by_date = plan.next_due_date and plan.next_due_date <= date.today()
        if not (by_hours or by_date):
            continue
        pending = db.execute(
            select(MaintenanceOrder.id).where(
                MaintenanceOrder.plan_id == plan.id, MaintenanceOrder.status.in_(["planned", "in_progress"])
            )
        ).first()
        if pending:
            continue
        due.append(plan)
        emit(
            db,
            "equipment.maintenance_due",
            {
                "id": equipment.id,
                "equipment": f"{equipment.code} {equipment.name}",
                "title": plan.title,
                "due_date": plan.next_due_date or date.today(),
            },
            aggregate_type="equipment",
            aggregate_id=equipment.id,
            project_id=equipment.current_project_id,
        )
    return due


def create_order(
    db: Session,
    equipment: Equipment,
    *,
    kind: str,
    plan: MaintenancePlan | None,
    description: str | None,
    scheduled: date | None,
    technician_id: uuid.UUID | None,
    vendor: str | None,
    user_id: uuid.UUID,
) -> MaintenanceOrder:
    order = MaintenanceOrder(
        number=next_number(db, "maintenance"),
        equipment_id=equipment.id,
        plan_id=plan.id if plan else None,
        kind=kind,
        description=description,
        scheduled_date=scheduled or date.today(),
        technician_id=technician_id,
        vendor=vendor,
    )
    db.add(order)
    db.flush()
    audit.record(
        db,
        family="business",
        module="equipment",
        action="MAINTENANCE_PLAN",
        resource_type="maintenance_order",
        resource_id=order.id,
        actor_id=user_id,
        diff={"kind": kind},
    )
    return order


def start_order(db: Session, order: MaintenanceOrder, equipment: Equipment, *, user_id: uuid.UUID) -> MaintenanceOrder:
    if order.status != "planned":
        raise BusinessRuleError("Ordre déjà démarré ou clos")
    order.status = "in_progress"
    equipment.status = "maintenance"
    audit.record(
        db,
        family="business",
        module="equipment",
        action="MAINTENANCE_START",
        resource_type="maintenance_order",
        resource_id=order.id,
        actor_id=user_id,
    )
    return order


def complete_order(
    db: Session,
    order: MaintenanceOrder,
    equipment: Equipment,
    *,
    cost: Decimal,
    downtime_hours: Decimal,
    report: str,
    condition: str | None,
    user_id: uuid.UUID,
) -> MaintenanceOrder:
    if order.status not in ("planned", "in_progress"):
        raise BusinessRuleError("Ordre déjà clos")
    order.status = "done"
    order.done_at = utcnow()
    order.cost = money(cost)
    order.downtime_hours = downtime_hours
    order.report = report
    if order.plan_id:
        plan = db.get(MaintenancePlan, order.plan_id)
        if plan is not None:
            plan.last_done_at = date.today()
            plan.last_done_hours = equipment.meter_hours
            plan.next_due_date = plan_next_due(plan)
    active = db.execute(
        select(EquipmentAssignment.id).where(
            EquipmentAssignment.equipment_id == equipment.id, EquipmentAssignment.status == "active"
        )
    ).first()
    equipment.status = "assigned" if active else "available"
    if condition:
        equipment.condition = condition
    if equipment.current_project_id and order.cost > 0 and order.kind == "corrective":
        from app.modules.finance.service import record_expense

        record_expense(
            db,
            project_id=equipment.current_project_id,
            lot_id=None,
            category="materiel",
            label=f"Maintenance {order.number} — {equipment.code}",
            amount=Decimal(order.cost),
            expense_date=date.today(),
            source_type="equipment",
            source_id=order.id,
            user_id=user_id,
        )
    audit.record(
        db,
        family="business",
        module="equipment",
        action="MAINTENANCE_DONE",
        resource_type="maintenance_order",
        resource_id=order.id,
        actor_id=user_id,
        diff={"cost": str(order.cost), "downtime": str(downtime_hours)},
    )
    return order


def declare_incident(
    db: Session, equipment: Equipment, *, data: dict[str, Any], user_id: uuid.UUID
) -> EquipmentIncident:
    incident = EquipmentIncident(
        equipment_id=equipment.id,
        project_id=data.pop("project_id", None) or equipment.current_project_id,
        reported_by_id=user_id,
        **data,
    )
    db.add(incident)
    db.flush()
    if incident.kind in ("breakdown", "damage", "accident") and incident.severity in ("high", "critical"):
        equipment.status = "broken"
        create_order(
            db,
            equipment,
            kind="corrective",
            plan=None,
            description=f"Incident {incident.kind} : {incident.description or ''}"[:2000],
            scheduled=date.today(),
            technician_id=None,
            vendor=None,
            user_id=user_id,
        )
    if incident.kind == "theft":
        equipment.status = "retired"
    audit.record(
        db,
        family="business",
        module="equipment",
        action="INCIDENT",
        resource_type="equipment",
        resource_id=equipment.id,
        project_id=incident.project_id,
        actor_id=user_id,
        diff={"kind": incident.kind, "severity": incident.severity},
        criticality="MEDIUM",
    )
    return incident


def cost_report(db: Session, equipment: Equipment, *, start: date, end: date) -> dict[str, Any]:
    usage = db.execute(
        select(
            func.coalesce(func.sum(EquipmentUsage.cost), 0),
            func.coalesce(func.sum(EquipmentUsage.hours), 0),
            func.coalesce(func.sum(EquipmentUsage.fuel_liters), 0),
        ).where(
            EquipmentUsage.equipment_id == equipment.id,
            EquipmentUsage.usage_date >= start,
            EquipmentUsage.usage_date <= end,
        )
    ).one()
    maintenance = db.execute(
        select(
            func.coalesce(func.sum(MaintenanceOrder.cost), 0),
            func.coalesce(func.sum(MaintenanceOrder.downtime_hours), 0),
        ).where(
            MaintenanceOrder.equipment_id == equipment.id,
            MaintenanceOrder.status == "done",
            func.date(MaintenanceOrder.done_at) >= start,
            func.date(MaintenanceOrder.done_at) <= end,
        )
    ).one()
    incidents = db.execute(
        select(func.coalesce(func.sum(EquipmentIncident.cost), 0), func.count(EquipmentIncident.id)).where(
            EquipmentIncident.equipment_id == equipment.id,
            func.date(EquipmentIncident.occurred_at) >= start,
            func.date(EquipmentIncident.occurred_at) <= end,
        )
    ).one()
    period_days = (end - start).days + 1
    assigned_days = 0
    for assignment in db.execute(
        select(EquipmentAssignment).where(
            EquipmentAssignment.equipment_id == equipment.id, EquipmentAssignment.start_date <= end
        )
    ).scalars():
        a_start = max(assignment.start_date, start)
        a_end = min(assignment.end_date or date.today(), end)
        if a_end >= a_start:
            assigned_days += (a_end - a_start).days + 1
    return {
        "equipment": {"id": equipment.id, "code": equipment.code, "name": equipment.name},
        "period": {"start": start, "end": end},
        "usage_cost": usage[0],
        "hours": usage[1],
        "fuel_liters": usage[2],
        "maintenance_cost": maintenance[0],
        "downtime_hours": maintenance[1],
        "incident_cost": incidents[0],
        "incidents": incidents[1],
        "total_cost": money(Decimal(usage[0]) + Decimal(maintenance[0]) + Decimal(incidents[0])),
        "utilization_rate": round(min(assigned_days, period_days) * 100 / period_days, 1) if period_days > 0 else None,
    }
