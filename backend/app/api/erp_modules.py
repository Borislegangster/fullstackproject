"""Remaining ERP modules — Planning, Agenda, QHSE, Equipment, Subcontractors, Finances, Notifications, Activity, Users Admin."""
from datetime import datetime, timezone
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
# pyrefly: ignore [missing-import]
from sqlalchemy import select, func
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import AsyncSession
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import Optional, Literal

from app.database import get_db
from app.auth.models import User
from app.auth.service import (
    require_admin, require_staff, require_chef_projet, require_rh,
    get_current_user, hash_password, create_invitation_token,
)
from app.models.erp import (
    Appointment, QHSEIncident, QHSEAudit, Equipment,
    SubContractor, SubContract, SubContractorEvaluation, SubcontractorSituation,
    PettyCash, Notification, ActivityLog, Project, Invoice,
    Charge, ProjectExpense, Payment, SafetyBriefing,
)
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification, mark_read, mark_all_read, get_unread_count
from app.services.email_service import send_appointment_notification, send_invitation_email


from app.utils.time import utcnow_naive as _now

# ═════════════════════════════════════════════════════════════
# AGENDA / APPOINTMENTS
# ═════════════════════════════════════════════════════════════

agenda_router = APIRouter(prefix="/agenda", tags=["Agenda"])

class AppointmentCreate(BaseModel):
    project_id: Optional[str] = None
    title: str
    description: str = ""
    location: str = ""
    start_time: datetime
    end_time: datetime
    attendees: list = []

