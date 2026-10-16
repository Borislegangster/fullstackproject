"""Planificateur de jobs (historique des jobs §22.1) avec verrou consultatif PostgreSQL par job
(une seule exécution simultanée même avec plusieurs workers)."""

from __future__ import annotations

import importlib
import logging
import time
import zlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.core import metrics
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.utils import utcnow
from app.modules.system.models import JobRun

log = logging.getLogger("globus.scheduler")


@dataclass
class Job:
    name: str
    target: str  # "module.path:function" — fonction(db) -> int | dict
    every_seconds: int | None = None
    daily_at: str | None = None  # "HH:MM" heure locale (Africa/Douala)
    weekday: int | None = None  # 0 = lundi (avec daily_at)
    description: str = ""


JOBS: list[Job] = [
    Job(
        "cms_publication",
        "app.modules.cms.service:run_scheduled_publication",
        every_seconds=60,
        description="Publications / dépublications planifiées du CMS",
    ),
    Job(
        "missed_calls",
        "app.modules.communications.service:mark_missed_calls",
        every_seconds=30,
        description="Appels restés en sonnerie : marqués manqués + notification",
    ),
    Job(
        "sla_monitor",
        "app.modules.crm.service:monitor_sla",
        every_seconds=300,
        description="SLA leads : relances et escalades",
    ),
    Job(
        "support_sla_monitor",
        "app.modules.support.service:monitor_sla",
        every_seconds=300,
        description="SLA tickets SAV",
    ),
    Job(
        "aps_translation_poll",
        "app.modules.bim.service:poll_translations",
        every_seconds=120,
        description="Suivi des traductions APS Model Derivative",
    ),
    Job(
        "newsletter_scheduler",
        "app.modules.newsletter.service:run_scheduled_campaigns",
        every_seconds=60,
        description="Envoi des campagnes programmées",
    ),
    Job(
        "automation_runner",
        "app.modules.newsletter.service:run_automations",
        every_seconds=300,
        description="Automatisations marketing",
    ),
    Job(
        "payment_reconciliation",
        "app.modules.finance.payments:reconcile_pending",
        every_seconds=120,
        description="Relecture des paiements et transferts en attente auprès des prestataires (MoMo, Orange, …)",
    ),
    Job(
        "overdue_checks",
        "app.workers.periodic:overdue_checks",
        every_seconds=3600,
        description="Échéances : appels de fonds, factures, actions correctives, dossiers, maintenance, stocks",
    ),
    Job(
        "daily_reminders",
        "app.workers.periodic:daily_reminders",
        daily_at="08:00",
        description="Rappels quotidiens (actions en retard, dossiers, maintenance, stocks bas)",
    ),
    Job(
        "webhook_retries",
        "app.modules.admin.webhooks:retry_pending",
        every_seconds=120,
        description="Reprise des webhooks sortants",
    ),
    Job(
        "calendar_reminders",
        "app.modules.agenda.service:send_reminders",
        every_seconds=300,
        description="Rappels d'agenda",
    ),
    Job(
        "analytics_aggregation",
        "app.modules.analytics.service:aggregate_daily",
        daily_at="01:30",
        description="Agrégats analytics quotidiens",
    ),
    Job(
        "anomaly_detection",
        "app.modules.ai.service:detect_anomalies",
        daily_at="02:00",
        description="Détection d'anomalies (factures, quantités, paiements)",
    ),
    Job(
        "predictions",
        "app.modules.ai.service:compute_predictions",
        daily_at="02:30",
        description="Prévisions coût / délai (EVM)",
    ),
    Job(
        "retention_purge",
        "app.workers.periodic:retention_purge",
        daily_at="03:00",
        description="Purge contrôlée (clés d'idempotence, sessions expirées, enregistrements d'appels)",
    ),
    Job(
        "billing_reminders",
        "app.modules.billing.lifecycle:send_payment_reminders",
        daily_at="08:00",
        description="Relances d'échéance des factures clients (J-3, J+1, J+7, J+15, J+30) et escalade finance",
    ),
    Job(
        "payment_plan_reminders",
        "app.modules.billing.collections:send_plan_reminders",
        daily_at="08:10",
        description="Échéanciers : rappels par échéance (J-3, J+1, J+7) avec lien de paiement, détection des défauts",
    ),
    Job(
        "backup_daily",
        "app.modules.admin.backups:scheduled_backup",
        daily_at="03:30",
        description="Sauvegarde quotidienne base + fichiers",
    ),
    Job(
        "client_digest",
        "app.modules.projects.digest:send_weekly_digests",
        daily_at="07:00",
        weekday=0,
        description="Digest hebdomadaire client",
    ),
    Job(
        "trust_snapshots",
        "app.modules.projects.trust:snapshot_all",
        daily_at="06:00",
        description="Indice de confiance des chantiers (historique, tendance, alerte en cas de chute)",
    ),
    Job(
        "executive_report",
        "app.modules.reports.executive:weekly_job",
        daily_at="06:30",
        weekday=0,
        description="Rapport de direction hebdomadaire (indicateurs figés, synthèse IA ou règles, PDF)",
    ),
    Job(
        "weekly_timelapses",
        "app.modules.timelapse.service:weekly_job",
        daily_at="06:45",
        weekday=0,
        description="Time-lapse hebdomadaire des chantiers (caméras 4G / photos publiées), envoi au client",
    ),
    Job(
        "market_prices",
        "app.modules.market.service:daily_job",
        daily_at="05:30",
        description="Indice des prix des matériaux (collecte ERP / extranet) et recommandations d'achat anticipé",
    ),
    Job(
        "planning_risks",
        "app.modules.scheduling.service:daily_job",
        daily_at="05:45",
        description="Planning intelligent : risques pluie / livraison / absence / dépendance et replanification",
    ),
    Job(
        "maintenance",
        "app.modules.maintenance.service:daily_job",
        daily_at="07:30",
        description="Carnet d'entretien : rappels clients (J-14, J-1) et alertes de SAV prédictif",
    ),
    Job(
        "escrow_reviews",
        "app.modules.escrow.service:overdue_reviews",
        daily_at="09:00",
        description="Séquestre : demandes de libération sans réponse du client dans le délai → alerte Direction",
    ),
    Job(
        "proof_photo_batches",
        "app.modules.proofs.service:certify_recent_photos",
        every_seconds=3600,
        description="Certification des photos de chantier (racine de Merkle par chantier et par jour)",
    ),
    Job(
        "proof_anchoring",
        "app.modules.proofs.service:anchor_pending",
        every_seconds=600,
        description="Horodatage OpenTimestamps des preuves en attente (si ANCHORING_ENABLED)",
    ),
    Job(
        "outbox_recovery",
        "app.workers.outbox:recover_stuck",
        every_seconds=300,
        description="Reprise des événements bloqués",
    ),
]

