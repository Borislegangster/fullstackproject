"""Messaging API — Conversations & Messages."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import get_current_user
from app.models.erp import Conversation, ConversationParticipant, Message

router = APIRouter(prefix="/messaging", tags=["Messaging"])


from app.utils.time import utcnow_naive as _now


class MessageCreate(BaseModel):
    content: str
    attachment_url: Optional[str] = None


@router.get("/conversations/{project_id}")
async def get_conversation(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Conversation).where(Conversation.project_id == project_id))
    conv = r.scalars().first()
    if not conv:
        raise HTTPException(404, "Aucune conversation pour ce projet")
    return {"id": conv.id, "project_id": conv.project_id, "subject": conv.subject, "created_at": conv.created_at}


@router.get("/conversations/{project_id}/messages")
async def list_messages(
    project_id: str, page: int = 1, per_page: int = 50,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Conversation).where(Conversation.project_id == project_id))
    conv = r.scalars().first()
    if not conv:
        return []
    offset = (page - 1) * per_page
    msgs_r = await db.execute(
        select(Message).where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc()).offset(offset).limit(per_page)
    )
    msgs = msgs_r.scalars().all()

    # Mark as read
    part_r = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv.id,
            ConversationParticipant.user_id == user.id,
        )
    )
    part = part_r.scalars().first()
    if part:
        part.last_read_at = _now()
        await db.commit()

    return [
        {"id": m.id, "sender_id": m.sender_id, "content": m.content,
         "is_system": m.is_system, "attachment_url": m.attachment_url,
         "created_at": m.created_at}
        for m in reversed(msgs)  # Return in chronological order
    ]


@router.post("/conversations/{project_id}/messages")
async def send_message(
    project_id: str, data: MessageCreate,
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Conversation).where(Conversation.project_id == project_id))
    conv = r.scalars().first()
    if not conv:
        # Create conversation if it doesn't exist
        conv = Conversation(project_id=project_id)
        db.add(conv)
        await db.flush()
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=user.id))

    msg = Message(
        conversation_id=conv.id, sender_id=user.id,
        content=data.content, attachment_url=data.attachment_url,
    )
    db.add(msg)
    conv.updated_at = _now()
    await db.commit()

    # Real-time broadcast (Phase 6) — non-fatal if hub is unavailable
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

    return {"id": msg.id, "created_at": msg.created_at}
