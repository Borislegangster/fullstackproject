"""Idempotence des mutations critiques (en-tête `Idempotency-Key`, V4-DATA-33).

Usage dans un endpoint :

    def create(..., idem: Idempotency = Depends(idempotency(required=True)), db=Depends(get_db)):
        if idem.replay is not None:
            return idem.replay
        result = ...
        return idem.complete(db, result, status_code=201)

La clé est réservée de façon atomique (INSERT … ON CONFLICT DO NOTHING) ; un rejeu identique renvoie
la réponse mémorisée ; un rejeu avec un corps différent est refusé (409) ; un échec libère la clé.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from fastapi import Header, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.database import SessionLocal
from app.core.errors import AppError, Conflict
from app.core.utils import utcnow
from app.modules.system.models import IdempotencyKey

TTL = timedelta(hours=48)


@dataclass
class Idempotency:
    key: str | None
    scope: str
    record_id: Any = None
    replay: JSONResponse | None = None
    completed: bool = False

    def complete(self, db: Session, result: Any, *, status_code: int = 200) -> JSONResponse:
        """Mémorise la réponse dans la même transaction que l'opération métier puis valide."""
        body = jsonable_encoder(result)
        if self.key and self.record_id is not None:
            row = db.get(IdempotencyKey, self.record_id)
            if row is not None:
                row.status = "completed"
                row.status_code = status_code
                row.response = body if isinstance(body, dict) else {"__list__": body}
        db.commit()
        self.completed = True
        return JSONResponse(content=body, status_code=status_code)


def _request_hash(method: str, path: str, raw: bytes) -> str:
    try:
        canonical = json.dumps(json.loads(raw or b"{}"), sort_keys=True, separators=(",", ":")).encode()
    except (ValueError, UnicodeDecodeError):
        canonical = raw
    return hashlib.sha256(method.encode() + b"|" + path.encode() + b"|" + canonical).hexdigest()


def _reserve(scope: str, key: str, method: str, path: str, req_hash: str) -> Idempotency:
    db = SessionLocal()
    try:
        db.execute(delete(IdempotencyKey).where(IdempotencyKey.expires_at < utcnow()))
        inserted = db.execute(
            insert(IdempotencyKey)
            .values(
                scope=scope,
                key=key,
                method=method,
                path=path,
                request_hash=req_hash,
                status="in_progress",
                expires_at=utcnow() + TTL,
            )
            .on_conflict_do_nothing(index_elements=["scope", "key"])
            .returning(IdempotencyKey.id)
        ).scalar_one_or_none()
        db.commit()
        if inserted is not None:
            return Idempotency(key=key, scope=scope, record_id=inserted)
        existing = db.execute(
            select(IdempotencyKey).where(IdempotencyKey.scope == scope, IdempotencyKey.key == key)
        ).scalar_one()
        if existing.request_hash != req_hash:
            raise Conflict("Idempotency-Key déjà utilisée avec une requête différente", code="IDEMPOTENCY_KEY_MISMATCH")
        if existing.status != "completed":
            raise Conflict("Requête identique en cours de traitement", code="IDEMPOTENCY_IN_PROGRESS")
        content: Any = existing.response or {}
        if isinstance(content, dict) and "__list__" in content:
            content = content["__list__"]
        response = JSONResponse(
            content=content, status_code=existing.status_code or 200, headers={"Idempotent-Replayed": "true"}
        )
        return Idempotency(key=key, scope=scope, record_id=existing.id, replay=response, completed=True)
    finally:
        db.close()


def _release(record_id: Any) -> None:
    db = SessionLocal()
    try:
        row = db.get(IdempotencyKey, record_id)
        if row is not None and row.status == "in_progress":
            db.delete(row)
            db.commit()
    finally:
        db.close()


def idempotency(*, required: bool = False) -> Callable[..., Any]:
    async def dependency(
        request: Request,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> AsyncIterator[Idempotency]:
        from app.core.deps import optional_scope_key  # import tardif (évite un cycle)

        scope = optional_scope_key(request)
        if not idempotency_key:
            if required:
                raise AppError("En-tête Idempotency-Key requis pour cette opération", code="IDEMPOTENCY_KEY_REQUIRED")
            yield Idempotency(key=None, scope=scope)
            return
        if len(idempotency_key) > 200:
            raise AppError("Idempotency-Key trop longue", code="IDEMPOTENCY_KEY_INVALID")
        raw = await request.body()
        req_hash = _request_hash(request.method, request.url.path, raw)
        idem = await run_in_threadpool(_reserve, scope, idempotency_key, request.method, request.url.path, req_hash)
        try:
            yield idem
        except Exception:
            if idem.record_id is not None and idem.replay is None:
                await run_in_threadpool(_release, idem.record_id)
            raise
        else:
            if idem.record_id is not None and not idem.completed:
                await run_in_threadpool(_release, idem.record_id)

    return dependency
