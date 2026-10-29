"""API QHSE (§17.1) : EPI, inspections, incidents, quarts d'heure sécurité, actions correctives, statistiques."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, NotFound
from app.core.files import store_private, validate_upload
from app.core.idempotency import Idempotency, idempotency
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable
from app.modules.projects.models import Site
from app.modules.qhse import service
from app.modules.qhse.models import (
    CorrectiveAction,
    Incident,
    Inspection,
    InspectionTemplate,
    PPEDistribution,
    PPEItem,
    SafetyTalk,
)
from app.modules.system.models import StoredFile

TAG = "QHSE"
router = APIRouter(tags=[TAG])

router.include_router(
    make_crud_router(
        PPEItem,
        prefix="/qhse/ppe-items",
        tags=[TAG],
        module="qhse",
        read_perm="qhse:read",
        write_perm="qhse:write",
        label="EPI",
        filters=["kind", "is_active"],
        search=["name", "norm"],
        sort=["name"],
        default_sort="name",
    )
)
router.include_router(
    make_crud_router(
        InspectionTemplate,
        prefix="/qhse/inspection-templates",
        tags=[TAG],
        module="qhse",
        read_perm="qhse:read",
        write_perm="qhse:write",
        label="Grille d'inspection",
        filters=["category", "is_active"],
        search=["name"],
        sort=["name"],
        default_sort="name",
        allow_delete=False,
    )
)


def _check_site(db: Session, project_id: uuid.UUID, site_id: uuid.UUID | None) -> None:
    if site_id:
        site = db.get(Site, site_id)
        if site is None or site.project_id != project_id:
            raise BusinessRuleError("Chantier hors projet")


def _owned_files(db: Session, file_ids: list[uuid.UUID], user_id: uuid.UUID) -> list[str]:
    for fid in file_ids:
        stored = db.get(StoredFile, fid)
        if stored is None or stored.uploaded_by_id != user_id:
            raise BusinessRuleError("Pièce jointe inconnue")
    return [str(f) for f in file_ids]


@router.post("/qhse/files", status_code=201)
async def upload(
    file: UploadFile = File(...),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Photo / preuve terrain (géolocalisée) réutilisable dans incidents, inspections, actions, quarts d'heure."""
    if not access.p.has_any("qhse:write", "site:report"):
        access.require("qhse:write")
    upload_ = validate_upload(file.filename or "photo", await file.read(), category="media")
    extra = {"geo": {"lat": latitude, "lng": longitude}} if latitude is not None and longitude is not None else None
    stored = store_private(
        db, upload_, purpose="qhse", classification="internal", uploaded_by_id=access.p.id, extra=extra
    )
    db.commit()
    return jsonable({"file_id": stored.id, "geo": stored.geo, "taken_at": stored.taken_at})


