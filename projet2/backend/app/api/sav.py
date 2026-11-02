"""SAV / Support Tickets API."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, get_current_user
from app.models.erp import SAVTicket, SAVTicketReply, Warranty
from app.services.activity_service import log_activity
from app.services.notification_service import create_notification
from app.services.email_service import send_ticket_reply_notification

router = APIRouter(prefix="/sav", tags=["SAV"])


from app.utils.time import utcnow_naive as _now


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


class TicketRating(BaseModel):
    rating: int
    comment: str = ""


class TicketAssign(BaseModel):
    assignee_id: str


class WarrantyCreate(BaseModel):
    project_id: Optional[str] = None
    name: str
    duration: str = ""
    description: str = ""
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    status: str = "ACTIVE"


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
         "rating_comment": t.rating_comment or "",
         "created_at": t.created_at, "resolved_at": t.resolved_at}
        for t in r.scalars().all()
    ]


@router.post("/tickets")
async def create_ticket(
    data: TicketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(SAVTicket.id)))
    count = count_r.scalar() or 0
    code = f"SAV-{_now().strftime('%Y')}-{count + 1:03d}"
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
async def reply_ticket(
    ticket_id: str,
    data: TicketReplyCreate,
    bg: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    reply = SAVTicketReply(ticket_id=ticket_id, author_id=user.id, **data.model_dump())
    db.add(reply)
    ticket.updated_at = _now()

    # If staff replies, notify client
    if user.role != "CLIENT" and not data.is_internal:
        client_r = await db.execute(select(User).where(User.id == ticket.client_id))
        client = client_r.scalars().first()
        if client:
            await create_notification(db, client.id, title=f"Réponse à votre ticket {ticket.code}",
                                      type="sav", entity_type="sav_ticket", entity_id=ticket.id)
            bg.add_task(send_ticket_reply_notification, client.email, ticket.code, client.first_name)

    await db.commit()
    return {"id": reply.id}


@router.patch("/tickets/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: str,
    data: TicketAssign = None,
    assignee_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Assign a ticket to a staff member. Accepts both JSON body and query param for backward compat."""
    final_assignee = (data.assignee_id if data else None) or assignee_id
    if not final_assignee:
        raise HTTPException(400, "assignee_id requis")
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    ticket.assigned_to = final_assignee
    ticket.status = "EN_COURS"
    ticket.updated_at = _now()
    await db.commit()
    return {"detail": "Ticket assigné"}


@router.patch("/tickets/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    ticket.status = "RESOLU"
    ticket.resolved_at = _now()
    ticket.updated_at = _now()
    await log_activity(db, user.id, "TICKET_RESOLVED", "sav_ticket", ticket.id)
    await db.commit()
    return {"detail": "Ticket résolu"}


@router.patch("/tickets/{ticket_id}/rate")
async def rate_ticket(
    ticket_id: str,
    data: TicketRating = None,
    rating: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rate a ticket. Accepts both JSON body and query param for backward compat."""
    final_rating = (data.rating if data else None) if data else rating
    if final_rating is None:
        final_rating = rating
    if final_rating is None or final_rating < 1 or final_rating > 5:
        raise HTTPException(400, "La note doit être entre 1 et 5")
    r = await db.execute(select(SAVTicket).where(SAVTicket.id == ticket_id))
    ticket = r.scalars().first()
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    ticket.rating = final_rating
    if data and getattr(data, "comment", None):
        ticket.rating_comment = data.comment
    ticket.updated_at = _now()
    await db.commit()
    return {"detail": "Note enregistrée"}


@router.get("/warranties")
async def list_warranties(
    project_id: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Warranty).where(Warranty.deleted_at.is_(None))
    if project_id:
        q = q.where(Warranty.project_id == project_id)
    q = q.order_by(Warranty.expires_at)
    r = await db.execute(q)
    return [
        {"id": w.id, "project_id": w.project_id, "name": w.name,
         "duration": w.duration, "description": w.description,
         "starts_at": w.starts_at, "expires_at": w.expires_at, "status": w.status}
        for w in r.scalars().all()
    ]


@router.post("/warranties")
async def create_warranty(
    data: WarrantyCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    w = Warranty(**data.model_dump())
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return {"id": w.id}


@router.delete("/warranties/{warranty_id}")
async def delete_warranty(
    warranty_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Warranty).where(Warranty.id == warranty_id))
    w = r.scalars().first()
    if not w:
        raise HTTPException(404, "Garantie introuvable")
    w.deleted_at = _now()
    await db.commit()
    return {"detail": "Garantie supprimée"}


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


@router.get("/stats/by-category")
async def stats_by_category(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(SAVTicket.category, func.count(SAVTicket.id))
        .where(SAVTicket.deleted_at.is_(None))
        .group_by(SAVTicket.category)
    )
    return [{"category": c, "count": n} for c, n in rows.all()]
