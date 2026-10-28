"""RH §17 : employés, pointage QR géolocalisé (hors ligne idempotent), heures et heures supplémentaires, congés,
paie paramétrée (cotisations et barème IRPP en paramètres versionnés), bulletins PDF, documents RH, historique."""

from __future__ import annotations

import calendar
import logging
import uuid
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.numbering import next_number
from app.core.security import random_token
from app.core.utils import money, utcnow
from app.modules.hr.models import (
    Attendance,
    Employee,
    HRDocument,
    HRHistory,
    LeaveRequest,
    PayrollItem,
    PayrollRun,
    WorkSchedule,
)
from app.modules.projects.models import Site
from app.modules.system.models import Setting

log = logging.getLogger("globus.hr")

# Paramètres de paie par défaut (Cameroun) — modifiables dans Paramètres → Paie ; la validation d'une paie exige
# que ces paramètres aient été revus (« reviewed ») par le cabinet comptable.
DEFAULT_PAYROLL_PARAMETERS: dict[str, Any] = {
    "reviewed": False,
    "currency": "XAF",
    "monthly_hours": 173.33,
    "overtime_rate": 1.2,
    "unpaid_day_divisor": 30,
    "contributions": [
        {
            "code": "CNPS_PVID",
            "label": "CNPS pension vieillesse",
            "base": "gross",
            "employee_rate": 4.2,
            "employer_rate": 4.2,
            "ceiling": 750000,
        },
        {
            "code": "CNPS_PF",
            "label": "CNPS prestations familiales",
            "base": "gross",
            "employee_rate": 0,
            "employer_rate": 7.0,
            "ceiling": 750000,
        },
        {
            "code": "CNPS_AT",
            "label": "CNPS accidents du travail (BTP)",
            "base": "gross",
            "employee_rate": 0,
            "employer_rate": 5.0,
            "ceiling": None,
        },
        {
            "code": "CFC",
            "label": "Crédit foncier",
            "base": "gross",
            "employee_rate": 1.0,
            "employer_rate": 1.5,
            "ceiling": None,
        },
        {
            "code": "FNE",
            "label": "Fonds national de l'emploi",
            "base": "gross",
            "employee_rate": 0,
            "employer_rate": 1.0,
            "ceiling": None,
        },
    ],
    "irpp": {
        "professional_abatement_pct": 30,
        "annual_abatement": 500000,
        "monthly_exemption_threshold": 62000,
        "brackets": [[2000000, 10], [3000000, 15], [5000000, 25], [None, 35]],
        "cac_pct": 10,
    },
    "rav_brackets": [
        [50000, 0],
        [100000, 750],
        [200000, 1950],
        [300000, 3250],
        [400000, 4550],
        [500000, 5850],
        [600000, 7150],
        [700000, 8450],
        [800000, 9750],
        [900000, 11050],
        [1000000, 12350],
        [None, 13000],
    ],
    "tdl_brackets": [
        [62000, 0],
        [75000, 250],
        [100000, 500],
        [125000, 750],
        [150000, 1000],
        [200000, 1250],
        [250000, 1500],
        [300000, 2000],
        [500000, 2250],
        [None, 2500],
    ],
}


def payroll_parameters(db: Session) -> dict[str, Any]:
    row = db.get(Setting, "payroll_parameters")
    if row is None or not isinstance(row.value, dict) or not row.value:
        return dict(DEFAULT_PAYROLL_PARAMETERS)
    return {**DEFAULT_PAYROLL_PARAMETERS, **row.value}


def _history(
    db: Session,
    employee: Employee,
    *,
    kind: str,
    description: str,
    details: dict[str, Any] | None,
    user_id: uuid.UUID | None,
    effective: date | None = None,
) -> HRHistory:
    row = HRHistory(
        employee_id=employee.id,
        kind=kind,
        effective_date=effective or date.today(),
        description=description,
        details=details or {},
        recorded_by_id=user_id,
    )
    db.add(row)
    return row


# ============================================================================ employés
def create_employee(db: Session, *, data: dict[str, Any], user_id: uuid.UUID) -> Employee:
    employee = Employee(
        matricule=data.pop("matricule", None) or next_number(db, "employee"), badge_token=random_token(24), **data
    )
    db.add(employee)
    db.flush()
    _history(
        db,
        employee,
        kind="embauche",
        description=f"Embauche — {employee.job_title} ({employee.contract_type})",
        details={"base_salary": str(employee.base_salary), "daily_rate": str(employee.daily_rate)},
        user_id=user_id,
        effective=employee.hire_date,
    )
    audit.record(
        db,
        family="business",
        module="hr",
        action="CREATE",
        resource_type="employee",
        resource_id=employee.id,
        actor_id=user_id,
        diff={"matricule": employee.matricule},
    )
    return employee


