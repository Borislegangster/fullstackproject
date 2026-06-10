"""Client Portal API — All endpoints scoped to the authenticated CLIENT user's project."""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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
    SAVTicket, SAVTicketReply, Appointment, Notification, ProjectGuest,
)
from app.services.notification_service import create_notification

router = APIRouter(prefix="/client", tags=["Client Portal"])


from app.utils.time import utcnow_naive as _now


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
        inv.paid_at = _now()
    inv.updated_at = _now()
    await db.commit()
    return {"detail": "Paiement enregistré"}


@router.get("/finances/evolution")
async def get_finances_evolution(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Monthly cumulative invoiced vs paid for the client's project.

    Feeds the client "évolution du budget" area chart. Each point is cumulative
    (running total) so the curve only ever rises. Returns [] when there are no
    invoices yet (the chart shows its empty state).
    """
    _require_client(user)
    p = await _get_client_project(user, db)

    inv_r = await db.execute(
        select(Invoice).where(
            Invoice.project_id == p.id, Invoice.client_id == user.id,
            Invoice.status.in_(["ENVOYEE", "PAYEE", "EN_RETARD"]),
            Invoice.deleted_at.is_(None),
        )
    )
    invoices = inv_r.scalars().all()
    if not invoices:
        return []

    # Gather per-month invoiced (by issue_date) and paid (by payment date).
    invoiced_by_month: dict[str, float] = {}
    paid_by_month: dict[str, float] = {}
    inv_ids = []
    for inv in invoices:
        inv_ids.append(inv.id)
        if inv.issue_date:
            k = inv.issue_date.strftime("%Y-%m")
            invoiced_by_month[k] = invoiced_by_month.get(k, 0) + float(inv.total or 0)

    pay_r = await db.execute(
        select(Payment.paid_at, Payment.amount).where(Payment.invoice_id.in_(inv_ids))
    )
    for paid_at, amount in pay_r.all():
        if paid_at:
            k = paid_at.strftime("%Y-%m")
            paid_by_month[k] = paid_by_month.get(k, 0) + float(amount or 0)

    all_months = sorted(set(invoiced_by_month) | set(paid_by_month))
    budget = float(p.budget_initial or 0)
    cum_inv = 0.0
    cum_paid = 0.0
    out = []
    for month in all_months:
        cum_inv += invoiced_by_month.get(month, 0)
        cum_paid += paid_by_month.get(month, 0)
        out.append({
            "month": month,
            "invoiced": round(cum_inv, 2),
            "paid": round(cum_paid, 2),
            "budget": budget,
        })
    return out


@router.get("/finances/receipts")
async def get_finances_receipts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Payment receipts for the client's invoices (most recent first)."""
    _require_client(user)
    p = await _get_client_project(user, db)

    inv_r = await db.execute(
        select(Invoice).where(
            Invoice.project_id == p.id, Invoice.client_id == user.id,
            Invoice.deleted_at.is_(None),
        )
    )
    code_by_id = {inv.id: inv.code for inv in inv_r.scalars().all()}
    if not code_by_id:
        return []

    pay_r = await db.execute(
        select(Payment).where(Payment.invoice_id.in_(list(code_by_id.keys())))
        .order_by(Payment.paid_at.desc())
    )
    return [
        {
            "id": pay.id,
            "invoice_code": code_by_id.get(pay.invoice_id, ""),
            "amount": float(pay.amount or 0),
            "method": pay.method,
            "reference": pay.reference,
            "paid_at": pay.paid_at,
        }
        for pay in pay_r.scalars().all()
    ]


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
    doc.signed_at = _now()
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


class MaterialSelectionIn(BaseModel):
    selection: str


@router.patch("/material-choices/{choice_id}")
async def select_material(choice_id: str, data: MaterialSelectionIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    _require_client(user)
    r = await db.execute(select(MaterialChoice).where(MaterialChoice.id == choice_id))
    mc = r.scalars().first()
    if not mc:
        raise HTTPException(404, "Choix introuvable")
    mc.selected = data.selection
    mc.selected_by = user.id
    mc.selected_at = _now()
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
    """Send a message in the client's project conversation. Auto-creates the
    conversation if it doesn't exist yet (e.g. project not converted via the
    full Lead → Convert flow)."""
    _require_client(user)
    p = await _get_client_project(user, db)
    conv_r = await db.execute(select(Conversation).where(Conversation.project_id == p.id))
    conv = conv_r.scalars().first()
    if not conv:
        conv = Conversation(project_id=p.id, subject=f"Projet {p.name}")
        db.add(conv)
        await db.flush()
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=user.id))
        if p.chef_projet_id and p.chef_projet_id != user.id:
            db.add(ConversationParticipant(conversation_id=conv.id, user_id=p.chef_projet_id))
    msg = Message(conversation_id=conv.id, sender_id=user.id, content=data.content, attachment_url=data.attachment_url)
    db.add(msg)
    conv.updated_at = _now()
    await db.commit()

    # Real-time broadcast (Phase 6) — staff connected to /ws/messaging/{project_id}
    # receives the new message immediately.
    try:
        from app.api.realtime import messaging_hub
        await messaging_hub.broadcast(conv.id, {
            "type": "MESSAGE_CREATED",
            "payload": {
                "id": msg.id,
                "sender_id": msg.sender_id,
                "content": msg.content,
                "is_system": msg.is_system,
                "attachment_url": msg.attachment_url,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            },
        })
    except Exception:
        pass

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


