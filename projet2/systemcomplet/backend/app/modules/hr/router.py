"""API RH (§17) : employés, badges QR, pointage géolocalisé, congés, paie, bulletins, documents RH, historique."""

from __future__ import annotations

import io
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

import qrcode
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response, watermark_label
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.files import store_private, validate_upload
from app.core.numbering import next_number
from app.core.pagination import PageParams, paginate
from app.core.utils import clean_phone, jsonable, utcnow
from app.modules.hr import service
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
from app.modules.subcontracting.trades import ensure_person_trade
from app.modules.system.models import StoredFile

TAG = "RH"
router = APIRouter(tags=[TAG])


def _mask(value: str | None) -> str | None:
    return ("•" * max(0, len(value) - 4) + value[-4:]) if value else None


def employee_out(employee: Employee, *, detail: bool = False) -> dict[str, Any]:
    data = serialize(employee)
    for key in service.SENSITIVE:
        data.pop(key, None)
        data[f"{key}_masked"] = _mask(getattr(employee, key))
    data.pop("badge_token", None)
    data["full_name"] = employee.full_name
    if not detail:
        for key in ("base_salary", "hourly_rate", "daily_rate"):
            data.pop(key, None)
    return jsonable(data)


def _png(payload: str) -> Response:
    buf = io.BytesIO()
    qrcode.make(payload, box_size=8, border=2).save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png", headers={"Cache-Control": "no-store"})


def _employee(db: Session, employee_id: uuid.UUID) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None or employee.deleted_at is not None:
        raise NotFound("Employé introuvable")
    return employee


# ============================================================================ employés
class EmployeeIn(BaseModel):
    matricule: str | None = Field(default=None, max_length=30)
    user_id: uuid.UUID | None = None
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    gender: str | None = Field(default=None, pattern="^(M|F|X)$")
    birth_date: date | None = None
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=1000)
    job_title: str = Field(min_length=2, max_length=150)
    trade: str | None = Field(default=None, max_length=80)
    department: str | None = Field(default=None, max_length=80)
    team_id: uuid.UUID | None = None
    contract_type: str = Field(default="CDI", pattern="^(CDI|CDD|journalier|stage|interim)$")
    hire_date: date
    end_date: date | None = None
    base_salary: Decimal = Field(default=Decimal("0"), ge=0)
    hourly_rate: Decimal = Field(default=Decimal("0"), ge=0)
    daily_rate: Decimal = Field(default=Decimal("0"), ge=0)
    pay_frequency: str = Field(default="monthly", pattern="^(monthly|daily|weekly)$")
    national_id: str | None = Field(default=None, max_length=60)
    social_security_number: str | None = Field(default=None, max_length=60)
    bank_account: str | None = Field(default=None, max_length=80)
    mobile_money_number: str | None = Field(default=None, max_length=40)
    emergency_contact: str | None = Field(default=None, max_length=250)
    current_project_id: uuid.UUID | None = None


class EmployeeUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=1000)
    job_title: str | None = Field(default=None, min_length=2, max_length=150)
    trade: str | None = Field(default=None, max_length=80)
    department: str | None = Field(default=None, max_length=80)
    team_id: uuid.UUID | None = None
    contract_type: str | None = Field(default=None, pattern="^(CDI|CDD|journalier|stage|interim)$")
    end_date: date | None = None
    base_salary: Decimal | None = Field(default=None, ge=0)
    hourly_rate: Decimal | None = Field(default=None, ge=0)
    daily_rate: Decimal | None = Field(default=None, ge=0)
    pay_frequency: str | None = Field(default=None, pattern="^(monthly|daily|weekly)$")
    national_id: str | None = Field(default=None, max_length=60)
    social_security_number: str | None = Field(default=None, max_length=60)
    bank_account: str | None = Field(default=None, max_length=80)
    mobile_money_number: str | None = Field(default=None, max_length=40)
    emergency_contact: str | None = Field(default=None, max_length=250)
    current_project_id: uuid.UUID | None = None
    status: str | None = Field(default=None, pattern="^(active|suspended)$")
    user_id: uuid.UUID | None = None
    reason: str | None = Field(default=None, max_length=2000)


