"""Agenda : rendez-vous, visites de chantier, réunions (dont réunions BIM / visio), jalons ; invitations internes et
externes (ICS), réponses, rappels automatiques."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError
from app.core.utils import utcnow
from app.modules.agenda.models import CalendarEvent, EventAttendee


def when(value: datetime, fmt: str = "%d/%m/%Y %H:%M") -> str:
    """Date et heure dans le fuseau de la plateforme (messages, notifications) — les dates sont stockées en UTC."""
    try:
        from zoneinfo import ZoneInfo

        value = value.astimezone(ZoneInfo(settings.TIMEZONE))
    except Exception:  # noqa: BLE001 — fuseau indisponible : heure UTC
        pass
    return value.strftime(fmt)


def ics(event: CalendarEvent, *, organizer_email: str | None = None) -> str:
    def fmt(value: datetime) -> str:
        return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")

    def esc(text: str | None) -> str:
        return (text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GLOBUS ENGINEERING//Agenda//FR",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{event.id}@globus-engineering",
        f"DTSTAMP:{fmt(utcnow())}",
        f"DTSTART:{fmt(event.starts_at)}",
        f"DTEND:{fmt(event.ends_at)}",
        f"SUMMARY:{esc(event.title)}",
        f"DESCRIPTION:{esc(event.description)}",
        f"LOCATION:{esc(event.location)}",
        f"STATUS:{'CANCELLED' if event.status == 'cancelled' else 'CONFIRMED'}",
    ]
    if organizer_email:
        lines.append(f"ORGANIZER:mailto:{organizer_email}")
    if event.rrule:
        lines.append(f"RRULE:{event.rrule}")
    for minutes in event.reminders or []:
        lines += ["BEGIN:VALARM", "ACTION:DISPLAY", f"TRIGGER:-PT{int(minutes)}M", "DESCRIPTION:Rappel", "END:VALARM"]
    lines += ["END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(lines) + "\r\n"


def create_event(
    db: Session,
    *,
    organizer: Any,
    data: dict[str, Any],
    attendee_ids: list[uuid.UUID],
    external: list[dict[str, str]],
    invitation: tuple[str, str] | None = None,
) -> CalendarEvent:
    if data["ends_at"] <= data["starts_at"]:
        raise BusinessRuleError("Fin antérieure au début")
    event = CalendarEvent(organizer_id=organizer.id, **data)
    event.attendees.append(EventAttendee(user_id=organizer.id, response="accepted"))
    for uid in {u for u in attendee_ids if u != organizer.id}:
        event.attendees.append(EventAttendee(user_id=uid))
    for ext in external:
        event.attendees.append(EventAttendee(external_email=ext["email"].lower(), external_name=ext.get("name")))
    db.add(event)
    db.flush()
    _invite(db, event, organizer, invitation)
    audit.record(
        db,
        family="business",
        module="agenda",
        action="EVENT_CREATE",
        resource_type="calendar_event",
        resource_id=event.id,
        project_id=event.project_id,
        actor_id=organizer.id,
        diff={"attendees": len(event.attendees), "kind": event.kind},
    )
    return event


def _invite(db: Session, event: CalendarEvent, organizer: Any, invitation: tuple[str, str] | None = None) -> None:
    from app.core.files import store_generated
    from app.modules.notifications.service import notify_users, queue_external

    internal = [a.user_id for a in event.attendees if a.user_id and a.user_id != organizer.id]
    at = when(event.starts_at)
    if internal:
        title, body = invitation or (f"Invitation : {event.title}", f"{at} — {event.location or 'lieu à préciser'}")
        notify_users(
            db,
            internal,
            category="general",
            title=title,
            body=body,
            link=f"/agenda/{event.id}",
            channels=("in_app", "push", "email"),
            entity_type="calendar_event",
            entity_id=str(event.id),
            project_id=event.project_id,
            event_type="agenda.invitation",
        )
    externals = [a for a in event.attendees if a.external_email]
    if externals:
        stored = store_generated(
            db,
            ics(event, organizer_email=organizer.email).encode(),
            filename="invitation.ics",
            mime="text/calendar",
            purpose="agenda",
            classification="internal",
            uploaded_by_id=organizer.id,
        )
        for attendee in externals:
            queue_external(
                db,
                channel="email",
                recipient=attendee.external_email or "",
                template_code="generic.notification",
                context={
                    "title": f"Invitation : {event.title}",
                    "body": f"{organizer.full_name} vous invite le {at} ({event.location or 'visio'}).",
                    "link": None,
                },
                attachments_file_ids=[str(stored.id)],
            )


def notify_change(
    db: Session, event: CalendarEvent, *, actor_id: uuid.UUID, title: str, body: str, event_type: str
) -> None:
    """Prévient les participants (et l'organisateur) d'un changement : déplacement, annulation, confirmation."""
    from app.modules.notifications.service import notify_users

    users = {a.user_id for a in event.attendees if a.user_id and a.response != "declined"}
    if event.organizer_id:
        users.add(event.organizer_id)
    users.discard(actor_id)
    if users:
        notify_users(
            db,
            sorted(users, key=str),
            category="general",
            title=title,
            body=body,
            link=f"/agenda/{event.id}",
            channels=("in_app", "push", "email"),
            entity_type="calendar_event",
            entity_id=str(event.id),
            project_id=event.project_id,
            event_type=event_type,
        )


def respond(db: Session, event: CalendarEvent, *, user_id: uuid.UUID, response: str) -> EventAttendee:
    attendee = next((a for a in event.attendees if a.user_id == user_id), None)
    if attendee is None:
        raise BusinessRuleError("Vous n'êtes pas invité(e) à cet événement")
    attendee.response = response
    return attendee


def send_reminders(db: Session) -> dict[str, Any]:
    """Job : rappels (minutes avant) pour les événements confirmés à venir, une seule fois par événement."""
    from app.modules.notifications.service import notify_users

    now = utcnow()
    horizon = now + timedelta(hours=24)
    count = 0
    for event in db.execute(
        select(CalendarEvent).where(
            CalendarEvent.status == "confirmed",
            CalendarEvent.reminder_sent_at.is_(None),
            CalendarEvent.starts_at > now,
            CalendarEvent.starts_at <= horizon,
        )
    ).scalars():
        lead = max([int(m) for m in (event.reminders or [30])] or [30])
        if event.starts_at - timedelta(minutes=lead) > now:
            continue
        users = [a.user_id for a in event.attendees if a.user_id and a.response != "declined"]
        if users:
            notify_users(
                db,
                users,
                category="general",
                title=f"Rappel : {event.title}",
                body=f"Début à {when(event.starts_at, '%H:%M')} — {event.location or ''}".strip(" —"),
                link=f"/agenda/{event.id}",
                channels=("in_app", "push"),
                entity_type="calendar_event",
                entity_id=str(event.id),
                project_id=event.project_id,
                event_type="agenda.reminder",
            )
        event.reminder_sent_at = now
        count += 1
    return {"items": count}