@router.get("/qhse/files/{file_id}")
def download(file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    access.require("qhse:read")
    stored = db.get(StoredFile, file_id)
    if stored is None or stored.purpose != "qhse":
        raise NotFound("Fichier introuvable")
    return file_response(stored)


# ============================================================================ EPI
class DistributionIn(BaseModel):
    ppe_item_id: uuid.UUID
    employee_id: uuid.UUID | None = None
    worker_name: str | None = Field(default=None, max_length=200)
    project_id: uuid.UUID | None = None
    quantity: int = Field(default=1, ge=1, le=1000)
    distributed_at: date | None = None
    signature_file_id: uuid.UUID | None = None
    warehouse_id: uuid.UUID | None = None


@router.post("/qhse/ppe-distributions", status_code=201)
def distribute(
    data: DistributionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("qhse:write")
    if data.project_id:
        access.require_project(data.project_id)
    item = db.get(PPEItem, data.ppe_item_id)
    if item is None or not item.is_active:
        raise NotFound("EPI introuvable")
    if data.signature_file_id:
        _owned_files(db, [data.signature_file_id], access.p.id)
    row = service.distribute_ppe(
        db,
        item=item,
        employee_id=data.employee_id,
        worker_name=data.worker_name,
        project_id=data.project_id,
        quantity=data.quantity,
        distributed_at=data.distributed_at or date.today(),
        signature_file_id=data.signature_file_id,
        warehouse_id=data.warehouse_id,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(row))


@router.get("/qhse/ppe-distributions")
def list_distributions(
    params: PageParams = Depends(),
    employee_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    due_only: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("qhse:read")
    stmt = access.filter_by_project(select(PPEDistribution), PPEDistribution.project_id)
    if employee_id:
        stmt = stmt.where(PPEDistribution.employee_id == employee_id)
    if project_id:
        stmt = stmt.where(PPEDistribution.project_id == project_id)
    if due_only:
        stmt = stmt.where(
            PPEDistribution.returned_at.is_(None),
            PPEDistribution.expected_replacement <= date.today() + timedelta(days=15),
        )
    from app.modules.hr.models import Employee

    def out(row: PPEDistribution) -> dict[str, Any]:
        item = db.get(PPEItem, row.ppe_item_id)
        employee = db.get(Employee, row.employee_id) if row.employee_id else None
        return jsonable(
            {
                **serialize(row),
                "ppe_item_name": f"{item.name}{f' ({item.size})' if item.size else ''}" if item else None,
                "employee_name": employee.full_name if employee else None,
            }
        )

    return paginate(db, stmt, params, default_sort=PPEDistribution.distributed_at.desc(), transform=out)


@router.post("/qhse/ppe-distributions/{distribution_id}/return")
def return_ppe(
    distribution_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("qhse:write")
    row = db.get(PPEDistribution, distribution_id)
    if row is None:
        raise NotFound("Dotation introuvable")
    row.returned_at = date.today()
    db.commit()
    return jsonable(serialize(row))


# ============================================================================ inspections
class InspectionIn(BaseModel):
    template_id: uuid.UUID | None = None
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    category: str = Field(default="securite", pattern="^(securite|qualite|environnement)$")
    inspection_date: date | None = None


@router.post("/qhse/inspections", status_code=201)
def start_inspection(
    data: InspectionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require_project(data.project_id, "qhse:write")
    _check_site(db, data.project_id, data.site_id)
    template = db.get(InspectionTemplate, data.template_id) if data.template_id else None
    if data.template_id and (template is None or not template.is_active):
        raise NotFound("Grille introuvable")
    inspection = service.start_inspection(
        db,
        template=template,
        project_id=data.project_id,
        site_id=data.site_id,
        zone_id=data.zone_id,
        category=data.category,
        inspection_date=data.inspection_date or date.today(),
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(inspection))


@router.get("/qhse/inspections")
def list_inspections(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("qhse:read")
    stmt = access.filter_by_project(select(Inspection), Inspection.project_id, allow_null=False)
    for col, value in (
        (Inspection.project_id, project_id),
        (Inspection.status, status),
        (Inspection.category, category),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Inspection.inspection_date.desc(),
        search_columns=[Inspection.number],
        transform=lambda r: jsonable(serialize(r)),
    )


def _inspection(db: Session, access: Access, inspection_id: uuid.UUID, *perms: str) -> Inspection:
    inspection = db.get(Inspection, inspection_id)
    if inspection is None:
        raise NotFound("Inspection introuvable")
    access.require_project(inspection.project_id, *perms)
    return inspection


@router.get("/qhse/inspections/{inspection_id}")
def get_inspection(
    inspection_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return jsonable(serialize(_inspection(db, access, inspection_id, "qhse:read")))


class ResultIn(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    label: str | None = Field(default=None, max_length=250)
    weight: int = Field(default=1, ge=0, le=10)
    status: str = Field(pattern="^(ok|nok|na)$")
    comment: str | None = Field(default=None, max_length=2000)
    photo_file_id: uuid.UUID | None = None


class CompleteInspectionIn(BaseModel):
    results: list[ResultIn] = Field(min_length=1, max_length=300)
    findings: str | None = Field(default=None, max_length=8000)
    photo_file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)


@router.post("/qhse/inspections/{inspection_id}/complete")
def complete_inspection(
    inspection_id: uuid.UUID,
    data: CompleteInspectionIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    inspection = _inspection(db, access, inspection_id, "qhse:write")
    photos = _owned_files(
        db, [*data.photo_file_ids, *[r.photo_file_id for r in data.results if r.photo_file_id]], access.p.id
    )
    inspection.photo_file_ids = [*inspection.photo_file_ids, *photos]
    service.complete_inspection(
        db,
        inspection,
        results=[jsonable(r.model_dump()) for r in data.results],
        findings=data.findings,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(inspection))


@router.post("/qhse/inspections/{inspection_id}/close")
def close_inspection(
    inspection_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    inspection = _inspection(db, access, inspection_id, "qhse:write")
    if inspection.status != "completed":
        raise BusinessRuleError("Inspection non terminée")
    pending = (
        db.execute(
            select(CorrectiveAction.number).where(
                CorrectiveAction.source_type == "inspection",
                CorrectiveAction.source_id == inspection.id,
                CorrectiveAction.status.in_(["open", "in_progress", "done"]),
            )
        )
        .scalars()
        .all()
    )
    if pending:
        raise BusinessRuleError("Actions correctives non vérifiées : " + ", ".join(pending), code="ACTIONS_PENDING")
    inspection.status = "closed"
    db.commit()
    return jsonable(serialize(inspection))


# ============================================================================ incidents
class IncidentIn(BaseModel):
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    kind: str = Field(
        default="securite", pattern="^(accident|presque_accident|securite|qualite|environnement|materiel)$"
    )
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    occurred_at: datetime
    location: str | None = Field(default=None, max_length=250)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    people_involved: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    injuries: str | None = Field(default=None, max_length=4000)
    lost_time_days: int = Field(default=0, ge=0, le=3650)
    immediate_actions: str | None = Field(default=None, max_length=4000)
    photo_file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=30)
    source: str = Field(default="web", pattern="^(web|mobile|offline|desktop)$")


@router.post("/qhse/incidents", status_code=201)
def declare(
    data: IncidentIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    idem: Idempotency = Depends(idempotency()),
) -> Any:
    if idem.replay is not None:
        return idem.replay
    if not access.p.has_any("qhse:write", "site:report"):
        access.require("qhse:write")
    access.require_project(data.project_id)
    _check_site(db, data.project_id, data.site_id)
    values = data.model_dump()
    values["photo_file_ids"] = _owned_files(db, data.photo_file_ids, access.p.id)
    incident = service.declare_incident(db, data=values, user_id=access.p.id)
    return idem.complete(db, jsonable(serialize(incident)), status_code=201)


@router.get("/qhse/incidents")
def list_incidents(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    severity: str | None = None,
    kind: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("qhse:read")
    stmt = access.filter_by_project(select(Incident), Incident.project_id, allow_null=False)
    for col, value in (
        (Incident.project_id, project_id),
        (Incident.status, status),
        (Incident.severity, severity),
        (Incident.kind, kind),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Incident.occurred_at.desc(),
        search_columns=[Incident.number, Incident.title],
        transform=lambda r: jsonable(serialize(r)),
    )


def _incident(db: Session, access: Access, incident_id: uuid.UUID, *perms: str) -> Incident:
    incident = service.get_incident(db, incident_id)
    access.require_project(incident.project_id, *perms)
    return incident


@router.get("/qhse/incidents/{incident_id}")
def get_incident(
    incident_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    incident = _incident(db, access, incident_id, "qhse:read")
    actions = (
        db.execute(
            select(CorrectiveAction).where(
                CorrectiveAction.source_type == "incident", CorrectiveAction.source_id == incident.id
            )
        )
        .scalars()
        .all()
    )
    return jsonable({**serialize(incident), "actions": [serialize(a) for a in actions]})


class InvestigationIn(BaseModel):
    root_cause: str = Field(min_length=5, max_length=8000)
    immediate_actions: str | None = Field(default=None, max_length=4000)
    lost_time_days: int | None = Field(default=None, ge=0, le=3650)


@router.post("/qhse/incidents/{incident_id}/investigation")
def investigate(
    incident_id: uuid.UUID, data: InvestigationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    incident = _incident(db, access, incident_id, "qhse:write")
    service.investigate(
        db,
        incident,
        root_cause=data.root_cause,
        immediate_actions=data.immediate_actions,
        lost_time_days=data.lost_time_days,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(incident))


class PhotosIn(BaseModel):
    file_ids: list[uuid.UUID] = Field(min_length=1, max_length=30)


@router.post("/qhse/incidents/{incident_id}/photos")
def add_photos(
    incident_id: uuid.UUID, data: PhotosIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    incident = _incident(db, access, incident_id)
    if not access.p.has_any("qhse:write", "site:report"):
        access.require("qhse:write")
    incident.photo_file_ids = [*incident.photo_file_ids, *_owned_files(db, data.file_ids, access.p.id)]
    db.commit()
    return jsonable(serialize(incident))


@router.post("/qhse/incidents/{incident_id}/close")
def close_incident(
    incident_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    incident = _incident(db, access, incident_id, "qhse:write")
    service.close_incident(db, incident, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(incident))


class PublishIn(BaseModel):
    client_summary: str = Field(min_length=10, max_length=2000)


@router.post("/qhse/incidents/{incident_id}/publish-client")
def publish_incident(
    incident_id: uuid.UUID, data: PublishIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    incident = _incident(db, access, incident_id, "projects:publish_client")
    service.publish_incident(db, incident, summary=data.client_summary, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(incident))


# ============================================================================ actions correctives
class ActionIn(BaseModel):
    project_id: uuid.UUID | None = None
    source_type: str = Field(default="other", pattern="^(incident|inspection|audit|other)$")
    source_id: uuid.UUID | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str | None = Field(default=None, max_length=8000)
    responsible_id: uuid.UUID
    due_date: date


@router.post("/qhse/actions", status_code=201)
def create_action(
    data: ActionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("qhse:write")
    if data.project_id:
        access.require_project(data.project_id)
    if data.due_date < date.today():
        raise BusinessRuleError("Échéance passée")
    action = service.create_action(
        db,
        project_id=data.project_id,
        source_type=data.source_type,
        source_id=data.source_id,
        title=data.title,
        description=data.description,
        responsible_id=data.responsible_id,
        due_date=data.due_date,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(action))


@router.get("/qhse/actions")
def list_actions(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    mine: bool = False,
    overdue: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not access.p.has_any("qhse:read", "site:report"):
        access.require("qhse:read")
    stmt = access.filter_by_project(select(CorrectiveAction), CorrectiveAction.project_id)
    if project_id:
        stmt = stmt.where(CorrectiveAction.project_id == project_id)
    if status:
        stmt = stmt.where(CorrectiveAction.status == status)
    if mine or not access.has("qhse:read"):
        stmt = stmt.where(CorrectiveAction.responsible_id == access.p.id)
    if overdue:
        stmt = stmt.where(
            CorrectiveAction.status.in_(["open", "in_progress"]), CorrectiveAction.due_date < date.today()
        )
    return paginate(
        db,
        stmt,
        params,
        default_sort=CorrectiveAction.due_date.asc(),
        search_columns=[CorrectiveAction.number, CorrectiveAction.title],
        transform=lambda a: jsonable(serialize(a)),
    )


def _action(db: Session, access: Access, action_id: uuid.UUID) -> CorrectiveAction:
    action = db.get(CorrectiveAction, action_id)
    if action is None:
        raise NotFound("Action introuvable")
    if action.project_id:
        access.require_project(action.project_id)
    return action


@router.get("/qhse/actions/{action_id}")
def get_action(
    action_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Fiche d'action corrective : le responsable la consulte même sans droit de lecture QHSE global."""
    action = _action(db, access, action_id)
    if action.responsible_id != access.p.id:
        access.require("qhse:read")
    source: dict[str, Any] | None = None
    if action.source_type == "incident" and action.source_id:
        incident = db.get(Incident, action.source_id)
        if incident:
            source = {"type": "incident", "id": incident.id, "number": incident.number, "title": incident.title}
    elif action.source_type == "inspection" and action.source_id:
        inspection = db.get(Inspection, action.source_id)
        if inspection:
            source = {"type": "inspection", "id": inspection.id, "number": inspection.number, "title": None}
    return jsonable({**serialize(action), "source": source})


@router.post("/qhse/actions/{action_id}/start")
def start_action(
    action_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    action = _action(db, access, action_id)
    if action.responsible_id != access.p.id:
        access.require("qhse:write")
    if action.status != "open":
        raise BusinessRuleError("Action déjà démarrée")
    action.status = "in_progress"
    db.commit()
    return jsonable(serialize(action))


class CompleteActionIn(BaseModel):
    note: str = Field(min_length=5, max_length=4000)
    evidence_file_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)


@router.post("/qhse/actions/{action_id}/complete")
def complete_action(
    action_id: uuid.UUID, data: CompleteActionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    action = _action(db, access, action_id)
    if action.responsible_id != access.p.id:
        access.require("qhse:write")
    service.complete_action(
        db, action, note=data.note, evidence=_owned_files(db, data.evidence_file_ids, access.p.id), user_id=access.p.id
    )
    db.commit()
    return jsonable(serialize(action))


class VerifyIn(BaseModel):
    accept: bool
    comment: str | None = Field(default=None, max_length=2000)


@router.post("/qhse/actions/{action_id}/verify")
def verify_action(
    action_id: uuid.UUID, data: VerifyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("qhse:write")
    action = _action(db, access, action_id)
    service.verify_action(db, action, accept=data.accept, comment=data.comment, user_id=access.p.id, principal=access.p)
    db.commit()
    return jsonable(serialize(action))


@router.post("/qhse/actions/{action_id}/cancel")
def cancel_action(
    action_id: uuid.UUID, data: VerifyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("qhse:write")
    action = _action(db, access, action_id)
    if not (data.comment or "").strip():
        raise BusinessRuleError("Motif d'annulation requis")
    action.status = "cancelled"
    audit.record(
        db,
        family="business",
        module="qhse",
        action="ACTION_CANCEL",
        resource_type="corrective_action",
        resource_id=action.id,
        project_id=action.project_id,
        reason=data.comment,
    )
    db.commit()
    return jsonable(serialize(action))


# ============================================================================ quart d'heure sécurité
class AttendeeIn(BaseModel):
    employee_id: uuid.UUID | None = None
    name: str | None = Field(default=None, max_length=200)
    signed: bool = False


class SafetyTalkIn(BaseModel):
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    talk_date: date | None = None
    topic: str = Field(min_length=3, max_length=250)
    content: str | None = Field(default=None, max_length=8000)
    duration_minutes: int = Field(default=15, ge=5, le=240)
    attendees: list[AttendeeIn] = Field(min_length=1, max_length=500)
    photo_file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


@router.post("/qhse/safety-talks", status_code=201)
def create_talk(
    data: SafetyTalkIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if not access.p.has_any("qhse:write", "site:report"):
        access.require("qhse:write")
    access.require_project(data.project_id)
    _check_site(db, data.project_id, data.site_id)
    attendees = [jsonable(a.model_dump()) for a in data.attendees if a.employee_id or a.name]
    if not attendees:
        raise BusinessRuleError("Liste des participants requise")
    talk = SafetyTalk(
        project_id=data.project_id,
        site_id=data.site_id,
        talk_date=data.talk_date or date.today(),
        topic=data.topic,
        content=data.content,
        animator_id=access.p.id,
        duration_minutes=data.duration_minutes,
        attendees=attendees,
        attendee_count=len(attendees),
        photo_file_ids=_owned_files(db, data.photo_file_ids, access.p.id),
    )
    db.add(talk)
    db.flush()
    audit.record(
        db,
        family="business",
        module="qhse",
        action="SAFETY_TALK",
        resource_type="safety_talk",
        resource_id=talk.id,
        project_id=talk.project_id,
        diff={"attendees": len(attendees)},
    )
    db.commit()
    return jsonable(serialize(talk))


@router.get("/qhse/safety-talks")
def list_talks(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("qhse:read")
    stmt = access.filter_by_project(select(SafetyTalk), SafetyTalk.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(SafetyTalk.project_id == project_id)
    return paginate(
        db,
        stmt,
        params,
        default_sort=SafetyTalk.talk_date.desc(),
        search_columns=[SafetyTalk.topic],
        transform=lambda t: jsonable(serialize(t)),
    )


# ============================================================================ statistiques
@router.get("/qhse/statistics")
def statistics(
    start: date | None = None,
    end: date | None = None,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("qhse:read")
    end = end or date.today()
    start = start or end - timedelta(days=365)
    if project_id:
        access.require_project(project_id)
        scope: list[uuid.UUID] | None = [project_id]
    else:
        visible = access.project_scope()
        scope = None if visible is None else list(visible)
    return jsonable(service.statistics(db, project_ids=scope, start=start, end=end))
