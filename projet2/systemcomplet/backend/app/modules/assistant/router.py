"""API publique de l'assistant de la vitrine (widget flottant) — quotas par IP, aucune donnée sensible."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.config import settings
from app.core.database import get_db
from app.core.middleware import client_ip
from app.core.ratelimit import rate_limit
from app.modules.assistant import service

public = APIRouter(prefix="/public/assistant", tags=["Assistant (public)"])


@public.get("")
def welcome(db: Session = Depends(get_db)) -> dict[str, Any]:
    return service.welcome(db)


class MessageIn(BaseModel):
    conversation_id: uuid.UUID | None = None
    message: str = Field(min_length=1, max_length=1000)
    page_path: str | None = Field(default=None, max_length=250)


@public.post("/messages", dependencies=[Depends(rate_limit("assistant", "60/hour"))])
def send_message(data: MessageIn, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    result = service.converse(
        db,
        conversation_id=data.conversation_id,
        message=data.message,
        page_path=data.page_path,
        ip=client_ip(request.scope),
    )
    db.commit()
    return result


class LeadIn(BaseModel):
    conversation_id: uuid.UUID
    first_name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    need: str | None = Field(default=None, max_length=1000)
    consent: bool


@public.post(
    "/lead", status_code=201, dependencies=[Depends(rate_limit("assistant_lead", settings.RATE_LIMIT_PUBLIC_FORMS))]
)
def leave_contact(data: LeadIn, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    result = service.capture_lead(
        db,
        conversation_id=data.conversation_id,
        first_name=data.first_name,
        phone=data.phone,
        email=str(data.email) if data.email else None,
        need=data.need,
        consent=data.consent,
        ip=client_ip(request.scope),
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    return result


# ---------------------------------------------------------------------------- équipe : boîte de réception (A1)
router = APIRouter(prefix="/assistant", tags=["Assistant — conversations"])


@router.get("/conversations")
def conversations(
    channel: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    """Conversations du widget et de WhatsApp (les plus récentes d'abord)."""
    from sqlalchemy import select

    from app.modules.assistant.models import AssistantConversation
    from app.modules.assistant.whatsapp import conversation_out

    access.require("crm:read")
    stmt = select(AssistantConversation)
    if channel:
        stmt = stmt.where(AssistantConversation.channel == channel)
    if status:
        stmt = stmt.where(AssistantConversation.status == status)
    order = (AssistantConversation.last_message_at.desc().nulls_last(), AssistantConversation.created_at.desc())
    rows = db.execute(stmt.order_by(*order).limit(300)).scalars()
    return [conversation_out(c, full=False) for c in rows]


def _conversation(db: Session, conversation_id: uuid.UUID) -> Any:
    from app.core.errors import NotFound
    from app.modules.assistant.models import AssistantConversation

    conversation = db.get(AssistantConversation, conversation_id)
    if conversation is None:
        raise NotFound("Conversation introuvable")
    return conversation


@router.get("/conversations/{conversation_id}")
def conversation(
    conversation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.assistant.whatsapp import conversation_out

    access.require("crm:read")
    return conversation_out(_conversation(db, conversation_id), full=True, reveal_phone=access.has("crm:write"))


class ReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


@router.post("/conversations/{conversation_id}/reply")
def reply(
    conversation_id: uuid.UUID, data: ReplyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Réponse d'un conseiller sur WhatsApp : l'assistant automatique se met en retrait pendant 12 h."""
    from app.core import audit
    from app.modules.assistant.whatsapp import agent_reply, conversation_out

    access.require("crm:write")
    conv = _conversation(db, conversation_id)
    agent_reply(db, conv, user=access.p.user, text=data.message)
    audit.record(
        db,
        family="business",
        module="assistant",
        action="AGENT_REPLY",
        resource_type="assistant_conversation",
        resource_id=conv.id,
    )
    db.commit()
    return conversation_out(conv, full=True, reveal_phone=True)


@router.post("/conversations/{conversation_id}/release")
def release(
    conversation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Rend la main à l'assistant automatique."""
    from app.modules.assistant.whatsapp import conversation_out

    access.require("crm:write")
    conv = _conversation(db, conversation_id)
    conv.human_until = None
    conv.mode = "client" if conv.user_id else "rules"
    if conv.status == "handoff":
        conv.status = "open"
    db.commit()
    return conversation_out(conv, full=True, reveal_phone=True)


@router.post("/conversations/{conversation_id}/close")
def close(
    conversation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.modules.assistant.whatsapp import conversation_out

    access.require("crm:write")
    conv = _conversation(db, conversation_id)
    conv.status = "closed"
    conv.human_until = None
    db.commit()
    return conversation_out(conv, full=True, reveal_phone=True)
