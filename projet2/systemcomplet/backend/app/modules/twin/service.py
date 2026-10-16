"""Jumeau numérique de chantier (innovation I1) — avancement objectif.

1. Pour une zone BIM (ou le chantier entier), les photos récentes sont confrontées par Claude (vision) aux tâches
   attendues : intitulé, lot, avancement planifié à date, avancement déclaré, éléments de la maquette de la zone.
2. L'IA propose un avancement observé par tâche avec un niveau de confiance et l'élément visuel qui le justifie ;
   les écarts significatifs (≥ 15 points) avec le déclaré sont signalés.
3. Un responsable valide ou corrige : les avancements des tâches sont alors mis à jour (source « jumeau »), et
   l'observation est certifiée (empreinte des photos + résultats) — base incontestable de la facturation à
   l'avancement. Le client voit l'avancement mesuré, pas les hypothèses internes.
Sans IA configurée, la mesure par l'image n'est pas disponible (aucune estimation fabriquée).
"""

from __future__ import annotations

import io
import json
import logging
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.utils import jsonable, utcnow
from app.modules.twin.models import ProgressObservation

log = logging.getLogger("globus.twin")
MAX_PHOTOS = 6
MAX_TASKS = 15
GAP_POINTS = 15


def planned_pct(task: Any, today: date) -> float:
    if not task.start_planned or not task.end_planned:
        return 0.0
    if today <= task.start_planned:
        return 0.0
    if today >= task.end_planned:
        return 100.0
    total = (task.end_planned - task.start_planned).days or 1
    return round((today - task.start_planned).days / total * 100, 1)


