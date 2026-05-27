"""Client Portal API — All endpoints scoped to the authenticated CLIENT user's project."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import get_current_user
from app.models.erp import (
    Project, ProjectPhase, ProjectMedia, Invoice, Payment,
    Document, MaterialChoice, Conversation, Message, ConversationParticipant,
    SAVTicket, SAVTicketReply, Appointment, Notification,
)
from app.services.notification_service import create_notification

router = APIRouter(prefix="/client", tags=["Client Portal"])


def _require_client(user: User):
    """Ensure the user is a CLIENT."""
    if user.role != "CLIENT":
        raise HTTPException(403, "Accès réservé aux clients")


async def _get_client_project(user: User, db: AsyncSession) -> Project:
    """Get the client's active project."""
    r = await db.execute(
        select(Project).where(Project.client_id == user.id, Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
    )
    project = r.scalars().first()
    if not project:
        raise HTTPException(404, "Aucun projet trouvé pour ce client")
    return project


# ── Profile ──────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {
        "id": user.id, "email": user.email, "first_name": user.first_name,
        "last_name": user.last_name, "full_name": user.full_name,
        "phone": user.phone, "avatar_url": user.avatar_url, "role": user.role,
    }


# ── Project ──────────────────────────────────────────────────

@router.get("/project")
async def get_project(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    return {
        "id": p.id, "code": p.code, "name": p.name, "description": p.description,
        "location": p.location, "project_type": p.project_type,
        "budget_initial": p.budget_initial, "status": p.status, "progress": p.progress,
        "start_date": p.start_date, "estimated_end_date": p.estimated_end_date,
    }


@router.get("/project/timeline")
async def get_timeline(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    r = await db.execute(
        select(ProjectPhase).where(ProjectPhase.project_id == p.id).order_by(ProjectPhase.sort_order)
    )
    return [
        {"id": ph.id, "name": ph.name, "status": ph.status, "progress": ph.progress,
         "start_date": ph.start_date, "end_date": ph.end_date}
        for ph in r.scalars().all()
    ]


@router.get("/project/gallery")
async def get_gallery(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    r = await db.execute(
        select(ProjectMedia).where(ProjectMedia.project_id == p.id).order_by(ProjectMedia.created_at.desc())
    )
    return [
        {"id": m.id, "url": m.url, "caption": m.caption, "media_type": m.media_type,
         "phase_id": m.phase_id, "created_at": m.created_at}
        for m in r.scalars().all()
    ]


# ── Finances ─────────────────────────────────────────────────

@router.get("/finances")
async def get_finances(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    r = await db.execute(
        select(Invoice).where(
            Invoice.project_id == p.id,
            Invoice.client_id == user.id,
            Invoice.status.in_(["ENVOYEE", "PAYEE", "EN_RETARD"]),
            Invoice.deleted_at.is_(None),
        ).order_by(Invoice.issue_date.desc())
    )
    return [
        {"id": i.id, "code": i.code, "invoice_type": i.invoice_type,
         "status": i.status, "total": i.total, "amount_paid": i.amount_paid,
         "issue_date": i.issue_date, "due_date": i.due_date, "lines": i.lines}
        for i in r.scalars().all()
    ]


class ClientPayment(BaseModel):
    amount: float
    method: str = "mobile_money"
    reference: str = ""

@router.post("/finances/{invoice_id}/pay")
async def pay_invoice(invoice_id: str, data: ClientPayment, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    r = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id, Invoice.client_id == user.id)
    )
    inv = r.scalars().first()
    if not inv:
        raise HTTPException(404, "Facture introuvable")
    payment = Payment(invoice_id=inv.id, amount=data.amount, method=data.method, reference=data.reference)
    db.add(payment)
    inv.amount_paid = (inv.amount_paid or 0) + data.amount
    if inv.amount_paid >= inv.total:
        inv.status = "PAYEE"
        inv.paid_at = datetime.utcnow()
    inv.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Paiement enregistré"}


# ── Documents ────────────────────────────────────────────────

@router.get("/documents")
async def get_documents(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    r = await db.execute(
        select(Document).where(
            Document.project_id == p.id,
            Document.shared_with_client == True,
            Document.deleted_at.is_(None),
        ).order_by(Document.created_at.desc())
    )
    return [
        {"id": d.id, "name": d.name, "file_url": d.file_url, "category": d.category,
         "version": d.version, "signed_at": d.signed_at, "created_at": d.created_at}
        for d in r.scalars().all()
    ]


@router.post("/documents/{doc_id}/sign-otp")
async def sign_document(doc_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    r = await db.execute(select(Document).where(Document.id == doc_id, Document.shared_with_client == True))
    doc = r.scalars().first()
    if not doc:
        raise HTTPException(404, "Document introuvable")
    doc.signed_at = datetime.utcnow()
    doc.signed_by = user.id
    await db.commit()
    return {"detail": "Document signé"}


@router.get("/material-choices")
async def get_material_choices(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    r = await db.execute(select(MaterialChoice).where(MaterialChoice.project_id == p.id))
    return [
        {"id": m.id, "category": m.category, "options": m.options,
         "selected": m.selected, "selected_at": m.selected_at}
        for m in r.scalars().all()
    ]


@router.patch("/material-choices/{choice_id}")
async def select_material(choice_id: str, selection: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    r = await db.execute(select(MaterialChoice).where(MaterialChoice.id == choice_id))
    mc = r.scalars().first()
    if not mc:
        raise HTTPException(404, "Choix introuvable")
    mc.selected = selection
    mc.selected_by = user.id
    mc.selected_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Choix enregistré"}


# ── Messages ─────────────────────────────────────────────────

@router.get("/messages")
async def get_messages(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    conv_r = await db.execute(select(Conversation).where(Conversation.project_id == p.id))
    conv = conv_r.scalars().first()
    if not conv:
        return []
    msgs_r = await db.execute(
        select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at)
    )
    return [
        {"id": m.id, "sender_id": m.sender_id, "content": m.content,
         "is_system": m.is_system, "attachment_url": m.attachment_url, "created_at": m.created_at}
        for m in msgs_r.scalars().all()
    ]


class ClientMessage(BaseModel):
    content: str
    attachment_url: Optional[str] = None

@router.post("/messages")
async def send_message(data: ClientMessage, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    conv_r = await db.execute(select(Conversation).where(Conversation.project_id == p.id))
    conv = conv_r.scalars().first()
    if not conv:
        raise HTTPException(404, "Aucune conversation")
    msg = Message(conversation_id=conv.id, sender_id=user.id, content=data.content, attachment_url=data.attachment_url)
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    await db.commit()
    return {"id": msg.id}


# ── Planning ─────────────────────────────────────────────────

@router.get("/planning")
async def get_planning(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    phases_r = await db.execute(
        select(ProjectPhase).where(ProjectPhase.project_id == p.id).order_by(ProjectPhase.sort_order)
    )
    appts_r = await db.execute(
        select(Appointment).where(
            Appointment.project_id == p.id, Appointment.deleted_at.is_(None)
        ).order_by(Appointment.start_time)
    )
    return {
        "phases": [
            {"id": ph.id, "name": ph.name, "status": ph.status, "progress": ph.progress,
             "duration_days": ph.duration_days, "start_date": ph.start_date, "end_date": ph.end_date}
            for ph in phases_r.scalars().all()
        ],
        "appointments": [
            {"id": a.id, "title": a.title, "start_time": a.start_time, "end_time": a.end_time,
             "status": a.status, "location": a.location}
            for a in appts_r.scalars().all()
        ],
    }


class AppointmentRequest(BaseModel):
    title: str
    description: str = ""
    start_time: datetime
    end_time: datetime

@router.post("/appointments")
async def request_appointment(data: AppointmentRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    p = await _get_client_project(user, db)
    appt = Appointment(
        project_id=p.id, title=data.title, description=data.description,
        start_time=data.start_time, end_time=data.end_time,
        requested_by=user.id, status="PENDING",
    )
    db.add(appt)
    await db.commit()
    return {"id": appt.id, "status": "PENDING"}


# ── SAV ──────────────────────────────────────────────────────

@router.get("/sav/tickets")
async def get_tickets(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    r = await db.execute(
        select(SAVTicket).where(SAVTicket.client_id == user.id, SAVTicket.deleted_at.is_(None))
        .order_by(SAVTicket.created_at.desc())
    )
    return [
        {"id": t.id, "code": t.code, "subject": t.subject, "category": t.category,
         "priority": t.priority, "status": t.status, "rating": t.rating,
         "created_at": t.created_at, "resolved_at": t.resolved_at}
        for t in r.scalars().all()
    ]


# ── Notifications ────────────────────────────────────────────

@router.get("/notifications")
async def get_notifications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(Notification).where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc()).limit(50)
    )
    return [
        {"id": n.id, "type": n.type, "title": n.title, "message": n.message,
         "is_read": n.is_read, "created_at": n.created_at}
        for n in r.scalars().all()
    ]
