"""
Communications API — Calls (audio/video/screen), participants, presence.
Routes: /api/v1/calls/*
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.service import require_staff, get_current_user
from app.models.communications import Call, CallParticipant, UserPresence
from app.services.activity_service import log_activity
import uuid

router = APIRouter(prefix="/calls", tags=["communications"])


def _dict(obj) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ── Schemas ──────────────────────────────────────────────────

class CallCreate(BaseModel):
    project_id: Optional[str] = None
    call_type: str = "AUDIO"
    title: str = ""
    scheduled_at: Optional[str] = None
    participants: list = []

class CallUpdate(BaseModel):
    status: Optional[str] = None
    recording_url: Optional[str] = None
    recording_consent: Optional[bool] = None
    notes: Optional[str] = None

class PresenceUpdate(BaseModel):
    status: str = "ONLINE"
    status_message: str = ""
    current_activity: str = ""


# ── Calls ────────────────────────────────────────────────────

@router.get("")
async def list_calls(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_staff),
):
    q = select(Call).where(Call.deleted_at.is_(None))
    if project_id:
        q = q.where(Call.project_id == project_id)
    if status:
        q = q.where(Call.status == status)
    rows = (await db.execute(q.order_by(Call.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return [_dict(r) for r in rows]


@router.post("")
async def create_call(body: CallCreate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    call = Call(
        id=str(uuid.uuid4()),
        initiated_by=user.id,
        call_type=body.call_type,
        title=body.title,
        project_id=body.project_id,
        scheduled_at=datetime.fromisoformat(body.scheduled_at) if body.scheduled_at else None,
        room_id=str(uuid.uuid4()),
    )
    db.add(call)

    initiator = CallParticipant(
        id=str(uuid.uuid4()),
        call_id=call.id,
        user_id=user.id,
        role="HOST",
        joined_at=datetime.utcnow(),
    )
    db.add(initiator)

    for pid in body.participants:
        p = CallParticipant(
            id=str(uuid.uuid4()),
            call_id=call.id,
            user_id=pid,
            role="PARTICIPANT",
        )
        db.add(p)

    await db.commit()
    await db.refresh(call)
    await log_activity(db, user.id, "CREATE", "call", call.id, description=f"Appel {body.call_type} initié")
    return _dict(call)


@router.get("/{call_id}")
async def get_call(call_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
    if not call:
        raise HTTPException(404)
    participants = (await db.execute(
        select(CallParticipant).where(CallParticipant.call_id == call_id)
    )).scalars().all()
    result = _dict(call)
    result["participants"] = [_dict(p) for p in participants]
    return result


@router.patch("/{call_id}")
async def update_call(call_id: str, body: CallUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
    if not call:
        raise HTTPException(404)
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        if data["status"] == "EN_COURS" and not call.started_at:
            call.started_at = datetime.utcnow()
        elif data["status"] == "TERMINE":
            call.ended_at = datetime.utcnow()
            if call.started_at:
                call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())
    for k, v in data.items():
        setattr(call, k, v)
    await db.commit()
    return _dict(call)


@router.post("/{call_id}/join")
async def join_call(call_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
    if not call:
        raise HTTPException(404)
    existing = (await db.execute(
        select(CallParticipant).where(CallParticipant.call_id == call_id, CallParticipant.user_id == user.id)
    )).scalar_one_or_none()
    if existing:
        existing.joined_at = datetime.utcnow()
        existing.left_at = None
    else:
        p = CallParticipant(
            id=str(uuid.uuid4()),
            call_id=call_id,
            user_id=user.id,
            role="PARTICIPANT",
            joined_at=datetime.utcnow(),
        )
        db.add(p)
    call.participant_count = (await db.execute(
        select(func.count()).where(CallParticipant.call_id == call_id, CallParticipant.left_at.is_(None))
    )).scalar() or 0
    await db.commit()
    return {"ok": True, "room_id": call.room_id}


@router.post("/{call_id}/leave")
async def leave_call(call_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    p = (await db.execute(
        select(CallParticipant).where(CallParticipant.call_id == call_id, CallParticipant.user_id == user.id)
    )).scalar_one_or_none()
    if p:
        p.left_at = datetime.utcnow()
    call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
    if call:
        active = (await db.execute(
            select(func.count()).where(CallParticipant.call_id == call_id, CallParticipant.left_at.is_(None))
        )).scalar() or 0
        call.participant_count = active
        if active == 0:
            call.status = "TERMINE"
            call.ended_at = datetime.utcnow()
            if call.started_at:
                call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())
    await db.commit()
    return {"ok": True}


@router.post("/{call_id}/screen-share")
async def toggle_screen_share(call_id: str, active: bool = True, db: AsyncSession = Depends(get_db), user=Depends(require_staff)):
    p = (await db.execute(
        select(CallParticipant).where(CallParticipant.call_id == call_id, CallParticipant.user_id == user.id)
    )).scalar_one_or_none()
    if not p:
        raise HTTPException(404)
    p.is_screen_sharing = active
    call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
    if call and active:
        call.screen_share_active = True
    await db.commit()
    return {"ok": True}


# ── Presence ─────────────────────────────────────────────────

@router.get("/presence")
async def list_presence(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    rows = (await db.execute(select(UserPresence))).scalars().all()
    return [_dict(r) for r in rows]


@router.put("/presence/me")
async def update_my_presence(body: PresenceUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    pres = (await db.execute(
        select(UserPresence).where(UserPresence.user_id == user.id)
    )).scalar_one_or_none()
    if pres:
        pres.status = body.status
        pres.status_message = body.status_message
        pres.current_activity = body.current_activity
        pres.last_seen = datetime.utcnow()
    else:
        pres = UserPresence(
            id=str(uuid.uuid4()),
            user_id=user.id,
            status=body.status,
            status_message=body.status_message,
            current_activity=body.current_activity,
            last_seen=datetime.utcnow(),
        )
        db.add(pres)
    await db.commit()
    return _dict(pres)


@router.get("/presence/{user_id}")
async def get_presence(user_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    pres = (await db.execute(
        select(UserPresence).where(UserPresence.user_id == user_id)
    )).scalar_one_or_none()
    if not pres:
        return {"user_id": user_id, "status": "OFFLINE"}
    return _dict(pres)
