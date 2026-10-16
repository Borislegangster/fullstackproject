"""API Hub BIM (§10, V4-BIM-20/21/22/23) : maquettes multi-disciplines versionnées, visionneuse APS / Three.js,
annotations temps réel par version, issues, conflits (manuels / assistés), zones QR, points de vue."""

from __future__ import annotations

import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

import qrcode
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.files import store_private, validate_upload
from app.core.utils import jsonable, utcnow
from app.modules.bim import service
from app.modules.bim.models import (
    BimAnnotation,
    BimIssue,
    BimModel,
    BimVersion,
    Clash,
    ClashRule,
    DisciplineLayer,
    IssueComment,
    SpatialZone,
    Viewpoint,
    ZoneScan,
)
from app.modules.system.models import StoredFile
from app.websocket.hub import publish_room

TAG = "Hub BIM"
router = APIRouter(tags=[TAG])


def _project(access: Access, project_id: uuid.UUID, *perms: str) -> None:
    access.require_project(project_id, *perms)


def _discipline_filter(access: Access, project_id: uuid.UUID, column: Any) -> Any:
    allowed = access.allowed_disciplines(project_id)
    if allowed is None:
        return None
    return or_(column.is_(None), column.in_(sorted(allowed)))


def _model(db: Session, access: Access, model_id: uuid.UUID, *perms: str) -> BimModel:
    model = db.get(BimModel, model_id)
    if model is None or model.deleted_at is not None:
        raise NotFound("Maquette introuvable")
    _project(access, model.project_id, *perms)
    allowed = access.allowed_disciplines(model.project_id)
    if allowed is not None and model.discipline not in allowed:
        raise NotFound("Maquette introuvable")
    return model


def _version(db: Session, access: Access, version_id: uuid.UUID, *perms: str) -> tuple[BimVersion, BimModel]:
    version = db.get(BimVersion, version_id)
    if version is None:
        raise NotFound("Version introuvable")
    if access.p.is_client:
        model = db.get(BimModel, version.model_id)
        if model is None or not version.published_to_client:
            raise NotFound("Version introuvable")
        _project(access, model.project_id)
        return version, model
    return version, _model(db, access, version.model_id, *perms)


def _version_out(version: BimVersion) -> dict[str, Any]:
    return jsonable({**serialize(version), "derivatives": [serialize(d) for d in version.derivatives]})


