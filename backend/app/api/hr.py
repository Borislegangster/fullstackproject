"""HR API — Employees, Temp Workers, Attendance, Payroll."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_rh
from app.models.erp import Employee, TempWorker, Attendance, Payroll
from app.services.activity_service import log_activity

router = APIRouter(prefix="/hr", tags=["HR"])


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
async def update_employee(emp_id: str, data: dict, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Employee).where(Employee.id == emp_id, Employee.deleted_at.is_(None)))
    emp = r.scalars().first()
    if not emp:
        raise HTTPException(404, "Employé introuvable")
    for k, v in data.items():
        if hasattr(emp, k):
            setattr(emp, k, v)
    emp.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Employé mis à jour"}

@router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, user: User = Depends(require_rh), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = r.scalars().first()
    if emp:
        emp.deleted_at = datetime.utcnow()
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
        project_id=data.project_id, date=datetime.utcnow(),
        status=data.status, check_in=datetime.utcnow(), notes=data.notes,
    )
    db.add(att)
    await db.commit()
    return {"detail": "Pointage enregistré"}


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
