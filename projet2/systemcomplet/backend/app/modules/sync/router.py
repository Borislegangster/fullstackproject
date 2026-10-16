"""API de synchronisation hors ligne (applications mobiles terrain / desktop) : push de mutations idempotentes,
pull incrémental, conflits explicites (V4-DATA-32/33)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.errors import NotFound
from app.core.utils import jsonable, utcnow
from app.modules.sync import service
from app.modules.sync.models import SyncMutation

router = APIRouter(prefix="/sync", tags=["Synchronisation hors ligne"])


class MutationIn(BaseModel):
    client_mutation_id: str = Field(min_length=8, max_length=80)
    entity: str = Field(min_length=2, max_length=40)
    entity_id: uuid.UUID | None = None
    operation: str = Field(pattern="^(create|update|delete|action)$")
    base_version: int | None = Field(default=None, ge=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    client_created_at: datetime | None = None


class PushIn(BaseModel):
    device_id: str | None = Field(default=None, max_length=120)
    mutations: list[MutationIn] = Field(min_length=1, max_length=200)


def _out(row: SyncMutation) -> dict[str, Any]:
    return jsonable(
        {
            "client_mutation_id": row.client_mutation_id,
            "status": row.status,
            "result": row.result,
            "conflict": row.conflict or None,
            "error": row.error,
            "id": row.id,
        }
    )


@router.post("/push")
def push(data: PushIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    results = []
    for mutation in sorted(data.mutations, key=lambda m: m.client_created_at or utcnow()):
        row = service.apply(db, access, mutation.model_dump(), device_id=data.device_id)
        results.append(_out(row))
    db.commit()
    return {
        "server_time": utcnow().isoformat(),
        "results": results,
        "summary": {
            status: sum(1 for r in results if r["status"] == status)
            for status in ("applied", "conflict", "rejected", "resolved")
        },
    }


@router.get("/pull")
def pull(
    project_ids: list[uuid.UUID] = Query(default_factory=list),
    since: datetime | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not project_ids:
        scope = access.project_scope()
        project_ids = list(scope) if scope is not None else []
    return service.pull(db, access, since=since, project_ids=project_ids[:100])


@router.get("/conflicts")
def conflicts(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    rows = db.execute(
        select(SyncMutation)
        .where(SyncMutation.user_id == access.p.id, SyncMutation.status == "conflict")
        .order_by(SyncMutation.received_at)
    ).scalars()
    return [jsonable(serialize(r)) for r in rows]


class ResolveIn(BaseModel):
    resolution: str = Field(pattern="^(client_wins|server_wins|merged)$")
    merged: dict[str, Any] | None = None


@router.post("/conflicts/{mutation_id}/resolve")
def resolve(
    mutation_id: uuid.UUID, data: ResolveIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    row = db.get(SyncMutation, mutation_id)
    if row is None:
        raise NotFound("Conflit introuvable")
    service.resolve(db, access, row, resolution=data.resolution, merged=data.merged)
    db.commit()
    return _out(row)
