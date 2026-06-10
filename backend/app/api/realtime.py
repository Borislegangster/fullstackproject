"""Real-time WebSocket endpoints — notifications + messaging.

The Phase 5 collaboration WebSocket lives in `api/collaboration.py` because it
has its own packet protocol. This module covers the two simpler real-time
channels every authenticated user needs:

    GET /ws/notifications?token=<jwt>
        Per-user pipe. Whenever a Notification row is inserted server-side, a
        packet { type: "NOTIFICATION_CREATED", payload: {...} } is pushed.

    GET /ws/messaging/{project_id}?token=<jwt>
        Per-project pipe. Broadcasts:
            MESSAGE_CREATED  - new chat message
            TYPING_START     - someone is typing
            TYPING_STOP      - someone stopped
"""
from __future__ import annotations

from typing import Dict, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import decode_access_token
from app.database import AsyncSessionLocal, get_db
from app.models.erp import Conversation, ConversationParticipant

router = APIRouter(tags=["Real-time"])


# ══════════════════════════════════════════════════════════════
# NOTIFICATION CHANNEL — one room per user_id
# ══════════════════════════════════════════════════════════════

class NotificationHub:
    """In-process pub/sub for notifications.

    For a multi-instance deployment, swap the dict for a Redis pub/sub layer
    (see Phase 8 polish).
    """

    def __init__(self) -> None:
        # user_id → set of WebSocket connections
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        room = self.rooms.get(user_id)
        if not room:
            return
        room.discard(ws)
        if not room:
            self.rooms.pop(user_id, None)

    async def push(self, user_id: str, packet: dict) -> None:
        room = self.rooms.get(user_id)
        if not room:
            return
        dead: list[WebSocket] = []
        for ws in room:
            try:
                await ws.send_json(packet)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)


# Global hub instance shared with notification_service
notification_hub = NotificationHub()


@router.websocket("/ws/notifications")
async def notifications_ws(websocket: WebSocket, token: str):
    """Per-user notifications channel."""
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Token invalide")
            return
    except HTTPException:
        await websocket.close(code=4001, reason="Token invalide")
        return

    async with AsyncSessionLocal() as db:
        user_r = await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
        if not user_r.scalars().first():
            await websocket.close(code=4001, reason="Utilisateur introuvable")
            return

    await notification_hub.connect(user_id, websocket)
    try:
        # Hold the connection open — we don't expect inbound packets but support
        # client pings to keep proxies from idling out.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_hub.disconnect(user_id, websocket)
    except Exception:
        notification_hub.disconnect(user_id, websocket)


# ══════════════════════════════════════════════════════════════
# MESSAGING CHANNEL — one room per project's conversation
# ══════════════════════════════════════════════════════════════

class MessagingHub:
    """Per-conversation pub/sub including typing indicators."""

    def __init__(self) -> None:
        # conversation_id → {user_id: WebSocket}
        self.rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, conv_id: str, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms.setdefault(conv_id, {})[user_id] = ws

    def disconnect(self, conv_id: str, user_id: str) -> None:
        room = self.rooms.get(conv_id)
        if not room:
            return
        room.pop(user_id, None)
        if not room:
            self.rooms.pop(conv_id, None)

    async def broadcast(self, conv_id: str, packet: dict, exclude_user: str | None = None) -> None:
        room = self.rooms.get(conv_id)
        if not room:
            return
        dead: list[str] = []
        for uid, ws in room.items():
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(packet)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(conv_id, uid)


messaging_hub = MessagingHub()


async def _resolve_conversation_for_project(
    db: AsyncSession, project_id: str, user_id: str
) -> Conversation | None:
    """Return the conversation row + verify the user participates in it."""
    conv_r = await db.execute(
        select(Conversation).where(Conversation.project_id == project_id)
    )
    conv = conv_r.scalars().first()
    if not conv:
        return None
    part_r = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conv.id,
            ConversationParticipant.user_id == user_id,
        )
    )
    if not part_r.scalars().first():
        # Auto-add the requester as a participant — useful when a CLIENT joins
        # via the live channel before their first /messages POST.
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=user_id))
        await db.commit()
    return conv


@router.websocket("/ws/messaging/{project_id}")
async def messaging_ws(websocket: WebSocket, project_id: str, token: str):
    """Per-conversation channel. Supports TYPING_START/STOP packets in
    addition to consuming MESSAGE_CREATED broadcasts."""
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Token invalide")
            return
    except HTTPException:
        await websocket.close(code=4001, reason="Token invalide")
        return

    async with AsyncSessionLocal() as db:
        conv = await _resolve_conversation_for_project(db, project_id, user_id)
        if not conv:
            await websocket.close(code=4004, reason="Conversation introuvable")
            return

    await messaging_hub.connect(conv.id, user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            import json
            try:
                packet = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if packet.get("type") in ("TYPING_START", "TYPING_STOP"):
                # Relay only — no DB persistence for typing
                await messaging_hub.broadcast(
                    conv.id,
                    {
                        "type": packet["type"],
                        "payload": {"user_id": user_id},
                    },
                    exclude_user=user_id,
                )
    except WebSocketDisconnect:
        messaging_hub.disconnect(conv.id, user_id)
    except Exception:
        messaging_hub.disconnect(conv.id, user_id)
