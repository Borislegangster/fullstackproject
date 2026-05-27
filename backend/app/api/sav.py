"""SAV / Support Tickets API."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, get_current_user
from app.models.erp import SAVTicket, SAVTicketReply
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification
from app.services.email_service import send_ticket_reply_notification

router = APIRouter(prefix="/sav", tags=["SAV"])


class TicketCreate(BaseModel):
    project_id: str
    subject: str
    description: str = ""
    category: str = "general"
    priority: str = "NORMALE"

class TicketReplyCreate(BaseModel):
    content: str
    attachment_url: Optional[str] = None
    is_internal: bool = False


@router.get("/tickets")
async def list_tickets(
    status_filter: Optional[str] = None, project_id: Optional[str] = None,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    query = select(SAVTicket).where(SAVTicket.deleted_at.is_(None))
    if user.role == "CLIENT":
        query = query.where(SAVTicket.client_id == user.id)
    if status_filter:
        query = query.where(SAVTicket.status == status_filter)
    if project_id:
        query = query.where(SAVTicket.project_id == project_id)
    query = query.order_by(SAVTicket.created_at.desc())
    r = await db.execute(query)
    return [
        {"id": t.id, "code": t.code, "project_id": t.project_id, "subject": t.subject,
         "description": t.description, "category": t.category, "priority": t.priority,
         "status": t.status, "assigned_to": t.assigned_to, "rating": t.rating,
         "created_at": t.created_at, "resolved_at": t.resolved_at}
        for t in r.scalars().all()
    ]


@router.post("/tickets")
async def create_ticket(data: TicketCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count_r = await db.execute(select(func.count(SAVTicket.id)))
    count = count_r.scalar() or 0
    code = f"SAV-{datetime.utcnow().strftime('%Y')}-{count + 1:03d}"
    ticket = SAVTicket(code=code, client_id=user.id, **data.model_dump())
    db.add(ticket)
    await log_activity(db, user.id, "TICKET_CREATED", "sav_ticket", ticket.id)
    await db.commit()
    return {"id": ticket.id, "code": code}


@router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id, SAVTicket.deleted_at.is_(None)))
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    # Clients can only see their own tickets
    if user.role == "CLIENT" and t.client_id != user.id:
        raise HTTPException(403, "Accès refusé")

    replies_r = await db.execute(
        select(SAVTicketReply).where(SAVTicketReply.ticket_id == ticket_id).order_by(SAVTicketReply.created_at)
    )
    replies = replies_r.scalars().all()
    reply_list = [
        {"id": rp.id, "author_id": rp.author_id, "content": rp.content,
         "attachment_url": rp.attachment_url, "is_internal": rp.is_internal, "created_at": rp.created_at}
        for rp in replies if not rp.is_internal or user.role != "CLIENT"
    ]
    return {
        "id": t.id, "code": t.code, "project_id": t.project_id, "subject": t.subject,
        "description": t.description, "category": t.category, "priority": t.priority,
        "status": t.status, "assigned_to": t.assigned_to, "rating": t.rating,
        "created_at": t.created_at, "resolved_at": t.resolved_at,
        "replies": reply_list,
    }


@router.post("/tickets/{ticket_id}/replies")
async def reply_ticket(ticket_id: str, data: TicketReplyCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    reply = SAVTicketReply(ticket_id=ticket_id, author_id=user.id, **data.model_dump())
    db.add(reply)
    ticket.updated_at = datetime.utcnow()

    # If staff replies, notify client
    if user.role != "CLIENT" and not data.is_internal:
        client_r = await db.execute(select(User).where(User.id == ticket.client_id))
        client = client_r.scalars().first()
        if client:
            await create_notification(db, client.id, title=f"Réponse à votre ticket {ticket.code}",
                                      type="sav", entity_type="sav_ticket", entity_id=ticket.id)
            try:
                send_ticket_reply_notification(client.email, ticket.code, client.first_name)
            except Exception:
                pass

    await db.commit()
    return {"id": reply.id}


@router.patch("/tickets/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, assignee_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    ticket.assigned_to = assignee_id
    ticket.status = "EN_COURS"
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Ticket assigné"}


@router.patch("/tickets/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    ticket.status = "RESOLU"
    ticket.resolved_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()
    await log_activity(db, user.id, "TICKET_RESOLVED", "sav_ticket", ticket.id)
    await db.commit()
    return {"detail": "Ticket résolu"}


@router.patch("/tickets/{ticket_id}/rate")
async def rate_ticket(ticket_id: str, rating: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if rating < 1 or rating > 5:
        raise HTTPException(400, "La note doit être entre 1 et 5")
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    ticket.rating = rating
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    return {"detail": "Note enregistrée"}


@router.get("/stats")
async def get_sav_stats(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    open_r = await db.execute(select(func.count(SAVTicket.id)).where(SAVTicket.status == "OUVERT"))
    in_progress_r = await db.execute(select(func.count(SAVTicket.id)).where(SAVTicket.status == "EN_COURS"))
    resolved_r = await db.execute(select(func.count(SAVTicket.id)).where(SAVTicket.status == "RESOLU"))
    avg_rating_r = await db.execute(select(func.avg(SAVTicket.rating)).where(SAVTicket.rating.isnot(None)))
    return {
        "open": open_r.scalar() or 0,
        "in_progress": in_progress_r.scalar() or 0,
        "resolved": resolved_r.scalar() or 0,
        "avg_rating": round(avg_rating_r.scalar() or 0, 1),
    }
