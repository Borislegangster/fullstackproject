"""API Agenda : calendrier personnel / projet, invitations (internes, externes ICS), réponses, export ICS,
réunion visio rattachée."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import serialize
from app.core.database import get_db
from app.core.errors import BusinessRuleError, Forbidden, NotFound
from app.core.utils import jsonable
from app.modules.agenda import service
from app.modules.agenda.models import CalendarEvent, EventAttendee
from app.modules.identity.models import User

router = APIRouter(tags=["Agenda"])


def _event_out(db: Session, event: CalendarEvent) -> dict[str, Any]:
    attendees = []
    for a in event.attendees:
        user = db.get(User, a.user_id) if a.user_id else None
        attendees.append({**serialize(a), "name": user.full_name if user else a.external_name})
    return jsonable({**serialize(event), "attendees": attendees})


def _visible(db: Session, access: Access, event: CalendarEvent) -> bool:
    if event.organizer_id == access.p.id or any(a.user_id == access.p.id for a in event.attendees):
        return True
    if event.project_id and access.can_access_project(event.project_id):
        return access.p.is_internal or event.client_visible
    return False


def _event(db: Session, access: Access, event_id: uuid.UUID) -> CalendarEvent:
    event = db.get(CalendarEvent, event_id)
    if event is None or not _visible(db, access, event):
        raise NotFound("Événement introuvable")
    return event


@router.get("/agenda/events")
def list_events(
    start: datetime,
    end: datetime,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    if (end - start).days > 400:
        raise BusinessRuleError("Période maximale : 400 jours")
    mine = select(EventAttendee.event_id).where(EventAttendee.user_id == access.p.id)
    stmt = select(CalendarEvent).where(CalendarEvent.starts_at < end, CalendarEvent.ends_at > start)
    if project_id:
        access.require_project(project_id)
        stmt = stmt.where(CalendarEvent.project_id == project_id)
        if not access.p.is_internal:
            stmt = stmt.where(or_(CalendarEvent.client_visible.is_(True), CalendarEvent.id.in_(mine)))
    else:
        stmt = stmt.where(or_(CalendarEvent.organizer_id == access.p.id, CalendarEvent.id.in_(mine)))
    return [_event_out(db, e) for e in db.execute(stmt.order_by(CalendarEvent.starts_at).limit(1000)).scalars()]


class ExternalIn(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=200)


class EventIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    kind: str = Field(
        default="meeting", pattern="^(appointment|site_visit|meeting|bim_meeting|call|milestone|reminder)$"
    )
    description: str | None = Field(default=None, max_length=8000)
    starts_at: datetime
    ends_at: datetime
    all_day: bool = False
    location: str | None = Field(default=None, max_length=300)
    project_id: uuid.UUID | None = None
    entity_type: str | None = Field(default=None, max_length=40)
    entity_id: uuid.UUID | None = None
    rrule: str | None = Field(default=None, max_length=250, pattern="^(FREQ=(DAILY|WEEKLY|MONTHLY)[;A-Z0-9=,]*)$")
    reminders: list[int] = Field(default_factory=lambda: [30], max_length=5)
    client_visible: bool = False
    attendee_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)
    external: list[ExternalIn] = Field(default_factory=list, max_length=50)
    with_video_call: bool = False


@router.post("/agenda/events", status_code=201)
def create_event(data: EventIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("agenda:write")
    if data.project_id:
        access.require_project(data.project_id)
    if data.client_visible:
        access.require("projects:publish_client")
    values = data.model_dump(exclude={"attendee_ids", "external", "with_video_call"})
    event = service.create_event(
        db,
        organizer=access.p.user,
        data=values,
        attendee_ids=data.attendee_ids,
        external=[e.model_dump() for e in data.external],
    )
    if data.with_video_call and data.attendee_ids:
        from app.modules.communications import service as comms

        call = comms.start_call(
            db,
            access.p.user,
            kind="video",
            participant_ids=data.attendee_ids,
            conversation_id=None,
            project_id=data.project_id,
            issue_id=data.entity_id if data.entity_type == "issue" else None,
            title=data.title,
            scheduled_at=data.starts_at,
        )
        event.call_id = call.id
    db.commit()
    return _event_out(db, event)


@router.get("/agenda/events/{event_id}")
def get_event(
    event_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return _event_out(db, _event(db, access, event_id))


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location: str | None = Field(default=None, max_length=300)
    status: str | None = Field(default=None, pattern="^(tentative|confirmed|cancelled)$")
    reminders: list[int] | None = Field(default=None, max_length=5)


@router.patch("/agenda/events/{event_id}")
def update_event(
    event_id: uuid.UUID, data: EventUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    event = _event(db, access, event_id)
    if event.organizer_id != access.p.id and not access.has("agenda:write"):
        raise Forbidden("Modification réservée à l'organisateur")
    values = data.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(event, key, value)
    if event.ends_at <= event.starts_at:
        raise BusinessRuleError("Fin antérieure au début")
    if {"starts_at", "ends_at"} & set(values):
        event.reminder_sent_at = None
    audit.record(
        db,
        family="business",
        module="agenda",
        action="EVENT_UPDATE",
        resource_type="calendar_event",
        resource_id=event.id,
        project_id=event.project_id,
        diff={"fields": sorted(values)},
    )
    db.commit()
    return _event_out(db, event)


class ResponseIn(BaseModel):
    response: str = Field(pattern="^(accepted|declined|tentative)$")


@router.post("/agenda/events/{event_id}/respond")
def respond(
    event_id: uuid.UUID, data: ResponseIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    event = _event(db, access, event_id)
    service.respond(db, event, user_id=access.p.id, response=data.response)
    db.commit()
    return _event_out(db, event)


@router.get("/agenda/events/{event_id}/ics")
def event_ics(event_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    event = _event(db, access, event_id)
    organizer = db.get(User, event.organizer_id) if event.organizer_id else None
    return Response(
        service.ics(event, organizer_email=organizer.email if organizer else None),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="evenement-{event.id}.ics"'},
    )
