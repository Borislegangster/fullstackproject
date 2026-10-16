"""Synchronisation hors ligne (§14.3) : file de mutations idempotentes avec version serveur connue et
détection de conflit (résolution manuelle pour les données critiques, V4-DATA-32)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Index, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, UUIDPk, dt_col, fk, int_col, json_col, str_col, text_col
from app.core.utils import utcnow


class SyncMutation(UUIDPk, Base):
    __tablename__ = "sync_mutations"
    __table_args__ = (Index("ix_sync_mutations_user_status", "user_id", "status"),)

    client_mutation_id: Mapped[str] = str_col(
        80, nullable=False, unique=True
    )  # clé d'idempotence générée sur l'appareil
    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, index=False)
    device_id: Mapped[str | None] = str_col(120)
    entity: Mapped[str] = str_col(40, nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    operation: Mapped[str] = str_col(10, nullable=False)  # create / update / delete / action
    base_version: Mapped[int | None] = mapped_column(nullable=True)
    payload: Mapped[dict[str, Any]] = json_col(dict)
    status: Mapped[str] = str_col(20, nullable=False, default="applied")  # applied / conflict / rejected / resolved
    result: Mapped[dict[str, Any]] = json_col(dict)
    conflict: Mapped[dict[str, Any]] = json_col(dict)  # {"server_version", "server_data", "fields"}
    error: Mapped[str | None] = text_col()
    client_created_at: Mapped[datetime | None] = dt_col()
    received_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    resolved_at: Mapped[datetime | None] = dt_col()
    resolved_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    resolution: Mapped[str | None] = str_col(20)  # client_wins / server_wins / merged / discarded
    attempts: Mapped[int] = int_col(1)


__all__ = ["SyncMutation"]
