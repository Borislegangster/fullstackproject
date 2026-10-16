"""Point d'entrée WebSocket `/ws?ticket=…` : présence, saisie en cours, accusés de lecture, signalisation
WebRTC (SDP/ICE), présence et curseurs BIM, abonnement aux salons autorisés."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from app.core.database import SessionLocal
from app.core.security import decode_token
from app.core.utils import utcnow
from app.websocket.hub import Connection, hub

log = logging.getLogger("globus.ws")
router = APIRouter()


def _authenticate(ticket: str) -> dict[str, Any] | None:
    from app.modules.identity.models import User, UserSession

    try:
        payload = decode_token(ticket, expected_type="ws")
    except jwt.PyJWTError:
        return None
    db = SessionLocal()
    try:
        user = db.get(User, uuid.UUID(payload["sub"]))
        if user is None or not user.is_active:
            return None
        sid = payload.get("sid")
        if sid:
            session = db.get(UserSession, uuid.UUID(sid))
            if session is None or session.revoked_at is not None or session.expires_at < utcnow():
                return None
        perms: set[str] = set()
        for role in user.roles:
            perms.update(role.permission_codes)
        return {
            "user_id": str(user.id),
            "name": user.full_name,
            "permissions": perms,
            "internal": bool(user.organization and user.organization.kind == "internal"),
        }
    finally:
        db.close()


def _can_join(user: dict[str, Any], room: str) -> bool:
    """Autorise l'abonnement à un salon selon le contexte métier (ABAC)."""
    from sqlalchemy import select

    from app.core.access import Access
    from app.core.deps import Principal
    from app.modules.identity.models import User

    kind, _, raw_id = room.partition(":")
    if kind == "presence":
        return True
    try:
        entity_id = uuid.UUID(raw_id.split(":")[0])
    except ValueError:
        return False
    db = SessionLocal()
    try:
        user_obj = db.get(User, uuid.UUID(user["user_id"]))
        if user_obj is None:
            return False
        principal = Principal(
            user=user_obj,
            session_id=None,
            roles=set(user_obj.role_codes),
            permissions=user["permissions"],
            organization_id=user_obj.organization_id,
            org_kind=user_obj.organization.kind if user_obj.organization else None,
            global_scope=any(r.global_scope for r in user_obj.roles),
        )
        access = Access(principal, db)
        if kind == "conversation":
            from app.modules.communications.models import ConversationMember

            return (
                db.execute(
                    select(ConversationMember.id).where(
                        ConversationMember.conversation_id == entity_id, ConversationMember.user_id == user_obj.id
                    )
                ).first()
                is not None
            )
        if kind == "project":
            return access.can_access_project(entity_id)
        if kind == "bim":
            from app.modules.bim.models import BimModel, BimVersion

            version = db.get(BimVersion, entity_id)
            model = db.get(BimModel, version.model_id) if version else None
            return bool(model and "bim:read" in user["permissions"] and access.can_access_project(model.project_id))
        if kind == "call":
            from app.modules.communications.models import CallParticipant

            return (
                db.execute(
                    select(CallParticipant.id).where(
                        CallParticipant.call_id == entity_id, CallParticipant.user_id == user_obj.id
                    )
                ).first()
                is not None
            )
        return False
    finally:
        db.close()


def _relay_allowed(sender: str, call_id: str, target: str) -> bool:
    from sqlalchemy import select

    from app.modules.communications.models import Call, CallParticipant

    db = SessionLocal()
    try:
        cid = uuid.UUID(call_id)
        call = db.get(Call, cid)
        if call is None or call.status in ("ended", "cancelled", "rejected", "missed"):
            return False
        members = set(
            str(u) for u in db.execute(select(CallParticipant.user_id).where(CallParticipant.call_id == cid)).scalars()
        )
        return sender in members and target in members
    except ValueError:
        return False
    finally:
        db.close()


