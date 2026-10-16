"""Planning intelligent (innovation A4) : risques de retard détectés (pluie, livraison, absence, dépendance) avec
proposition de replanification, et prévisions météo mises en cache par zone."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, dt_col, fk, json_col, str_col, text_col
from app.core.utils import utcnow


class ScheduleRisk(UUIDPk, Timestamps, Base):
    __tablename__ = "schedule_risks"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    task_id: Mapped[uuid.UUID] = fk("tasks.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(20, nullable=False)  # weather / season / supply / absence / dependency
    severity: Mapped[str] = str_col(10, nullable=False, default="medium")  # low / medium / high
    title: Mapped[str] = str_col(250, nullable=False)
    detail: Mapped[str] = text_col(nullable=False)
    evidence: Mapped[dict[str, Any]] = json_col(dict)
    suggestion: Mapped[dict[str, Any]] = json_col(dict)  # {new_start, new_end, shift_days, note}
    status: Mapped[str] = str_col(
        20, nullable=False, default="open", index=True
    )  # open / applied / dismissed / resolved
    fingerprint: Mapped[str] = str_col(64, nullable=False, unique=True)
    last_detected_at: Mapped[datetime | None] = dt_col()
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    decision_note: Mapped[str | None] = text_col()


class WeatherForecast(UUIDPk, Base):
    __tablename__ = "weather_forecasts"
    __table_args__ = (UniqueConstraint("zone", "day"),)

    zone: Mapped[str] = str_col(24, nullable=False)  # « lat,lon » arrondis à 0,1° (≈ 11 km)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    precipitation_mm: Mapped[Decimal] = mapped_column(Numeric(6, 1), nullable=False, default=Decimal("0"))
    probability: Mapped[int | None] = mapped_column(nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


__all__ = ["ScheduleRisk", "WeatherForecast"]
