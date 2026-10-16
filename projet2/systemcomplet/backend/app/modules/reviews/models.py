"""Avis clients vérifiés (innovation R6) : invitations nominatives envoyées à la remise des clés ; l'avis déposé
devient un témoignage « vérifié » (client réel d'un chantier réel), publié après modération et consentement."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, dt_col, fk, json_col, str_col, text_col


class ReviewInvitation(UUIDPk, Timestamps, Base):
    __tablename__ = "review_invitations"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    user_id: Mapped[uuid.UUID | None] = fk("users.id", ondelete="SET NULL")
    recipient_name: Mapped[str] = str_col(200, nullable=False)
    token_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    channels: Mapped[list[Any]] = json_col(list)
    status: Mapped[str] = str_col(20, nullable=False, default="sent", index=True)  # sent / opened / completed / expired
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    opened_at: Mapped[datetime | None] = dt_col()
    completed_at: Mapped[datetime | None] = dt_col()
    reminded_at: Mapped[datetime | None] = dt_col()
    rating: Mapped[int | None] = mapped_column(nullable=True)  # conservé même sans consentement de publication
    comment: Mapped[str | None] = text_col()
    consent_publish: Mapped[bool | None] = mapped_column(nullable=True)
    testimonial_id: Mapped[uuid.UUID | None] = fk("cms_testimonials.id", ondelete="SET NULL")
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


__all__ = ["ReviewInvitation"]