# ============================================================================ maquettes & versions
@router.get("/projects/{project_id}/bim/models")
def list_models(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(access, project_id, "bim:read")
    stmt = select(BimModel).where(BimModel.project_id == project_id, BimModel.deleted_at.is_(None))
    clause = _discipline_filter(access, project_id, BimModel.discipline)
    if clause is not None:
        stmt = stmt.where(clause)
    out = []
    for model in db.execute(stmt.order_by(BimModel.discipline, BimModel.name)).scalars():
        current = db.get(BimVersion, model.current_version_id) if model.current_version_id else None
        out.append({**serialize(model), "current_version": _version_out(current) if current else None})
    return jsonable(out)


class ModelIn(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    discipline: str = Field(min_length=2, max_length=40)
    description: str | None = Field(default=None, max_length=4000)


@router.post("/projects/{project_id}/bim/models", status_code=201)
def create_model(
    project_id: uuid.UUID, data: ModelIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(access, project_id, "bim:write")
    keys = {d["key"] for d in service.disciplines(db, project_id)}
    if data.discipline not in keys:
        raise BusinessRuleError(f"Discipline inconnue ({', '.join(sorted(keys))})")
    model = BimModel(
        project_id=project_id,
        name=data.name,
        discipline=data.discipline,
        description=data.description,
        created_by_id=access.p.id,
    )
    db.add(model)
    db.flush()
    audit.record(
        db,
        family="business",
        module="bim",
        action="MODEL_CREATE",
        resource_type="bim_model",
        resource_id=model.id,
        project_id=project_id,
        diff={"name": data.name, "discipline": data.discipline},
    )
    db.commit()
    return jsonable(serialize(model))


@router.get("/bim/models/{model_id}")
def get_model(
    model_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    model = _model(db, access, model_id, "bim:read")
    versions = (
        db.execute(select(BimVersion).where(BimVersion.model_id == model.id).order_by(BimVersion.number.desc()))
        .scalars()
        .all()
    )
    return jsonable({**serialize(model), "versions": [_version_out(v) for v in versions]})


@router.post("/bim/models/{model_id}/versions", status_code=201)
async def upload_version(
    model_id: uuid.UUID,
    file: UploadFile = File(...),
    revision_reason: str | None = Form(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    model = _model(db, access, model_id, "bim:write")
    service.source_format(file.filename or "")
    upload = validate_upload(file.filename or "maquette", await file.read(), category="any", allow_bim=True)
    version = service.upload_version(db, access=access, model=model, upload=upload, revision_reason=revision_reason)
    db.commit()
    return _version_out(version)


@router.get("/bim/versions/{version_id}")
def get_version(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if not access.p.has_any("bim:read", "client:portal"):
        access.require("bim:read")
    version, model = _version(db, access, version_id, "bim:read")
    return {**_version_out(version), "model": jsonable(serialize(model))}


@router.get("/bim/versions/{version_id}/file")
def version_file(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    """Fichier de la version (visionneuse Three.js / IFC navigateur)."""
    if not access.p.has_any("bim:read", "client:portal"):
        access.require("bim:read")
    version, _model_obj = _version(db, access, version_id, "bim:read")
    if version.viewer != "three" and not access.has("bim:write"):
        raise Forbidden(
            "Fichier source réservé aux contributeurs BIM ; consulter via la visionneuse", code="SOURCE_RESTRICTED"
        )
    return file_response(db.get(StoredFile, version.file_id), inline=False)


@router.post("/bim/versions/{version_id}/validate")
def validate_version(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    version, _model_obj = _version(db, access, version_id, "bim:validate")
    service.validate_version(db, version, user_id=access.p.id)
    db.commit()
    return _version_out(version)


class PublishIn(BaseModel):
    to_client: bool = False


@router.post("/bim/versions/{version_id}/publish")
def publish_version(
    version_id: uuid.UUID, data: PublishIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    version, model = _version(db, access, version_id, "bim:validate")
    if data.to_client:
        access.require("projects:publish_client")
    service.publish_version(db, model, version, user_id=access.p.id, to_client=data.to_client)
    db.commit()
    return _version_out(version)


@router.post("/bim/versions/{version_id}/retry")
def retry_translation(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.core.events import emit
    from app.providers.aps import aps_configured

    version, model = _version(db, access, version_id, "bim:write")
    if version.status != "failed" or version.viewer != "aps":
        raise BusinessRuleError("Seule une traduction APS en échec peut être relancée")
    if not aps_configured():
        raise BusinessRuleError("Autodesk APS non configuré", code="APS_NOT_CONFIGURED")
    version.status = "uploaded"
    version.translation_error = None
    emit(
        db,
        "bim.translate",
        {"version_id": version.id},
        aggregate_type="bim_version",
        aggregate_id=version.id,
        project_id=model.project_id,
    )
    db.commit()
    return _version_out(version)


@router.get("/bim/viewer-token")
def viewer_token(access: Access = Depends(get_access)) -> dict[str, Any]:
    """Jeton APS en lecture seule (viewables:read) pour la visionneuse ; jamais le secret client."""
    if not access.p.has_any("bim:read", "client:portal"):
        access.require("bim:read")
    from app.providers.aps import aps_configured
    from app.providers.aps import viewer_token as token

    if not aps_configured():
        raise BusinessRuleError("Autodesk APS non configuré", code="APS_NOT_CONFIGURED")
    return token()


@router.get("/projects/{project_id}/bim/federation")
def federation(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if access.p.is_client:
        access.require_project(project_id, "client:portal")
        return jsonable(service.federation(db, project_id, client_only=True))
    _project(access, project_id, "bim:read")
    data = service.federation(db, project_id)
    allowed = access.allowed_disciplines(project_id)
    if allowed is not None:
        data["models"] = [m for m in data["models"] if m["discipline"] in allowed]
    return jsonable(data)


@router.get("/projects/{project_id}/bim/disciplines")
def get_disciplines(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(access, project_id, "bim:read")
    return service.disciplines(db, project_id)


@router.get("/bim/disciplines")
def get_global_disciplines(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> list[dict[str, Any]]:
    """Référentiel global des disciplines (profil des utilisateurs)."""
    return service.global_disciplines(db)


class DisciplineIn(BaseModel):
    # Absente pour une nouvelle discipline : dérivée du nom. Fournie pour modifier un calque existant.
    key: str | None = Field(default=None, min_length=2, max_length=40, pattern="^[a-z0-9_]+$")
    name: str = Field(min_length=2, max_length=120)
    color: str = Field(default="#385AA6", pattern="^#[0-9A-Fa-f]{6}$")
    visible_by_default: bool = True
    sort_order: int = Field(default=50, ge=0, le=999)


@router.put("/projects/{project_id}/bim/disciplines")
def upsert_discipline(
    project_id: uuid.UUID, data: DisciplineIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(access, project_id, "bim:coordinate")
    values = data.model_dump()
    if data.key is None:
        values["key"] = service.discipline_key(data.name)
        if values["key"] in {d["key"] for d in service.disciplines(db, project_id)}:
            raise Conflict("Une discipline porte déjà ce nom : utilisez « Modifier ».", code="DISCIPLINE_EXISTS")
    row = db.execute(
        select(DisciplineLayer).where(DisciplineLayer.project_id == project_id, DisciplineLayer.key == values["key"])
    ).scalar_one_or_none()
    if row is None:
        db.add(DisciplineLayer(project_id=project_id, **values))
    else:
        for key, value in values.items():
            setattr(row, key, value)
    db.commit()
    return service.disciplines(db, project_id)


@router.post("/bim/files", status_code=201)
async def upload_bim_file(
    file: UploadFile = File(...), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Photo probatoire / capture de vue (annotations, issues, points de vue)."""
    if not access.p.has_any("bim:write", "site:report"):
        access.require("bim:write")
    upload = validate_upload(file.filename or "capture.png", await file.read(), category="image")
    stored = store_private(db, upload, purpose="bim", classification="internal", uploaded_by_id=access.p.id)
    db.commit()
    return jsonable({"file_id": stored.id, "geo": stored.geo})


@router.get("/bim/files/{file_id}")
def get_bim_file(file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    if not access.p.has_any("bim:read", "client:portal"):
        access.require("bim:read")
    stored = db.get(StoredFile, file_id)
    if stored is None or stored.purpose != "bim":
        raise NotFound("Fichier introuvable")
    if access.p.is_client:
        visible = (
            db.execute(
                select(BimAnnotation.id).where(BimAnnotation.file_id == file_id, BimAnnotation.client_visible.is_(True))
            ).first()
            or db.execute(
                select(Viewpoint.id).where(Viewpoint.snapshot_file_id == file_id, Viewpoint.client_visible.is_(True))
            ).first()
        )
        if not visible:
            raise NotFound("Fichier introuvable")
    return file_response(stored)


def _owned_file(db: Session, file_id: uuid.UUID | None, user_id: uuid.UUID) -> None:
    if file_id is None:
        return
    stored = db.get(StoredFile, file_id)
    if stored is None or stored.uploaded_by_id != user_id or stored.purpose != "bim":
        raise BusinessRuleError("Fichier inconnu")


# ============================================================================ annotations temps réel
class AnnotationIn(BaseModel):
    kind: str = Field(pattern="^(pin|text|measure|photo|capture|arrow|rect|issue)$")
    geometry: dict[str, Any]
    content: str | None = Field(default=None, max_length=8000)
    measurement_value: float | None = None
    measurement_unit: str | None = Field(default=None, max_length=10)
    file_id: uuid.UUID | None = None
    color: str = Field(default="#FB8C43", pattern="^#[0-9A-Fa-f]{6}$")
    discipline: str | None = Field(default=None, max_length=40)
    issue_id: uuid.UUID | None = None
    client_visible: bool = False


class AnnotationUpdate(BaseModel):
    expected_version: int = Field(ge=1)
    geometry: dict[str, Any] | None = None
    content: str | None = Field(default=None, max_length=8000)
    color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    client_visible: bool | None = None


def _annotation_out(db: Session, annotation: BimAnnotation) -> dict[str, Any]:
    from app.modules.identity.models import User

    author = db.get(User, annotation.author_id) if annotation.author_id else None
    return jsonable({**serialize(annotation), "author": author.full_name if author else None})


@router.get("/bim/versions/{version_id}/annotations")
def list_annotations(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    if not access.p.has_any("bim:read", "client:portal"):
        access.require("bim:read")
    version, model = _version(db, access, version_id, "bim:read")
    stmt = select(BimAnnotation).where(BimAnnotation.version_id == version.id, BimAnnotation.deleted_at.is_(None))
    if access.p.is_client:
        stmt = stmt.where(BimAnnotation.client_visible.is_(True))
    else:
        clause = _discipline_filter(access, model.project_id, BimAnnotation.discipline)
        if clause is not None:
            stmt = stmt.where(clause)
    return [_annotation_out(db, a) for a in db.execute(stmt.order_by(BimAnnotation.created_at)).scalars()]


@router.post("/bim/versions/{version_id}/annotations", status_code=201)
def create_annotation(
    version_id: uuid.UUID, data: AnnotationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    version, model = _version(db, access, version_id, "bim:write")
    _owned_file(db, data.file_id, access.p.id)
    if data.kind in ("photo", "capture") and not data.file_id:
        raise BusinessRuleError("Fichier requis pour une annotation photo / capture")
    if data.client_visible:
        access.require("projects:publish_client")
    annotation = service.create_annotation(
        db, version=version, project_id=model.project_id, data=data.model_dump(), user_id=access.p.id
    )
    db.commit()
    payload = _annotation_out(db, annotation)
    publish_room(f"bim:{version.id}", "bim.annotation.created", payload)
    return payload


def _annotation(db: Session, access: Access, annotation_id: uuid.UUID) -> BimAnnotation:
    annotation = db.get(BimAnnotation, annotation_id)
    if annotation is None or annotation.deleted_at is not None:
        raise NotFound("Annotation introuvable")
    _version(db, access, annotation.version_id, "bim:write")
    return annotation


@router.patch("/bim/annotations/{annotation_id}")
def update_annotation(
    annotation_id: uuid.UUID,
    data: AnnotationUpdate,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    annotation = _annotation(db, access, annotation_id)
    values = data.model_dump(exclude_unset=True, exclude={"expected_version"})
    if values.get("client_visible"):
        access.require("projects:publish_client")
    service.update_annotation(
        db, annotation, values=values, expected_version=data.expected_version, user_id=access.p.id
    )
    db.commit()
    payload = _annotation_out(db, annotation)
    publish_room(f"bim:{annotation.version_id}", "bim.annotation.updated", payload)
    return payload


@router.delete("/bim/annotations/{annotation_id}")
def delete_annotation(
    annotation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    annotation = _annotation(db, access, annotation_id)
    if annotation.author_id != access.p.id and not access.has("bim:coordinate"):
        raise Forbidden("Suppression réservée à l'auteur ou au coordinateur")
    annotation.deleted_at = utcnow()
    db.commit()
    publish_room(f"bim:{annotation.version_id}", "bim.annotation.deleted", {"id": annotation.id})
    return {"status": "deleted"}


# ============================================================================ issues
class IssueIn(BaseModel):
    version_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    kind: str = Field(default="design", pattern="^(clash|design|question|observation|defect)$")
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    discipline: str | None = Field(default=None, max_length=40)
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    location: dict[str, Any] = Field(default_factory=dict)
    viewpoint: dict[str, Any] = Field(default_factory=dict)
    snapshot_file_id: uuid.UUID | None = None


def _issue_out(db: Session, issue: BimIssue, *, detail: bool = False) -> dict[str, Any]:
    out = serialize(issue)
    if detail:
        out["comments"] = [
            serialize(c)
            for c in db.execute(
                select(IssueComment).where(IssueComment.issue_id == issue.id).order_by(IssueComment.created_at)
            ).scalars()
        ]
        out["annotations"] = [
            serialize(a)
            for a in db.execute(
                select(BimAnnotation).where(BimAnnotation.issue_id == issue.id, BimAnnotation.deleted_at.is_(None))
            ).scalars()
        ]
    return jsonable(out)


@router.get("/projects/{project_id}/bim/issues")
def list_issues(
    project_id: uuid.UUID,
    status: str | None = None,
    assignee_id: uuid.UUID | None = None,
    discipline: str | None = None,
    version_id: uuid.UUID | None = None,
    mine: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    _project(access, project_id, "bim:read")
    stmt = select(BimIssue).where(BimIssue.project_id == project_id)
    for col, value in (
        (BimIssue.status, status),
        (BimIssue.assignee_id, assignee_id),
        (BimIssue.discipline, discipline),
        (BimIssue.version_id, version_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    if mine:
        stmt = stmt.where(BimIssue.assignee_id == access.p.id)
    clause = _discipline_filter(access, project_id, BimIssue.discipline)
    if clause is not None:
        stmt = stmt.where(clause)
    return [_issue_out(db, i) for i in db.execute(stmt.order_by(BimIssue.created_at.desc()).limit(500)).scalars()]


@router.post("/projects/{project_id}/bim/issues", status_code=201)
def create_issue(
    project_id: uuid.UUID, data: IssueIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(access, project_id, "bim:write")
    _owned_file(db, data.snapshot_file_id, access.p.id)
    issue = service.create_issue(db, project_id=project_id, data=data.model_dump(), user_id=access.p.id)
    db.commit()
    payload = _issue_out(db, issue)
    if issue.version_id:
        publish_room(f"bim:{issue.version_id}", "bim.issue.created", payload)
    return payload


def _issue(db: Session, access: Access, issue_id: uuid.UUID, *perms: str) -> BimIssue:
    issue = db.get(BimIssue, issue_id)
    if issue is None:
        raise NotFound("Issue introuvable")
    _project(access, issue.project_id, *perms)
    return issue


@router.get("/bim/issues/{issue_id}")
def get_issue(
    issue_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return _issue_out(db, _issue(db, access, issue_id, "bim:read"), detail=True)


class IssueUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    priority: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    discipline: str | None = Field(default=None, max_length=40)


@router.patch("/bim/issues/{issue_id}")
def update_issue(
    issue_id: uuid.UUID, data: IssueUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    issue = _issue(db, access, issue_id, "bim:write")
    values = data.model_dump(exclude_unset=True)
    reassigned = "assignee_id" in values and values["assignee_id"] != issue.assignee_id
    for key, value in values.items():
        setattr(issue, key, value)
    if reassigned and issue.assignee_id:
        service.notify_assignee(db, issue)
    audit.record(
        db,
        family="business",
        module="bim",
        action="ISSUE_UPDATE",
        resource_type="bim_issue",
        resource_id=issue.id,
        project_id=issue.project_id,
        diff=jsonable(values),
    )
    db.commit()
    return _issue_out(db, issue)


class IssueTransitionIn(BaseModel):
    target: str = Field(pattern="^(in_progress|resolved|closed|reopened|open)$")
    note: str | None = Field(default=None, max_length=8000)
    resolved_in_version_id: uuid.UUID | None = None


@router.post("/bim/issues/{issue_id}/transition")
def transition_issue(
    issue_id: uuid.UUID, data: IssueTransitionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    issue = _issue(db, access, issue_id, "bim:write")
    service.transition_issue(
        db,
        issue,
        target=data.target,
        user_id=access.p.id,
        note=data.note,
        resolved_in_version_id=data.resolved_in_version_id,
        can_close=access.has("bim:coordinate"),
    )
    db.commit()
    payload = _issue_out(db, issue)
    if issue.version_id:
        publish_room(f"bim:{issue.version_id}", "bim.issue.updated", payload)
    return payload


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=8000)
    file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=10)


@router.post("/bim/issues/{issue_id}/comments", status_code=201)
def comment_issue(
    issue_id: uuid.UUID, data: CommentIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    issue = _issue(db, access, issue_id, "bim:read")
    if not access.p.has_any("bim:write", "site:report"):
        access.require("bim:write")
    for fid in data.file_ids:
        _owned_file(db, fid, access.p.id)
    comment = IssueComment(
        issue_id=issue.id, author_id=access.p.id, body=data.body, file_ids=[str(f) for f in data.file_ids]
    )
    db.add(comment)
    db.commit()
    if issue.version_id:
        publish_room(
            f"bim:{issue.version_id}", "bim.issue.comment", {"issue_id": issue.id, **jsonable(serialize(comment))}
        )
    return jsonable(serialize(comment))


class MeetingIn(BaseModel):
    kind: str = Field(default="video", pattern="^(audio|video)$")
    participant_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


@router.post("/bim/issues/{issue_id}/meeting", status_code=201)
def issue_meeting(
    issue_id: uuid.UUID, data: MeetingIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Réunion depuis une issue BIM (§13) : appel avec l'émetteur, l'assigné et les participants choisis."""
    from app.modules.communications import service as comms
    from app.websocket.hub import publish_user

    access.require("calls:use")
    issue = _issue(db, access, issue_id, "bim:read")
    participants = {
        p for p in [issue.assignee_id, issue.created_by_id, *data.participant_ids] if p and p != access.p.id
    }
    call = comms.start_call(
        db,
        access.p.user,
        kind=data.kind,
        participant_ids=list(participants),
        conversation_id=None,
        project_id=issue.project_id,
        issue_id=issue.id,
        title=f"Issue {issue.number} — {issue.title}"[:200],
    )
    issue.meeting_call_id = call.id
    db.commit()
    for p in call.participants:
        if p.user_id != access.p.id:
            publish_user(
                p.user_id,
                "call.incoming",
                {
                    "call_id": call.id,
                    "kind": call.kind,
                    "title": call.title,
                    "from": {"id": access.p.id, "name": access.p.user.full_name},
                },
            )
    return {"call_id": str(call.id), "issue_id": str(issue.id)}


# ============================================================================ conflits (clash)
router.include_router(
    make_crud_router(
        ClashRule,
        prefix="/bim/clash-rules",
        tags=[TAG],
        module="bim",
        read_perm="bim:read",
        write_perm="bim:coordinate",
        label="Règle de conflit",
        project_attr="project_id",
        filters=["project_id", "is_active"],
        search=["name"],
    )
)


class ManualClashIn(BaseModel):
    version_a_id: uuid.UUID
    version_b_id: uuid.UUID | None = None
    object_a: dict[str, Any]
    object_b: dict[str, Any]
    discipline_a: str = Field(max_length=40)
    discipline_b: str = Field(max_length=40)
    clash_type: str = Field(default="hard", pattern="^(hard|soft|clearance|duplicate)$")
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    location: dict[str, Any] = Field(default_factory=dict)
    zone_id: uuid.UUID | None = None
    estimated_cost_avoided: Decimal = Field(default=Decimal("0"), ge=0)


@router.post("/projects/{project_id}/bim/clashes", status_code=201)
def manual_clash(
    project_id: uuid.UUID, data: ManualClashIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.core.numbering import next_number

    _project(access, project_id, "bim:coordinate")
    for vid in (data.version_a_id, data.version_b_id):
        if vid:
            _version_obj, model = _version(db, access, vid, "bim:read")
            if model.project_id != project_id:
                raise BusinessRuleError("Version hors projet")
    clash = Clash(
        number=next_number(db, "clash"),
        project_id=project_id,
        detection="manual",
        status="new",
        detected_by_id=access.p.id,
        signature=service.clash_signature(data.object_a, data.object_b, data.clash_type),
        **data.model_dump(),
    )
    db.add(clash)
    db.commit()
    return jsonable(serialize(clash))


class ElementIn(BaseModel):
    db_id: int | None = None
    guid: str | None = Field(default=None, max_length=120)
    name: str | None = Field(default=None, max_length=250)
    bbox: list[float] = Field(min_length=6, max_length=6)


class DetectionIn(BaseModel):
    rule_id: uuid.UUID
    version_a_id: uuid.UUID
    version_b_id: uuid.UUID
    elements_a: list[ElementIn] = Field(min_length=1, max_length=50000)
    elements_b: list[ElementIn] = Field(min_length=1, max_length=50000)


@router.post("/projects/{project_id}/bim/clash-detection")
def clash_detection(
    project_id: uuid.UUID, data: DetectionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(access, project_id, "bim:coordinate")
    rule = db.get(ClashRule, data.rule_id)
    if rule is None or not rule.is_active or (rule.project_id and rule.project_id != project_id):
        raise NotFound("Règle introuvable")
    version_a, model_a = _version(db, access, data.version_a_id, "bim:read")
    version_b, model_b = _version(db, access, data.version_b_id, "bim:read")
    if model_a.project_id != project_id or model_b.project_id != project_id:
        raise BusinessRuleError("Versions hors projet")
    result = service.detect_clashes(
        db,
        project_id=project_id,
        rule=rule,
        version_a=version_a,
        version_b=version_b,
        elements_a=[e.model_dump() for e in data.elements_a],
        elements_b=[e.model_dump() for e in data.elements_b],
        user_id=access.p.id,
    )
    db.commit()
    return result


@router.get("/projects/{project_id}/bim/clashes")
def list_clashes(
    project_id: uuid.UUID,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    _project(access, project_id, "bim:read")
    stmt = select(Clash).where(Clash.project_id == project_id)
    if status:
        stmt = stmt.where(Clash.status == status)
    return [jsonable(serialize(c)) for c in db.execute(stmt.order_by(Clash.created_at.desc()).limit(2000)).scalars()]


class ClashStatusIn(BaseModel):
    status: str = Field(pattern="^(new|active|reviewed|approved|resolved)$")


@router.patch("/bim/clashes/{clash_id}")
def update_clash(
    clash_id: uuid.UUID, data: ClashStatusIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    clash = db.get(Clash, clash_id)
    if clash is None:
        raise NotFound("Conflit introuvable")
    _project(access, clash.project_id, "bim:coordinate")
    clash.status = data.status
    if data.status == "resolved":
        clash.resolved_at = utcnow()
    db.commit()
    return jsonable(serialize(clash))


class ClashIssueIn(BaseModel):
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None


@router.post("/bim/clashes/{clash_id}/issue", status_code=201)
def clash_issue(
    clash_id: uuid.UUID, data: ClashIssueIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    clash = db.get(Clash, clash_id)
    if clash is None:
        raise NotFound("Conflit introuvable")
    _project(access, clash.project_id, "bim:coordinate")
    issue = service.clash_to_issue(db, clash, assignee_id=data.assignee_id, due=data.due_date, user_id=access.p.id)
    db.commit()
    return _issue_out(db, issue)


@router.get("/projects/{project_id}/bim/clash-stats")
def clash_stats(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(access, project_id, "bim:read")
    return jsonable({**service.clash_statistics(db, project_id), **service.model_stats(db, project_id)})


# ============================================================================ zones spatiales & points de vue
class ZoneIn(BaseModel):
    site_id: uuid.UUID | None = None
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=200)
    level: str | None = Field(default=None, max_length=40)
    zone_type: str = Field(default="piece", pattern="^(piece|zone|niveau|exterieur)$")
    discipline: str | None = Field(default=None, max_length=40)
    bbox: dict[str, Any] = Field(default_factory=dict)
    element_ids: list[Any] = Field(default_factory=list, max_length=10000)
    checklist: list[dict[str, Any]] = Field(default_factory=list, max_length=200)
    area_m2: Decimal | None = Field(default=None, ge=0)
    client_label: str | None = Field(default=None, max_length=120)


def _zone_out(zone: SpatialZone) -> dict[str, Any]:
    data = serialize(zone)
    data.pop("qr_token", None)
    return jsonable(data)


@router.get("/projects/{project_id}/bim/zones")
def list_zones(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(access, project_id, "bim:read")
    rows = db.execute(
        select(SpatialZone).where(SpatialZone.project_id == project_id).order_by(SpatialZone.level, SpatialZone.code)
    ).scalars()
    return [_zone_out(z) for z in rows]


@router.post("/projects/{project_id}/bim/zones", status_code=201)
def create_zone(
    project_id: uuid.UUID, data: ZoneIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(access, project_id, "bim:write")
    zone = service.create_zone(db, project_id=project_id, data=jsonable(data.model_dump()))
    db.commit()
    return _zone_out(zone)


@router.get("/bim/zones/{zone_id}/qr")
def zone_qr(zone_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    zone = db.get(SpatialZone, zone_id)
    if zone is None:
        raise NotFound("Zone introuvable")
    _project(access, zone.project_id, "bim:write")
    buf = io.BytesIO()
    qrcode.make(f"GLOBUS:ZONE:{zone.qr_token}", box_size=8, border=2).save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


class ScanIn(BaseModel):
    code: str = Field(min_length=8, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    application: str | None = Field(default=None, max_length=40)


@router.post("/bim/zones/scan")
def scan_zone(data: ScanIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """QR spatial : contexte de la pièce (issues ouvertes, points de vue, check-list, maquettes du projet)."""
    zone = service.zone_by_token(db, data.code.strip())
    _project(access, zone.project_id)
    if not access.p.has_any("bim:read", "site:report"):
        access.require("bim:read")
    db.add(
        ZoneScan(
            zone_id=zone.id,
            user_id=access.p.id,
            application=data.application,
            latitude=data.latitude,
            longitude=data.longitude,
        )
    )
    issues = (
        db.execute(
            select(BimIssue).where(
                BimIssue.zone_id == zone.id, BimIssue.status.in_(["open", "in_progress", "reopened"])
            )
        )
        .scalars()
        .all()
    )
    viewpoints = db.execute(select(Viewpoint).where(Viewpoint.zone_id == zone.id)).scalars().all()
    db.commit()
    return jsonable(
        {
            "zone": _zone_out(zone),
            "open_issues": [serialize(i) for i in issues],
            "viewpoints": [serialize(v) for v in viewpoints],
            "federation": service.federation(db, zone.project_id),
        }
    )


class ViewpointIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    camera: dict[str, Any]
    visible_disciplines: list[str] = Field(default_factory=list, max_length=30)
    snapshot_file_id: uuid.UUID | None = None
    is_preset: bool = False
    client_visible: bool = False
    zone_id: uuid.UUID | None = None


@router.get("/bim/versions/{version_id}/viewpoints")
def list_viewpoints(
    version_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    if not access.p.has_any("bim:read", "client:portal"):
        access.require("bim:read")
    version, _model_obj = _version(db, access, version_id, "bim:read")
    stmt = select(Viewpoint).where(Viewpoint.version_id == version.id)
    if access.p.is_client:
        stmt = stmt.where(Viewpoint.client_visible.is_(True))
    return [
        jsonable(serialize(v)) for v in db.execute(stmt.order_by(Viewpoint.is_preset.desc(), Viewpoint.name)).scalars()
    ]


@router.post("/bim/versions/{version_id}/viewpoints", status_code=201)
def create_viewpoint(
    version_id: uuid.UUID, data: ViewpointIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    version, _model_obj = _version(db, access, version_id, "bim:write")
    _owned_file(db, data.snapshot_file_id, access.p.id)
    if data.client_visible or data.is_preset:
        access.require("projects:publish_client")
    viewpoint = Viewpoint(version_id=version.id, created_by_id=access.p.id, **data.model_dump())
    db.add(viewpoint)
    db.commit()
    payload = jsonable(serialize(viewpoint))
    publish_room(f"bim:{version.id}", "bim.viewpoint.created", payload)
    return payload


@router.delete("/bim/viewpoints/{viewpoint_id}")
def delete_viewpoint(
    viewpoint_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    viewpoint = db.get(Viewpoint, viewpoint_id)
    if viewpoint is None:
        raise NotFound("Point de vue introuvable")
    _version(db, access, viewpoint.version_id, "bim:write")
    if viewpoint.created_by_id != access.p.id and not access.has("bim:coordinate"):
        raise Forbidden("Suppression réservée à l'auteur ou au coordinateur")
    db.delete(viewpoint)
    db.commit()
    return {"status": "deleted"}
