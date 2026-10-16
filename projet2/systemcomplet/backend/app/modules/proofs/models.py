"""Preuves opposables (innovation R4) : registre des empreintes certifiées (PV et documents publiés, décisions client,
réceptions de livraison, photos de chantier du jour), vérifiables publiquement par QR code et horodatées via
OpenTimestamps lorsque l'ancrage est activé."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, json_col, str_col, text_col

SUBJECT_TYPES = ("document_version", "decision", "goods_receipt", "photo_day")


class Proof(UUIDPk, Timestamps, Base):
    __tablename__ = "proofs"
    __table_args__ = (UniqueConstraint("subject_type", "subject_id"),)

    number: Mapped[str] = str_col(40, nullable=False, unique=True)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="SET NULL")
    subject_type: Mapped[str] = str_col(30, nullable=False, index=True)
    subject_id: Mapped[str] = str_col(80, nullable=False)
    title: Mapped[str] = str_col(250, nullable=False)
    summary: Mapped[dict[str, Any]] = json_col(dict)  # constats affichables publiquement (aucune donnée sensible)
    sha256: Mapped[str] = str_col(64, nullable=False, index=True)
    algorithm: Mapped[str] = str_col(20, nullable=False, default="sha256")  # sha256 / merkle-sha256
    leaves: Mapped[list[Any]] = json_col(list)  # lots d'empreintes (photos du jour…) : [{"label", "sha256"}]
    public_code: Mapped[str] = str_col(40, nullable=False, unique=True)
    client_visible: Mapped[bool] = bool_col(False)
    anchor_status: Mapped[str] = str_col(20, nullable=False, default="none")  # none / queued / pending / failed
    anchor_receipt: Mapped[dict[str, Any]] = json_col(dict)
    anchored_at: Mapped[datetime | None] = dt_col()
    anchor_error: Mapped[str | None] = text_col()
    revoked_at: Mapped[datetime | None] = dt_col()
    revoked_reason: Mapped[str | None] = text_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


__all__ = ["SUBJECT_TYPES", "Proof"]