def _image(data: bytes) -> bytes:
    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src).convert("RGB")
    img.thumbnail((1568, 1568))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def analyze(db: Session, project: Any, *, zone_id: uuid.UUID | None, user_id: uuid.UUID | None) -> ProgressObservation:
    from app.core.files import read_private
    from app.modules.ai.service import SYSTEM_BASE, _json, _record
    from app.modules.bim.models import SpatialZone
    from app.modules.projects.models import Lot, SiteMedia, Task
    from app.modules.system.models import StoredFile
    from app.providers.ai import Attachment, get_ai_provider, strict_schema

    if get_ai_provider() is None:
        raise BusinessRuleError("La mesure par l'image nécessite l'IA (Paramètres › Intégrations)", code="AI_REQUIRED")
    today = date.today()
    zone = db.get(SpatialZone, zone_id) if zone_id else None
    if zone_id and (zone is None or zone.project_id != project.id):
        raise NotFound("Zone introuvable")
    stmt = select(Task).where(
        Task.project_id == project.id,
        Task.deleted_at.is_(None),
        Task.status.not_in(["cancelled"]),
        Task.start_planned.is_not(None),
        Task.start_planned <= today + timedelta(days=7),
    )
    if zone is not None:
        stmt = stmt.where(Task.zone_id == zone.id)
    tasks = [
        t
        for t in db.execute(stmt.order_by(Task.start_planned)).scalars()
        if not (t.status == "done" and t.end_actual and t.end_actual < today - timedelta(days=30))
    ][:MAX_TASKS]
    if not tasks:
        raise BusinessRuleError("Aucune tâche en cours ou proche à mesurer pour cette zone", code="NO_TASKS")
    media_stmt = (
        select(SiteMedia, StoredFile)
        .join(StoredFile, StoredFile.id == SiteMedia.file_id)
        .where(
            SiteMedia.project_id == project.id,
            SiteMedia.media_type == "photo",
            SiteMedia.created_at >= utcnow() - timedelta(days=14),
            StoredFile.deleted_at.is_(None),
        )
        .order_by(SiteMedia.created_at.desc())
        .limit(MAX_PHOTOS)
    )
    if zone is not None:
        media_stmt = media_stmt.where(SiteMedia.zone_id == zone.id)
    photos = db.execute(media_stmt).all()
    if not photos:
        raise BusinessRuleError("Aucune photo du chantier sur les 14 derniers jours pour cette zone", code="NO_PHOTOS")
    lots = {lot.id: lot.name for lot in db.execute(select(Lot).where(Lot.project_id == project.id)).scalars()}
    listing = [
        {
            "index": i,
            "tache": t.title,
            "lot": lots.get(t.lot_id),
            "avancement_planifie_pct": planned_pct(t, today),
            "avancement_declare_pct": float(t.progress_pct or 0),
        }
        for i, t in enumerate(tasks)
    ]
    context = {
        "projet": project.name,
        "zone": {
            "nom": zone.name,
            "niveau": zone.level,
            "elements_maquette": len(zone.element_ids or []),
            "checklist": zone.checklist,
        }
        if zone
        else None,
        "taches": listing,
    }
    schema = strict_schema(
        {
            "tasks": {
                "type": "array",
                "items": strict_schema(
                    {
                        "index": {"type": "integer"},
                        "observed_pct": {"type": "integer"},
                        "confidence": {"type": "string", "enum": ["faible", "moyenne", "bonne"]},
                        "evidence": {"type": "string"},
                    }
                ),
            },
            "summary": {"type": "string"},
            "anomalies": {"type": "array", "items": {"type": "string"}},
        }
    )
    system = (
        SYSTEM_BASE
        + " Tu es conducteur de travaux. À partir des photos (les plus récentes d'abord), estime pour chaque tâche "
        "l'avancement RÉELLEMENT visible (0-100 %), avec un niveau de confiance et l'élément visuel qui le justifie. "
        "Si une tâche n'est pas visible sur les photos, confiance « faible » et reprends l'avancement déclaré. "
        "Signale les anomalies visibles (malfaçon, sécurité, ouvrage non conforme). N'invente rien."
    )
    attachments = [Attachment(data=_image(read_private(stored)), media_type="image/jpeg") for _, stored in photos]
    data, result, error = _json(
        "progress_twin",
        system=system,
        prompt="Contexte (JSON) :\n" + json.dumps(context, ensure_ascii=False, default=str),
        schema=schema,
        effort="medium",
        attachments=attachments,
    )
    if data is None:
        raise BusinessRuleError(f"Analyse indisponible : {error or 'réessayez plus tard'}", code="AI_FAILED")
    by_index = {int(r["index"]): r for r in data.get("tasks", []) if 0 <= int(r.get("index", -1)) < len(tasks)}
    results = []
    for i, task in enumerate(tasks):
        r = by_index.get(i)
        observed = max(0, min(100, int(r["observed_pct"]))) if r else None
        declared = float(task.progress_pct or 0)
        results.append(
            {
                "task_id": str(task.id),
                "title": task.title,
                "planned_pct": planned_pct(task, today),
                "declared_pct": declared,
                "observed_pct": observed,
                "confidence": r["confidence"] if r else "faible",
                "evidence": r["evidence"] if r else "Non visible sur les photos",
                "gap": None if observed is None else round(observed - declared, 1),
                "flag": observed is not None and abs(observed - declared) >= GAP_POINTS,
            }
        )
    measured = [r["observed_pct"] for r in results if r["observed_pct"] is not None]
    observation = ProgressObservation(
        project_id=project.id,
        zone_id=zone.id if zone else None,
        observed_on=today,
        media_ids=[str(m.id) for m, _ in photos],
        results=jsonable(results),
        summary=str(data.get("summary") or "")[:4000],
        anomalies=[str(a)[:500] for a in data.get("anomalies", [])][:20],
        overall_observed_pct=Decimal(str(round(sum(measured) / len(measured), 1))) if measured else None,
        ai_used=True,
        created_by_id=user_id,
    )
    db.add(observation)
    db.flush()
    _record(
        db,
        feature="progress_twin",
        user_id=user_id,
        entity_type="progress_observation",
        entity_id=observation.id,
        source=json.dumps(context, ensure_ascii=False, default=str),
        result=result,
        output=data,
        validation="pending",
    )
    return observation