@router.get("/hr/employees")
def list_employees(
    params: PageParams = Depends(),
    status: str | None = None,
    project_id: uuid.UUID | None = None,
    trade: str | None = None,
    team_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not access.p.has_any("hr:read", "site:report"):
        raise Forbidden("Permission manquante : hr:read", code="PERMISSION_DENIED")
    stmt = select(Employee).where(Employee.deleted_at.is_(None))
    if not access.has("hr:read"):
        stmt = access.filter_by_project(stmt, Employee.current_project_id, allow_null=False)
    for col, value in (
        (Employee.status, status),
        (Employee.current_project_id, project_id),
        (Employee.trade, trade),
        (Employee.team_id, team_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"last_name": Employee.last_name, "hire_date": Employee.hire_date},
        default_sort=Employee.last_name.asc(),
        search_columns=[Employee.first_name, Employee.last_name, Employee.matricule, Employee.job_title],
        transform=lambda e: employee_out(e, detail=access.has("hr:payroll")),
    )


@router.post("/hr/employees", status_code=201)
def create_employee(
    data: EmployeeIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:write")
    values = data.model_dump()
    ensure_person_trade(values["trade"])
    for key in ("phone", "mobile_money_number"):
        if values.get(key):
            values[key] = clean_phone(values[key])
    if values.get("email"):
        values["email"] = str(values["email"]).lower()
    if values["matricule"] and db.execute(select(Employee.id).where(Employee.matricule == values["matricule"])).first():
        raise Conflict("Matricule déjà utilisé", code="DUPLICATE_MATRICULE")
    employee = service.create_employee(db, data=values, user_id=access.p.id)
    db.commit()
    return employee_out(employee, detail=True)


@router.get("/hr/employees/{employee_id}")
def get_employee(
    employee_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:read")
    return employee_out(_employee(db, employee_id), detail=True)


@router.patch("/hr/employees/{employee_id}")
def update_employee(
    employee_id: uuid.UUID, data: EmployeeUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:write")
    employee = _employee(db, employee_id)
    values = data.model_dump(exclude_unset=True)
    reason = values.pop("reason", None)
    if any(k in values for k in ("base_salary", "hourly_rate", "daily_rate")):
        access.require("hr:payroll")
        if not reason:
            raise BusinessRuleError("Motif obligatoire pour une modification de rémunération", code="REASON_REQUIRED")
    if "trade" in values:
        ensure_person_trade(values["trade"], current=employee.trade)
    for key in ("phone", "mobile_money_number"):
        if values.get(key):
            values[key] = clean_phone(values[key])
    service.update_employee(db, employee, values=values, user_id=access.p.id, reason=reason)
    db.commit()
    return employee_out(employee, detail=True)


class TerminateIn(BaseModel):
    end_date: date
    reason: str = Field(min_length=5, max_length=2000)


@router.post("/hr/employees/{employee_id}/terminate")
def terminate(
    employee_id: uuid.UUID, data: TerminateIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:write")
    employee = service.terminate(
        db, _employee(db, employee_id), end_date=data.end_date, reason=data.reason, user_id=access.p.id
    )
    db.commit()
    return employee_out(employee, detail=True)


@router.get("/hr/employees/{employee_id}/badge")
def employee_badge(
    employee_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("hr:write")
    employee = _employee(db, employee_id)
    if employee.status != "active":
        raise BusinessRuleError("Badge indisponible pour un employé inactif")
    audit.record(
        db, family="security", module="hr", action="BADGE_PRINT", resource_type="employee", resource_id=employee.id
    )
    db.commit()
    return _png(f"GLOBUS:EMP:{employee.badge_token}")


@router.post("/hr/employees/{employee_id}/badge/regenerate")
def regenerate_badge(
    employee_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    access.require("hr:write")
    service.regenerate_badge(db, _employee(db, employee_id), user_id=access.p.id)
    db.commit()
    return {"status": "regenerated"}


@router.get("/hr/employees/{employee_id}/history")
def employee_history(
    employee_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("hr:read")
    rows = db.execute(
        select(HRHistory)
        .where(HRHistory.employee_id == employee_id)
        .order_by(HRHistory.effective_date.desc(), HRHistory.created_at.desc())
    ).scalars()
    return [jsonable(serialize(r)) for r in rows]


# ---------------------------------------------------------------------------- documents RH
@router.get("/hr/employees/{employee_id}/documents")
def employee_documents(
    employee_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require("hr:read")
    allowed = access.allowed_confidentialities()
    rows = db.execute(
        select(HRDocument)
        .where(HRDocument.employee_id == employee_id, HRDocument.deleted_at.is_(None))
        .order_by(HRDocument.created_at.desc())
    ).scalars()
    return [jsonable(serialize(d)) for d in rows if d.confidentiality in allowed or access.has("hr:payroll")]


@router.post("/hr/employees/{employee_id}/documents", status_code=201)
async def upload_document(
    employee_id: uuid.UUID,
    kind: str = Form(..., max_length=40),
    title: str = Form(..., min_length=2, max_length=250),
    expiry_date: date | None = Form(None),
    confidentiality: str = Form("confidential", pattern="^(internal|confidential|very_sensitive)$"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("hr:write")
    employee = _employee(db, employee_id)
    upload = validate_upload(file.filename or "document", await file.read(), category="media")
    stored = store_private(
        db, upload, purpose="hr_documents", classification=confidentiality, uploaded_by_id=access.p.id
    )
    doc = HRDocument(
        employee_id=employee.id,
        kind=kind,
        title=title,
        file_id=stored.id,
        expiry_date=expiry_date,
        confidentiality=confidentiality,
        uploaded_by_id=access.p.id,
    )
    db.add(doc)
    db.flush()
    audit.record(
        db,
        family="business",
        module="hr",
        action="DOCUMENT_ADD",
        resource_type="employee",
        resource_id=employee.id,
        diff={"kind": kind, "title": title},
    )
    db.commit()
    return jsonable(serialize(doc))


@router.get("/hr/documents/{document_id}/file")
def document_file(
    document_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    doc = db.get(HRDocument, document_id)
    if doc is None or doc.deleted_at is not None:
        raise NotFound("Document introuvable")
    employee = db.get(Employee, doc.employee_id)
    own = employee is not None and employee.user_id == access.p.id
    if not own:
        access.require("hr:read")
        if doc.confidentiality == "very_sensitive" and not access.has("hr:payroll"):
            raise Forbidden("Document très sensible", code="CONFIDENTIALITY_DENIED")
    audit.record(
        db,
        family="security",
        module="hr",
        action="DOCUMENT_ACCESS",
        resource_type="hr_document",
        resource_id=doc.id,
        diff={"own": own},
    )
    db.commit()
    return file_response(db.get(StoredFile, doc.file_id), watermark_text=watermark_label(access.p.user))


# ============================================================================ horaires & pointage
router.include_router(
    make_crud_router(
        WorkSchedule,
        prefix="/hr/work-schedules",
        tags=[TAG],
        module="hr",
        read_perm="hr:read",
        write_perm="hr:write",
        label="Horaire",
        sort=["name"],
        default_sort="name",
    )
)


class ScanIn(BaseModel):
    badge: str = Field(min_length=8, max_length=120)
    project_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    action: str | None = Field(default=None, pattern="^(in|out)$")
    at: datetime | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    client_mutation_id: str | None = Field(default=None, max_length=80)


def _attendance_out(db: Session, row: Attendance, kind: str | None = None) -> dict[str, Any]:
    employee = db.get(Employee, row.employee_id)
    out = {
        **serialize(row),
        "employee": employee.full_name if employee else "",
        "matricule": employee.matricule if employee else "",
    }
    if kind:
        out["scan"] = kind
    return jsonable(out)


@router.post("/hr/attendance/scan")
def scan(data: ScanIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Pointage par scan du badge QR de l'ouvrier (chef de chantier / chef d'équipe)."""
    if not access.p.has_any("hr:write", "site:report"):
        raise Forbidden("Pointage réservé à l'encadrement chantier", code="PERMISSION_DENIED")
    if data.project_id:
        access.require_project(data.project_id)
    if data.site_id:
        site = db.get(Site, data.site_id)
        if site is None:
            raise NotFound("Chantier introuvable")
        access.require_project(site.project_id)
    employee = service.employee_by_badge(db, data.badge)
    row, kind = service.record_scan(
        db,
        employee=employee,
        project_id=data.project_id,
        site_id=data.site_id,
        at=data.at,
        latitude=data.latitude,
        longitude=data.longitude,
        method="qr",
        recorded_by_id=access.p.id,
        client_mutation_id=data.client_mutation_id,
        action=data.action,
    )
    db.commit()
    return _attendance_out(db, row, kind)


class SelfScanIn(BaseModel):
    site_code: str = Field(min_length=2, max_length=120)
    action: str | None = Field(default=None, pattern="^(in|out)$")
    at: datetime | None = None
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    client_mutation_id: str | None = Field(default=None, max_length=80)


@router.post("/hr/attendance/self")
def self_scan(data: SelfScanIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Auto-pointage : l'employé scanne le QR du chantier ; géolocalisation obligatoire."""
    access.require("attendance:self")
    employee = db.execute(
        select(Employee).where(Employee.user_id == access.p.id, Employee.deleted_at.is_(None))
    ).scalar_one_or_none()
    if employee is None:
        raise Forbidden("Aucune fiche employé liée à votre compte", code="NO_EMPLOYEE_RECORD")
    code = data.site_code.split("GLOBUS:SITE:", 1)[1] if data.site_code.startswith("GLOBUS:SITE:") else data.site_code
    site = db.execute(select(Site).where(Site.code == code, Site.deleted_at.is_(None))).scalar_one_or_none()
    if site is None:
        raise NotFound("QR chantier inconnu")
    row, kind = service.record_scan(
        db,
        employee=employee,
        project_id=site.project_id,
        site_id=site.id,
        at=data.at,
        latitude=data.latitude,
        longitude=data.longitude,
        method="mobile",
        recorded_by_id=access.p.id,
        client_mutation_id=data.client_mutation_id,
        action=data.action,
    )
    db.commit()
    return _attendance_out(db, row, kind)


@router.get("/hr/sites/{site_id}/attendance-qr")
def site_qr(site_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    site = db.get(Site, site_id)
    if site is None:
        raise NotFound("Chantier introuvable")
    access.require_project(site.project_id)
    if not access.p.has_any("hr:write", "site:report"):
        raise Forbidden("Permission manquante", code="PERMISSION_DENIED")
    return _png(f"GLOBUS:SITE:{site.code}")


class ManualIn(BaseModel):
    employee_id: uuid.UUID
    work_date: date
    check_in: time | None = None
    check_out: time | None = None
    status: str = Field(default="present", pattern="^(present|absent|late|leave|sick)$")
    project_id: uuid.UUID | None = None
    reason: str = Field(min_length=5, max_length=300)


@router.post("/hr/attendance/manual", status_code=201)
def manual(data: ManualIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("hr:write")
    if data.check_in and data.check_out and data.check_out <= data.check_in:
        raise BusinessRuleError("Départ antérieur à l'arrivée")
    row = service.manual_attendance(
        db,
        employee=_employee(db, data.employee_id),
        work_date=data.work_date,
        check_in=data.check_in,
        check_out=data.check_out,
        status=data.status,
        project_id=data.project_id,
        reason=data.reason,
        user_id=access.p.id,
    )
    db.commit()
    return _attendance_out(db, row)


@router.get("/hr/attendance")
def list_attendance(
    params: PageParams = Depends(),
    start: date | None = None,
    end: date | None = None,
    project_id: uuid.UUID | None = None,
    employee_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not access.p.has_any("hr:read", "site:report"):
        raise Forbidden("Permission manquante : hr:read", code="PERMISSION_DENIED")
    stmt = select(Attendance)
    if not access.has("hr:read"):
        stmt = access.filter_by_project(stmt, Attendance.project_id, allow_null=False)
    for col, value in ((Attendance.project_id, project_id), (Attendance.employee_id, employee_id)):
        if value:
            stmt = stmt.where(col == value)
    if start:
        stmt = stmt.where(Attendance.work_date >= start)
    if end:
        stmt = stmt.where(Attendance.work_date <= end)
    return paginate(
        db, stmt, params, default_sort=Attendance.work_date.desc(), transform=lambda r: _attendance_out(db, r)
    )


@router.post("/hr/attendance/{attendance_id}/validate")
def validate_attendance(
    attendance_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    row = db.get(Attendance, attendance_id)
    if row is None:
        raise NotFound("Pointage introuvable")
    if not access.p.has_any("hr:write", "site:report"):
        raise Forbidden("Permission manquante", code="PERMISSION_DENIED")
    if row.project_id:
        access.require_project(row.project_id)
    row.validated_by_id = access.p.id
    row.validated_at = utcnow()
    db.commit()
    return _attendance_out(db, row)


@router.get("/hr/attendance/summary")
def summary(
    start: date,
    end: date,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("hr:read")
    if (end - start).days > 366:
        raise BusinessRuleError("Période maximale : 1 an")
    return jsonable(service.attendance_summary(db, start=start, end=end, project_id=project_id))


# ============================================================================ congés
class LeaveIn(BaseModel):
    employee_id: uuid.UUID | None = None
    kind: str = Field(default="conge", pattern="^(conge|maladie|sans_solde|autre)$")
    start_date: date
    end_date: date
    reason: str | None = Field(default=None, max_length=2000)


@router.get("/hr/leaves")
def list_leaves(
    params: PageParams = Depends(),
    status: str | None = None,
    employee_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    stmt = select(LeaveRequest)
    if not access.has("hr:read"):
        access.require("attendance:self")
        mine = db.execute(select(Employee.id).where(Employee.user_id == access.p.id)).scalar_one_or_none()
        stmt = stmt.where(LeaveRequest.employee_id == (mine or uuid.uuid4()))
    if status:
        stmt = stmt.where(LeaveRequest.status == status)
    if employee_id:
        stmt = stmt.where(LeaveRequest.employee_id == employee_id)
    return paginate(
        db, stmt, params, default_sort=LeaveRequest.start_date.desc(), transform=lambda r: jsonable(serialize(r))
    )


@router.post("/hr/leaves", status_code=201)
def create_leave(data: LeaveIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    if data.employee_id and access.has("hr:write"):
        employee = _employee(db, data.employee_id)
    else:
        access.require("attendance:self")
        employee = db.execute(select(Employee).where(Employee.user_id == access.p.id)).scalar_one_or_none()
        if employee is None:
            raise Forbidden("Aucune fiche employé liée à votre compte", code="NO_EMPLOYEE_RECORD")
    row = service.request_leave(
        db,
        employee=employee,
        kind=data.kind,
        start=data.start_date,
        end=data.end_date,
        reason=data.reason,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(row))


class LeaveDecisionIn(BaseModel):
    approve: bool


@router.post("/hr/leaves/{leave_id}/decision")
def decide_leave(
    leave_id: uuid.UUID, data: LeaveDecisionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:write")
    leave = db.get(LeaveRequest, leave_id)
    if leave is None:
        raise NotFound("Demande introuvable")
    service.decide_leave(db, leave, approve=data.approve, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(leave))


# ============================================================================ espace salarié
@router.get("/hr/me")
def my_space(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("attendance:self")
    employee = db.execute(
        select(Employee).where(Employee.user_id == access.p.id, Employee.deleted_at.is_(None))
    ).scalar_one_or_none()
    if employee is None:
        return {"employee": None, "attendance": [], "payslips": [], "leaves": []}
    attendance = (
        db.execute(
            select(Attendance)
            .where(Attendance.employee_id == employee.id)
            .order_by(Attendance.work_date.desc())
            .limit(31)
        )
        .scalars()
        .all()
    )
    payslips = (
        db.execute(
            select(HRDocument)
            .where(
                HRDocument.employee_id == employee.id, HRDocument.kind == "fiche_paie", HRDocument.deleted_at.is_(None)
            )
            .order_by(HRDocument.created_at.desc())
        )
        .scalars()
        .all()
    )
    leaves = (
        db.execute(
            select(LeaveRequest)
            .where(LeaveRequest.employee_id == employee.id)
            .order_by(LeaveRequest.start_date.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    data = employee_out(employee, detail=False)
    return jsonable(
        {
            "employee": data,
            "attendance": [serialize(a) for a in attendance],
            "payslips": [{"id": p.id, "title": p.title, "created_at": p.created_at} for p in payslips],
            "leaves": [serialize(lv) for lv in leaves],
        }
    )


# ============================================================================ paie
class PayrollRunIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


def _run_out(db: Session, run: PayrollRun) -> dict[str, Any]:
    employees = {
        e.id: e
        for e in db.execute(
            select(Employee).where(Employee.id.in_([i.employee_id for i in run.items] or [uuid.uuid4()]))
        ).scalars()
    }
    return jsonable(
        {
            **serialize(run),
            "items": [
                {
                    **serialize(i),
                    "employee": employees[i.employee_id].full_name if i.employee_id in employees else "",
                    "matricule": employees[i.employee_id].matricule if i.employee_id in employees else "",
                }
                for i in run.items
            ],
            "parameters_reviewed": bool((run.parameters or {}).get("reviewed")),
        }
    )


def _run(db: Session, run_id: uuid.UUID) -> PayrollRun:
    run = db.get(PayrollRun, run_id)
    if run is None:
        raise NotFound("Paie introuvable")
    return run


@router.get("/hr/payroll-runs")
def list_runs(
    params: PageParams = Depends(), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:payroll")
    return paginate(
        db,
        select(PayrollRun),
        params,
        default_sort=PayrollRun.period.desc(),
        transform=lambda r: jsonable({**serialize(r), "employees": len(r.items)}),
    )


@router.post("/hr/payroll-runs", status_code=201)
def create_run(
    data: PayrollRunIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:payroll")
    if db.execute(select(PayrollRun.id).where(PayrollRun.period == data.period)).first():
        raise Conflict("Paie déjà créée pour cette période", code="PAYROLL_EXISTS")
    run = PayrollRun(number=next_number(db, "payroll"), period=data.period)
    db.add(run)
    db.flush()
    service.compute_run(db, run, user_id=access.p.id)
    db.commit()
    return _run_out(db, run)


@router.get("/hr/payroll-runs/{run_id}")
def get_run(run_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("hr:payroll")
    return _run_out(db, _run(db, run_id))


@router.post("/hr/payroll-runs/{run_id}/compute")
def compute(run_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("hr:payroll")
    run = service.compute_run(db, _run(db, run_id), user_id=access.p.id)
    db.commit()
    return _run_out(db, run)


class ItemAdjustIn(BaseModel):
    bonuses: Decimal | None = Field(default=None, ge=0)
    allowances: Decimal | None = Field(default=None, ge=0)
    advances: Decimal | None = Field(default=None, ge=0)
    reason: str = Field(min_length=5, max_length=1000)


@router.patch("/hr/payroll-runs/{run_id}/items/{item_id}")
def adjust_item(
    run_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ItemAdjustIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("hr:payroll")
    run = _run(db, run_id)
    item = db.get(PayrollItem, item_id)
    if item is None or item.run_id != run.id:
        raise NotFound("Ligne de paie introuvable")
    service.update_item(
        db,
        run,
        item,
        bonuses=data.bonuses,
        allowances=data.allowances,
        advances=data.advances,
        user_id=access.p.id,
        reason=data.reason,
    )
    db.commit()
    return _run_out(db, run)


@router.post("/hr/payroll-runs/{run_id}/validate")
def validate_run(
    run_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Validation par la finance (contrôle à quatre yeux : RH calcule, finance valide)."""
    access.require("hr:payroll", "finance:approve")
    run = service.validate_run(db, _run(db, run_id), user_id=access.p.id)
    db.commit()
    return _run_out(db, run)


@router.post("/hr/payroll-runs/{run_id}/paid")
async def mark_paid(
    run_id: uuid.UUID,
    method: str = Form(..., pattern="^(bank_transfer|mobile_money|cash|cheque)$"),
    reference: str | None = Form(None),
    proof: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("finance:pay")
    run = _run(db, run_id)
    upload = validate_upload(proof.filename or "preuve", await proof.read(), category="media")
    stored = store_private(
        db, upload, purpose="payroll_proofs", classification="very_sensitive", uploaded_by_id=access.p.id
    )
    service.mark_paid(db, run, user_id=access.p.id, method=method, proof_file_id=stored.id, reference=reference)
    db.commit()
    return _run_out(db, run)


@router.get("/hr/payroll-runs/{run_id}/export.csv")
def export_run(run_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    access.require("hr:payroll")
    run = _run(db, run_id)
    audit.record(
        db,
        family="security",
        module="hr",
        action="PAYROLL_EXPORT",
        resource_type="payroll_run",
        resource_id=run.id,
        criticality="MEDIUM",
    )
    db.commit()
    return Response(
        ("﻿" + service.payroll_csv(db, run)).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="paie-{run.period}.csv"'},
    )


@router.get("/hr/payroll-runs/{run_id}/items/{item_id}/payslip")
def payslip(
    run_id: uuid.UUID, item_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("hr:payroll")
    run = _run(db, run_id)
    item = db.get(PayrollItem, item_id)
    if item is None or item.run_id != run.id:
        raise NotFound("Ligne de paie introuvable")
    if item.payslip_file_id:
        return file_response(db.get(StoredFile, item.payslip_file_id), watermark_text=watermark_label(access.p.user))
    return Response(service.payslip_pdf(db, run, item), media_type="application/pdf")


@router.get("/hr/payroll-parameters")
def get_parameters(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("hr:payroll")
    return jsonable(service.payroll_parameters(db))


class ParametersIn(BaseModel):
    parameters: dict[str, Any]
    reviewed: bool = False
    reviewer_note: str | None = Field(default=None, max_length=2000)


@router.put("/hr/payroll-parameters")
def set_parameters(
    data: ParametersIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("hr:payroll", "settings:write")
    from app.modules.system.models import Setting

    merged = {
        **service.payroll_parameters(db),
        **data.parameters,
        "reviewed": data.reviewed,
        "reviewer_note": data.reviewer_note,
    }
    for key in ("contributions", "irpp", "rav_brackets", "tdl_brackets"):
        if key not in merged:
            raise BusinessRuleError(f"Paramètre manquant : {key}")
    row = db.get(Setting, "payroll_parameters")
    previous = row.value if row else None
    if row is None:
        row = Setting(key="payroll_parameters", category="hr", value=merged, updated_by_id=access.p.id)
        db.add(row)
    else:
        row.value = merged
        row.updated_by_id = access.p.id
    audit.record(
        db,
        family="business",
        module="hr",
        action="PAYROLL_PARAMETERS",
        resource_type="setting",
        resource_id="payroll_parameters",
        diff={"previous_reviewed": bool((previous or {}).get("reviewed")), "reviewed": data.reviewed},
        criticality="HIGH",
    )
    db.commit()
    return jsonable(merged)
