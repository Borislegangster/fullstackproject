"""Journal de chantier vidéo (innovation R2) : caméras 4G de chantier (photos périodiques) et time-lapse
hebdomadaire généré automatiquement, envoyé au client le lundi."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, int_col, str_col, text_col


class SiteCamera(UUIDPk, Timestamps, Base):
    """Caméra 4G autonome : dépose une photo à intervalle régulier avec son jeton (jamais un compte utilisateur)."""

    __tablename__ = "site_cameras"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(120, nullable=False)
    token_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    token_hint: Mapped[str] = str_col(8, nullable=False)
    active: Mapped[bool] = bool_col(True)
    last_seen_at: Mapped[datetime | None] = dt_col()
    snapshots: Mapped[int] = int_col(0)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class Timelapse(UUIDPk, Timestamps, Base):
    __tablename__ = "timelapses"
    __table_args__ = (UniqueConstraint("project_id", "period_start", "period_end"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    poster_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    frames: Mapped[int] = int_col(0)
    duration_s: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, default=Decimal("0"), server_default="0")
    source: Mapped[str] = str_col(20, nullable=False, default="photos")  # camera / photos
    status: Mapped[str] = str_col(20, nullable=False, default="ready")  # ready / failed
    error: Mapped[str | None] = text_col()
    published_to_client: Mapped[bool] = bool_col(True)
    sent_at: Mapped[datetime | None] = dt_col()
    generated_by: Mapped[str] = str_col(20, nullable=False, default="schedule")  # schedule / user


__all__ = ["SiteCamera", "Timelapse"]
