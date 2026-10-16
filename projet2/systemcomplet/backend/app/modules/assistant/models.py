"""Assistant GLOBUS : conversations du widget de la vitrine et du canal WhatsApp (innovation A1) — consentement,
lead créé, page d'origine, client reconnu, reprise par un conseiller."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, dt_col, fk, json_col, str_col
from app.core.security import EncryptedString


class AssistantConversation(UUIDPk, Timestamps, Base):
    __tablename__ = "assistant_conversations"
    __table_args__ = (Index("ix_assistant_conversations_contact", "channel", "contact_hash"),)

    channel: Mapped[str] = str_col(20, nullable=False, default="web")  # web / whatsapp
    messages: Mapped[list[Any]] = json_col(list)  # [{"role": "user"|"assistant"|"agent", "content": str, "at": iso}]
    page_path: Mapped[str | None] = str_col(250)
    ip_hash: Mapped[str | None] = str_col(64, index=True)
    contact_hash: Mapped[str | None] = str_col(64)  # empreinte du numéro WhatsApp (recherche sans clair)
    contact_phone: Mapped[str | None] = mapped_column(EncryptedString, nullable=True)  # chiffré : réponse du conseiller
    contact_name: Mapped[str | None] = str_col(150)
    user_id: Mapped[uuid.UUID | None] = fk("users.id")  # client reconnu par son numéro
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    state: Mapped[dict[str, Any]] = json_col(dict)  # attente de consentement, projet choisi…
    mode: Mapped[str] = str_col(20, nullable=False, default="rules")  # rules / ai / human
    human_until: Mapped[datetime | None] = dt_col()  # reprise par un conseiller : l'assistant se tait
    handled_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    last_message_at: Mapped[datetime | None] = dt_col(index=True)
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    status: Mapped[str] = str_col(20, nullable=False, default="open")  # open / lead / handoff / closed


__all__ = ["AssistantConversation"]