def _mark_read(user_id: str, conversation_id: str, message_id: str | None) -> list[str]:
    from sqlalchemy import select

    from app.modules.communications.models import ConversationMember

    db = SessionLocal()
    try:
        member = db.execute(
            select(ConversationMember).where(
                ConversationMember.conversation_id == uuid.UUID(conversation_id),
                ConversationMember.user_id == uuid.UUID(user_id),
            )
        ).scalar_one_or_none()
        if member is None:
            return []
        member.last_read_at = utcnow()
        if message_id:
            member.last_read_message_id = uuid.UUID(message_id)
        db.commit()
        return [conversation_id]
    except ValueError:
        return []
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    ticket = ws.query_params.get("ticket", "")
    user = await run_in_threadpool(_authenticate, ticket)
    if user is None:
        await ws.close(code=4401)
        return
    await ws.accept()
    application = ws.query_params.get("app", "web")[:40]
    conn = Connection(ws=ws, user_id=user["user_id"], application=application)
    await hub.register(conn)
    await hub.join(conn, "presence")
    await conn.send({"type": "ready", "data": {"user_id": user["user_id"], "online": hub.online_users()}})
    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=75)
            except TimeoutError:
                await conn.send({"type": "ping"})
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            mtype = msg.get("type")
            data = msg.get("data") or {}
            if mtype == "ping":
                await conn.send({"type": "pong"})
            elif mtype == "join":
                room = str(data.get("room", ""))[:120]
                ok = await run_in_threadpool(_can_join, user, room)
                if ok:
                    await hub.join(conn, room)
                    await conn.send({"type": "joined", "data": {"room": room, "members": hub.room_members(room)}})
                    if room.startswith("bim:"):
                        await hub.emit(
                            {
                                "target": "room",
                                "room": room,
                                "message": {
                                    "type": "bim.presence",
                                    "data": {"user_id": user["user_id"], "name": user["name"], "status": "joined"},
                                },
                            },
                            exclude=conn.id,
                        )
                else:
                    await conn.send({"type": "error", "data": {"code": "ROOM_FORBIDDEN", "room": room}})
            elif mtype == "leave":
                room = str(data.get("room", ""))
                await hub.leave(conn, room)
                if room.startswith("bim:"):
                    await hub.emit(
                        {
                            "target": "room",
                            "room": room,
                            "message": {"type": "bim.presence", "data": {"user_id": user["user_id"], "status": "left"}},
                        }
                    )
            elif mtype == "typing":
                room = f"conversation:{data.get('conversation_id')}"
                if room in conn.rooms:
                    await hub.emit(
                        {
                            "target": "room",
                            "room": room,
                            "message": {
                                "type": "typing",
                                "data": {
                                    "conversation_id": data.get("conversation_id"),
                                    "user_id": user["user_id"],
                                    "name": user["name"],
                                    "typing": bool(data.get("typing", True)),
                                },
                            },
                        },
                        exclude=conn.id,
                    )
            elif mtype == "read":
                conv = str(data.get("conversation_id", ""))
                done = await run_in_threadpool(_mark_read, user["user_id"], conv, data.get("message_id"))
                if done:
                    await hub.emit(
                        {
                            "target": "room",
                            "room": f"conversation:{conv}",
                            "message": {
                                "type": "read",
                                "data": {
                                    "conversation_id": conv,
                                    "user_id": user["user_id"],
                                    "message_id": data.get("message_id"),
                                    "at": utcnow().isoformat(),
                                },
                            },
                        }
                    )
            elif mtype == "call.signal":
                call_id, target = str(data.get("call_id", "")), str(data.get("to", ""))
                if await run_in_threadpool(_relay_allowed, user["user_id"], call_id, target):
                    await hub.emit(
                        {
                            "target": "user",
                            "user_id": target,
                            "message": {
                                "type": "call.signal",
                                "data": {"call_id": call_id, "from": user["user_id"], "signal": data.get("signal")},
                            },
                        }
                    )
            elif mtype in ("bim.cursor", "bim.camera", "bim.selection"):
                room = f"bim:{data.get('version_id')}"
                if room in conn.rooms:
                    await hub.emit(
                        {
                            "target": "room",
                            "room": room,
                            "message": {
                                "type": mtype,
                                "data": {**data, "user_id": user["user_id"], "name": user["name"]},
                            },
                        },
                        exclude=conn.id,
                    )
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("ws_error")
    finally:
        await hub.unregister(conn)
