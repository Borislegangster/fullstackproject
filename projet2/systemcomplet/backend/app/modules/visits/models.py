"""Visite immersive partageable (innovation R5) : lien sécurisé vers une photo / vidéo 360°, une visite virtuelle ou
la maquette 3D du projet, à partager avec la famille (sans compte), avec expiration, code PIN facultatif et
révocation."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.orm import Mapped

from app.core.database import Base, Timestamps, UUIDPk, dt_col, fk, int_col, str_col


class ImmersiveShare(UUIDPk, Timestamps, Base):
    __tablename__ = "immersive_shares"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    content_type: Mapped[str] = str_col(20, nullable=False)  # immersive / model
    content_id: Mapped[uuid.UUID | None] = fk("immersive_contents.id", index=False, ondelete="CASCADE")
    model_id: Mapped[uuid.UUID | None] = fk("configurator_models.id", index=False, ondelete="CASCADE")
    title: Mapped[str] = str_col(200, nullable=False)
    message: Mapped[str | None] = str_col(500)  # mot d'accueil affiché aux invités
    token_hash: Mapped[str] = str_col(64, nullable=False, unique=True)
    token_hint: Mapped[str] = str_col(8, nullable=False)
    pin_hash: Mapped[str | None] = str_col(64)
    pin_failures: Mapped[int] = int_col(0)
    expires_at: Mapped[datetime] = dt_col(nullable=False)
    max_views: Mapped[int | None] = int_col(None, nullable=True)
    views: Mapped[int] = int_col(0)
    last_viewed_at: Mapped[datetime | None] = dt_col()
    revoked_at: Mapped[datetime | None] = dt_col()
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


__all__ = ["ImmersiveShare"]
