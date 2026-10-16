"""Jumeau numérique de chantier (innovation I1) : avancement réel mesuré à partir des photos du chantier
comparées au planning et à la maquette (zones BIM), validé par l'équipe puis certifié."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, json_col, str_col, text_col


class ProgressObservation(UUIDPk, Timestamps, Base):
    __tablename__ = "progress_observations"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    zone_id: Mapped[uuid.UUID | None] = fk("spatial_zones.id")
    observed_on: Mapped[date] = mapped_column(Date, nullable=False)
    media_ids: Mapped[list[Any]] = json_col(list)
    results: Mapped[list[Any]] = json_col(list)  # [{task_id, title, planned_pct, declared_pct, observed_pct, …}]
    summary: Mapped[str | None] = text_col()
    anomalies: Mapped[list[Any]] = json_col(list)
    overall_observed_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    ai_used: Mapped[bool] = bool_col(True)
    status: Mapped[str] = str_col(20, nullable=False, default="pending", index=True)  # pending / validated / rejected
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    decision_note: Mapped[str | None] = text_col()
    proof_code: Mapped[str | None] = str_col(40)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


__all__ = ["ProgressObservation"]
