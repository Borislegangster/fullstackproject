"""Hub temps réel : présence, salons (conversation / projet / BIM / appel), diffusion multi-processus
via Redis pub/sub (repli mémoire mono-processus en développement).

Le code synchrone (endpoints, worker) publie via `publish_user` / `publish_room` ; la diffusion est
faite sur la boucle asyncio principale.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

from starlette.websockets import WebSocket, WebSocketState

from app.core import metrics
from app.core.config import settings
from app.core.utils import jsonable, utcnow

log = logging.getLogger("globus.realtime")
CHANNEL = "globus:realtime"


@dataclass(eq=False)
class Connection:
    ws: WebSocket
    user_id: str
    application: str = "web"
    rooms: set[str] = field(default_factory=set)
    id: str = field(default_factory=lambda: uuid.uuid4().hex)

    async def send(self, message: dict[str, Any]) -> bool:
        if self.ws.application_state != WebSocketState.CONNECTED:
            return False
        try:
            await self.ws.send_text(json.dumps(message, default=str, ensure_ascii=False))
            return True
        except Exception:  # noqa: BLE001
            return False


class Hub:
    def __init__(self) -> None:
        self.users: dict[str, set[Connection]] = defaultdict(set)
        self.rooms: dict[str, set[Connection]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None
        self._redis: Any = None
        self._listener: asyncio.Task[Any] | None = None
        self.instance_id = uuid.uuid4().hex

    # ------------------------------------------------------------------ cycle de vie
    async def start(self) -> None:
        self.loop = asyncio.get_running_loop()
        if settings.REDIS_URL:
            try:
                import redis.asyncio as aioredis

                self._redis = aioredis.from_url(settings.REDIS_URL)
                await self._redis.ping()
                self._listener = asyncio.create_task(self._listen())
                log.info("realtime_redis_enabled")
            except Exception:  # noqa: BLE001
                log.warning("realtime_redis_unavailable_fallback_memory")
                self._redis = None

    async def stop(self) -> None:
        if self._listener:
            self._listener.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._listener
        if self._redis is not None:
            with contextlib.suppress(Exception):
                await self._redis.aclose()

    async def _listen(self) -> None:
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        async for item in pubsub.listen():
            if item.get("type") != "message":
                continue
            try:
                envelope = json.loads(item["data"])
            except (TypeError, ValueError):
                continue
            await self._deliver_local(envelope)

    # ------------------------------------------------------------------ connexions
    async def register(self, conn: Connection) -> None:
        first = not self.users.get(conn.user_id)
        self.users[conn.user_id].add(conn)
        await self.join(conn, f"user:{conn.user_id}")
        metrics.ws_connections.inc()
        if first:
            await self.broadcast_presence(conn.user_id, "online")

    async def unregister(self, conn: Connection) -> None:
        for room in list(conn.rooms):
            self.rooms[room].discard(conn)
            if not self.rooms[room]:
                self.rooms.pop(room, None)
        self.users[conn.user_id].discard(conn)
        metrics.ws_connections.dec()
        if not self.users[conn.user_id]:
            self.users.pop(conn.user_id, None)
            await self.broadcast_presence(conn.user_id, "offline")

    async def join(self, conn: Connection, room: str) -> None:
        conn.rooms.add(room)
        self.rooms[room].add(conn)

    async def leave(self, conn: Connection, room: str) -> None:
        conn.rooms.discard(room)
        self.rooms[room].discard(conn)

    def is_online(self, user_id: str) -> bool:
        return bool(self.users.get(str(user_id)))

    def online_users(self) -> list[str]:
        return list(self.users.keys())

    def room_members(self, room: str) -> list[str]:
        return sorted({c.user_id for c in self.rooms.get(room, set())})

    async def broadcast_presence(self, user_id: str, status: str) -> None:
        await self.emit(
            {
                "target": "room",
                "room": "presence",
                "message": {
                    "type": "presence",
                    "data": {"user_id": user_id, "status": status, "at": utcnow().isoformat()},
                },
            }
        )
        try:
            from starlette.concurrency import run_in_threadpool

            await run_in_threadpool(_persist_presence, user_id, status)
        except Exception:  # noqa: BLE001
            log.debug("presence_persist_failed")

    # ------------------------------------------------------------------ diffusion
    async def emit(self, envelope: dict[str, Any], *, exclude: str | None = None) -> None:
        envelope = {**envelope, "exclude": exclude}
        if self._redis is not None:
            try:
                await self._redis.publish(CHANNEL, json.dumps(envelope, default=str))
                return
            except Exception:  # noqa: BLE001
                log.warning("realtime_redis_publish_failed")
        await self._deliver_local(envelope)

    async def _deliver_local(self, envelope: dict[str, Any]) -> None:
        message = envelope.get("message") or {}
        exclude = envelope.get("exclude")
        if envelope.get("target") == "user":
            targets = set(self.users.get(str(envelope.get("user_id")), set()))
        else:
            targets = set(self.rooms.get(str(envelope.get("room")), set()))
        dead: list[Connection] = []
        for conn in targets:
            if exclude and conn.id == exclude:
                continue
            if not await conn.send(message):
                dead.append(conn)
        for conn in dead:
            await self.unregister(conn)

    # ------------------------------------------------------------------ API synchrone (threads)
    def _submit(self, envelope: dict[str, Any]) -> None:
        if self.loop is None or self.loop.is_closed():
            if settings.REDIS_URL:
                _sync_redis_publish(envelope)
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self.loop:
            self.loop.create_task(self.emit(envelope))
        else:
            asyncio.run_coroutine_threadsafe(self.emit(envelope), self.loop)


hub = Hub()


def _sync_redis_publish(envelope: dict[str, Any]) -> None:
    try:
        import redis

        redis.Redis.from_url(settings.REDIS_URL or "", socket_timeout=1).publish(
            CHANNEL, json.dumps(envelope, default=str)
        )
    except Exception:  # noqa: BLE001
        log.warning("realtime_sync_publish_failed")


def _persist_presence(user_id: str, status: str) -> None:
    from app.core.database import SessionLocal
    from app.modules.communications.models import Presence

    db = SessionLocal()
    try:
        uid = uuid.UUID(user_id)
        row = db.get(Presence, uid)
        if row is None:
            row = Presence(user_id=uid)
            db.add(row)
        row.status = status
        row.last_seen_at = utcnow()
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()


def publish_user(user_id: Any, event_type: str, data: dict[str, Any] | None = None) -> None:
    hub._submit(
        {"target": "user", "user_id": str(user_id), "message": {"type": event_type, "data": jsonable(data or {})}}
    )


def publish_room(room: str, event_type: str, data: dict[str, Any] | None = None) -> None:
    hub._submit({"target": "room", "room": room, "message": {"type": event_type, "data": jsonable(data or {})}})
