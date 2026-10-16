"""Rapport de direction hebdomadaire (innovation A7) : indicateurs figés de la semaine, synthèse rédigée (IA si
configurée, règles sinon), PDF diffusé à la Direction chaque lundi."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, json_col, str_col, text_col


class ExecutiveReport(UUIDPk, Timestamps, Base):
    __tablename__ = "executive_reports"
    __table_args__ = (UniqueConstraint("period_start", "period_end"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    data: Mapped[dict[str, Any]] = json_col(dict)
    narrative: Mapped[dict[str, Any]] = json_col(dict)  # {headline, highlights[], risks[], decisions[], outlook}
    ai_generated: Mapped[bool] = bool_col(False)
    summary_text: Mapped[str | None] = text_col()
    pdf_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    generated_by: Mapped[str] = str_col(20, nullable=False, default="schedule")  # schedule / user
    requested_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    sent_at: Mapped[datetime | None] = dt_col()


__all__ = ["ExecutiveReport"]
