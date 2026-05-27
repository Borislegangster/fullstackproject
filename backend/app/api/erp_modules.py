"""Remaining ERP modules — Planning, Agenda, QHSE, Equipment, Subcontractors, Finances, Notifications, Activity, Users Admin."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import (
    require_admin, require_staff, require_chef_projet, require_rh,
    get_current_user, hash_password, create_invitation_token,
)
from app.models.erp import (
    Appointment, QHSEIncident, QHSEAudit, Equipment,
    SubContractor, SubContract, SubContractorEvaluation,
    PettyCash, Notification, ActivityLog, Project, Invoice,
)
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification, mark_read, mark_all_read, get_unread_count
from app.services.email_service import send_appointment_notification, send_invitation_email

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
async def confirm_appointment(appt_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = r.scalars().first()
    if not appt:
        raise HTTPException(404, "RDV introuvable")
    appt.status = "CONFIRMED"
    appt.updated_at = datetime.utcnow()
    # Notify requester
    requester_r = await db.execute(select(User).where(User.id == appt.requested_by))
    requester = requester_r.scalars().first()
    if requester:
        await create_notification(db, requester.id, title="Rendez-vous confirmé",
                                  message=appt.title, type="appointment")
        try:
            send_appointment_notification(requester.email, appt.title, str(appt.start_time), requester.first_name)
        except Exception:
            pass
    await db.commit()
    return {"detail": "RDV confirmé"}

@agenda_router.patch("/appointments/{appt_id}/cancel")
async def cancel_appointment(appt_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Appointment).where(Appointment.id == appt_id))
    appt = r.scalars().first()
    if not appt:
        raise HTTPException(404, "RDV introuvable")
    appt.status = "CANCELLED"
    appt.updated_at = datetime.utcnow()
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

@subcontractors_router.post("/{sub_id}/evaluate")
async def evaluate_subcontractor(sub_id: str, quality: int = 3, timeliness: int = 3, communication: int = 3, comments: str = "", project_id: str = "", user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    ev = SubContractorEvaluation(
        subcontractor_id=sub_id, project_id=project_id, evaluated_by=user.id,
        quality_score=quality, timeliness_score=timeliness, communication_score=communication, comments=comments,
    )
    db.add(ev)
    # Update average rating
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
    result = []
    for p in projects:
        inv_r = await db.execute(select(func.sum(Invoice.total)).where(Invoice.project_id == p.id, Invoice.status == "PAYEE"))
        revenue = inv_r.scalar() or 0
        margin = ((revenue - p.budget_spent) / revenue * 100) if revenue > 0 else 0
        result.append({"project_id": p.id, "project_name": p.name, "budget": p.budget_initial,
                        "spent": p.budget_spent, "revenue": revenue, "margin": round(margin, 1)})
    return result

@finances_router.post("/petty-cash")
async def add_petty_cash(project_id: str, amount: float, description: str, category: str = "", user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    pc = PettyCash(project_id=project_id, amount=amount, description=description, category=category, recorded_by=user.id)
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
         "new_value": l.new_value, "created_at": l.created_at}
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
    role: str = "CLIENT"

@users_router.get("")
async def list_users(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc()))
    return [
        {"id": u.id, "email": u.email, "first_name": u.first_name, "last_name": u.last_name,
         "full_name": u.full_name, "phone": u.phone, "role": u.role,
         "is_active": u.is_active, "must_change_password": u.must_change_password,
         "last_login_at": u.last_login_at, "created_at": u.created_at}
        for u in r.scalars().all()
    ]

@users_router.post("")
async def admin_create_user(data: UserCreate, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == data.email, User.deleted_at.is_(None)))
    if existing.scalars().first():
        raise HTTPException(400, "Cet email est déjà utilisé")

    import secrets, string
    temp_password = "".join(secrets.choice(string.ascii_letters + string.digits + "!@#$") for _ in range(12))
    invitation_token = create_invitation_token(data.email)

    user = User(
        email=data.email, password_hash=hash_password(temp_password),
        first_name=data.first_name, last_name=data.last_name,
        phone=data.phone, role=data.role,
        is_active=False, must_change_password=True,
        invitation_token=invitation_token, invitation_sent_at=datetime.utcnow(),
    )
    db.add(user)
    await log_activity(db, admin.id, "USER_CREATED", "user", user.id,
                       new_value={"email": data.email, "role": data.role})
    await db.commit()

    try:
        send_invitation_email(data.email, invitation_token, temp_password, data.first_name)
    except Exception:
        pass

    return {"id": user.id, "detail": "Utilisateur créé et invitation envoyée"}

@users_router.patch("/{user_id}")
async def admin_update_user(user_id: str, data: dict, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    for k, v in data.items():
        if k not in ("id", "password_hash", "created_at") and hasattr(user, k):
            setattr(user, k, v)
    user.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Utilisateur mis à jour"}

@users_router.delete("/{user_id}")
async def admin_delete_user(user_id: str, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    user.deleted_at = datetime.utcnow()
    await log_activity(db, admin.id, "USER_DEACTIVATED", "user", user_id)
    await db.commit()
    return {"detail": "Utilisateur désactivé"}

@users_router.post("/{user_id}/resend-invitation")
async def resend_invitation(user_id: str, admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = r.scalars().first()
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    if user.is_active and not user.must_change_password:
        return {"detail": "L'utilisateur a déjà activé son compte"}
    new_token = create_invitation_token(user.email)
    user.invitation_token = new_token
    user.invitation_sent_at = datetime.utcnow()
    await db.commit()
    from app.services.email_service import send_resend_invitation
    try:
        send_resend_invitation(user.email, new_token, user.first_name)
    except Exception:
        pass
    return {"detail": "Invitation renvoyée"}
