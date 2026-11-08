"""Assistant du site (Claude) : conversations de l'équipe éditoriale, historique exact des échanges avec le modèle
(rejoué tel quel à chaque tour), et journal des actions — appliquées d'office (brouillons) ou proposées à la
validation humaine (tout ce que voient les visiteurs)."""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import Index
from sqlalchemy.orm import Mapped

from app.core.database import Base, Timestamps, UUIDPk, dt_col, fk, int_col, json_col, str_col, text_col
from app.core.utils import utcnow

_lock = threading.Lock()
_last: datetime | None = None


def stamp() -> datetime:
    """Horodatage strictement croissant : l'ordre du fil est celui de l'écriture, même dans une transaction."""
    global _last
    with _lock:
        now = utcnow()
        _last = now if _last is None or now > _last else _last + timedelta(microseconds=1)
        return _last


class SiteAssistantSession(UUIDPk, Timestamps, Base):
    __tablename__ = "site_assistant_sessions"
    __table_args__ = (Index("ix_site_assistant_sessions_user", "user_id", "updated_at"),)

    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE", index=False)
    title: Mapped[str] = str_col(200, nullable=False, default="Nouvelle demande")
    # idle (en attente d'une consigne) / running (Claude travaille) / error (dernier tour en échec)
    state: Mapped[str] = str_col(20, nullable=False, default="idle")
    error: Mapped[str | None] = text_col()
    # Historique Messages API exact (blocs de contenu tels que renvoyés) : rejoué sans modification.
    transcript: Mapped[list[Any]] = json_col(list)
    input_tokens: Mapped[int] = int_col(0)
    output_tokens: Mapped[int] = int_col(0)
    model: Mapped[str | None] = str_col(60)
    last_run_at: Mapped[datetime | None] = dt_col()
    archived_at: Mapped[datetime | None] = dt_col()


class SiteAssistantMessage(UUIDPk, Timestamps, Base):
    """Fil lisible de la conversation (consignes, réponses de Claude, étapes de travail)."""

    __tablename__ = "site_assistant_messages"
    __table_args__ = (Index("ix_site_assistant_messages_session", "session_id", "created_at"),)

    session_id: Mapped[uuid.UUID] = fk("site_assistant_sessions.id", nullable=False, ondelete="CASCADE", index=False)
    role: Mapped[str] = str_col(20, nullable=False)  # user / assistant / step
    text: Mapped[str | None] = text_col()
    # Pièces jointes : [{"kind": "image"|"document"|"text", "name", "media_id"?, "file_id"?, "size"}]
    attachments: Mapped[list[Any]] = json_col(list)


class SiteAssistantAction(UUIDPk, Timestamps, Base):
    """Une opération demandée par Claude : appliquée d'office (brouillon) ou proposée, puis appliquée / rejetée."""

    __tablename__ = "site_assistant_actions"
    __table_args__ = (Index("ix_site_assistant_actions_session", "session_id", "status"),)

    session_id: Mapped[uuid.UUID] = fk("site_assistant_sessions.id", nullable=False, ondelete="CASCADE", index=False)
    tool: Mapped[str] = str_col(60, nullable=False)
    summary: Mapped[str] = str_col(400, nullable=False)
    payload: Mapped[dict[str, Any]] = json_col(dict)
    target_type: Mapped[str | None] = str_col(40)
    target_id: Mapped[str | None] = str_col(80)
    target_label: Mapped[str | None] = str_col(300)
    # applied (appliquée d'office) / proposed / accepted (appliquée par une personne) / rejected / failed
    status: Mapped[str] = str_col(20, nullable=False, default="proposed")
    result: Mapped[dict[str, Any]] = json_col(dict)
    error: Mapped[str | None] = text_col()
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()


__all__ = ["SiteAssistantAction", "SiteAssistantMessage", "SiteAssistantSession", "stamp"]