def validate(
    db: Session, observation: ProgressObservation, *, adjustments: dict[str, int], note: str | None, user: Any
) -> ProgressObservation:
    """Validation humaine : mise à jour des avancements (source « jumeau ») + certification de l'observation."""
    from app.modules.projects.models import SiteMedia, Task
    from app.modules.projects.service import update_task_progress
    from app.modules.proofs.service import canonical_sha256, certify, merkle_root
    from app.modules.system.models import StoredFile

    if observation.status != "pending":
        raise BusinessRuleError("Observation déjà traitée")
    final = []
    for r in observation.results:
        pct = adjustments.get(r["task_id"], r["observed_pct"])
        if pct is None:
            final.append({**r, "validated_pct": None})
            continue
        task = db.get(Task, uuid.UUID(r["task_id"]))
        if task is not None and abs(float(task.progress_pct or 0) - float(pct)) >= 0.5:
            update_task_progress(
                db,
                task,
                pct=Decimal(str(pct)),
                note=f"Avancement mesuré (jumeau numérique) : {note or ''}".strip(),
                evidence=observation.media_ids,
                user_id=user.id,
                source="twin",
            )
        final.append({**r, "validated_pct": pct})
    observation.results = jsonable(final)
    observation.status = "validated"
    observation.decided_by_id = user.id
    observation.decided_at = utcnow()
    observation.decision_note = note
    checksums = []
    for mid in observation.media_ids:
        media = db.get(SiteMedia, uuid.UUID(mid))
        stored = db.get(StoredFile, media.file_id) if media else None
        if stored is not None:
            checksums.append(stored.checksum_sha256)
    record_hash = canonical_sha256(
        {"observation": str(observation.id), "results": final, "on": observation.observed_on}
    )
    proof = certify(
        db,
        subject_type="progress_observation",
        subject_id=observation.id,
        title=f"Avancement mesuré du {observation.observed_on:%d/%m/%Y}",
        sha256=merkle_root([record_hash, *checksums]),
        project_id=observation.project_id,
        summary={"tasks": len(final), "photos": len(checksums), "validated_by": user.full_name},
        leaves=[{"label": "Résultats validés", "sha256": record_hash}]
        + [{"label": f"Photo {i + 1}", "sha256": c} for i, c in enumerate(checksums)],
        client_visible=True,
        actor_id=user.id,
    )
    observation.proof_code = proof.public_code
    emit(
        db,
        "twin.validated",
        {
            "id": observation.id,
            "project_id": observation.project_id,
            "overall": observation.overall_observed_pct,
            "flags": sum(1 for r in final if r.get("flag")),
            "link": "/espace-client/chantier",
        },
        aggregate_type="progress_observation",
        aggregate_id=observation.id,
        project_id=observation.project_id,
    )
    return observation


def observation_out(observation: ProgressObservation, *, internal: bool) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": observation.id,
        "zone_id": observation.zone_id,
        "observed_on": observation.observed_on,
        "overall_observed_pct": observation.overall_observed_pct,
        "status": observation.status,
        "proof_code": observation.proof_code,
        "results": [
            {
                "title": r["title"],
                "planned_pct": r["planned_pct"],
                "observed_pct": r.get("validated_pct", r["observed_pct"]),
            }
            for r in observation.results
        ]
        if not internal
        else observation.results,
    }
    if internal:
        data.update(
            {
                "summary": observation.summary,
                "anomalies": observation.anomalies,
                "media_ids": observation.media_ids,
                "decision_note": observation.decision_note,
                "decided_at": observation.decided_at,
                "created_at": observation.created_at,
            }
        )
    return jsonable(data)


def get(db: Session, observation_id: uuid.UUID) -> ProgressObservation:
    observation = db.get(ProgressObservation, observation_id)
    if observation is None:
        raise NotFound("Observation introuvable")
    return observation


__all__ = ["analyze", "get", "observation_out", "planned_pct", "validate"]
