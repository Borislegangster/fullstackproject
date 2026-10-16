"""Hub BIM §10 (étapes 62 → 74) : import versionné en GED, traitement APS Model Derivative (ou visionneuse Three.js
pour glTF/GLB/OBJ/STL/IFC), disciplines, annotations temps réel ancrées à une version précise, issues, clash
manuel / assisté (boîtes englobantes + règles), zones spatiales QR, publication client."""

from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import date
from decimal import Decimal
from pathlib import PurePath
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.events import emit
from app.core.files import ValidatedUpload
from app.core.numbering import next_number
from app.core.security import random_token
from app.core.utils import slugify, utcnow
from app.modules.bim.models import (
    DEFAULT_DISCIPLINES,
    BimAnnotation,
    BimIssue,
    BimModel,
    BimVersion,
    Clash,
    ClashRule,
    Derivative,
    DisciplineLayer,
    SpatialZone,
)

log = logging.getLogger("globus.bim")
THREE_FORMATS = {"glb", "gltf", "obj", "stl", "fbx", "3ds"}
APS_FORMATS = {"rvt", "dwg", "dxf", "ifc", "skp", "nwd", "nwc", "pdf"}


# ============================================================================ disciplines
def disciplines(db: Session, project_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = {d.key: d for d in db.execute(select(DisciplineLayer).where(DisciplineLayer.project_id.is_(None))).scalars()}
    rows.update(
        {
            d.key: d
            for d in db.execute(select(DisciplineLayer).where(DisciplineLayer.project_id == project_id)).scalars()
        }
    )
    if rows:
        return [
            {"key": d.key, "name": d.name, "color": d.color, "visible": d.visible_by_default, "sort": d.sort_order}
            for d in sorted(rows.values(), key=lambda d: d.sort_order)
        ]
    return [
        {"key": k, "name": n, "color": c, "visible": True, "sort": i} for i, (k, n, c) in enumerate(DEFAULT_DISCIPLINES)
    ]


def global_disciplines(db: Session) -> list[dict[str, Any]]:
    """Référentiel global des disciplines (calques sans projet), à défaut la liste par défaut."""
    rows = db.execute(
        select(DisciplineLayer).where(DisciplineLayer.project_id.is_(None)).order_by(DisciplineLayer.sort_order)
    ).scalars()
    # Une clé par discipline : l'unicité (project_id, key) ne s'applique pas aux lignes globales (project_id NULL).
    unique = {d.key: d for d in reversed(list(rows))}
    if unique:
        return [{"key": d.key, "name": d.name} for d in sorted(unique.values(), key=lambda d: d.sort_order)]
    return [{"key": k, "name": n} for k, n, _c in DEFAULT_DISCIPLINES]


def ensure_known_disciplines(
    values: list[str] | None, known: list[dict[str, Any]], *, tolerated: list[str] | None = None
) -> None:
    """Refuse toute discipline absente de la liste proposée ; `tolerated` garde les valeurs déjà enregistrées."""
    keys = {d["key"] for d in known} | set(tolerated or [])
    unknown = [v for v in values or [] if v not in keys]
    if unknown:
        raise BusinessRuleError(
            f"Discipline inconnue : {', '.join(unknown)}. Choisissez-la dans la liste proposée.",
            code="UNKNOWN_DISCIPLINE",
        )


def discipline_key(name: str) -> str:
    """Clé technique d'un calque dérivée de son nom (« Façades & bardage » → facades_bardage)."""
    return slugify(re.sub(r"[^\w]+", " ", name), max_length=40).replace("-", "_")  # ’ & / … séparent


def ensure_default_disciplines(db: Session) -> None:
    rows = db.execute(
        select(DisciplineLayer).where(DisciplineLayer.project_id.is_(None)).order_by(DisciplineLayer.created_at)
    ).scalars()
    seen: set[str] = set()
    for row in rows:  # doublons hérités d'un ancien double semis : on garde la ligne la plus ancienne
        if row.key in seen:
            db.delete(row)
        seen.add(row.key)
    if seen:
        return
    for index, (key, name, color) in enumerate(DEFAULT_DISCIPLINES):
        db.add(DisciplineLayer(project_id=None, key=key, name=name, color=color, sort_order=index))


# ============================================================================ versions (62 → 66, 72 → 74)
def source_format(filename: str) -> str:
    ext = PurePath(filename).suffix.lower().lstrip(".")
    if ext not in THREE_FORMATS | APS_FORMATS:
        raise BusinessRuleError(
            "Format non pris en charge (RVT, DWG, DXF, IFC, SKP, NWD, PDF, GLB, glTF, OBJ, STL, FBX)",
            code="UNSUPPORTED_BIM_FORMAT",
        )
    return ext


def upload_version(
    db: Session, *, access: Access, model: BimModel, upload: ValidatedUpload, revision_reason: str | None
) -> BimVersion:
    """Stockage GED (document « maquette_bim », version vN) puis version BIM liée au fichier exact."""
    from app.modules.documents import service as ged
    from app.modules.documents.models import Document, DocumentVersion

    fmt = source_format(upload.filename)
    previous = (
        db.execute(select(BimVersion).where(BimVersion.model_id == model.id).order_by(BimVersion.number.desc()))
        .scalars()
        .first()
    )
    if previous is not None and not (revision_reason or "").strip():
        raise BusinessRuleError(
            "Motif de révision obligatoire pour une nouvelle version", code="REVISION_REASON_REQUIRED"
        )
    document = None
    if previous is not None and previous.document_version_id:
        prev_doc_version = db.get(DocumentVersion, previous.document_version_id)
        document = db.get(Document, prev_doc_version.document_id) if prev_doc_version else None
    if document is None:
        document, doc_version = ged.create_document(
            db,
            access=access,
            upload=upload,
            title=f"Maquette {model.name}",
            doc_type="maquette_bim",
            project_id=model.project_id,
            site_id=None,
            lot_id=None,
            folder_id=None,
            discipline=model.discipline,
            confidentiality="internal",
            description=model.description,
            tags=["bim", model.discipline],
        )
    else:
        doc_version = ged.new_version(
            db,
            access=access,
            document=document,
            upload=upload,
            reason=revision_reason or "Nouvelle version maquette",
            major=True,
        )
    from app.core.config import settings
    from app.providers.aps import aps_configured

    if fmt in THREE_FORMATS:
        viewer, status, error = "three", "ready", None
    elif aps_configured():
        viewer, status, error = "aps", "uploaded", None
    elif fmt == "ifc":
        viewer, status, error = "three", "ready", None  # visionneuse IFC navigateur (web-ifc)
    else:
        viewer, status, error = "aps", "failed", "Traitement Autodesk APS non configuré (APS_CLIENT_ID / secret)"
    version = BimVersion(
        model_id=model.id,
        number=(previous.number + 1) if previous else 1,
        document_version_id=doc_version.id,
        file_id=doc_version.file_id,
        source_format=fmt,
        viewer=viewer,
        status=status,
        translation_error=error,
        revision_reason=revision_reason,
        uploaded_by_id=access.p.id,
    )
    db.add(version)
    db.flush()
    model.current_version_id = version.id
    if status == "uploaded":
        emit(
            db,
            "bim.translate",
            {"version_id": version.id},
            aggregate_type="bim_version",
            aggregate_id=version.id,
            project_id=model.project_id,
        )
    elif status == "ready":
        _ready(db, model, version)
    audit.record(
        db,
        family="business",
        module="bim",
        action="VERSION_UPLOAD",
        resource_type="bim_version",
        resource_id=version.id,
        project_id=model.project_id,
        actor_id=access.p.id,
        diff={
            "model": model.name,
            "number": version.number,
            "format": fmt,
            "viewer": viewer,
            "aps_region": settings.APS_REGION if viewer == "aps" else None,
        },
    )
    return version


def _ready(db: Session, model: BimModel, version: BimVersion) -> None:
    emit(
        db,
        "bim.version_ready",
        {"model_id": model.id, "model": model.name, "number": version.number, "uploaded_by_id": version.uploaded_by_id},
        aggregate_type="bim_version",
        aggregate_id=version.id,
        project_id=model.project_id,
    )


def start_translation(db: Session, version: BimVersion) -> BimVersion:
    """Worker : envoi APS OSS + job Model Derivative (SVF2 2D/3D)."""
    from app.core.files import read_private
    from app.modules.system.models import StoredFile
    from app.providers import aps

    if version.status != "uploaded":
        return version
    stored = db.get(StoredFile, version.file_id)
    data = read_private(stored)
    key = f"v{version.id.hex}-{stored.original_name}".replace(" ", "_")[:200]
    object_id = aps.upload(key, data)
    urn = aps.to_urn(object_id)
    aps.translate(urn)
    version.aps_object_id = object_id
    version.aps_urn = urn
    version.status = "translating"
    version.translation_progress = "0% complete"
    return version


def poll_translations(db: Session) -> dict[str, Any]:
    """Job : suivi des traductions APS (manifest) → dérivés 2D/3D, statut prêt / échec."""
    from app.providers import aps

    if not aps.aps_configured():
        return {"items": 0, "skipped": "aps_not_configured"}
    done = 0
    for version in db.execute(select(BimVersion).where(BimVersion.status == "translating").limit(50)).scalars():
        try:
            data = aps.manifest(version.aps_urn or "")
        except Exception as exc:  # noqa: BLE001 — nouvelle tentative au prochain passage
            log.warning("aps_manifest_failed", extra={"version": str(version.id), "error": str(exc)[:200]})
            continue
        version.translation_progress = data.get("progress")
        status = data.get("status")
        model = db.get(BimModel, version.model_id)
        if status == "success":
            version.manifest = {"status": status, "progress": data.get("progress")}
            version.derivatives.clear()
            for item in aps.derivatives_from_manifest(data):
                version.derivatives.append(Derivative(**item))
            version.status = "ready"
            if model:
                _ready(db, model, version)
            done += 1
        elif status in ("failed", "timeout"):
            version.status = "failed"
            version.translation_error = str(data.get("derivatives", [{}])[0].get("messages", ""))[:2000] or status
            done += 1
    return {"items": done}


def validate_version(db: Session, version: BimVersion, *, user_id: uuid.UUID) -> BimVersion:
    if version.status != "ready":
        raise BusinessRuleError("Version non prête (traduction en cours ou en échec)", code="VERSION_NOT_READY")
    version.status = "validated"
    version.validated_by_id = user_id
    version.validated_at = utcnow()
    audit.record(
        db,
        family="business",
        module="bim",
        action="VERSION_VALIDATE",
        resource_type="bim_version",
        resource_id=version.id,
        actor_id=user_id,
    )
    return version


def publish_version(
    db: Session, model: BimModel, version: BimVersion, *, user_id: uuid.UUID, to_client: bool
) -> BimVersion:
    """Publication : la version publiée précédente devient obsolète (jamais redevenir la vérité par erreur)."""
    if version.status not in ("validated", "published"):
        raise BusinessRuleError("Valider la version avant publication", code="VERSION_NOT_VALIDATED")
    if model.published_version_id and model.published_version_id != version.id:
        previous = db.get(BimVersion, model.published_version_id)
        if previous is not None and previous.number > version.number:
            raise BusinessRuleError("Une version plus récente est déjà publiée")
        if previous is not None:
            previous.status = "obsolete"
            previous.obsolete_at = utcnow()
            previous.published_to_client = False
    version.status = "published"
    version.published_at = utcnow()
    version.published_to_client = to_client
    model.published_version_id = version.id
    if to_client:
        emit(
            db,
            "bim.version_published",
            {"model": model.name, "number": version.number, "model_id": model.id},
            aggregate_type="bim_version",
            aggregate_id=version.id,
            project_id=model.project_id,
        )
    audit.record(
        db,
        family="business",
        module="bim",
        action="VERSION_PUBLISH",
        resource_type="bim_version",
        resource_id=version.id,
        project_id=model.project_id,
        actor_id=user_id,
        diff={"client": to_client},
    )
    return version


def federation(db: Session, project_id: uuid.UUID, *, client_only: bool = False) -> dict[str, Any]:
    """Vue fédérée multi-disciplines (V4-BIM-20) : dernière version exploitable de chaque maquette."""
    layers = {d["key"]: d for d in disciplines(db, project_id)}
    models = (
        db.execute(
            select(BimModel)
            .where(BimModel.project_id == project_id, BimModel.deleted_at.is_(None))
            .order_by(BimModel.discipline, BimModel.name)
        )
        .scalars()
        .all()
    )
    out = []
    for model in models:
        if client_only:
            version = db.get(BimVersion, model.published_version_id) if model.published_version_id else None
            if version is None or not version.published_to_client:
                continue
        else:
            version = (
                db.execute(
                    select(BimVersion)
                    .where(BimVersion.model_id == model.id, BimVersion.status.in_(["ready", "validated", "published"]))
                    .order_by(BimVersion.number.desc())
                )
                .scalars()
                .first()
            )
        if version is None:
            continue
        layer = layers.get(model.discipline, {"name": model.discipline, "color": "#385AA6"})
        out.append(
            {
                "model_id": model.id,
                "model": model.name,
                "discipline": model.discipline,
                "discipline_name": layer["name"],
                "color": layer["color"],
                "version_id": version.id,
                "number": version.number,
                "status": version.status,
                "viewer": version.viewer,
                "urn": version.aps_urn,
                "format": version.source_format,
            }
        )
    return {"project_id": project_id, "disciplines": list(layers.values()), "models": out}


# ============================================================================ annotations (V4-BIM-21 / 23)
def create_annotation(
    db: Session, *, version: BimVersion, project_id: uuid.UUID, data: dict[str, Any], user_id: uuid.UUID
) -> BimAnnotation:
    if version.status in ("failed", "uploaded", "translating"):
        raise BusinessRuleError("Version non consultable")
    annotation = BimAnnotation(version_id=version.id, project_id=project_id, author_id=user_id, **data)
    db.add(annotation)
    db.flush()
    return annotation


def update_annotation(
    db: Session, annotation: BimAnnotation, *, values: dict[str, Any], expected_version: int, user_id: uuid.UUID
) -> BimAnnotation:
    """Concurrence optimiste : une modification basée sur une version périmée est refusée (pas d'écrasement)."""
    if annotation.version != expected_version:
        raise Conflict(
            "Annotation modifiée entre-temps", code="VERSION_CONFLICT", details={"server_version": annotation.version}
        )
    if annotation.author_id != user_id:
        raise BusinessRuleError("Seul l'auteur peut modifier son annotation")
    for key, value in values.items():
        setattr(annotation, key, value)
    db.flush()
    return annotation


# ============================================================================ issues (V4-BIM-22)
def create_issue(db: Session, *, project_id: uuid.UUID, data: dict[str, Any], user_id: uuid.UUID) -> BimIssue:
    if data.get("version_id"):
        version = db.get(BimVersion, data["version_id"])
        model = db.get(BimModel, version.model_id) if version else None
        if model is None or model.project_id != project_id:
            raise BusinessRuleError("Version hors projet")
        data.setdefault("model_id", model.id)
    issue = BimIssue(number=next_number(db, "bim_issue"), project_id=project_id, created_by_id=user_id, **data)
    db.add(issue)
    db.flush()
    if issue.assignee_id:
        notify_assignee(db, issue)
    audit.record(
        db,
        family="business",
        module="bim",
        action="ISSUE_CREATE",
        resource_type="bim_issue",
        resource_id=issue.id,
        project_id=project_id,
        actor_id=user_id,
        diff={"priority": issue.priority, "version": str(issue.version_id) if issue.version_id else None},
    )
    return issue


def notify_assignee(db: Session, issue: BimIssue) -> None:
    emit(
        db,
        "bim.issue_assigned",
        {
            "id": issue.id,
            "number": issue.number,
            "title": issue.title,
            "priority": issue.priority,
            "due_date": issue.due_date,
            "assignee_id": issue.assignee_id,
        },
        aggregate_type="bim_issue",
        aggregate_id=issue.id,
        project_id=issue.project_id,
    )


ISSUE_FLOW = {
    "open": {"in_progress", "resolved", "closed"},
    "in_progress": {"resolved", "open"},
    "resolved": {"closed", "reopened"},
    "reopened": {"in_progress", "resolved"},
    "closed": {"reopened"},
}


def transition_issue(
    db: Session,
    issue: BimIssue,
    *,
    target: str,
    user_id: uuid.UUID,
    note: str | None,
    resolved_in_version_id: uuid.UUID | None,
    can_close: bool,
) -> BimIssue:
    if target not in ISSUE_FLOW.get(issue.status, set()):
        raise BusinessRuleError(f"Transition {issue.status} → {target} interdite", code="INVALID_TRANSITION")
    if target == "resolved":
        if not (note or "").strip():
            raise BusinessRuleError("Note de résolution requise")
        issue.resolution_note = note
        issue.resolved_at = utcnow()
        if resolved_in_version_id:
            version = db.get(BimVersion, resolved_in_version_id)
            if version is None or version.model_id != issue.model_id:
                raise BusinessRuleError("Version de correction d'une autre maquette")
            issue.resolved_in_version_id = resolved_in_version_id
        emit(
            db,
            "bim.issue_resolved",
            {"id": issue.id, "number": issue.number, "title": issue.title, "created_by_id": issue.created_by_id},
            aggregate_type="bim_issue",
            aggregate_id=issue.id,
            project_id=issue.project_id,
        )
    if target == "closed":
        if not can_close and issue.created_by_id != user_id:
            raise BusinessRuleError("Clôture réservée à l'émetteur ou au coordinateur BIM", code="CLOSE_FORBIDDEN")
        issue.closed_at = utcnow()
    if target == "reopened":
        issue.closed_at = None
        issue.resolved_at = None
    previous = issue.status
    issue.status = target
    if issue.clash_id and target in ("resolved", "closed"):
        clash = db.get(Clash, issue.clash_id)
        if clash is not None:
            clash.status = "resolved"
            clash.resolved_at = clash.resolved_at or utcnow()
    audit.record(
        db,
        family="business",
        module="bim",
        action="ISSUE_TRANSITION",
        resource_type="bim_issue",
        resource_id=issue.id,
        project_id=issue.project_id,
        actor_id=user_id,
        diff={"from": previous, "to": target},
        reason=note,
    )
    return issue


# ============================================================================ clash detection (§10.4)
def clash_signature(object_a: dict[str, Any], object_b: dict[str, Any], clash_type: str) -> str:
    keys = sorted(
        [str(object_a.get("guid") or object_a.get("db_id")), str(object_b.get("guid") or object_b.get("db_id"))]
    )
    return hashlib.sha256(f"{keys[0]}|{keys[1]}|{clash_type}".encode()).hexdigest()


def _bbox(element: dict[str, Any]) -> tuple[float, ...]:
    box = element.get("bbox") or []
    if len(box) != 6:
        raise BusinessRuleError("Boîte englobante invalide (minX, minY, minZ, maxX, maxY, maxZ attendus)")
    values = tuple(float(v) for v in box)
    if any(values[i] > values[i + 3] for i in range(3)):
        raise BusinessRuleError("Boîte englobante incohérente (min > max)")
    return values


def _gap(a: tuple[float, ...], b: tuple[float, ...]) -> float:
    """Distance entre deux boîtes (0 si chevauchement) et profondeur de chevauchement négative."""
    dx = max(b[0] - a[3], a[0] - b[3], 0.0)
    dy = max(b[1] - a[4], a[1] - b[4], 0.0)
    dz = max(b[2] - a[5], a[2] - b[5], 0.0)
    distance = (dx * dx + dy * dy + dz * dz) ** 0.5
    if distance > 0:
        return distance
    overlap = min(a[3] - b[0], b[3] - a[0], a[4] - b[1], b[4] - a[1], a[5] - b[2], b[5] - a[2])
    return -overlap


def detect_clashes(
    db: Session,
    *,
    project_id: uuid.UUID,
    rule: ClashRule,
    version_a: BimVersion,
    version_b: BimVersion,
    elements_a: list[dict[str, Any]],
    elements_b: list[dict[str, Any]],
    user_id: uuid.UUID,
    max_results: int = 2000,
) -> dict[str, Any]:
    """Clash assisté : intersections de boîtes englobantes (balayage trié sur X) selon la règle (tolérance en mm,
    unités du modèle en mètres) ; empreinte pour récurrence et dédoublonnage."""
    tolerance = float(rule.tolerance_mm) / 1000
    boxes_a = sorted(((_bbox(e), e) for e in elements_a), key=lambda x: x[0][0])
    boxes_b = sorted(((_bbox(e), e) for e in elements_b), key=lambda x: x[0][0])
    created, recurring, skipped = 0, 0, 0
    start = 0
    for box_a, elem_a in boxes_a:
        while start < len(boxes_b) and boxes_b[start][0][3] + tolerance < box_a[0]:
            start += 1
        index = start
        while index < len(boxes_b) and boxes_b[index][0][0] - tolerance <= box_a[3]:
            box_b, elem_b = boxes_b[index]
            index += 1
            if (elem_a.get("guid") and elem_a.get("guid") == elem_b.get("guid")) and rule.clash_type != "duplicate":
                continue
            gap = _gap(box_a, box_b)
            hit = {
                "hard": gap < -tolerance,
                "soft": gap < 0,
                "clearance": gap < tolerance,
                "duplicate": gap < 0 and abs(gap) >= min(box_a[3] - box_a[0], box_b[3] - box_b[0]) * 0.9,
            }[rule.clash_type]
            if not hit:
                continue
            object_a = {k: elem_a.get(k) for k in ("db_id", "guid", "name")} | {"discipline": rule.discipline_a}
            object_b = {k: elem_b.get(k) for k in ("db_id", "guid", "name")} | {"discipline": rule.discipline_b}
            signature = clash_signature(object_a, object_b, rule.clash_type)
            existing = (
                db.execute(
                    select(Clash)
                    .where(Clash.project_id == project_id, Clash.signature == signature)
                    .order_by(Clash.created_at.desc())
                )
                .scalars()
                .first()
            )
            if existing is not None and existing.version_a_id == version_a.id and existing.version_b_id == version_b.id:
                skipped += 1
                continue
            if existing is not None:
                recurring += 1
            center = [(max(box_a[i], box_b[i]) + min(box_a[i + 3], box_b[i + 3])) / 2 for i in range(3)]
            db.add(
                Clash(
                    number=next_number(db, "clash"),
                    project_id=project_id,
                    rule_id=rule.id,
                    version_a_id=version_a.id,
                    version_b_id=version_b.id,
                    object_a=object_a,
                    object_b=object_b,
                    discipline_a=rule.discipline_a,
                    discipline_b=rule.discipline_b,
                    clash_type=rule.clash_type,
                    severity=rule.severity,
                    location={"center": center, "gap_m": round(gap, 4)},
                    detection="assisted",
                    status="active" if existing is not None else "new",
                    estimated_cost_avoided=rule.cost_per_clash,
                    detected_by_id=user_id,
                    signature=signature,
                )
            )
            created += 1
            if created >= max_results:
                break
        if created >= max_results:
            break
    db.flush()
    audit.record(
        db,
        family="business",
        module="bim",
        action="CLASH_DETECTION",
        resource_type="clash_rule",
        resource_id=rule.id,
        project_id=project_id,
        actor_id=user_id,
        diff={
            "created": created,
            "recurring": recurring,
            "skipped": skipped,
            "elements": [len(elements_a), len(elements_b)],
        },
    )
    return {
        "created": created,
        "recurring": recurring,
        "skipped_existing": skipped,
        "truncated": created >= max_results,
    }


def clash_to_issue(
    db: Session, clash: Clash, *, assignee_id: uuid.UUID | None, due: date | None, user_id: uuid.UUID
) -> BimIssue:
    if clash.issue_id:
        raise Conflict("Conflit déjà converti en issue")
    version = db.get(BimVersion, clash.version_a_id) if clash.version_a_id else None
    label_a = clash.object_a.get("name") or clash.object_a.get("db_id")
    label_b = clash.object_b.get("name") or clash.object_b.get("db_id")
    title = f"Conflit {clash.discipline_a} / {clash.discipline_b} — {label_a} × {label_b}"
    issue = create_issue(
        db,
        project_id=clash.project_id,
        user_id=user_id,
        data={
            "version_id": version.id if version else None,
            "title": title[:250],
            "kind": "clash",
            "priority": {"critical": "critical", "high": "high"}.get(clash.severity, "medium"),
            "discipline": clash.discipline_b,
            "assignee_id": assignee_id,
            "due_date": due,
            "location": clash.location,
            "zone_id": clash.zone_id,
            "clash_id": clash.id,
        },
    )
    clash.issue_id = issue.id
    clash.status = "reviewed"
    return issue


def clash_statistics(db: Session, project_id: uuid.UUID) -> dict[str, Any]:
    clashes = db.execute(select(Clash).where(Clash.project_id == project_id)).scalars().all()
    by_pair: dict[str, int] = {}
    by_status: dict[str, int] = {}
    recurrence: dict[str, int] = {}
    resolution_hours = []
    for clash in clashes:
        pair = " × ".join(sorted([clash.discipline_a or "?", clash.discipline_b or "?"]))
        by_pair[pair] = by_pair.get(pair, 0) + 1
        by_status[clash.status] = by_status.get(clash.status, 0) + 1
        if clash.signature:
            recurrence[clash.signature] = recurrence.get(clash.signature, 0) + 1
        if clash.resolved_at:
            resolution_hours.append((clash.resolved_at - clash.created_at).total_seconds() / 3600)
    recurring_by_discipline: dict[str, int] = {}
    for clash in clashes:
        if clash.signature and recurrence.get(clash.signature, 0) > 1:
            key = clash.discipline_b or "?"
            recurring_by_discipline[key] = recurring_by_discipline.get(key, 0) + 1
    return {
        "total": len(clashes),
        "by_discipline_pair": by_pair,
        "by_status": by_status,
        "estimated_cost_avoided": sum(
            (Decimal(c.estimated_cost_avoided or 0) for c in clashes if c.status == "resolved"), Decimal("0")
        ),
        "avg_resolution_hours": round(sum(resolution_hours) / len(resolution_hours), 1) if resolution_hours else None,
        "recurrence_by_discipline": recurring_by_discipline,
    }


# ============================================================================ zones spatiales QR
def create_zone(db: Session, *, project_id: uuid.UUID, data: dict[str, Any]) -> SpatialZone:
    exists = db.execute(
        select(SpatialZone.id).where(SpatialZone.project_id == project_id, SpatialZone.code == data["code"])
    ).first()
    if exists:
        raise Conflict("Code de zone déjà utilisé sur ce projet", code="DUPLICATE_ZONE")
    zone = SpatialZone(project_id=project_id, qr_token=random_token(24), **data)
    db.add(zone)
    db.flush()
    return zone


def zone_by_token(db: Session, code: str) -> SpatialZone:
    token = code.split("GLOBUS:ZONE:", 1)[1] if code.startswith("GLOBUS:ZONE:") else code
    zone = db.execute(select(SpatialZone).where(SpatialZone.qr_token == token)).scalar_one_or_none()
    if zone is None:
        raise NotFound("QR de zone inconnu")
    return zone


def model_stats(db: Session, project_id: uuid.UUID) -> dict[str, Any]:
    issues = db.execute(
        select(BimIssue.status, func.count()).where(BimIssue.project_id == project_id).group_by(BimIssue.status)
    ).all()
    overdue = db.execute(
        select(func.count())
        .select_from(BimIssue)
        .where(
            BimIssue.project_id == project_id,
            BimIssue.status.in_(["open", "in_progress", "reopened"]),
            BimIssue.due_date < date.today(),
        )
    ).scalar_one()
    return {"issues_by_status": {s: c for s, c in issues}, "issues_overdue": overdue}
