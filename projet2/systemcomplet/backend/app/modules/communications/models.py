"""Communication unifiée : Conversation, ConversationMember, Message, Attachment, Call, CallParticipant,
Presence (§13)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, Integer, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    Timestamps,
    UUIDPk,
    bool_col,
    dt_col,
    fk,
    json_col,
    str_col,
    text_col,
)
from app.core.utils import utcnow


class Conversation(UUIDPk, Timestamps, Base):
    __tablename__ = "conversations"

    kind: Mapped[str] = str_col(
        20, nullable=False, default="group"
    )  # direct / group / project / trade / issue / support / client
    title: Mapped[str | None] = str_col(200)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")
    trade: Mapped[str | None] = str_col(60)  # canal par corps d'état
    issue_id: Mapped[uuid.UUID | None] = fk("bim_issues.id")
    direct_key: Mapped[str | None] = str_col(80, unique=True)  # pour les 1:1 (ids triés)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    last_message_at: Mapped[datetime | None] = dt_col(index=True)
    is_archived: Mapped[bool] = bool_col(False)

    members: Mapped[list[ConversationMember]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class ConversationMember(UUIDPk, Base):
    __tablename__ = "conversation_members"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id"),)

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False, ondelete="CASCADE")
    role: Mapped[str] = str_col(20, nullable=False, default="member")
    last_read_at: Mapped[datetime | None] = dt_col()
    last_read_message_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    muted: Mapped[bool] = bool_col(False)
    joined_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class Message(UUIDPk, Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_created", "conversation_id", "created_at"),)

    conversation_id: Mapped[uuid.UUID] = fk("conversations.id", nullable=False, ondelete="CASCADE", index=False)
    sender_id: Mapped[uuid.UUID | None] = fk("users.id")
    kind: Mapped[str] = str_col(
        20, nullable=False, default="text"
    )  # text / file / image / plan / document / system / call
    body: Mapped[str | None] = text_col()
    reply_to_id: Mapped[uuid.UUID | None] = fk("messages.id", index=False)
    meta: Mapped[dict[str, Any]] = json_col(dict)
    client_message_id: Mapped[str | None] = str_col(80, unique=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    edited_at: Mapped[datetime | None] = dt_col()
    deleted_at: Mapped[datetime | None] = dt_col()

    attachments: Mapped[list[MessageAttachment]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class MessageAttachment(UUIDPk, Base):
    __tablename__ = "message_attachments"

    message_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("messages.id", ondelete="CASCADE"), index=True)
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    document_version_id: Mapped[uuid.UUID | None] = fk("document_versions.id")
    bim_viewpoint_id: Mapped[uuid.UUID | None] = fk("bim_viewpoints.id")
    name: Mapped[str] = str_col(300, nullable=False)
    mime_type: Mapped[str | None] = str_col(150)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Call(UUIDPk, Base):
    __tablename__ = "calls"

    kind: Mapped[str] = str_col(10, nullable=False, default="audio")  # audio / video
    conversation_id: Mapped[uuid.UUID | None] = fk("conversations.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    issue_id: Mapped[uuid.UUID | None] = fk("bim_issues.id")  # réunion depuis une issue BIM
    title: Mapped[str | None] = str_col(200)
    initiator_id: Mapped[uuid.UUID | None] = fk("users.id")
    status: Mapped[str] = str_col(
        20, nullable=False, default="ringing", index=True
    )  # ringing / active / ended / missed / rejected / cancelled
    topology: Mapped[str] = str_col(10, nullable=False, default="mesh")  # mesh / sfu
    scheduled_at: Mapped[datetime | None] = dt_col()
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
    started_at: Mapped[datetime | None] = dt_col()
    ended_at: Mapped[datetime | None] = dt_col()
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    had_screen_share: Mapped[bool] = bool_col(False)
    recording_requested: Mapped[bool] = bool_col(False)
    recording_consents: Mapped[dict[str, Any]] = json_col(dict)  # {user_id: ISO date}
    recording_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    recording_retention_until: Mapped[datetime | None] = dt_col()

    participants: Mapped[list[CallParticipant]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class CallParticipant(UUIDPk, Base):
    __tablename__ = "call_participants"
    __table_args__ = (UniqueConstraint("call_id", "user_id"),)

    call_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("calls.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = fk("users.id", nullable=False)
    status: Mapped[str] = str_col(
        20, nullable=False, default="invited"
    )  # invited / ringing / joined / declined / missed / left
    joined_at: Mapped[datetime | None] = dt_col()
    left_at: Mapped[datetime | None] = dt_col()
    used_video: Mapped[bool] = bool_col(False)
    shared_screen: Mapped[bool] = bool_col(False)


class Presence(Base):
    __tablename__ = "presence"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = str_col(10, nullable=False, default="offline")  # online / away / busy / offline
    last_seen_at: Mapped[datetime | None] = dt_col()
    application: Mapped[str | None] = str_col(40)


__all__ = ["Call", "CallParticipant", "Conversation", "ConversationMember", "Message", "MessageAttachment", "Presence"]
