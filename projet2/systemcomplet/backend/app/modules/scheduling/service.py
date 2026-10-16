"""Planning intelligent (innovation A4).

Chaque jour, pour les tâches des 30 prochains jours des chantiers actifs :
  • pluie : tâche extérieure (gros œuvre, toiture, VRD…) et prévision de fortes pluies (Open-Meteo si activé) →
    proposition de décaler sur la prochaine fenêtre sèche ; hors prévision, la saison des pluies de la région
    (climatologie paramétrable) déclenche une alerte d'anticipation (bâches, marge) ;
  • approvisionnement : bon de commande du même chantier / lot attendu après le début de la tâche → décalage proposé ;
  • absence : congé approuvé d'un équipier affecté pendant la tâche → réaffectation ou décalage ;
  • dépendance : prédécesseur en retard → décalage des successeurs.
Une proposition n'est appliquée qu'après validation (décalage en cascade des successeurs, jalons impactés signalés,
message au client préparé). Rien n'est modifié automatiquement.
"""

from __future__ import annotations

import hashlib
import logging
import math
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.utils import jsonable, utcnow
from app.modules.scheduling.models import ScheduleRisk, WeatherForecast

log = logging.getLogger("globus.scheduling")

DEFAULTS: dict[str, Any] = {
    "horizon_days": 30,
    "rain_mm": 10,
    "rain_probability": 70,
    "outdoor_keywords": [
        "terrassement", "fouille", "fondation", "semelle", "beton", "coulage", "dalle", "chape exterieure",
        "maconnerie", "elevation", "poteau", "chainage", "toiture", "charpente", "couverture", "etancheite",
        "enduit exterieur", "facade", "peinture exterieure", "vrd", "assainissement", "cloture", "voirie", "pavage",
        "drainage", "implantation",
    ],
    # mois de saison des pluies (1-12) et mois de pluies intenses, par région du Cameroun
    "seasons": {
        "littoral": {"rainy": [3, 4, 5, 6, 7, 8, 9, 10, 11], "heavy": [6, 7, 8, 9, 10]},
        "ouest": {"rainy": [3, 4, 5, 6, 7, 8, 9, 10, 11], "heavy": [7, 8, 9]},
        "centre": {"rainy": [3, 4, 5, 6, 9, 10, 11], "heavy": [4, 5, 10]},
        "nord": {"rainy": [5, 6, 7, 8, 9, 10], "heavy": [7, 8]},
    },
}  # fmt: skip
REGION_CITIES = {
    "littoral": ("douala", "limbe", "buea", "kribi", "edea", "tiko", "kumba", "nkongsamba"),
    "ouest": ("bafoussam", "bamenda", "dschang", "mbouda", "foumban", "bangangte"),
    "centre": ("yaounde", "mbalmayo", "obala", "bertoua", "ebolowa", "sangmelima", "bafia"),
    "nord": ("garoua", "maroua", "ngaoundere", "kousseri", "guider", "mokolo"),
}


def policy(db: Session) -> dict[str, Any]:
    from app.modules.system.models import Setting

    row = db.get(Setting, "planning_ai")
    return {**DEFAULTS, **(row.value if row and isinstance(row.value, dict) else {})}