class ClientTicketCreate(BaseModel):
    subject: str
    description: str = ""
    category: str = "general"
    priority: str = "NORMALE"


@router.post("/sav/tickets")
async def create_ticket(
    data: ClientTicketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Client creates a SAV ticket against their active project."""
    _require_client(user)
    project = await _get_client_project(user, db)

    from sqlalchemy import func
    count_r = await db.execute(select(func.count(SAVTicket.id)))
    count = count_r.scalar() or 0
    code = f"SAV-{_now().strftime('%Y')}-{count + 1:03d}"

    ticket = SAVTicket(
        code=code,
        project_id=project.id,
        client_id=user.id,
        subject=data.subject,
        description=data.description,
        category=data.category,
        priority=data.priority,
    )
    db.add(ticket)
    await db.commit()
    return {"id": ticket.id, "code": code}


class ClientTicketRating(BaseModel):
    rating: int


@router.post("/sav/tickets/{ticket_id}/rate")
async def rate_ticket(
    ticket_id: str,
    data: ClientTicketRating,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_client(user)
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(400, "La note doit être entre 1 et 5")
    r = await db.execute(
        select(SAVTicket).where(SAVTicket.id == ticket_id, SAVTicket.client_id == user.id)
    )
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    t.rating = data.rating
    t.updated_at = _now()
    await db.commit()
    return {"detail": "Note enregistrée"}


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


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Client marks one of their own notifications as read."""
    r = await db.execute(
        select(Notification).where(
            Notification.id == notif_id, Notification.user_id == user.id
        )
    )
    n = r.scalars().first()
    if not n:
        raise HTTPException(404, "Notification introuvable")
    n.is_read = True
    await db.commit()
    return {"detail": "Notification lue"}


@router.delete("/notifications/{notif_id}")
async def delete_notification(
    notif_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Client dismisses (deletes) one of their own notifications."""
    r = await db.execute(
        select(Notification).where(
            Notification.id == notif_id, Notification.user_id == user.id
        )
    )
    n = r.scalars().first()
    if not n:
        raise HTTPException(404, "Notification introuvable")
    await db.delete(n)
    await db.commit()
    return {"detail": "Notification supprimée"}


# ── Live project state (weather + recent activity) ──────────

@router.get("/project/live")
async def get_project_live(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight live data for the client dashboard widget."""
    _require_client(user)
    project = await _get_client_project(user, db)

    # Most recent media (photo of the day)
    media_r = await db.execute(
        select(ProjectMedia).where(ProjectMedia.project_id == project.id)
        .order_by(ProjectMedia.created_at.desc()).limit(3)
    )
    last_media = [
        {"url": m.url, "caption": m.caption, "created_at": m.created_at}
        for m in media_r.scalars().all()
    ]

    # Latest phase update
    phase_r = await db.execute(
        select(ProjectPhase).where(ProjectPhase.project_id == project.id)
        .order_by(ProjectPhase.updated_at.desc()).limit(1)
    )
    last_phase = phase_r.scalars().first()

    # Unread messages count
    conv_r = await db.execute(select(Conversation).where(Conversation.project_id == project.id))
    conv = conv_r.scalars().first()
    unread_msgs = 0
    if conv:
        from sqlalchemy import and_
        part_r = await db.execute(
            select(ConversationParticipant).where(
                ConversationParticipant.conversation_id == conv.id,
                ConversationParticipant.user_id == user.id,
            )
        )
        part = part_r.scalars().first()
        last_read = part.last_read_at if part else None
        msg_q = select(Message).where(Message.conversation_id == conv.id)
        if last_read:
            msg_q = msg_q.where(Message.created_at > last_read)
        msgs = await db.execute(msg_q)
        unread_msgs = len(msgs.scalars().all())

    return {
        "project": {
            "id": project.id,
            "code": project.code,
            "name": project.name,
            "progress": project.progress,
            "status": project.status,
        },
        "last_media": last_media,
        "last_phase": {
            "id": last_phase.id, "name": last_phase.name, "status": last_phase.status,
            "progress": last_phase.progress, "updated_at": last_phase.updated_at,
        } if last_phase else None,
        "unread_messages": unread_msgs,
        "weather": None,  # Filled by /client/weather (Phase 7)
    }


# ── Documents — client upload ────────────────────────────────

class ClientDocumentCreate(BaseModel):
    name: str
    file_url: str
    category: str = "envoi_client"
    notes: str = ""


@router.post("/documents")
async def upload_client_document(
    data: ClientDocumentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Client uploads a document. The file itself goes through /admin/media/upload first
    and the client posts the resulting URL here."""
    _require_client(user)
    project = await _get_client_project(user, db)
    doc = Document(
        project_id=project.id,
        name=data.name,
        file_url=data.file_url,
        category=data.category,
        shared_with_client=True,
        uploaded_by=user.id,
    )
    db.add(doc)
    # Notify staff (project chef_projet if any)
    if project.chef_projet_id:
        await create_notification(
            db, project.chef_projet_id,
            title="Nouveau document client",
            message=f"{data.name} déposé par le client",
            type="document",
            entity_type="document", entity_id=doc.id,
        )
    await db.commit()
    return {"id": doc.id}


@router.post("/documents/upload")
async def upload_client_document_binary(
    file: UploadFile = File(...),
    name: str = Form(""),
    category: str = Form("envoi_client"),
    notes: str = Form(""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Client uploads a *real* binary file scoped to their own project.

    Stores the bytes on S3/R2 (or the local /uploads dir in dev) via the shared
    storage helper, and creates a Document row whose download is served through
    the secure presigned endpoint — no placeholder or public URLs.
    """
    from app.api.admin_media import _validate_upload
    from app.services.storage_service import store_upload

    _require_client(user)
    project = await _get_client_project(user, db)

    content = await file.read()
    content = _validate_upload(file, content)
    url, size_str, storage_key = await store_upload(
        content, file.filename or "file",
        file.content_type or "application/octet-stream",
        prefix="client", public=False,
    )

    doc = Document(
        project_id=project.id,
        name=name or file.filename or "Document",
        file_url=url,
        storage_key=storage_key,
        file_size=size_str,
        mime_type=file.content_type or "",
        category=category,
        shared_with_client=True,
        uploaded_by=user.id,
    )
    db.add(doc)
    if project.chef_projet_id:
        await create_notification(
            db, project.chef_projet_id,
            title="Nouveau document client",
            message=f"{doc.name} déposé par le client",
            type="document", entity_type="document", entity_id=doc.id,
        )
    await db.commit()
    await db.refresh(doc)
    # Serve downloads through the secure presigned endpoint (cloud + local).
    doc.file_url = f"/api/v1/ged/documents/{doc.id}/download"
    await db.commit()
    return {
        "id": doc.id, "name": doc.name,
        "file_url": doc.file_url, "category": doc.category,
    }


# ── Family / Guest access ────────────────────────────────────

class GuestInvite(BaseModel):
    email: str
    name: str = ""
    role: str = "READ_ONLY"  # READ_ONLY / EDIT


def _guest_out(g: ProjectGuest) -> dict:
    return {
        "id": g.id, "email": g.email, "name": g.name,
        "role": g.role, "status": g.status, "created_at": g.created_at,
    }


@router.get("/guests")
async def list_guests(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """List the family/guest accesses the client has granted."""
    _require_client(user)
    r = await db.execute(
        select(ProjectGuest)
        .where(ProjectGuest.owner_id == user.id, ProjectGuest.deleted_at.is_(None))
        .order_by(ProjectGuest.created_at.desc())
    )
    return [_guest_out(g) for g in r.scalars().all()]


@router.post("/guests")
async def invite_guest(
    data: GuestInvite,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a family member / guest to follow the client's project."""
    _require_client(user)
    email = (data.email or "").strip().lower()
    if not email:
        raise HTTPException(400, "Email requis")
    project = await _get_client_project(user, db)
    existing = await db.execute(
        select(ProjectGuest).where(
            ProjectGuest.owner_id == user.id,
            ProjectGuest.email == email,
            ProjectGuest.deleted_at.is_(None),
        )
    )
    if existing.scalars().first():
        raise HTTPException(409, "Cet invité a déjà été ajouté")
    role = "EDIT" if str(data.role).strip().upper() == "EDIT" else "READ_ONLY"
    guest = ProjectGuest(
        project_id=project.id, owner_id=user.id,
        email=email, name=data.name or "", role=role, status="PENDING",
    )
    db.add(guest)
    await db.commit()
    await db.refresh(guest)
    return _guest_out(guest)


@router.delete("/guests/{guest_id}")
async def remove_guest(
    guest_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a guest's access (soft delete)."""
    _require_client(user)
    r = await db.execute(select(ProjectGuest).where(ProjectGuest.id == guest_id))
    guest = r.scalars().first()
    if not guest or guest.owner_id != user.id:
        raise HTTPException(404, "Invité introuvable")
    guest.deleted_at = _now()
    await db.commit()
    return {"detail": "Invité retiré"}
