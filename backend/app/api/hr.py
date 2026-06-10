"""HR API — Employees, Temp Workers, Attendance, Payroll."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_rh
from app.models.erp import Employee, TempWorker, Attendance, Payroll
from app.services.activity_service import log_activity
from app.services.pdf_service import render_pdf
from app.services.qr_service import temp_worker_badge_png

router = APIRouter(prefix="/hr", tags=["HR"])


from app.utils.time import utcnow_naive as _now


class EmployeeCreate(BaseModel):
    first_name: str
    last_name: str
    email: str = ""
    phone: str = ""
    position: str = ""
    department: str = ""
    contract_type: str = "CDI"
    base_salary: float = 0.0
    hire_date: Optional[datetime] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    contract_type: Optional[str] = None
    base_salary: Optional[float] = None
    hire_date: Optional[datetime] = None
    photo_url: Optional[str] = None
    is_active: Optional[bool] = None

class TempWorkerCreate(BaseModel):
    first_name: str
    last_name: str
    phone: str = ""
    speciality: str = ""
    daily_rate: float = 0.0

class AttendanceRecord(BaseModel):
    worker_type: str
    worker_id: str
    project_id: Optional[str] = None
    status: str = "PRESENT"
    notes: str = ""

class PayrollGenerate(BaseModel):
    worker_type: str
    worker_id: str
    period: str
    days_worked: int = 0
    bonuses: float = 0.0
    deductions: float = 0.0
    advances: float = 0.0


class AttestationRequest(BaseModel):
    subject: str = "Attestation de travail"
    body: Optional[str] = None
    purpose: Optional[str] = None


class ContractRequest(BaseModel):
    title: str = "Contrat de travail"
    contract_type: Optional[str] = None
    position: Optional[str] = None
    salary: Optional[float] = None
    salary_period: str = "FCFA brut/mois"
    working_hours: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    clauses: Optional[str] = None


# ── Employees ────────────────────────────────────────────────

@router.get("/employees")
async def list_employees(user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Employee).where(Employee.deleted_at.is_(None)).order_by(Employee.last_name))
    return [
        {"id": e.id, "employee_code": e.employee_code, "first_name": e.first_name,
         "last_name": e.last_name, "email": e.email, "phone": e.phone,
         "position": e.position, "department": e.department,
         "contract_type": e.contract_type, "base_salary": e.base_salary,
         "hire_date": e.hire_date, "is_active": e.is_active, "photo_url": e.photo_url}
        for e in r.scalars().all()
    ]

@router.post("/employees")
async def create_employee(data: EmployeeCreate, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    count_r = await db.execute(select(func.count(Employee.id)))
    count = count_r.scalar() or 0
    emp = Employee(employee_code=f"EMP-{count + 1:03d}", **data.model_dump())
    db.add(emp)
    await log_activity(db, user.id, "EMPLOYEE_CREATED", "employee", emp.id)
    await db.commit()
    return {"id": emp.id, "employee_code": emp.employee_code}

@router.patch("/employees/{emp_id}")
async def update_employee(
    emp_id: str,
    data: EmployeeUpdate,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    """Update an employee with a strict Pydantic schema (no field injection)."""
    r = await db.execute(select(Employee).where(Employee.id == emp_id, Employee.deleted_at.is_(None)))
    emp = r.scalars().first()
    if not emp:
        raise HTTPException(404, "Employé introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(emp, k, v)
    emp.updated_at = _now()
    await db.commit()
    return {"detail": "Employé mis à jour"}


@router.get("/employees/{emp_id}")
async def get_employee(
    emp_id: str,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Employee).where(Employee.id == emp_id, Employee.deleted_at.is_(None)))
    e = r.scalars().first()
    if not e:
        raise HTTPException(404, "Employé introuvable")
    return {
        "id": e.id, "employee_code": e.employee_code,
        "first_name": e.first_name, "last_name": e.last_name,
        "email": e.email, "phone": e.phone, "position": e.position,
        "department": e.department, "contract_type": e.contract_type,
        "base_salary": e.base_salary, "hire_date": e.hire_date,
        "is_active": e.is_active, "photo_url": e.photo_url,
    }

@router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = r.scalars().first()
    if emp:
        emp.deleted_at = _now()
        await db.commit()
    return {"detail": "Employé supprimé"}


# ── Temp Workers ─────────────────────────────────────────────

@router.get("/temp-workers")
async def list_temp_workers(user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(TempWorker).where(TempWorker.deleted_at.is_(None)))
    return [
        {"id": w.id, "first_name": w.first_name, "last_name": w.last_name,
         "phone": w.phone, "speciality": w.speciality, "daily_rate": w.daily_rate,
         "rating": w.rating, "qr_code_data": w.qr_code_data, "is_active": w.is_active}
        for w in r.scalars().all()
    ]

@router.post("/temp-workers")
async def create_temp_worker(data: TempWorkerCreate, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    import uuid
    worker = TempWorker(**data.model_dump(), qr_code_data=str(uuid.uuid4()))
    db.add(worker)
    await db.commit()
    return {"id": worker.id, "qr_code_data": worker.qr_code_data}


# ── Attendance ───────────────────────────────────────────────

@router.get("/attendance")
async def list_attendance(
    date: Optional[str] = None, project_id: Optional[str] = None,
    user: User = Depends(require_rh), db: AsyncSession = Depends(get_db),
):
    query = select(Attendance).order_by(Attendance.date.desc())
    if project_id:
        query = query.where(Attendance.project_id == project_id)
    r = await db.execute(query)
    return [
        {"id": a.id, "worker_type": a.worker_type, "worker_id": a.worker_id,
         "project_id": a.project_id, "date": a.date, "status": a.status,
         "check_in": a.check_in, "check_out": a.check_out, "notes": a.notes}
        for a in r.scalars().all()
    ]

@router.post("/attendance/scan")
async def record_attendance(data: AttendanceRecord, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    att = Attendance(
        worker_type=data.worker_type, worker_id=data.worker_id,
        project_id=data.project_id, date=_now(),
        status=data.status, check_in=_now(), notes=data.notes,
    )
    db.add(att)
    await db.commit()
    return {"detail": "Pointage enregistré"}


@router.get("/attendance/summary")
async def attendance_summary(
    days: int = 7,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    """Daily attendance counts (present / late / absent) over the last N days.

    Feeds the RH "pointage" bar chart. Returns a continuous day series
    (zero-filled) ordered oldest → newest.
    """
    from datetime import timedelta
    today = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=days - 1)

    # day key (YYYY-MM-DD) → counts
    series: dict[str, dict] = {}
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        series[d] = {"date": d, "present": 0, "late": 0, "absent": 0}

    r = await db.execute(
        select(Attendance.date, Attendance.status).where(Attendance.date >= start)
    )
    status_map = {"PRESENT": "present", "RETARD": "late", "ABSENT": "absent"}
    for adate, astatus in r.all():
        if not adate:
            continue
        key = adate.strftime("%Y-%m-%d")
        if key in series:
            bucket = status_map.get(astatus or "PRESENT", "present")
            series[key][bucket] += 1

    return [series[k] for k in sorted(series.keys())]


# ── Payroll ──────────────────────────────────────────────────

@router.post("/payroll/generate")
async def generate_payroll(data: PayrollGenerate, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    # Calculate
    base = 0.0
    if data.worker_type == "employee":
        r = await db.execute(select(Employee).where(Employee.id == data.worker_id))
        emp = r.scalars().first()
        if emp:
            base = (emp.base_salary / 30) * data.days_worked
    else:
        r = await db.execute(select(TempWorker).where(TempWorker.id == data.worker_id))
        w = r.scalars().first()
        if w:
            base = w.daily_rate * data.days_worked

    net = base + data.bonuses - data.deductions - data.advances
    payroll = Payroll(
        worker_type=data.worker_type, worker_id=data.worker_id,
        period=data.period, days_worked=data.days_worked,
        base_amount=base, bonuses=data.bonuses,
        deductions=data.deductions, advances=data.advances, net_amount=net,
    )
    db.add(payroll)
    await db.commit()
    return {"id": payroll.id, "net_amount": net}

@router.get("/payroll/{worker_id}")
async def get_payroll(worker_id: str, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Payroll).where(Payroll.worker_id == worker_id).order_by(Payroll.period.desc()))
    return [
        {"id": p.id, "period": p.period, "days_worked": p.days_worked,
         "base_amount": p.base_amount, "bonuses": p.bonuses,
         "deductions": p.deductions, "advances": p.advances,
         "net_amount": p.net_amount, "status": p.status}
        for p in r.scalars().all()
    ]


@router.get("/payroll")
async def list_payroll(
    period: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    """List all payroll entries (across all workers), optionally filtered by period (YYYY-MM)."""
    q = select(Payroll).order_by(Payroll.period.desc(), Payroll.created_at.desc())
    if period:
        q = q.where(Payroll.period == period)
    if status_filter:
        q = q.where(Payroll.status == status_filter)
    r = await db.execute(q)
    return [
        {
            "id": p.id, "worker_type": p.worker_type, "worker_id": p.worker_id,
            "period": p.period, "days_worked": p.days_worked,
            "base_amount": p.base_amount, "bonuses": p.bonuses,
            "deductions": p.deductions, "advances": p.advances,
            "net_amount": p.net_amount, "status": p.status,
            "paid_at": p.paid_at, "created_at": p.created_at,
        }
        for p in r.scalars().all()
    ]


@router.patch("/payroll/{payroll_id}/validate")
async def validate_payroll(
    payroll_id: str,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    p = r.scalars().first()
    if not p:
        raise HTTPException(404, "Bulletin introuvable")
    p.status = "VALIDE"
    p.updated_at = _now()
    await log_activity(db, user.id, "PAYROLL_VALIDATED", "payroll", payroll_id)
    await db.commit()
    return {"detail": "Bulletin validé"}


@router.patch("/payroll/{payroll_id}/mark-paid")
async def mark_payroll_paid(
    payroll_id: str,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    p = r.scalars().first()
    if not p:
        raise HTTPException(404, "Bulletin introuvable")
    p.status = "PAYE"
    p.paid_at = _now()
    p.updated_at = _now()
    await db.commit()
    return {"detail": "Bulletin marqué payé"}


# ── PDF generation ───────────────────────────────────────────

async def _resolve_worker(db: AsyncSession, worker_type: str, worker_id: str) -> dict:
    """Return a serialisable view of an Employee or TempWorker."""
    if worker_type == "employee":
        r = await db.execute(select(Employee).where(Employee.id == worker_id))
        emp = r.scalars().first()
        if not emp:
            return {}
        return {
            "first_name": emp.first_name, "last_name": emp.last_name,
            "full_name": f"{emp.first_name} {emp.last_name}".strip(),
            "employee_code": emp.employee_code, "position": emp.position,
            "department": emp.department, "contract_type": emp.contract_type,
            "email": emp.email, "phone": emp.phone, "hire_date": emp.hire_date,
            "base_salary": emp.base_salary,
        }
    r = await db.execute(select(TempWorker).where(TempWorker.id == worker_id))
    w = r.scalars().first()
    if not w:
        return {}
    return {
        "first_name": w.first_name, "last_name": w.last_name,
        "full_name": f"{w.first_name} {w.last_name}".strip(),
        "employee_code": "", "position": w.speciality, "department": "Chantier",
        "contract_type": "Journalier", "phone": w.phone,
    }


@router.get("/payroll/{payroll_id}/pdf")
async def payroll_pdf(
    payroll_id: str,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Payroll).where(Payroll.id == payroll_id))
    p = r.scalars().first()
    if not p:
        raise HTTPException(404, "Bulletin introuvable")
    worker = await _resolve_worker(db, p.worker_type, p.worker_id)
    pdf_bytes = render_pdf(
        "payslip.html",
        {
            "payroll": {
                "id": p.id, "period": p.period, "worker_type": p.worker_type,
                "days_worked": p.days_worked, "base_amount": p.base_amount,
                "bonuses": p.bonuses, "deductions": p.deductions,
                "advances": p.advances, "net_amount": p.net_amount,
                "status": p.status, "paid_at": p.paid_at,
            },
            "worker": worker,
            "generated_at": _now(),
        },
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="bulletin-{p.period}.pdf"'},
    )


@router.post("/employees/{emp_id}/attestation-pdf")
async def employee_attestation_pdf(
    emp_id: str,
    data: AttestationRequest,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Employee).where(Employee.id == emp_id, Employee.deleted_at.is_(None)))
    emp = r.scalars().first()
    if not emp:
        raise HTTPException(404, "Employé introuvable")
    pdf_bytes = render_pdf(
        "attestation.html",
        {
            "attestation": {
                "code": f"ATT-{emp.employee_code}-{_now().strftime('%Y%m%d')}",
                "subject": data.subject, "body": data.body, "purpose": data.purpose,
            },
            "recipient": {
                "full_name": f"{emp.first_name} {emp.last_name}".strip(),
                "first_name": emp.first_name, "last_name": emp.last_name,
                "position": emp.position, "hire_date": emp.hire_date,
            },
            "generated_at": _now(),
        },
    )
    await log_activity(db, user.id, "ATTESTATION_GENERATED", "employee", emp.id,
                       new_value={"subject": data.subject})
    await db.commit()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="attestation-{emp.employee_code}.pdf"'},
    )


@router.post("/employees/{emp_id}/contract-pdf")
async def employee_contract_pdf(
    emp_id: str,
    data: ContractRequest,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Employee).where(Employee.id == emp_id, Employee.deleted_at.is_(None)))
    emp = r.scalars().first()
    if not emp:
        raise HTTPException(404, "Employé introuvable")
    pdf_bytes = render_pdf(
        "contract.html",
        {
            "contract": {
                "code": f"CTR-{emp.employee_code}-{_now().strftime('%Y%m%d')}",
                "title": data.title, "contract_type": data.contract_type or emp.contract_type,
                "position": data.position or emp.position,
                "salary": data.salary if data.salary is not None else emp.base_salary,
                "salary_period": data.salary_period,
                "working_hours": data.working_hours,
                "start_date": data.start_date or emp.hire_date,
                "end_date": data.end_date,
                "clauses": data.clauses,
                "created_at": _now(),
            },
            "worker": {
                "full_name": f"{emp.first_name} {emp.last_name}".strip(),
                "first_name": emp.first_name, "last_name": emp.last_name,
                "position": emp.position,
            },
            "generated_at": _now(),
        },
    )
    await log_activity(db, user.id, "CONTRACT_GENERATED", "employee", emp.id,
                       new_value={"contract_type": data.contract_type or emp.contract_type})
    await db.commit()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="contrat-{emp.employee_code}.pdf"'},
    )


# ── QR codes for temp workers ────────────────────────────────

@router.get("/temp-workers/{worker_id}/qr.png")
async def temp_worker_qr(
    worker_id: str,
    user: User = Depends(require_rh),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(TempWorker).where(TempWorker.id == worker_id))
    w = r.scalars().first()
    if not w:
        raise HTTPException(404, "Journalier introuvable")
    if not w.qr_code_data:
        import uuid as _uuid
        w.qr_code_data = str(_uuid.uuid4())
        await db.commit()
    png_bytes = temp_worker_badge_png(
        token=w.qr_code_data,
        worker_name=f"{w.first_name} {w.last_name}".strip(),
        speciality=w.speciality or "",
    )
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="qr-{w.qr_code_data[:8]}.png"'},
    )
