"""Indice de confiance du chantier (0-100) — innovation R3.

Cinq composantes explicables, calculées uniquement sur des faits enregistrés dans la plateforme :
  • Délais (25)        jalons tenus, tâches en retard, indice de performance planning (SPI) ;
  • Budget (25)        indice de performance coût (CPI) et dépassement prévisionnel à terminaison ;
  • Qualité (20)       notes d'inspection, incidents graves ouverts, actions correctives en retard ;
  • Transparence (15)  photos publiées au client, journaux de chantier, documents publiés ;
  • Réactivité (15)    tickets SAV traités dans les délais.
Une composante sans donnée est exclue (les poids sont renormalisés) : l'indice ne « devine » jamais.
Le client voit des constats en langage clair ; l'équipe voit en plus les mesures détaillées.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.events import emit
from app.core.utils import jsonable
from app.modules.projects.models import DailyLog, Milestone, Project, SiteMedia, Task, TrustSnapshot

WEIGHTS: dict[str, int] = {"delais": 25, "budget": 25, "qualite": 20, "transparence": 15, "reactivite": 15}
LABELS: dict[str, str] = {
    "delais": "Respect des délais",
    "budget": "Maîtrise du budget",
    "qualite": "Qualité et sécurité",
    "transparence": "Transparence",
    "reactivite": "Réactivité",
}
ACTIVE_STATUSES = ("preparation", "execution", "reception")


@dataclass
class Component:
    key: str
    score: float | None = None
    facts: list[str] = field(default_factory=list)  # constats en langage clair (client)
    details: dict[str, Any] = field(default_factory=dict)  # mesures internes (équipe)

    def out(self, *, internal: bool) -> dict[str, Any]:
        data: dict[str, Any] = {
            "key": self.key,
            "label": LABELS[self.key],
            "weight": WEIGHTS[self.key],
            "score": None if self.score is None else round(self.score, 1),
            "facts": self.facts,
        }
        if internal:
            data["details"] = jsonable(self.details)
        return data


def _clamp(value: float) -> float:
    return max(0.0, min(100.0, value))


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def level_for(score: float | None) -> str:
    if score is None:
        return "indisponible"
    if score >= 85:
        return "excellent"
    if score >= 70:
        return "bon"
    if score >= 50:
        return "vigilance"
    return "critique"


def _latest_prediction(db: Session, project_id: uuid.UUID) -> Any:
    from app.modules.ai.models import Prediction

    return (
        db.execute(
            select(Prediction)
            .where(Prediction.project_id == project_id)
            .order_by(Prediction.as_of.desc(), Prediction.computed_at.desc())
        )
        .scalars()
        .first()
    )


def _delais(db: Session, project: Project, today: date, prediction: Any) -> Component:
    c = Component("delais")
    milestones = (
        db.execute(
            select(Milestone).where(
                Milestone.project_id == project.id, Milestone.status != "cancelled", Milestone.due_date <= today
            )
        )
        .scalars()
        .all()
    )
    subs: list[float] = []
    if milestones:
        on_time = sum(1 for m in milestones if m.achieved_at is not None and m.achieved_at.date() <= m.due_date)
        subs.append(100.0 * on_time / len(milestones))
        c.facts.append(f"{on_time} jalon(s) sur {len(milestones)} tenu(s) à la date prévue")
        c.details["milestones_due"] = len(milestones)
        c.details["milestones_on_time"] = on_time
    due_tasks = db.execute(
        select(func.count())
        .select_from(Task)
        .where(Task.project_id == project.id, Task.deleted_at.is_(None), Task.end_planned <= today)
    ).scalar_one()
    if due_tasks:
        late = db.execute(
            select(func.count())
            .select_from(Task)
            .where(
                Task.project_id == project.id,
                Task.deleted_at.is_(None),
                Task.end_planned < today,
                Task.status.not_in(["done", "cancelled"]),
            )
        ).scalar_one()
        subs.append(100.0 * (1 - late / due_tasks))
        c.facts.append("Aucune tâche en retard" if not late else f"{late} tâche(s) en retard sur {due_tasks} échue(s)")
        c.details["tasks_due"] = due_tasks
        c.details["tasks_late"] = late
    if prediction is not None and prediction.spi is not None:
        spi = float(prediction.spi)
        subs.append(_clamp(spi * 100))
        c.details["spi"] = spi
        if prediction.delay_days > 0:
            c.facts.append(f"Fin prévisionnelle estimée avec {prediction.delay_days} jour(s) d'écart")
    c.score = _mean(subs)
    return c


def _budget(prediction: Any) -> Component:
    c = Component("budget")
    if prediction is None or prediction.cpi is None:
        return c
    cpi = float(prediction.cpi)
    bac = float(prediction.budget_at_completion or 0)
    eac = float(prediction.estimate_at_completion or 0)
    overrun = max(0.0, (eac - bac) / bac) if bac > 0 else 0.0
    cpi_score = _clamp(100 - max(0.0, 1 - cpi) * 200)
    overrun_score = _clamp(100 - overrun * 300)
    c.score = (cpi_score + overrun_score) / 2
    c.details.update({"cpi": cpi, "budget_at_completion": bac, "estimate_at_completion": eac, "overrun_pct": overrun})
    if overrun <= 0.02 and cpi >= 0.98:
        c.facts.append("Dépenses conformes à l'avancement réel du chantier")
    elif overrun <= 0.1:
        c.facts.append("Léger écart budgétaire sous surveillance")
    else:
        c.facts.append("Écart budgétaire en cours d'analyse avec votre chef de projet")
    return c


def _qualite(db: Session, project: Project, today: date) -> Component:
    from app.modules.qhse.models import CorrectiveAction, Incident, Inspection

    c = Component("qualite")
    since = today - timedelta(days=90)
    scores = [
        float(s)
        for s in db.execute(
            select(Inspection.score).where(
                Inspection.project_id == project.id,
                Inspection.status.in_(["completed", "closed"]),
                Inspection.inspection_date >= since,
                Inspection.score.is_not(None),
            )
        ).scalars()
    ]
    serious_open = db.execute(
        select(func.count())
        .select_from(Incident)
        .where(
            Incident.project_id == project.id,
            Incident.severity.in_(["high", "critical"]),
            Incident.status != "closed",
        )
    ).scalar_one()
    overdue_actions = db.execute(
        select(func.count())
        .select_from(CorrectiveAction)
        .where(
            CorrectiveAction.project_id == project.id,
            CorrectiveAction.status.in_(["open", "in_progress"]),
            CorrectiveAction.due_date < today,
        )
    ).scalar_one()
    if not scores and not serious_open and project.status not in ACTIVE_STATUSES:
        return c
    base = sum(scores) / len(scores) if scores else 60.0
    c.score = _clamp(base - 15 * serious_open - 5 * overdue_actions)
    c.details.update({"inspections": len(scores), "serious_open": serious_open, "overdue_actions": overdue_actions})
    c.facts.append(
        f"{len(scores)} contrôle(s) qualité / sécurité sur 90 jours, note moyenne {base:.0f}/100"
        if scores
        else "Aucun contrôle qualité enregistré ces 90 derniers jours"
    )
    if serious_open:
        c.facts.append(f"{serious_open} incident(s) important(s) en cours de traitement")
    if overdue_actions:
        c.facts.append(f"{overdue_actions} action(s) corrective(s) en retard")
    return c


def _transparence(db: Session, project: Project, today: date) -> Component:
    from app.modules.documents.models import Document

    c = Component("transparence")
    since = today - timedelta(days=14)
    photos = db.execute(
        select(func.count())
        .select_from(SiteMedia)
        .where(
            SiteMedia.project_id == project.id,
            SiteMedia.published_to_client.is_(True),
            func.coalesce(SiteMedia.taken_at, SiteMedia.created_at) >= since,
        )
    ).scalar_one()
    logs = db.execute(
        select(func.count())
        .select_from(DailyLog)
        .where(
            DailyLog.project_id == project.id,
            DailyLog.log_date >= since,
            DailyLog.status.in_(["submitted", "validated"]),
        )
    ).scalar_one()
    documents = db.execute(
        select(func.count())
        .select_from(Document)
        .where(
            Document.project_id == project.id,
            Document.client_visible.is_(True),
            Document.published_version_id.is_not(None),
            Document.deleted_at.is_(None),
        )
    ).scalar_one()
    active = project.status in ACTIVE_STATUSES
    if not active and not documents and not photos:
        return c
    score = 20.0 if documents else 0.0
    if active:
        score += 50.0 * min(1.0, photos / 6) + 30.0 * min(1.0, logs / 8)
    else:
        score = 100.0 if documents else 50.0
    c.score = _clamp(score)
    c.details.update({"photos_14d": photos, "daily_logs_14d": logs, "documents_published": documents})
    if active:
        c.facts.append(f"{photos} photo(s) publiée(s) ces 14 derniers jours")
        c.facts.append(f"{logs} journal(aux) de chantier tenu(s) sur la période")
    c.facts.append(f"{documents} document(s) officiel(s) consultable(s)")
    return c


def _reactivite(db: Session, project: Project, today: date) -> Component:
    from app.modules.support.models import Ticket

    c = Component("reactivite")
    since = today - timedelta(days=180)
    tickets = (
        db.execute(
            select(Ticket).where(
                Ticket.project_id == project.id, Ticket.created_at >= since, Ticket.status != "cancelled"
            )
        )
        .scalars()
        .all()
    )
    if not tickets:
        return c
    breached = sum(1 for t in tickets if t.response_breached or t.resolution_breached)
    c.score = _clamp(100.0 * (1 - breached / len(tickets)))
    c.details.update({"tickets": len(tickets), "breached": breached})
    c.facts.append(f"{len(tickets) - breached} demande(s) sur {len(tickets)} traitée(s) dans les délais garantis")
    return c


def compute_trust(db: Session, project: Project, *, as_of: date | None = None) -> dict[str, Any]:
    today = as_of or date.today()
    prediction = _latest_prediction(db, project.id)
    components = [
        _delais(db, project, today, prediction),
        _budget(prediction),
        _qualite(db, project, today),
        _transparence(db, project, today),
        _reactivite(db, project, today),
    ]
    scored = [c for c in components if c.score is not None]
    weight = sum(WEIGHTS[c.key] for c in scored)
    score = round(sum(WEIGHTS[c.key] * (c.score or 0) for c in scored) / weight, 1) if weight else None
    return {"score": score, "level": level_for(score), "as_of": today, "components": components}


def _history(db: Session, project_id: uuid.UUID, days: int = 84) -> list[TrustSnapshot]:
    return list(
        db.execute(
            select(TrustSnapshot)
            .where(TrustSnapshot.project_id == project_id, TrustSnapshot.as_of >= date.today() - timedelta(days=days))
            .order_by(TrustSnapshot.as_of)
        ).scalars()
    )


def trust_payload(db: Session, project: Project, *, internal: bool) -> dict[str, Any]:
    result = compute_trust(db, project)
    history = _history(db, project.id)
    week_ago = next(
        (h for h in reversed(history) if h.as_of <= date.today() - timedelta(days=7) and h.score is not None), None
    )
    trend = (
        round(float(result["score"]) - float(week_ago.score), 1)
        if result["score"] is not None and week_ago is not None
        else None
    )
    return jsonable(
        {
            "project_id": project.id,
            "score": result["score"],
            "level": result["level"],
            "as_of": result["as_of"],
            "trend_7d": trend,
            "components": [c.out(internal=internal) for c in result["components"]],
            "history": [{"as_of": h.as_of, "score": h.score} for h in history],
            "method": [f"{LABELS[k]} : {w} %" for k, w in WEIGHTS.items()],
        }
    )


def snapshot_project(db: Session, project: Project, *, as_of: date | None = None) -> TrustSnapshot:
    today = as_of or date.today()
    result = compute_trust(db, project, as_of=today)
    row = db.execute(
        select(TrustSnapshot).where(TrustSnapshot.project_id == project.id, TrustSnapshot.as_of == today)
    ).scalar_one_or_none()
    old_score = row.score if row is not None else None
    if row is None:
        row = TrustSnapshot(project_id=project.id, as_of=today)
        db.add(row)
    row.score = Decimal(str(result["score"])) if result["score"] is not None else None
    row.level = result["level"]
    row.components = jsonable([c.out(internal=True) for c in result["components"]])
    db.flush()
    previous = (
        db.execute(
            select(TrustSnapshot)
            .where(
                TrustSnapshot.project_id == project.id,
                TrustSnapshot.as_of <= today - timedelta(days=7),
                TrustSnapshot.score.is_not(None),
            )
            .order_by(TrustSnapshot.as_of.desc())
        )
        .scalars()
        .first()
    )

    def alarming(score: Decimal | None) -> bool:
        return score is not None and (
            (score < 50 and (previous is None or previous.score >= 50))
            or (previous is not None and previous.score - score >= 15)
        )

    # une seule alerte par jour : un recalcul du même jour ne la répète pas
    if alarming(row.score) and not alarming(old_score):
        emit(
            db,
            "project.trust_alert",
            {
                "project_id": project.id,
                "project_code": project.code,
                "project_name": project.name,
                "score": row.score,
                "previous": previous.score if previous else None,
                "level": row.level,
                "manager_id": project.manager_id,
            },
            aggregate_type="project",
            aggregate_id=project.id,
            project_id=project.id,
        )
    return row


def snapshot_all(db: Session) -> dict[str, Any]:
    """Job quotidien : fige l'indice de chaque chantier actif (historique, tendance, alerte en cas de chute)."""
    projects = (
        db.execute(
            select(Project).where(
                Project.deleted_at.is_(None), Project.status.in_([*ACTIVE_STATUSES, "garantie", "permis", "conception"])
            )
        )
        .scalars()
        .all()
    )
    for project in projects:
        snapshot_project(db, project)
    return {"items": len(projects)}


__all__ = ["LABELS", "WEIGHTS", "compute_trust", "level_for", "snapshot_all", "snapshot_project", "trust_payload"]