@agenda_router.get("/appointments")
async def list_appointments(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(Appointment).where(Appointment.deleted_at.is_(None)).order_by(Appointment.start_time)
    if user.role == "CLIENT":
        query = query.where(Appointment.requested_by == user.id)
    r = await db.execute(query)
    return [
        {"id": a.id, "title": a.title, "description": a.description, "location": a.location,
         "start_time": a.start_time, "end_time": a.end_time, "status": a.status,
         "requested_by": a.requested_by, "attendees": a.attendees, "project_id": a.project_id}
        for a in r.scalars().all()
    ]

@agenda_router.post("/appointments")
async def create_appointment(data: AppointmentCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    status = "CONFIRMED" if user.role != "CLIENT" else "PENDING"
    appt = Appointment(**data.model_dump(), requested_by=user.id, status=status)
    db.add(appt)
    await db.commit()
    return {"id": appt.id, "status": status}

@agenda_router.patch("/appointments/{appt_id}/confirm")
async def confirm_appointment(
    appt_id: str,
    bg: BackgroundTasks,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = r.scalars().first()
    if not appt:
        raise HTTPException(404, "RDV introuvable")
    appt.status = "CONFIRMED"
    appt.updated_at = _now()
    # Notify requester
    requester_r = await db.execute(select(User).where(User.id == appt.requested_by))
    requester = requester_r.scalars().first()
    if requester:
        await create_notification(db, requester.id, title="Rendez-vous confirmé",
                                  message=appt.title, type="appointment")
        # Non-blocking email via BackgroundTasks
        bg.add_task(
            send_appointment_notification,
            requester.email, appt.title, str(appt.start_time), requester.first_name
        )
    await db.commit()
    return {"detail": "RDV confirmé"}

@agenda_router.patch("/appointments/{appt_id}/cancel")
async def cancel_appointment(appt_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = r.scalars().first()
    if not appt:
        raise HTTPException(404, "RDV introuvable")
    appt.status = "CANCELLED"
    appt.updated_at = _now()
    await db.commit()
    return {"detail": "RDV annulé"}


# ═════════════════════════════════════════════════════════════
# QHSE
# ═════════════════════════════════════════════════════════════

qhse_router = APIRouter(prefix="/qhse", tags=["QHSE"])

class IncidentCreate(BaseModel):
    project_id: str
    title: str
    description: str = ""
    severity: str = "MINEUR"
    category: str = ""
    location: str = ""
    incident_date: datetime

class AuditCreate(BaseModel):
    project_id: str
    title: str
    audit_type: str = "SECURITE"
    audit_date: datetime
    findings: list = []

@qhse_router.get("/incidents")
async def list_incidents(project_id: Optional[str] = None, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    query = select(QHSEIncident).where(QHSEIncident.deleted_at.is_(None))
    if project_id:
        query = query.where(QHSEIncident.project_id == project_id)
    r = await db.execute(query.order_by(QHSEIncident.incident_date.desc()))
    return [
        {"id": i.id, "project_id": i.project_id, "title": i.title, "description": i.description,
         "severity": i.severity, "category": i.category, "status": i.status,
         "corrective_action": i.corrective_action, "incident_date": i.incident_date}
        for i in r.scalars().all()
    ]

@qhse_router.post("/incidents")
async def create_incident(data: IncidentCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    incident = QHSEIncident(**data.model_dump(), reported_by=user.id)
    db.add(incident)
    await log_activity(db, user.id, "INCIDENT_REPORTED", "qhse_incident", incident.id)
    await db.commit()
    return {"id": incident.id}

@qhse_router.get("/audits")
async def list_audits(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(QHSEAudit).order_by(QHSEAudit.audit_date.desc()))
    return [
        {"id": a.id, "project_id": a.project_id, "title": a.title, "audit_type": a.audit_type,
         "score": a.score, "findings": a.findings, "status": a.status, "audit_date": a.audit_date}
        for a in r.scalars().all()
    ]

@qhse_router.post("/audits")
async def create_audit(data: AuditCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    audit = QHSEAudit(**data.model_dump(), auditor=user.id)
    db.add(audit)
    await db.commit()
    return {"id": audit.id}


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    corrective_action: Optional[str] = None
    photos: Optional[list] = None


class AuditUpdate(BaseModel):
    title: Optional[str] = None
    audit_type: Optional[str] = None
    score: Optional[float] = None
    findings: Optional[list] = None
    status: Optional[str] = None
    audit_date: Optional[datetime] = None


@qhse_router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(QHSEIncident).where(QHSEIncident.id == incident_id, QHSEIncident.deleted_at.is_(None)))
    inc = r.scalars().first()
    if not inc:
        raise HTTPException(404, "Incident introuvable")
    return {
        "id": inc.id, "project_id": inc.project_id, "title": inc.title,
        "description": inc.description, "severity": inc.severity,
        "category": inc.category, "location": inc.location,
        "status": inc.status, "corrective_action": inc.corrective_action,
        "photos": inc.photos or [], "incident_date": inc.incident_date,
        "reported_by": inc.reported_by, "created_at": inc.created_at,
    }


@qhse_router.patch("/incidents/{incident_id}")
async def update_incident(
    incident_id: str,
    data: IncidentUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(QHSEIncident).where(QHSEIncident.id == incident_id, QHSEIncident.deleted_at.is_(None)))
    inc = r.scalars().first()
    if not inc:
        raise HTTPException(404, "Incident introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(inc, k, v)
    inc.updated_at = _now()
    await log_activity(db, user.id, "INCIDENT_UPDATED", "qhse_incident", incident_id, new_value=updates)
    await db.commit()
    return {"detail": "Incident mis à jour"}


@qhse_router.patch("/incidents/{incident_id}/close")
async def close_incident(
    incident_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(QHSEIncident).where(QHSEIncident.id == incident_id, QHSEIncident.deleted_at.is_(None)))
    inc = r.scalars().first()
    if not inc:
        raise HTTPException(404, "Incident introuvable")
    inc.status = "CLOTURE"
    inc.updated_at = _now()
    await db.commit()
    return {"detail": "Incident clôturé"}


@qhse_router.get("/audits/{audit_id}")
async def get_audit(
    audit_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(QHSEAudit).where(QHSEAudit.id == audit_id))
    a = r.scalars().first()
    if not a:
        raise HTTPException(404, "Audit introuvable")
    return {
        "id": a.id, "project_id": a.project_id, "title": a.title,
        "audit_type": a.audit_type, "score": a.score,
        "findings": a.findings or [], "status": a.status,
        "audit_date": a.audit_date, "auditor": a.auditor,
    }


@qhse_router.patch("/audits/{audit_id}")
async def update_audit(
    audit_id: str,
    data: AuditUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(QHSEAudit).where(QHSEAudit.id == audit_id))
    a = r.scalars().first()
    if not a:
        raise HTTPException(404, "Audit introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(a, k, v)
    a.updated_at = _now()
    await db.commit()
    return {"detail": "Audit mis à jour"}


@qhse_router.get("/stats")
async def qhse_stats(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    open_r = await db.execute(
        select(func.count(QHSEIncident.id)).where(
            QHSEIncident.status.in_(["OUVERT", "EN_COURS"]), QHSEIncident.deleted_at.is_(None)
        )
    )
    grave_r = await db.execute(
        select(func.count(QHSEIncident.id)).where(
            QHSEIncident.severity.in_(["GRAVE", "CRITIQUE"]), QHSEIncident.deleted_at.is_(None)
        )
    )
    closed_r = await db.execute(
        select(func.count(QHSEIncident.id)).where(
            QHSEIncident.status == "CLOTURE", QHSEIncident.deleted_at.is_(None)
        )
    )
    audits_r = await db.execute(
        select(func.count(QHSEAudit.id)).where(QHSEAudit.status == "TERMINE")
    )
    return {
        "open_incidents": open_r.scalar() or 0,
        "severe_incidents": grave_r.scalar() or 0,
        "closed_incidents": closed_r.scalar() or 0,
        "completed_audits": audits_r.scalar() or 0,
    }


# ── Safety briefings / Toolbox talks (Phase 14) ──────────────

class SafetyBriefingCreate(BaseModel):
    title: str
    project_id: Optional[str] = None
    site_label: str = ""
    animator: str = ""
    signed_count: int = 0
    total_count: int = 0
    status: str = "EN_COURS"
    briefing_date: Optional[datetime] = None
    notes: str = ""


class SafetyBriefingUpdate(BaseModel):
    title: Optional[str] = None
    site_label: Optional[str] = None
    animator: Optional[str] = None
    signed_count: Optional[int] = None
    total_count: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


def _serialize_briefing(b: SafetyBriefing) -> dict:
    return {
        "id": b.id, "title": b.title, "project_id": b.project_id,
        "site_label": b.site_label, "animator": b.animator,
        "signed_count": b.signed_count, "total_count": b.total_count,
        "status": b.status, "briefing_date": b.briefing_date, "notes": b.notes,
    }


@qhse_router.get("/briefings")
async def list_briefings(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(SafetyBriefing).where(SafetyBriefing.deleted_at.is_(None))
        .order_by(SafetyBriefing.briefing_date.desc())
    )
    return [_serialize_briefing(b) for b in r.scalars().all()]


@qhse_router.post("/briefings")
async def create_briefing(
    data: SafetyBriefingCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    payload = data.model_dump()
    if not payload.get("briefing_date"):
        payload["briefing_date"] = datetime.now(timezone.utc).replace(tzinfo=None)
    b = SafetyBriefing(**payload)
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return {"id": b.id}


@qhse_router.patch("/briefings/{briefing_id}")
async def update_briefing(
    briefing_id: str,
    data: SafetyBriefingUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SafetyBriefing).where(SafetyBriefing.id == briefing_id, SafetyBriefing.deleted_at.is_(None)))
    b = r.scalars().first()
    if not b:
        raise HTTPException(404, "Briefing introuvable")
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(b, k, v)
    b.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    return {"detail": "Briefing mis à jour"}


@qhse_router.delete("/briefings/{briefing_id}")
async def delete_briefing(
    briefing_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SafetyBriefing).where(SafetyBriefing.id == briefing_id))
    b = r.scalars().first()
    if not b:
        raise HTTPException(404, "Briefing introuvable")
    b.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    return {"detail": "Briefing supprimé"}


# ═════════════════════════════════════════════════════════════
# EQUIPMENT
# ═════════════════════════════════════════════════════════════

equipment_router = APIRouter(prefix="/equipment", tags=["Equipment"])

class EquipmentCreate(BaseModel):
    name: str
    category: str = ""
    brand: str = ""
    model: str = ""
    serial_number: str = ""

@equipment_router.get("")
async def list_equipment(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Equipment).where(Equipment.deleted_at.is_(None)))
    return [
        {"id": e.id, "code": e.code, "name": e.name, "category": e.category,
         "brand": e.brand, "model": e.model, "status": e.status,
         "current_project_id": e.current_project_id, "next_maintenance": e.next_maintenance,
         "maintenance_history": e.maintenance_history}
        for e in r.scalars().all()
    ]

@equipment_router.post("")
async def create_equipment(data: EquipmentCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    count_r = await db.execute(select(func.count(Equipment.id)))
    count = count_r.scalar() or 0
    code = f"EQ-{count + 1:03d}"
    equip = Equipment(code=code, **data.model_dump())
    db.add(equip)
    await db.commit()
    return {"id": equip.id, "code": code}


# ═════════════════════════════════════════════════════════════
# SUBCONTRACTORS
# ═════════════════════════════════════════════════════════════

subcontractors_router = APIRouter(prefix="/subcontractors", tags=["Subcontractors"])

class SubContractorCreate(BaseModel):
    company_name: str
    contact_name: str = ""
    email: str = ""
    phone: str = ""
    speciality: str = ""
    tax_id: str = ""

@subcontractors_router.get("")
async def list_subcontractors(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SubContractor).where(SubContractor.deleted_at.is_(None)))
    return [
        {"id": s.id, "company_name": s.company_name, "contact_name": s.contact_name,
         "email": s.email, "phone": s.phone, "speciality": s.speciality,
         "rating": s.rating, "is_active": s.is_active}
        for s in r.scalars().all()
    ]

@subcontractors_router.post("")
async def create_subcontractor(data: SubContractorCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    sub = SubContractor(**data.model_dump())
    db.add(sub)
    await db.commit()
    return {"id": sub.id}


class SituationCreate(BaseModel):
    subcontractor_id: Optional[str] = None
    project_id: Optional[str] = None
    description: str = ""
    progress_pct: int = 0
    amount: float = 0.0


@subcontractors_router.get("/situations")
async def list_situations(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(SubcontractorSituation)
        .where(SubcontractorSituation.deleted_at.is_(None))
        .order_by(SubcontractorSituation.created_at.desc())
    )
    rows = r.scalars().all()
    sub_ids = {s.subcontractor_id for s in rows if s.subcontractor_id}
    proj_ids = {s.project_id for s in rows if s.project_id}
    sub_names: dict = {}
    proj_names: dict = {}
    if sub_ids:
        sr = await db.execute(select(SubContractor.id, SubContractor.company_name).where(SubContractor.id.in_(sub_ids)))
        sub_names = {i: n for i, n in sr.all()}
    if proj_ids:
        pr = await db.execute(select(Project.id, Project.name).where(Project.id.in_(proj_ids)))
        proj_names = {i: n for i, n in pr.all()}
    return [
        {"id": s.id, "subcontractor_id": s.subcontractor_id,
         "subcontractor_name": sub_names.get(s.subcontractor_id, ""),
         "project_id": s.project_id, "project_name": proj_names.get(s.project_id, ""),
         "description": s.description, "progress_pct": s.progress_pct,
         "amount": s.amount, "status": s.status, "created_at": s.created_at}
        for s in rows
    ]


@subcontractors_router.post("/situations")
async def create_situation(data: SituationCreate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    s = SubcontractorSituation(**data.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return {"id": s.id}


@subcontractors_router.patch("/situations/{sit_id}/validate")
async def validate_situation(sit_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SubcontractorSituation).where(SubcontractorSituation.id == sit_id))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Situation introuvable")
    s.status = "VALIDEE"
    await db.commit()
    return {"detail": "Situation validée"}


@subcontractors_router.patch("/situations/{sit_id}/refuse")
async def refuse_situation(sit_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SubcontractorSituation).where(SubcontractorSituation.id == sit_id))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Situation introuvable")
    s.status = "REFUSEE"
    await db.commit()
    return {"detail": "Situation refusée"}


class SubContractorUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    speciality: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: Optional[bool] = None


@subcontractors_router.get("/{sub_id}")
async def get_subcontractor(
    sub_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SubContractor).where(SubContractor.id == sub_id, SubContractor.deleted_at.is_(None)))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Sous-traitant introuvable")
    return {
        "id": s.id, "company_name": s.company_name, "contact_name": s.contact_name,
        "email": s.email, "phone": s.phone, "speciality": s.speciality,
        "tax_id": s.tax_id, "rating": s.rating, "is_active": s.is_active,
    }


@subcontractors_router.patch("/{sub_id}")
async def update_subcontractor(
    sub_id: str,
    data: SubContractorUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SubContractor).where(SubContractor.id == sub_id, SubContractor.deleted_at.is_(None)))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Sous-traitant introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(s, k, v)
    s.updated_at = _now()
    await db.commit()
    return {"detail": "Sous-traitant mis à jour"}


@subcontractors_router.delete("/{sub_id}")
async def delete_subcontractor(
    sub_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SubContractor).where(SubContractor.id == sub_id))
    s = r.scalars().first()
    if not s:
        raise HTTPException(404, "Sous-traitant introuvable")
    s.deleted_at = _now()
    await db.commit()
    return {"detail": "Sous-traitant supprimé"}


class ContractCreate(BaseModel):
    project_id: str
    description: str = ""
    amount: float = 0.0
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


@subcontractors_router.get("/{sub_id}/contracts")
async def list_contracts(
    sub_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.models.erp import SubContract
    r = await db.execute(
        select(SubContract).where(
            SubContract.subcontractor_id == sub_id, SubContract.deleted_at.is_(None)
        ).order_by(SubContract.created_at.desc())
    )
    return [
        {
            "id": c.id, "project_id": c.project_id, "description": c.description,
            "amount": c.amount, "amount_paid": c.amount_paid, "status": c.status,
            "start_date": c.start_date, "end_date": c.end_date,
        }
        for c in r.scalars().all()
    ]


@subcontractors_router.post("/{sub_id}/contracts")
async def create_contract(
    sub_id: str,
    data: ContractCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.models.erp import SubContract
    c = SubContract(subcontractor_id=sub_id, **data.model_dump())
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return {"id": c.id}

class SubEvaluation(BaseModel):
    project_id: str
    quality: int = 3
    timeliness: int = 3
    communication: int = 3
    comments: str = ""


@subcontractors_router.post("/{sub_id}/evaluate")
async def evaluate_subcontractor(
    sub_id: str,
    data: SubEvaluation,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate a subcontractor. Body JSON (3 scores + comments + project_id)."""
    for score, label in [(data.quality, "quality"), (data.timeliness, "timeliness"), (data.communication, "communication")]:
        if score < 1 or score > 5:
            raise HTTPException(400, f"Le score {label} doit être entre 1 et 5")
    ev = SubContractorEvaluation(
        subcontractor_id=sub_id, project_id=data.project_id, evaluated_by=user.id,
        quality_score=data.quality, timeliness_score=data.timeliness,
        communication_score=data.communication, comments=data.comments,
    )
    db.add(ev)
    r = await db.execute(select(SubContractor).where(SubContractor.id == sub_id))
    sub = r.scalars().first()
    if sub:
        evals_r = await db.execute(select(SubContractorEvaluation).where(SubContractorEvaluation.subcontractor_id == sub_id))
        evals = evals_r.scalars().all()
        if evals:
            avg = sum((e.quality_score + e.timeliness_score + e.communication_score) / 3 for e in evals) / len(evals)
            sub.rating = round(avg, 1)
    await db.commit()
    return {"detail": "Évaluation enregistrée"}


# ═════════════════════════════════════════════════════════════
# FINANCES (Aggregation)
# ═════════════════════════════════════════════════════════════

finances_router = APIRouter(prefix="/finances", tags=["Finances"])

@finances_router.get("/profitability")
async def get_profitability(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project).where(Project.deleted_at.is_(None)))
    projects = r.scalars().all()
    # Resolve client names in bulk (real data, no placeholders).
    client_ids = {p.client_id for p in projects if p.client_id}
    client_names: dict = {}
    if client_ids:
        ur = await db.execute(
            select(User.id, User.first_name, User.last_name).where(User.id.in_(client_ids))
        )
        for cid, fn, ln in ur.all():
            client_names[cid] = f"{fn or ''} {ln or ''}".strip()
    # Real expense breakdown per project & category (one grouped query, no mock).
    exp_r = await db.execute(
        select(
            ProjectExpense.project_id,
            ProjectExpense.category,
            func.sum(ProjectExpense.amount),
        )
        .where(ProjectExpense.deleted_at.is_(None))
        .group_by(ProjectExpense.project_id, ProjectExpense.category)
    )
    breakdown_map: dict = {}
    for pid, cat, total in exp_r.all():
        b = breakdown_map.setdefault(
            pid, {"materiaux": 0.0, "main_oeuvre": 0.0, "sous_traitance": 0.0, "logistique": 0.0}
        )
        c = (cat or "").lower()
        if c == "materials":
            b["materiaux"] += total or 0
        elif c == "labor":
            b["main_oeuvre"] += total or 0
        elif c == "subcontractor":
            b["sous_traitance"] += total or 0
        else:  # logistics, equipment, misc, autre…
            b["logistique"] += total or 0
    zero_b = {"materiaux": 0.0, "main_oeuvre": 0.0, "sous_traitance": 0.0, "logistique": 0.0}
    result = []
    for p in projects:
        inv_r = await db.execute(select(func.sum(Invoice.total)).where(Invoice.project_id == p.id, Invoice.status == "PAYEE"))
        revenue = inv_r.scalar() or 0
        margin = ((revenue - p.budget_spent) / revenue * 100) if revenue > 0 else 0
        result.append({"project_id": p.id, "project_name": p.name, "budget": p.budget_initial,
                        "spent": p.budget_spent, "revenue": revenue, "margin": round(margin, 1),
                        "status": p.status, "client": client_names.get(p.client_id, ""),
                        "start_date": p.start_date, "end_date": p.estimated_end_date,
                        "breakdown": breakdown_map.get(p.id, zero_b)})
    return result


@finances_router.get("/cashflow")
async def get_cashflow(
    months: int = 6,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Monthly cash inflow vs outflow for the last N months.

    Inflow  = client payments received (Payment.paid_at).
    Outflow = project expenses + paid operating charges + petty cash.
    Returns a continuous month series (zero-filled) so the chart has no gaps.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # Build the continuous list of YYYY-MM keys for the window.
    keys: list[str] = []
    y, m = now.year, now.month
    for _ in range(months):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    keys.reverse()
    cutoff = datetime(int(keys[0][:4]), int(keys[0][5:7]), 1)

    inflow: dict[str, float] = {k: 0.0 for k in keys}
    outflow: dict[str, float] = {k: 0.0 for k in keys}

    def _bump(bucket: dict, dt, amount) -> None:
        if not dt:
            return
        key = dt.strftime("%Y-%m")
        if key in bucket:
            bucket[key] += float(amount or 0)

    # Inflow — payments received
    pay_r = await db.execute(select(Payment.paid_at, Payment.amount).where(Payment.paid_at >= cutoff))
    for paid_at, amount in pay_r.all():
        _bump(inflow, paid_at, amount)

    # Outflow — project expenses
    exp_r = await db.execute(
        select(ProjectExpense.expense_date, ProjectExpense.amount).where(
            ProjectExpense.deleted_at.is_(None), ProjectExpense.expense_date >= cutoff
        )
    )
    for dt, amount in exp_r.all():
        _bump(outflow, dt, amount)

    # Outflow — paid operating charges
    chg_r = await db.execute(
        select(Charge.paid_at, Charge.amount).where(
            Charge.deleted_at.is_(None), Charge.paid == True, Charge.paid_at >= cutoff  # noqa: E712
        )
    )
    for dt, amount in chg_r.all():
        _bump(outflow, dt, amount)

    # Outflow — petty cash
    pc_r = await db.execute(select(PettyCash.recorded_at, PettyCash.amount).where(PettyCash.recorded_at >= cutoff))
    for dt, amount in pc_r.all():
        _bump(outflow, dt, amount)

    return [
        {
            "month": k,
            "inflow": round(inflow[k], 2),
            "outflow": round(outflow[k], 2),
            "net": round(inflow[k] - outflow[k], 2),
        }
        for k in keys
    ]

class PettyCashCreate(BaseModel):
    project_id: Optional[str] = None
    amount: float
    description: str
    category: str = ""
    receipt_url: Optional[str] = None


@finances_router.get("/petty-cash")
async def list_petty_cash(
    project_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(PettyCash).order_by(PettyCash.recorded_at.desc())
    if project_id:
        q = q.where(PettyCash.project_id == project_id)
    r = await db.execute(q)
    return [
        {
            "id": p.id, "project_id": p.project_id, "amount": p.amount,
            "description": p.description, "category": p.category,
            "receipt_url": p.receipt_url, "recorded_at": p.recorded_at,
        }
        for p in r.scalars().all()
    ]


@finances_router.post("/petty-cash")
async def add_petty_cash(
    data: PettyCashCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Add a petty-cash entry. Body JSON."""
    pc = PettyCash(
        project_id=data.project_id, amount=data.amount,
        description=data.description, category=data.category,
        receipt_url=data.receipt_url, recorded_by=user.id,
    )
    db.add(pc)
    await db.commit()
    return {"id": pc.id}


# ═════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═════════════════════════════════════════════════════════════

notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])

@notifications_router.get("")
async def list_notifications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc()).limit(100)
    )
    return [
        {"id": n.id, "type": n.type, "title": n.title, "message": n.message,
         "entity_type": n.entity_type, "entity_id": n.entity_id,
         "is_read": n.is_read, "created_at": n.created_at}
        for n in r.scalars().all()
    ]

@notifications_router.patch("/{notif_id}/read")
async def mark_notification_read(notif_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await mark_read(db, notif_id, user.id)
    await db.commit()
    return {"detail": "Notification lue"}

@notifications_router.patch("/read-all")
async def mark_all_notifications_read(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await mark_all_read(db, user.id)
    await db.commit()
    return {"detail": "Toutes les notifications marquées lues"}

@notifications_router.get("/unread-count")
async def unread_count(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await get_unread_count(db, user.id)
    return {"count": count}


# ═════════════════════════════════════════════════════════════
# ACTIVITY LOG
# ═════════════════════════════════════════════════════════════

activity_router = APIRouter(prefix="/activity", tags=["Activity"])

@activity_router.get("/logs")
async def list_activity_logs(
    action: Optional[str] = None, entity_type: Optional[str] = None,
    limit: int = 100,
    user: User = Depends(require_staff), db: AsyncSession = Depends(get_db),
):
    query = select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit)
    if action:
        query = query.where(ActivityLog.action == action)
    if entity_type:
        query = query.where(ActivityLog.entity_type == entity_type)
    r = await db.execute(query)
    return [
        {"id": l.id, "actor_id": l.actor_id, "action": l.action,
         "entity_type": l.entity_type, "entity_id": l.entity_id,
         "description": l.description, "old_value": l.old_value,
         "new_value": l.new_value, "ip_address": l.ip_address,
         "user_agent": l.user_agent, "created_at": l.created_at}
        for l in r.scalars().all()
    ]


# ═════════════════════════════════════════════════════════════
# ADMIN USERS MANAGEMENT
# ═════════════════════════════════════════════════════════════

users_router = APIRouter(prefix="/admin/users", tags=["User Management"])


class UserCreate(BaseModel):
    email: str
    first_name: str
    last_name: str
    phone: str = ""
    role: Literal["ADMIN", "CHEF_PROJET", "COMPTABLE", "RH", "CLIENT"] = "CLIENT"


class UserUpdate(BaseModel):
    """Strictly typed — only these fields can be modified via the admin PATCH endpoint.
    This prevents injection of sensitive fields (password_hash, id, etc.).
    """
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["ADMIN", "CHEF_PROJET", "COMPTABLE", "RH", "CLIENT"]] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None


@users_router.get("")
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())
    )
    return [
        {
            "id": u.id, "email": u.email, "first_name": u.first_name, "last_name": u.last_name,
            "full_name": u.full_name, "phone": u.phone, "role": u.role,
            "is_active": u.is_active, "must_change_password": u.must_change_password,
            "last_login_at": u.last_login_at, "created_at": u.created_at,
        }
        for u in r.scalars().all()
    ]


@users_router.post("")
async def admin_create_user(
    data: UserCreate,
    bg: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check if email already exists
    existing = await db.execute(
        select(User).where(User.email == data.email, User.deleted_at.is_(None))
    )
    if existing.scalars().first():
        raise HTTPException(400, "Cet email est déjà utilisé")

    import secrets as _secrets, string as _string
    temp_password = "".join(
        _secrets.choice(_string.ascii_letters + _string.digits + "!@#$")
        for _ in range(12)
    )
    invitation_token = create_invitation_token(data.email)

    user = User(
        email=data.email,
        password_hash=hash_password(temp_password),
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        role=data.role,
        is_active=False,
        must_change_password=True,
        invitation_token=invitation_token,
        invitation_sent_at=_now(),
    )
    db.add(user)
    await log_activity(
        db, admin.id, "USER_CREATED", "user", user.id,
        new_value={"email": data.email, "role": data.role},
    )
    await db.commit()

    # Non-blocking email — does not delay the HTTP response
    bg.add_task(send_invitation_email, data.email, invitation_token, temp_password, data.first_name)

    return {"id": user.id, "detail": "Utilisateur créé et invitation envoyée"}


@users_router.patch("/{user_id}")
async def admin_update_user(
    user_id: str,
    data: UserUpdate,  # Strict Pydantic schema — no arbitrary field injection
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    update_data = data.model_dump(exclude_unset=True, exclude_none=True)
    for k, v in update_data.items():
        setattr(user, k, v)
    user.updated_at = _now()

    await log_activity(
        db, admin.id, "USER_UPDATED", "user", user_id,
        new_value=update_data,
    )
    await db.commit()
    return {"detail": "Utilisateur mis à jour"}


@users_router.delete("/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    user.deleted_at = _now()
    await log_activity(db, admin.id, "USER_DEACTIVATED", "user", user_id)
    await db.commit()
    return {"detail": "Utilisateur désactivé"}


@users_router.post("/{user_id}/resend-invitation")
async def resend_invitation(
    user_id: str,
    bg: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    if user.is_active and not user.must_change_password:
        return {"detail": "L'utilisateur a déjà activé son compte"}

    new_token = create_invitation_token(user.email)
    user.invitation_token = new_token
    user.invitation_sent_at = _now()
    await db.commit()

    from app.services.email_service import send_resend_invitation
    bg.add_task(send_resend_invitation, user.email, new_token, user.first_name)
    return {"detail": "Invitation renvoyée"}


@users_router.get("/{user_id}")
async def admin_get_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    u = r.scalars().first()
    if not u:
        raise HTTPException(404, "Utilisateur introuvable")
    return {
        "id": u.id, "email": u.email, "first_name": u.first_name,
        "last_name": u.last_name, "full_name": u.full_name,
        "phone": u.phone, "role": u.role, "is_active": u.is_active,
        "must_change_password": u.must_change_password,
        "last_login_at": u.last_login_at, "created_at": u.created_at,
        "avatar_url": u.avatar_url,
    }


@users_router.post("/{user_id}/force-reset-password")
async def admin_force_reset_password(
    user_id: str,
    bg: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin forces a user to reset their password. Sends them an email."""
    r = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    # Generate a reset token (same flow as forgot-password)
    from app.auth.service import generate_reset_token, hash_reset_token
    from app.auth.models import PasswordResetToken
    from app.services.email_service import send_password_reset_email
    from datetime import timedelta

    raw_token = generate_reset_token()
    token_hash = hash_reset_token(raw_token)
    expires_at = _now() + timedelta(hours=24)
    prt = PasswordResetToken(
        user_id=user.id, token_hash=token_hash, expires_at=expires_at,
        requested_ip="(admin-forced)",
    )
    db.add(prt)
    user.must_change_password = True
    await log_activity(db, admin.id, "USER_PASSWORD_RESET_FORCED", "user", user_id)
    await db.commit()

    bg.add_task(send_password_reset_email, user.email, raw_token, user.first_name)
    return {"detail": "Email de réinitialisation envoyé"}