TRACKED = {
    "base_salary": "salaire",
    "hourly_rate": "salaire",
    "daily_rate": "salaire",
    "job_title": "promotion",
    "current_project_id": "affectation",
    "team_id": "affectation",
    "contract_type": "contrat",
    "status": "statut",
}
SENSITIVE = {"national_id", "social_security_number", "bank_account", "mobile_money_number"}


def update_employee(
    db: Session, employee: Employee, *, values: dict[str, Any], user_id: uuid.UUID, reason: str | None
) -> Employee:
    changes: dict[str, Any] = {}
    for key, value in values.items():
        old = getattr(employee, key)
        if old == value:
            continue
        changes[key] = (
            "***"
            if key in SENSITIVE
            else {"old": str(old) if old is not None else None, "new": str(value) if value is not None else None}
        )
        setattr(employee, key, value)
        if key in TRACKED and key not in SENSITIVE:
            _history(
                db,
                employee,
                kind=TRACKED[key],
                description=f"{key} : {old} → {value}",
                details={"field": key, "reason": reason},
                user_id=user_id,
            )
    if changes:
        audit.record(
            db,
            family="business",
            module="hr",
            action="UPDATE",
            resource_type="employee",
            resource_id=employee.id,
            actor_id=user_id,
            diff=changes,
            reason=reason,
            criticality="HIGH" if SENSITIVE & set(changes) or "base_salary" in changes else "LOW",
        )
    return employee


def regenerate_badge(db: Session, employee: Employee, *, user_id: uuid.UUID) -> Employee:
    employee.badge_token = random_token(24)
    audit.record(
        db,
        family="security",
        module="hr",
        action="BADGE_REGENERATE",
        resource_type="employee",
        resource_id=employee.id,
        actor_id=user_id,
        criticality="MEDIUM",
    )
    return employee


def terminate(db: Session, employee: Employee, *, end_date: date, reason: str, user_id: uuid.UUID) -> Employee:
    if employee.status == "left":
        raise BusinessRuleError("Employé déjà sorti des effectifs")
    employee.status = "left"
    employee.end_date = end_date
    employee.badge_token = random_token(24)  # badge révoqué
    _history(
        db, employee, kind="depart", description=f"Départ : {reason}", details={}, user_id=user_id, effective=end_date
    )
    if employee.user_id:
        from app.modules.identity.models import User

        user = db.get(User, employee.user_id)
        if user is not None:
            user.is_active = False
    audit.record(
        db,
        family="business",
        module="hr",
        action="TERMINATE",
        resource_type="employee",
        resource_id=employee.id,
        actor_id=user_id,
        reason=reason,
        criticality="HIGH",
    )
    return employee


# ============================================================================ pointage
def default_schedule(db: Session) -> WorkSchedule | None:
    return db.execute(select(WorkSchedule).where(WorkSchedule.is_default.is_(True))).scalars().first()


def _geofence(site: Site | None, latitude: float | None, longitude: float | None) -> bool | None:
    if site is None or site.latitude is None or site.longitude is None or latitude is None or longitude is None:
        return None
    from app.providers.geo import haversine_m

    return haversine_m(latitude, longitude, site.latitude, site.longitude) <= (site.geofence_radius_m or 300)


def _compute_hours(attendance: Attendance, schedule: WorkSchedule | None) -> None:
    if not attendance.check_in or not attendance.check_out:
        return
    total = Decimal((attendance.check_out - attendance.check_in).total_seconds()) / Decimal(3600)
    break_hours = Decimal(schedule.break_minutes if schedule else 60) / 60
    worked = total - break_hours if total > 6 else total
    worked = max(Decimal("0"), worked).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    threshold = Decimal(schedule.overtime_threshold_hours if schedule else 8)
    attendance.hours_worked = worked
    attendance.overtime_hours = max(Decimal("0"), worked - threshold).quantize(Decimal("0.01"))


