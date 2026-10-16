"""Agenda : rendez-vous, visites, réunions BIM, appels, rappels (§7)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, Index, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, json_col, str_col, text_col


class CalendarEvent(UUIDPk, Timestamps, Base):
    __tablename__ = "calendar_events"
    __table_args__ = (Index("ix_calendar_events_range", "starts_at", "ends_at"),)

    title: Mapped[str] = str_col(250, nullable=False)
    kind: Mapped[str] = str_col(
        20, nullable=False, default="meeting"
    )  # appointment / site_visit / meeting / bim_meeting / call / milestone / reminder
    description: Mapped[str | None] = text_col()
    starts_at: Mapped[datetime] = mapped_column(nullable=False)
    ends_at: Mapped[datetime] = mapped_column(nullable=False)
    all_day: Mapped[bool] = bool_col(False)
    location: Mapped[str | None] = str_col(300)
    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")
    organizer_id: Mapped[uuid.UUID | None] = fk("users.id")
    entity_type: Mapped[str | None] = str_col(40)  # lead / issue / ticket / call / tender
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    call_id: Mapped[uuid.UUID | None] = fk("calls.id")
    rrule: Mapped[str | None] = str_col(250)
    reminders: Mapped[list[Any]] = json_col(lambda: [30])  # minutes avant
    client_visible: Mapped[bool] = bool_col(False)
    status: Mapped[str] = str_col(20, nullable=False, default="confirmed")  # tentative / confirmed / cancelled
    reminder_sent_at: Mapped[datetime | None] = dt_col()

    attendees: Mapped[list[EventAttendee]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class EventAttendee(UUIDPk, Base):
    __tablename__ = "event_attendees"
    __table_args__ = (UniqueConstraint("event_id", "user_id"),)

    event_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("calendar_events.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = fk("users.id")
    external_email: Mapped[str | None] = str_col(254)
    external_name: Mapped[str | None] = str_col(200)
    response: Mapped[str] = str_col(20, nullable=False, default="pending")  # pending / accepted / declined / tentative


__all__ = ["CalendarEvent", "EventAttendee"]
