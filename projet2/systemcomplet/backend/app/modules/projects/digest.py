"""Client Digest (§3.2, innovation P1) : résumé hebdomadaire automatique — avancées, risques, dépenses
et prochaines décisions — envoyé dans l'espace client et par e-mail."""

from __future__ import annotations

import html
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.events import emit
from app.core.utils import jsonable, utcnow
from app.modules.projects.models import (
    ClientDigest,
    Decision,
    Milestone,
    ProgressUpdate,
    Project,
    ProjectMember,
    SiteMedia,
    Task,
)

log = logging.getLogger("globus.digest")


def build_digest(db: Session, project: Project, start: date, end: date) -> dict[str, Any]:
    from app.modules.finance.models import FundsCall
    from app.modules.qhse.models import Incident

    progress_rows = db.execute(
        select(ProgressUpdate, Task.title)
        .join(Task, Task.id == ProgressUpdate.task_id)
        .where(
            ProgressUpdate.project_id == project.id,
            func.date(ProgressUpdate.reported_at) >= start,
            func.date(ProgressUpdate.reported_at) <= end,
        )
    ).all()
    achieved = (
        db.execute(
            select(Milestone).where(
                Milestone.project_id == project.id,
                Milestone.client_visible.is_(True),
                Milestone.status == "achieved",
                func.date(Milestone.achieved_at) >= start,
            )
        )
        .scalars()
        .all()
    )
    upcoming = (
        db.execute(
            select(Milestone)
            .where(
                Milestone.project_id == project.id,
                Milestone.client_visible.is_(True),
                Milestone.status == "planned",
                Milestone.due_date <= end + timedelta(days=21),
            )
            .order_by(Milestone.due_date)
        )
        .scalars()
        .all()
    )
    photos = db.execute(
        select(func.count())
        .select_from(SiteMedia)
        .where(
            SiteMedia.project_id == project.id,
            SiteMedia.published_to_client.is_(True),
            func.date(SiteMedia.created_at) >= start,
        )
    ).scalar_one()
    decisions = (
        db.execute(select(Decision).where(Decision.project_id == project.id, Decision.status == "pending_client"))
        .scalars()
        .all()
    )
    calls = (
        db.execute(
            select(FundsCall).where(
                FundsCall.project_id == project.id, FundsCall.status.in_(["issued", "partially_paid", "overdue"])
            )
        )
        .scalars()
        .all()
    )
    incidents = (
        db.execute(
            select(Incident).where(
                Incident.project_id == project.id,
                Incident.published_to_client.is_(True),
                func.date(Incident.created_at) >= start,
            )
        )
        .scalars()
        .all()
    )
    next_tasks = (
        db.execute(
            select(Task)
            .where(
                Task.project_id == project.id,
                Task.client_visible.is_(True),
                Task.deleted_at.is_(None),
                Task.status.in_(["todo", "in_progress"]),
                Task.start_planned <= end + timedelta(days=7),
            )
            .order_by(Task.start_planned)
            .limit(8)
        )
        .scalars()
        .all()
    )
    advanced = sorted({title for _, title in progress_rows})[:10]
    content = {
        "progress_pct": project.progress_pct,
        "health": project.health,
        "advanced_tasks": advanced,
        "milestones_achieved": [m.name for m in achieved],
        "milestones_upcoming": [{"name": m.name, "due_date": m.due_date} for m in upcoming],
        "photos_published": photos,
        "pending_decisions": [
            {"title": d.title, "due_date": d.due_date, "price_impact": d.price_impact} for d in decisions
        ],
        "funds_calls_due": [
            {"label": c.label, "amount": Decimal(c.amount) - Decimal(c.amount_paid), "due_date": c.due_date}
            for c in calls
        ],
        "incidents": [i.client_summary or i.title for i in incidents],
        "next_week": [t.title for t in next_tasks],
    }
    summary = _summary(project, content)
    return {"content": jsonable(content), "summary": summary}


def _summary(project: Project, c: dict[str, Any]) -> str:
    from app.providers.ai import get_ai_provider

    provider = get_ai_provider()
    if provider is not None:
        try:
            result = provider.complete_text(
                system="Tu rédiges le point hebdomadaire d'un chantier pour le client final (particulier, investisseur "
                "ou membre de la diaspora). Ton : clair, rassurant, factuel, sans jargon technique. 120 mots "
                "maximum, en français. N'invente aucune information absente des données.",
                prompt=f"Projet : {project.name}\nDonnées de la semaine (JSON) : {jsonable(c)}",
                effort="low",
                max_tokens=4000,
            )
            if result.text:
                return result.text
        except Exception:  # noqa: BLE001
            log.warning("digest_ai_failed")
    parts = [f"Avancement global : {c['progress_pct']} %."]
    if c["advanced_tasks"]:
        parts.append("Cette semaine : " + ", ".join(c["advanced_tasks"][:5]) + ".")
    if c["milestones_achieved"]:
        parts.append("Jalons atteints : " + ", ".join(c["milestones_achieved"]) + ".")
    if c["photos_published"]:
        parts.append(f"{c['photos_published']} nouvelle(s) photo(s) disponible(s) dans votre espace.")
    if c["pending_decisions"]:
        parts.append(f"{len(c['pending_decisions'])} décision(s) vous attend(ent).")
    if c["funds_calls_due"]:
        parts.append(f"{len(c['funds_calls_due'])} appel(s) de fonds en attente de règlement.")
    if c["next_week"]:
        parts.append("Prochaines étapes : " + ", ".join(c["next_week"][:4]) + ".")
    return " ".join(parts)


def _html(summary: str, content: dict[str, Any]) -> str:
    items = "".join(f"<li>{html.escape(str(m['name']))} — {m['due_date']}</li>" for m in content["milestones_upcoming"])
    block = f"<p>{html.escape(summary)}</p>"
    if items:
        block += f"<p><strong>Prochains jalons</strong></p><ul>{items}</ul>"
    return block


def send_weekly_digests(db: Session) -> dict[str, Any]:
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=6)
    sent = 0
    projects = (
        db.execute(
            select(Project).where(
                Project.deleted_at.is_(None),
                Project.client_visible.is_(True),
                Project.status.in_(["conception", "permis", "preparation", "execution", "reception"]),
            )
        )
        .scalars()
        .all()
    )
    for project in projects:
        has_client = db.execute(
            select(ProjectMember.id).where(
                ProjectMember.project_id == project.id, ProjectMember.project_role == "client"
            )
        ).first()
        if not has_client and not project.client_organization_id:
            continue
        exists = db.execute(
            select(ClientDigest.id).where(ClientDigest.project_id == project.id, ClientDigest.period_start == start)
        ).first()
        if exists:
            continue
        built = build_digest(db, project, start, end)
        digest = ClientDigest(
            project_id=project.id,
            period_start=start,
            period_end=end,
            content=built["content"],
            summary=built["summary"],
            sent_at=utcnow(),
        )
        db.add(digest)
        db.flush()
        emit(
            db,
            "client.digest",
            {
                "project_name": project.name,
                "summary": built["summary"],
                "html": _html(built["summary"], built["content"]),
                "digest_id": digest.id,
            },
            aggregate_type="client_digest",
            aggregate_id=digest.id,
            project_id=project.id,
        )
        sent += 1
    return {"items": sent}