def record_scan(
    db: Session,
    *,
    employee: Employee,
    project_id: uuid.UUID | None,
    site_id: uuid.UUID | None,
    at: datetime | None,
    latitude: float | None,
    longitude: float | None,
    method: str,
    recorded_by_id: uuid.UUID | None,
    client_mutation_id: str | None,
    action: str | None = None,
) -> tuple[Attendance, str]:
    """Pointage : 1er scan = arrivée, 2e = départ. Idempotent par `client_mutation_id` (synchronisation hors ligne)."""
    if client_mutation_id:
        existing = db.execute(
            select(Attendance).where(Attendance.client_mutation_id == client_mutation_id)
        ).scalar_one_or_none()
        if existing is not None:
            return existing, "replay"
    if employee.status != "active":
        raise BusinessRuleError("Employé inactif : pointage refusé", code="EMPLOYEE_INACTIVE")
    moment = at or utcnow()
    if moment > utcnow() + timedelta(minutes=5):
        raise BusinessRuleError("Horodatage dans le futur")
    site = db.get(Site, site_id) if site_id else None
    if site is not None and project_id and site.project_id != project_id:
        raise BusinessRuleError("Chantier hors projet")
    project_id = project_id or (site.project_id if site else employee.current_project_id)
    from zoneinfo import ZoneInfo

    from app.core.config import settings

    local = moment.astimezone(ZoneInfo(settings.TIMEZONE))
    work_date = local.date()
    attendance = db.execute(
        select(Attendance)
        .where(
            Attendance.employee_id == employee.id,
            Attendance.work_date == work_date,
            Attendance.project_id.is_(None) if project_id is None else Attendance.project_id == project_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    schedule = default_schedule(db)
    inside = _geofence(site, latitude, longitude)
    if attendance is None:
        if action == "out":
            raise BusinessRuleError("Aucune arrivée enregistrée ce jour")
        attendance = Attendance(
            employee_id=employee.id,
            project_id=project_id,
            site_id=site_id,
            work_date=work_date,
            check_in=moment,
            method=method,
            latitude=latitude,
            longitude=longitude,
            inside_geofence=inside,
            recorded_by_id=recorded_by_id,
            client_mutation_id=client_mutation_id,
            status="present",
        )
        if schedule is not None:
            start = datetime.combine(work_date, schedule.start_time, tzinfo=ZoneInfo(settings.TIMEZONE))
            if local > start + timedelta(minutes=15):
                attendance.status = "late"
        db.add(attendance)
        kind = "in"
    else:
        if action == "in":
            raise Conflict("Arrivée déjà enregistrée ce jour", code="ALREADY_CHECKED_IN")
        if attendance.check_out is not None and action != "out":
            raise Conflict("Arrivée et départ déjà enregistrés ce jour", code="ALREADY_CHECKED_OUT")
        if moment <= (attendance.check_in or moment):
            raise BusinessRuleError("Départ antérieur à l'arrivée")
        attendance.check_out = moment
        if inside is False:
            attendance.inside_geofence = False
        if client_mutation_id and not attendance.client_mutation_id:
            attendance.client_mutation_id = client_mutation_id
        _compute_hours(attendance, schedule)
        kind = "out"
    db.flush()
    if inside is False:
        audit.record(
            db,
            family="security",
            module="hr",
            action="ATTENDANCE_OUTSIDE_GEOFENCE",
            resource_type="attendance",
            resource_id=attendance.id,
            project_id=project_id,
            actor_id=recorded_by_id,
            diff={"lat": latitude, "lng": longitude},
            criticality="MEDIUM",
        )
    return attendance, kind


def manual_attendance(
    db: Session,
    *,
    employee: Employee,
    work_date: date,
    check_in: time | None,
    check_out: time | None,
    status: str,
    project_id: uuid.UUID | None,
    reason: str,
    user_id: uuid.UUID,
) -> Attendance:
    from zoneinfo import ZoneInfo

    from app.core.config import settings

    tz = ZoneInfo(settings.TIMEZONE)
    row = db.execute(
        select(Attendance).where(
            Attendance.employee_id == employee.id,
            Attendance.work_date == work_date,
            Attendance.project_id.is_(None) if project_id is None else Attendance.project_id == project_id,
        )
    ).scalar_one_or_none()
    if row is None:
        row = Attendance(
            employee_id=employee.id, project_id=project_id, work_date=work_date, method="manual", recorded_by_id=user_id
        )
        db.add(row)
    row.check_in = datetime.combine(work_date, check_in, tzinfo=tz) if check_in else None
    row.check_out = datetime.combine(work_date, check_out, tzinfo=tz) if check_out else None
    row.status = status
    row.notes = reason[:300]
    if status in ("absent", "leave", "sick"):
        row.hours_worked = Decimal("0")
        row.overtime_hours = Decimal("0")
    else:
        _compute_hours(row, default_schedule(db))
    db.flush()
    audit.record(
        db,
        family="business",
        module="hr",
        action="ATTENDANCE_MANUAL",
        resource_type="attendance",
        resource_id=row.id,
        project_id=project_id,
        actor_id=user_id,
        reason=reason,
        criticality="MEDIUM",
    )
    return row


def attendance_summary(
    db: Session, *, start: date, end: date, project_id: uuid.UUID | None = None
) -> list[dict[str, Any]]:
    stmt = (
        select(
            Attendance.employee_id,
            func.count(Attendance.id).filter(Attendance.status.in_(["present", "late"])),
            func.coalesce(func.sum(Attendance.hours_worked), 0),
            func.coalesce(func.sum(Attendance.overtime_hours), 0),
            func.count(Attendance.id).filter(Attendance.status == "late"),
            func.count(Attendance.id).filter(Attendance.status == "absent"),
        )
        .where(Attendance.work_date >= start, Attendance.work_date <= end)
        .group_by(Attendance.employee_id)
    )
    if project_id:
        stmt = stmt.where(Attendance.project_id == project_id)
    rows = db.execute(stmt).all()
    names = {
        e.id: e
        for e in db.execute(select(Employee).where(Employee.id.in_([r[0] for r in rows] or [uuid.uuid4()]))).scalars()
    }
    return [
        {
            "employee_id": eid,
            "matricule": names[eid].matricule if eid in names else "",
            "name": names[eid].full_name if eid in names else "",
            "days_present": days,
            "hours": hours,
            "overtime_hours": overtime,
            "late": late,
            "absences": absent,
        }
        for eid, days, hours, overtime, late, absent in rows
    ]


# ============================================================================ congés
def request_leave(
    db: Session, *, employee: Employee, kind: str, start: date, end: date, reason: str | None, user_id: uuid.UUID | None
) -> LeaveRequest:
    if end < start:
        raise BusinessRuleError("Période invalide")
    overlap = db.execute(
        select(LeaveRequest.id).where(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.status.in_(["pending", "approved"]),
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
    ).first()
    if overlap:
        raise Conflict("Chevauchement avec une autre demande", code="LEAVE_OVERLAP")
    days = Decimal(sum(1 for i in range((end - start).days + 1) if (start + timedelta(days=i)).weekday() < 6))
    row = LeaveRequest(employee_id=employee.id, kind=kind, start_date=start, end_date=end, days=days, reason=reason)
    db.add(row)
    db.flush()
    audit.record(
        db,
        family="business",
        module="hr",
        action="LEAVE_REQUEST",
        resource_type="leave_request",
        resource_id=row.id,
        actor_id=user_id,
        diff={"days": str(days), "kind": kind},
    )
    return row


def decide_leave(db: Session, leave: LeaveRequest, *, approve: bool, user_id: uuid.UUID) -> LeaveRequest:
    if leave.status != "pending":
        raise BusinessRuleError("Demande déjà traitée")
    leave.status = "approved" if approve else "rejected"
    leave.decided_by_id = user_id
    leave.decided_at = utcnow()
    if approve:
        current = leave.start_date
        while current <= leave.end_date:
            if current.weekday() < 6:
                row = db.execute(
                    select(Attendance).where(
                        Attendance.employee_id == leave.employee_id,
                        Attendance.work_date == current,
                        Attendance.project_id.is_(None),
                    )
                ).scalar_one_or_none()
                if row is None:
                    db.add(
                        Attendance(
                            employee_id=leave.employee_id,
                            work_date=current,
                            method="manual",
                            status="sick" if leave.kind == "maladie" else "leave",
                            recorded_by_id=user_id,
                            notes=f"Congé {leave.kind}",
                        )
                    )
            current += timedelta(days=1)
    audit.record(
        db,
        family="business",
        module="hr",
        action="LEAVE_" + ("APPROVE" if approve else "REJECT"),
        resource_type="leave_request",
        resource_id=leave.id,
        actor_id=user_id,
    )
    return leave


# ============================================================================ paie
def _bracket(value: Decimal, brackets: list[list[Any]]) -> Decimal:
    for ceiling, amount in brackets:
        if ceiling is None or value <= Decimal(str(ceiling)):
            return Decimal(str(amount))
    return Decimal("0")


def irpp_monthly(taxable_monthly: Decimal, params: dict[str, Any]) -> Decimal:
    """IRPP mensuel : base annualisée, abattement forfaitaire, barème progressif."""
    cfg = params["irpp"]
    if taxable_monthly < Decimal(str(cfg["monthly_exemption_threshold"])):
        return Decimal("0")
    annual = taxable_monthly * 12 - Decimal(str(cfg["annual_abatement"]))
    if annual <= 0:
        return Decimal("0")
    tax = Decimal("0")
    lower = Decimal("0")
    for ceiling, rate in cfg["brackets"]:
        upper = Decimal(str(ceiling)) if ceiling is not None else None
        if annual <= lower:
            break
        portion = (min(annual, upper) if upper is not None else annual) - lower
        tax += portion * Decimal(str(rate)) / 100
        if upper is None:
            break
        lower = upper
    return money(tax / 12)


def compute_item(
    employee: Employee,
    *,
    days: Decimal,
    hours: Decimal,
    overtime: Decimal,
    unpaid_days: Decimal,
    bonuses: Decimal,
    allowances: Decimal,
    advances: Decimal,
    params: dict[str, Any],
) -> dict[str, Any]:
    if employee.pay_frequency == "daily" or employee.contract_type == "journalier":
        base = Decimal(employee.daily_rate) * days
        hourly = Decimal(employee.daily_rate) / 8 if Decimal(employee.daily_rate) > 0 else Decimal(employee.hourly_rate)
    elif employee.pay_frequency == "weekly" or (
        Decimal(employee.base_salary) == 0 and Decimal(employee.hourly_rate) > 0
    ):
        base = Decimal(employee.hourly_rate) * hours
        hourly = Decimal(employee.hourly_rate)
    else:
        divisor = Decimal(str(params.get("unpaid_day_divisor", 30)))
        base = Decimal(employee.base_salary) - Decimal(employee.base_salary) / divisor * unpaid_days
        hourly = Decimal(employee.hourly_rate) or (
            Decimal(employee.base_salary) / Decimal(str(params["monthly_hours"]))
        )
    base = money(max(Decimal("0"), base))
    overtime_amount = money(overtime * hourly * Decimal(str(params["overtime_rate"])))
    gross = money(base + overtime_amount + bonuses + allowances)
    details: dict[str, str] = {}
    employee_total = Decimal("0")
    employer_total = Decimal("0")
    pension = Decimal("0")
    for contribution in params["contributions"]:
        ceiling = contribution.get("ceiling")
        assiette = min(gross, Decimal(str(ceiling))) if ceiling else gross
        emp = money(assiette * Decimal(str(contribution["employee_rate"])) / 100)
        er = money(assiette * Decimal(str(contribution["employer_rate"])) / 100)
        if emp:
            details[contribution["code"]] = str(emp)
            employee_total += emp
        employer_total += er
        if contribution["code"] == "CNPS_PVID":
            pension = emp
    taxable = gross * (1 - Decimal(str(params["irpp"]["professional_abatement_pct"])) / 100) - pension
    irpp = irpp_monthly(max(Decimal("0"), taxable), params)
    cac = money(irpp * Decimal(str(params["irpp"]["cac_pct"])) / 100)
    rav = _bracket(gross, params["rav_brackets"])
    tdl = _bracket(Decimal(employee.base_salary) or gross, params["tdl_brackets"])
    for code, value in (("IRPP", irpp), ("CAC", cac), ("RAV", rav), ("TDL", tdl)):
        if value:
            details[code] = str(value)
            employee_total += value
    deductions = money(employee_total)
    return {
        "base_amount": base,
        "overtime_amount": overtime_amount,
        "gross": gross,
        "deductions": deductions,
        "deduction_details": details,
        "employer_charges": money(employer_total),
        "net": money(gross - deductions - advances),
    }


def compute_run(db: Session, run: PayrollRun, *, user_id: uuid.UUID) -> PayrollRun:
    if run.status not in ("draft", "computed"):
        raise BusinessRuleError("Paie validée : recalcul impossible", code="PAYROLL_LOCKED")
    year, month = (int(x) for x in run.period.split("-"))
    start = date(year, month, 1)
    end = date(year, month, calendar.monthrange(year, month)[1])
    params = payroll_parameters(db)
    previous = {item.employee_id: item for item in run.items}
    employees = (
        db.execute(
            select(Employee).where(
                Employee.deleted_at.is_(None),
                Employee.hire_date <= end,
                (Employee.end_date.is_(None)) | (Employee.end_date >= start),
                Employee.status != "suspended",
            )
        )
        .scalars()
        .all()
    )
    run.items.clear()
    db.flush()
    totals = {"gross": Decimal("0"), "deductions": Decimal("0"), "employer": Decimal("0"), "net": Decimal("0")}
    for employee in employees:
        rows = (
            db.execute(
                select(Attendance).where(
                    Attendance.employee_id == employee.id, Attendance.work_date >= start, Attendance.work_date <= end
                )
            )
            .scalars()
            .all()
        )
        days = Decimal(sum(1 for r in rows if r.status in ("present", "late")))
        hours = sum((Decimal(r.hours_worked) for r in rows), Decimal("0"))
        overtime = sum((Decimal(r.overtime_hours) for r in rows), Decimal("0"))
        unpaid = Decimal(sum(1 for r in rows if r.status == "absent"))
        unpaid += sum(
            (
                Decimal(lv.days)
                for lv in db.execute(
                    select(LeaveRequest).where(
                        LeaveRequest.employee_id == employee.id,
                        LeaveRequest.kind == "sans_solde",
                        LeaveRequest.status == "approved",
                        LeaveRequest.start_date <= end,
                        LeaveRequest.end_date >= start,
                    )
                ).scalars()
            ),
            Decimal("0"),
        )
        kept = previous.get(employee.id)
        bonuses = Decimal(kept.bonuses) if kept else Decimal("0")
        allowances = Decimal(kept.allowances) if kept else Decimal("0")
        advances = Decimal(kept.advances) if kept else Decimal("0")
        values = compute_item(
            employee,
            days=days,
            hours=hours,
            overtime=overtime,
            unpaid_days=unpaid,
            bonuses=bonuses,
            allowances=allowances,
            advances=advances,
            params=params,
        )
        if values["gross"] <= 0 and not rows:
            continue
        project_hours: dict[str, Decimal] = {}
        for r in rows:
            if r.project_id and Decimal(r.hours_worked) > 0:
                project_hours[str(r.project_id)] = project_hours.get(str(r.project_id), Decimal("0")) + Decimal(
                    r.hours_worked
                )
        total_hours = sum(project_hours.values(), Decimal("0"))
        allocation = (
            {pid: str((h / total_hours * 100).quantize(Decimal("0.01"))) for pid, h in project_hours.items()}
            if total_hours > 0
            else {}
        )
        run.items.append(
            PayrollItem(
                employee_id=employee.id,
                days_worked=days,
                hours_worked=hours,
                overtime_hours=overtime,
                bonuses=bonuses,
                allowances=allowances,
                advances=advances,
                cost_allocation=allocation,
                **values,
            )
        )
        totals["gross"] += values["gross"]
        totals["deductions"] += values["deductions"]
        totals["employer"] += values["employer_charges"]
        totals["net"] += values["net"]
    run.total_gross = money(totals["gross"])
    run.total_deductions = money(totals["deductions"])
    run.total_employer_charges = money(totals["employer"])
    run.total_net = money(totals["net"])
    run.parameters = params
    run.status = "computed"
    run.computed_at = utcnow()
    db.flush()
    audit.record(
        db,
        family="business",
        module="hr",
        action="PAYROLL_COMPUTE",
        resource_type="payroll_run",
        resource_id=run.id,
        actor_id=user_id,
        diff={"employees": len(run.items), "net": str(run.total_net)},
    )
    return run


def update_item(
    db: Session,
    run: PayrollRun,
    item: PayrollItem,
    *,
    bonuses: Decimal | None,
    allowances: Decimal | None,
    advances: Decimal | None,
    user_id: uuid.UUID,
    reason: str,
) -> PayrollItem:
    if run.status != "computed":
        raise BusinessRuleError("Ajustements possibles uniquement sur une paie calculée non validée")
    employee = db.get(Employee, item.employee_id)
    params = run.parameters or payroll_parameters(db)
    for key, value in (("bonuses", bonuses), ("allowances", allowances), ("advances", advances)):
        if value is not None:
            setattr(item, key, money(value))
    unpaid = _unpaid_from_item(employee, item, Decimal(str(params.get("unpaid_day_divisor", 30))))
    values = compute_item(
        employee,
        days=Decimal(item.days_worked),
        hours=Decimal(item.hours_worked),
        overtime=Decimal(item.overtime_hours),
        unpaid_days=unpaid,
        bonuses=Decimal(item.bonuses),
        allowances=Decimal(item.allowances),
        advances=Decimal(item.advances),
        params=params,
    )
    for key, value in values.items():
        setattr(item, key, value)
    run.total_gross = money(sum((Decimal(i.gross) for i in run.items), Decimal("0")))
    run.total_deductions = money(sum((Decimal(i.deductions) for i in run.items), Decimal("0")))
    run.total_employer_charges = money(sum((Decimal(i.employer_charges) for i in run.items), Decimal("0")))
    run.total_net = money(sum((Decimal(i.net) for i in run.items), Decimal("0")))
    audit.record(
        db,
        family="business",
        module="hr",
        action="PAYROLL_ADJUST",
        resource_type="payroll_run",
        resource_id=run.id,
        actor_id=user_id,
        reason=reason,
        diff={"employee": str(item.employee_id), "bonuses": str(item.bonuses), "advances": str(item.advances)},
        criticality="MEDIUM",
    )
    return item


def _unpaid_from_item(employee: Employee, item: PayrollItem, divisor: Decimal) -> Decimal:
    """Jours non payés implicites d'une ligne mensuelle (base calculée < salaire de base)."""
    base_salary = Decimal(employee.base_salary)
    if base_salary <= 0 or employee.pay_frequency != "monthly":
        return Decimal("0")
    return (base_salary - Decimal(item.base_amount)) / (base_salary / divisor)


def payslip_pdf(db: Session, run: PayrollRun, item: PayrollItem) -> bytes:
    from app.core.pdf import PdfDocument, amount_in_words, company_party, fmt_money, render

    employee = db.get(Employee, item.employee_id)
    rows = [
        ["Salaire de base", fmt_money(item.base_amount)],
        ["Heures supplémentaires", fmt_money(item.overtime_amount)],
        ["Primes", fmt_money(item.bonuses)],
        ["Indemnités", fmt_money(item.allowances)],
        ["Salaire brut", fmt_money(item.gross)],
    ]
    rows += [[f"Retenue {code}", f"- {fmt_money(value)}"] for code, value in (item.deduction_details or {}).items()]
    if Decimal(item.advances) > 0:
        rows.append(["Avances / acomptes", f"- {fmt_money(item.advances)}"])
    doc = PdfDocument(
        title="BULLETIN DE PAIE",
        number=f"{run.number}-{employee.matricule}",
        issued_on=date.today(),
        parties=[
            company_party("Employeur"),
            (
                "Salarié",
                [f"<b>{employee.full_name}</b>", f"Matricule {employee.matricule}", employee.job_title or ""],
            ),
        ],
        meta=[
            ("Période", run.period),
            ("Jours travaillés", str(item.days_worked)),
            ("Heures", str(item.hours_worked)),
            ("Heures supplémentaires", str(item.overtime_hours)),
            ("Contrat", employee.contract_type),
        ],
        columns=["Rubrique", "Montant"],
        col_widths=[330, 150],
        rows=rows,
        totals=[("Total retenues", fmt_money(item.deductions)), ("NET À PAYER", fmt_money(item.net))],
        amount_words=amount_in_words(item.net),
        amount_words_label="Net à payer",
        signature_blocks=["Pour l'employeur", "Le salarié"],
        footer_note="Document confidentiel — à conserver sans limitation de durée.",
    )
    return render(doc)


def validate_run(db: Session, run: PayrollRun, *, user_id: uuid.UUID) -> PayrollRun:
    """Validation : bulletins PDF chiffrés, documents RH, coûts main d'œuvre imputés aux projets."""
    from app.core.files import store_generated
    from app.modules.finance.service import record_expense

    if run.status != "computed":
        raise BusinessRuleError("La paie doit être calculée avant validation")
    if not (run.parameters or {}).get("reviewed"):
        raise BusinessRuleError(
            "Paramètres de paie non revus par le cabinet comptable (Paramètres → Paie)",
            code="PAYROLL_PARAMETERS_NOT_REVIEWED",
        )
    year, month = (int(x) for x in run.period.split("-"))
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    for item in run.items:
        employee = db.get(Employee, item.employee_id)
        stored = store_generated(
            db,
            payslip_pdf(db, run, item),
            filename=f"bulletin-{run.period}-{employee.matricule}.pdf",
            mime="application/pdf",
            purpose="payslips",
            classification="very_sensitive",
            uploaded_by_id=user_id,
        )
        item.payslip_file_id = stored.id
        db.add(
            HRDocument(
                employee_id=employee.id,
                kind="fiche_paie",
                title=f"Bulletin de paie {run.period}",
                file_id=stored.id,
                confidentiality="very_sensitive",
                uploaded_by_id=user_id,
            )
        )
        cost = Decimal(item.gross) + Decimal(item.employer_charges)
        for project_id, share in (item.cost_allocation or {}).items():
            amount = money(cost * Decimal(share) / 100)
            if amount > 0:
                record_expense(
                    db,
                    project_id=uuid.UUID(project_id),
                    lot_id=None,
                    category="main_oeuvre",
                    label=f"Main-d'œuvre {run.period} — {employee.matricule}",
                    amount=amount,
                    expense_date=last_day,
                    source_type="payroll",
                    source_id=run.id,
                    user_id=user_id,
                )
    run.status = "validated"
    run.validated_by_id = user_id
    run.validated_at = utcnow()
    audit.record(
        db,
        family="business",
        module="hr",
        action="PAYROLL_VALIDATE",
        resource_type="payroll_run",
        resource_id=run.id,
        actor_id=user_id,
        diff={"net": str(run.total_net)},
        criticality="HIGH",
    )
    return run


def mark_paid(
    db: Session, run: PayrollRun, *, user_id: uuid.UUID, method: str, proof_file_id: uuid.UUID, reference: str | None
) -> PayrollRun:
    from app.modules.finance.models import Payment

    if run.status != "validated":
        raise BusinessRuleError("Paie non validée")
    for item in run.items:
        employee = db.get(Employee, item.employee_id)
        if Decimal(item.net) <= 0:
            continue
        db.add(
            Payment(
                number=next_number(db, "payment"),
                direction="out",
                counterparty_type="employee",
                counterparty_id=employee.id,
                counterparty_label=employee.full_name,
                amount=item.net,
                method=method,
                provider="manual",
                status="succeeded",
                paid_at=utcnow(),
                provider_reference=reference,
                proof_file_id=proof_file_id,
                initiated_by_id=user_id,
                approved_by_id=user_id,
                idempotency_key=f"payroll:{run.id}:{employee.id}",
                notes=f"Salaire {run.period}",
            )
        )
    run.status = "paid"
    run.paid_at = utcnow()
    audit.record(
        db,
        family="business",
        module="hr",
        action="PAYROLL_PAID",
        resource_type="payroll_run",
        resource_id=run.id,
        actor_id=user_id,
        diff={"method": method, "reference": reference},
        criticality="HIGH",
    )
    return run


def payroll_csv(db: Session, run: PayrollRun) -> str:
    import csv
    import io

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    codes = sorted({code for item in run.items for code in (item.deduction_details or {})})
    writer.writerow(
        [
            "matricule",
            "nom",
            "jours",
            "heures",
            "heures_sup",
            "brut",
            *codes,
            "retenues",
            "charges_patronales",
            "avances",
            "net",
        ]
    )
    for item in run.items:
        employee = db.get(Employee, item.employee_id)
        writer.writerow(
            [
                employee.matricule,
                employee.full_name,
                item.days_worked,
                item.hours_worked,
                item.overtime_hours,
                item.gross,
                *[(item.deduction_details or {}).get(c, "0") for c in codes],
                item.deductions,
                item.employer_charges,
                item.advances,
                item.net,
            ]
        )
    return buf.getvalue()


def expiring_documents(db: Session, days: int = 30) -> list[HRDocument]:
    horizon = date.today() + timedelta(days=days)
    return list(
        db.execute(
            select(HRDocument).where(
                HRDocument.deleted_at.is_(None), HRDocument.expiry_date.is_not(None), HRDocument.expiry_date <= horizon
            )
        ).scalars()
    )


def employee_by_badge(db: Session, code: str) -> Employee:
    token = code.strip()
    if token.startswith("GLOBUS:EMP:"):
        token = token.split("GLOBUS:EMP:", 1)[1]
    employee = db.execute(
        select(Employee).where(Employee.badge_token == token, Employee.deleted_at.is_(None))
    ).scalar_one_or_none()
    if employee is None:
        raise NotFound("Badge inconnu ou révoqué")
    return employee