def _norm(text: str | None) -> str:
    import unicodedata

    text = unicodedata.normalize("NFKD", (text or "").lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def region(project: Any) -> str:
    city = _norm(project.city)
    for name, cities in REGION_CITIES.items():
        if any(c in city for c in cities):
            return name
    lat, lon = project.latitude, project.longitude
    if lat is not None and lon is not None:
        if lat >= 7:
            return "nord"
        if lat < 4.6 and lon < 10.5:
            return "littoral"
        if lon < 10.8 and lat >= 5:
            return "ouest"
    return "centre"


def is_outdoor(task: Any, lot_name: str | None, keywords: list[str]) -> bool:
    text = _norm(f"{task.title} {lot_name or ''} {task.description or ''}")
    return any(k in text for k in keywords)


def _fingerprint(*parts: Any) -> str:
    return hashlib.sha256(":".join(str(p) for p in parts).encode()).hexdigest()


# ---------------------------------------------------------------------------- météo
def zone_of(project: Any) -> str | None:
    if project.latitude is None or project.longitude is None:
        return None
    return f"{round(project.latitude, 1)},{round(project.longitude, 1)}"


def forecast(db: Session, project: Any) -> dict[date, WeatherForecast]:
    """Prévisions 14 jours mises en cache (une requête par zone et par jour au plus)."""
    from app.providers.base import ProviderError
    from app.providers.weather import daily_forecast, weather_available

    zone = zone_of(project)
    if zone is None:
        return {}
    today = date.today()
    cached = {
        f.day: f
        for f in db.execute(
            select(WeatherForecast).where(WeatherForecast.zone == zone, WeatherForecast.day >= today)
        ).scalars()
    }
    fresh = cached and all(f.fetched_at.date() == today for f in cached.values())
    if weather_available() and not fresh:
        try:
            rows = daily_forecast(project.latitude, project.longitude, 14)
        except ProviderError as exc:
            log.warning("weather_unavailable", extra={"zone": zone, "error": str(exc)[:200]})
            rows = []
        for row in rows:
            item = cached.get(row["day"]) or WeatherForecast(zone=zone, day=row["day"])
            item.precipitation_mm = Decimal(str(round(row["precipitation_mm"], 1)))
            item.probability = row["probability"]
            item.fetched_at = utcnow()
            if row["day"] not in cached:
                db.add(item)
            cached[row["day"]] = item
        db.flush()
    return cached


def _rainy(f: WeatherForecast | None, rules: dict[str, Any]) -> bool:
    if f is None:
        return False
    return float(f.precipitation_mm) >= float(rules["rain_mm"]) or (f.probability or 0) >= int(
        rules["rain_probability"]
    )


# ---------------------------------------------------------------------------- détection
def _span(task: Any) -> tuple[date, date] | None:
    if task.start_planned is None:
        return None
    end = task.end_planned or task.start_planned + timedelta(days=max(1, task.duration_days or 1) - 1)
    return task.start_planned, max(end, task.start_planned)


def _shift(span: tuple[date, date], new_start: date) -> dict[str, Any]:
    duration = (span[1] - span[0]).days
    return {
        "new_start": new_start.isoformat(),
        "new_end": (new_start + timedelta(days=duration)).isoformat(),
        "shift_days": (new_start - span[0]).days,
    }


def detect_project(db: Session, project: Any, today: date | None = None) -> list[dict[str, Any]]:
    from app.modules.hr.models import Employee, LeaveRequest
    from app.modules.procurement.models import PurchaseOrder
    from app.modules.projects.models import Lot, Task, TaskDependency
    from app.modules.subcontracting.trades import trade_label

    today = today or date.today()
    rules = policy(db)
    horizon = today + timedelta(days=int(rules["horizon_days"]))
    tasks = (
        db.execute(
            select(Task).where(
                Task.project_id == project.id,
                Task.deleted_at.is_(None),
                Task.status.not_in(["done", "cancelled"]),
                Task.start_planned.is_not(None),
                Task.start_planned <= horizon,
            )
        )
        .scalars()
        .all()
    )
    lots = {lot.id: lot.name for lot in db.execute(select(Lot).where(Lot.project_id == project.id)).scalars()}
    findings: list[dict[str, Any]] = []
    weather = forecast(db, project)
    seasons = rules["seasons"].get(region(project), rules["seasons"]["centre"])

    for task in tasks:
        span = _span(task)
        if span is None or span[1] < today:
            continue
        outdoor = is_outdoor(task, lots.get(task.lot_id), rules["outdoor_keywords"])
        # ------------------------------------------------ pluie (prévision)
        if outdoor and weather:
            days = [span[0] + timedelta(days=i) for i in range((span[1] - span[0]).days + 1)]
            known = [d for d in days if d in weather]
            wet = [d for d in known if _rainy(weather.get(d), rules)]
            if known and len(wet) >= max(1, math.ceil(len(known) / 2)):
                duration = (span[1] - span[0]).days + 1
                window = None
                for start in sorted(d for d in weather if d > span[0]):
                    block = [start + timedelta(days=i) for i in range(duration)]
                    if all(b in weather and not _rainy(weather[b], rules) for b in block):
                        window = start
                        break
                findings.append(
                    {
                        "task": task,
                        "kind": "weather",
                        "severity": "high",
                        "title": f"Fortes pluies annoncées pendant « {task.title} »",
                        "detail": f"{len(wet)} jour(s) de pluie sur {len(known)} prévus entre le "
                        f"{span[0]:%d/%m} et le {span[1]:%d/%m} pour une tâche extérieure.",
                        "evidence": {
                            "days": [
                                {
                                    "day": d,
                                    "mm": str(weather[d].precipitation_mm),
                                    "probability": weather[d].probability,
                                }
                                for d in known
                            ]
                        },
                        "suggestion": {
                            **(_shift(span, window) if window else {}),
                            "note": "Décaler sur la prochaine fenêtre sèche"
                            if window
                            else "Aucune fenêtre sèche à 14 jours : prévoir bâches, pompage et protection des ouvrages",
                        },
                        "key": f"{span[0]}:{span[1]}",
                    }
                )
        # ------------------------------------------------ saison des pluies (climatologie)
        elif outdoor and span[0].month in seasons.get("heavy", []) and span[0] >= today:
            findings.append(
                {
                    "task": task,
                    "kind": "season",
                    "severity": "medium",
                    "title": f"« {task.title} » en pleine saison des pluies",
                    "detail": f"Démarrage prévu le {span[0]:%d/%m/%Y}, mois de pluies intenses dans la région "
                    f"({region(project)}). Anticiper protections, pompage et marge de délai.",
                    "evidence": {"region": region(project), "month": span[0].month},
                    "suggestion": {"note": "Prévoir une marge de délai et les protections du chantier"},
                    "key": f"{span[0]:%Y-%m}",
                }
            )
        # ------------------------------------------------ approvisionnement
        pos = db.execute(
            select(PurchaseOrder).where(
                PurchaseOrder.project_id == project.id,
                PurchaseOrder.deleted_at.is_(None),
                PurchaseOrder.status.in_(["sent", "confirmed", "countered", "shipped", "partially_received"]),
            )
        ).scalars()
        for po in pos:
            if task.lot_id and po.lot_id and po.lot_id != task.lot_id:
                continue
            if not task.lot_id and po.lot_id:
                continue
            arrival = po.eta.date() if po.eta else po.expected_date
            if arrival is None or arrival <= span[0] or arrival > span[1] + timedelta(days=60):
                continue
            findings.append(
                {
                    "task": task,
                    "kind": "supply",
                    "severity": "high" if (arrival - span[0]).days > 2 else "medium",
                    "title": f"Livraison {po.number} attendue après le début de « {task.title} »",
                    "detail": f"Matériaux attendus le {arrival:%d/%m/%Y}, tâche prévue à partir du {span[0]:%d/%m/%Y}.",
                    "evidence": {"purchase_order": po.number, "arrival": arrival},
                    "suggestion": {
                        **_shift(span, arrival + timedelta(days=1)),
                        "note": "Démarrer après réception, ou relancer le fournisseur",
                    },
                    "key": str(po.id),
                }
            )
        # ------------------------------------------------ absences
        employee_ids = {a.employee_id for a in task.assignments if a.employee_id}
        user_ids = {a.user_id for a in task.assignments if a.user_id}
        if user_ids:
            employee_ids |= set(db.execute(select(Employee.id).where(Employee.user_id.in_(user_ids))).scalars())
        if employee_ids:
            leaves = db.execute(
                select(LeaveRequest, Employee)
                .join(Employee, Employee.id == LeaveRequest.employee_id)
                .where(
                    LeaveRequest.employee_id.in_(employee_ids),
                    LeaveRequest.status == "approved",
                    LeaveRequest.start_date <= span[1],
                    LeaveRequest.end_date >= span[0],
                )
            ).all()
            for leave, employee in leaves:
                findings.append(
                    {
                        "task": task,
                        "kind": "absence",
                        "severity": "medium",
                        "title": f"{employee.first_name} {employee.last_name} absent(e) pendant « {task.title} »",
                        "detail": f"Congé du {leave.start_date:%d/%m} au {leave.end_date:%d/%m/%Y} "
                        f"({trade_label(employee.trade) or employee.job_title}).",
                        "evidence": {"leave": str(leave.id), "employee": f"{employee.first_name} {employee.last_name}"},
                        "suggestion": {
                            **_shift(span, leave.end_date + timedelta(days=1)),
                            "note": "Réaffecter un équipier de même métier, sinon décaler après son retour",
                        },
                        "key": str(leave.id),
                    }
                )
        # ------------------------------------------------ dépendances
        for dep, pred in db.execute(
            select(TaskDependency, Task)
            .join(Task, Task.id == TaskDependency.predecessor_id)
            .where(TaskDependency.successor_id == task.id, Task.deleted_at.is_(None))
        ).all():
            pred_span = _span(pred)
            if pred.status in ("done", "cancelled") or pred_span is None or pred_span[1] >= today:
                continue
            remaining = max(1, math.ceil((pred.duration_days or 1) * (1 - float(pred.progress_pct or 0) / 100)))
            expected_end = today + timedelta(days=remaining - 1)
            earliest = expected_end + timedelta(days=1 + (dep.lag_days or 0))
            if earliest <= span[0]:
                continue
            findings.append(
                {
                    "task": task,
                    "kind": "dependency",
                    "severity": "high",
                    "title": f"« {pred.title} » en retard : « {task.title} » ne pourra pas démarrer à temps",
                    "detail": f"Prédécesseur prévu fini le {pred_span[1]:%d/%m}, encore {remaining} jour(s) estimé(s) "
                    f"(avancement {float(pred.progress_pct or 0):.0f} %).",
                    "evidence": {"predecessor": pred.title, "expected_end": expected_end},
                    "suggestion": {**_shift(span, earliest), "note": "Décaler en cascade selon l'avancement réel"},
                    "key": str(pred.id),
                }
            )
    return findings


def scan_project(db: Session, project: Any) -> dict[str, int]:
    findings = detect_project(db, project)
    seen: set[str] = set()
    created = 0
    for f in findings:
        fp = _fingerprint(f["kind"], f["task"].id, f["key"])
        seen.add(fp)
        risk = db.execute(select(ScheduleRisk).where(ScheduleRisk.fingerprint == fp)).scalar_one_or_none()
        if risk is None:
            risk = ScheduleRisk(project_id=project.id, task_id=f["task"].id, kind=f["kind"], fingerprint=fp)
            db.add(risk)
            created += 1
        elif risk.status in ("applied", "dismissed"):
            continue
        risk.status = "open"
        risk.severity = f["severity"]
        risk.title = f["title"][:250]
        risk.detail = f["detail"]
        risk.evidence = jsonable(f["evidence"])
        risk.suggestion = jsonable(f["suggestion"])
        risk.last_detected_at = utcnow()
    resolved = 0
    for risk in db.execute(
        select(ScheduleRisk).where(ScheduleRisk.project_id == project.id, ScheduleRisk.status == "open")
    ).scalars():
        if risk.fingerprint not in seen:
            risk.status = "resolved"
            resolved += 1
    db.flush()
    if created:
        emit(
            db,
            "planning.risk_detected",
            {
                "project_id": project.id,
                "project_code": project.code,
                "project_name": project.name,
                "count": created,
                "manager_id": project.manager_id,
                "link": f"/erp/chantiers/{project.id}?onglet=planning",
            },
            aggregate_type="project",
            aggregate_id=project.id,
            project_id=project.id,
        )
    return {"created": created, "resolved": resolved, "open": len(seen)}


def daily_job(db: Session) -> dict[str, Any]:
    from app.modules.projects.models import Project
    from app.modules.projects.trust import ACTIVE_STATUSES

    total = 0
    for project in db.execute(
        select(Project).where(Project.deleted_at.is_(None), Project.status.in_(ACTIVE_STATUSES))
    ).scalars():
        total += scan_project(db, project)["created"]
        db.commit()
    return {"items": total}


# ---------------------------------------------------------------------------- application
def _move(task: Any, start: date) -> None:
    span = _span(task)
    duration = (span[1] - span[0]).days if span else max(0, (task.duration_days or 1) - 1)
    task.start_planned = start
    task.end_planned = start + timedelta(days=duration)


def apply(db: Session, risk: ScheduleRisk, *, user: Any, note: str | None) -> dict[str, Any]:
    """Applique la proposition : décale la tâche puis ses successeurs (fin → début + délai), signale les jalons."""
    from app.modules.projects.models import Milestone, Task, TaskDependency

    if risk.status != "open":
        raise BusinessRuleError("Risque déjà traité")
    new_start = risk.suggestion.get("new_start")
    if not new_start:
        raise BusinessRuleError("Pas de décalage proposé : traitez ce risque manuellement puis écartez-le")
    task = db.get(Task, risk.task_id)
    if task is None:
        raise NotFound("Tâche introuvable")
    moved: dict[uuid.UUID, tuple[Any, Any]] = {}

    def shift(t: Any, start: date, depth: int = 0) -> None:
        if depth > 200:
            return
        before = (t.start_planned, t.end_planned)
        _move(t, start)
        moved.setdefault(t.id, before)
        for dep, succ in db.execute(
            select(TaskDependency, Task)
            .join(Task, Task.id == TaskDependency.successor_id)
            .where(TaskDependency.predecessor_id == t.id, Task.deleted_at.is_(None))
        ).all():
            if succ.status in ("done", "cancelled") or succ.start_planned is None:
                continue
            earliest = t.end_planned + timedelta(days=1 + (dep.lag_days or 0))
            if succ.start_planned < earliest:
                shift(succ, earliest, depth + 1)

    shift(task, date.fromisoformat(new_start))
    impacted = []
    for task_id in moved:
        t = db.get(Task, task_id)
        if t.milestone_id:
            milestone = db.get(Milestone, t.milestone_id)
            if milestone and t.end_planned and t.end_planned > milestone.due_date and milestone.status != "achieved":
                impacted.append(
                    {"milestone": milestone.name, "due_date": milestone.due_date, "new_date": t.end_planned}
                )
    risk.status = "applied"
    risk.decided_by_id = user.id
    risk.decided_at = utcnow()
    risk.decision_note = note
    audit.record(
        db,
        family="business",
        module="planning",
        action="REPLAN",
        resource_type="schedule_risk",
        resource_id=risk.id,
        project_id=risk.project_id,
        diff={str(k): {"before": [str(v[0]), str(v[1])]} for k, v in moved.items()},
        reason=note,
    )
    emit(
        db,
        "planning.replanned",
        {
            "project_id": risk.project_id,
            "risk": risk.title,
            "tasks": len(moved),
            "milestones": jsonable(impacted),
            "link": f"/erp/chantiers/{risk.project_id}?onglet=planning",
        },
        aggregate_type="schedule_risk",
        aggregate_id=risk.id,
        project_id=risk.project_id,
    )
    db.flush()
    return jsonable(
        {
            "risk": risk_out(risk),
            "moved": [
                {
                    "task_id": k,
                    "title": db.get(Task, k).title,
                    "start": db.get(Task, k).start_planned,
                    "end": db.get(Task, k).end_planned,
                    "before": {"start": v[0], "end": v[1]},
                }
                for k, v in moved.items()
            ],
            "milestones": impacted,
            "client_message": _client_message(db, risk, impacted),
        }
    )


def _client_message(db: Session, risk: ScheduleRisk, impacted: list[dict[str, Any]]) -> str:
    """Brouillon de message client (à relire avant envoi) — transparence sans jargon."""
    from app.modules.projects.models import Project

    project = db.get(Project, risk.project_id)
    cause = {
        "weather": "de fortes pluies annoncées",
        "season": "la saison des pluies",
        "supply": "un décalage de livraison de matériaux",
        "absence": "une indisponibilité dans l'équipe",
        "dependency": "un retard sur une étape précédente",
    }.get(risk.kind, "un aléa de chantier")
    lines = [
        f"Bonjour, nous ajustons le planning de « {project.name if project else 'votre projet'} » en raison de {cause}."
    ]
    for m in impacted:
        lines.append(f"L'étape « {m['milestone']} » est désormais prévue le {m['new_date']:%d/%m/%Y}.")
    if not impacted:
        lines.append("Les étapes clés de votre projet restent inchangées.")
    lines.append("Votre chef de projet reste à votre disposition pour en parler.")
    return " ".join(lines)


def notify_client(db: Session, risk: ScheduleRisk, *, message: str, user: Any) -> None:
    from app.modules.projects.models import Project

    project = db.get(Project, risk.project_id)
    emit(
        db,
        "planning.client_notice",
        {
            "project_id": risk.project_id,
            "project_name": project.name if project else "",
            "message": message[:2000],
            "link": "/espace-client/planning",
        },
        aggregate_type="schedule_risk",
        aggregate_id=risk.id,
        project_id=risk.project_id,
        actor_id=user.id,
    )
    risk.evidence = {**(risk.evidence or {}), "client_notified_at": utcnow().isoformat()}


def risk_out(risk: ScheduleRisk, task: Any = None) -> dict[str, Any]:
    return jsonable(
        {
            "id": risk.id,
            "project_id": risk.project_id,
            "task_id": risk.task_id,
            "task_title": task.title if task else None,
            "kind": risk.kind,
            "severity": risk.severity,
            "title": risk.title,
            "detail": risk.detail,
            "evidence": risk.evidence,
            "suggestion": risk.suggestion,
            "status": risk.status,
            "last_detected_at": risk.last_detected_at,
            "decided_at": risk.decided_at,
            "decision_note": risk.decision_note,
        }
    )


__all__ = ["apply", "daily_job", "detect_project", "notify_client", "region", "risk_out", "scan_project"]