_last_run: dict[str, float] = {}
_last_daily: dict[str, str] = {}


def _resolve(target: str) -> Callable[..., Any]:
    module, _, func = target.partition(":")
    return getattr(importlib.import_module(module), func)


def _lock_key(name: str) -> int:
    return 74_300_000 + zlib.crc32(name.encode()) % 1_000_000


def run_job(job: Job) -> dict[str, Any]:
    db = SessionLocal()
    run = None
    try:
        got = db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": _lock_key(job.name)}).scalar()
        if not got:
            return {"skipped": "locked"}
        run = JobRun(job=job.name, status="running")
        db.add(run)
        db.commit()
        func = _resolve(job.target)
        result = func(db)
        db.commit()
        run.status = "success"
        run.items = (
            int(result)
            if isinstance(result, int)
            else int((result or {}).get("items", 0))
            if isinstance(result, dict)
            else 0
        )
        run.details = result if isinstance(result, dict) else {}
        metrics.job_runs.labels(job.name, "success").inc()
        return {"status": "success", "result": result}
    except Exception as exc:
        db.rollback()
        metrics.job_runs.labels(job.name, "failed").inc()
        log.exception("job_failed", extra={"job": job.name})
        if run is not None:
            run = db.merge(run)
            run.status = "failed"
            run.error = f"{type(exc).__name__}: {exc}"[:2000]
            from app.core.events import emit

            emit(db, "system.alert", {"title": f"Job {job.name} en échec", "message": run.error[:300]})
        return {"status": "failed", "error": str(exc)}
    finally:
        try:
            if run is not None:
                run.finished_at = utcnow()
                db.commit()
            db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _lock_key(job.name)})
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
        db.close()


def due_jobs(now: float | None = None) -> list[Job]:
    now = now or time.time()
    local = datetime.now(ZoneInfo(settings.TIMEZONE))
    due: list[Job] = []
    for job in JOBS:
        if job.every_seconds:
            if now - _last_run.get(job.name, 0) >= job.every_seconds:
                due.append(job)
        elif job.daily_at:
            if job.weekday is not None and local.weekday() != job.weekday:
                continue
            stamp = local.strftime("%Y-%m-%d")
            if local.strftime("%H:%M") >= job.daily_at and _last_daily.get(job.name) != stamp:
                due.append(job)
    return due


def tick() -> int:
    ran = 0
    for job in due_jobs():
        _last_run[job.name] = time.time()
        if job.daily_at:
            _last_daily[job.name] = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d")
        run_job(job)
        ran += 1
    return ran


def job_catalog() -> list[dict[str, Any]]:
    return [
        {
            "name": j.name,
            "every_seconds": j.every_seconds,
            "daily_at": j.daily_at,
            "weekday": j.weekday,
            "description": j.description,
        }
        for j in JOBS
    ]


def run_by_name(name: str) -> dict[str, Any]:
    for job in JOBS:
        if job.name == name:
            return run_job(job)
    raise KeyError(name)
