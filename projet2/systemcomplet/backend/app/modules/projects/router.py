"""API Chantiers / Projets / Planning (ERP)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response, signed_url
from app.core.errors import BusinessRuleError, Conflict, Forbidden, NotFound
from app.core.events import emit
from app.core.files import store_private, validate_upload
from app.core.numbering import next_number
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable, money, utcnow
from app.modules.projects import planning, service
from app.modules.projects.models import (
    SITE_MEDIA_STAGES,
    ChangeOrder,
    ClientDigest,
    DailyLog,
    Decision,
    ImmersiveContent,
    Lot,
    Milestone,
    Phase,
    Project,
    ProjectMember,
    Risk,
    Site,
    SiteMedia,
    Task,
    TaskAssignment,
    TaskDependency,
    TranquilliteItem,
    Warranty,
    WorkCalendar,
)
from app.modules.system.models import StoredFile

router = APIRouter(tags=["Chantiers & planning"])


def _project(db: Session, access: Access, project_id: uuid.UUID, *perms: str) -> Project:
    project = service.get_project(db, project_id)
    access.require_project(project.id, *perms)
    return project


# ---------------------------------------------------------------------------- projets
class ProjectIn(BaseModel):
    name: str = Field(min_length=2, max_length=250)
    description: str | None = None
    client_organization_id: uuid.UUID | None = None
    universe: str | None = Field(default=None, pattern="^(HOME|BUSINESS|PREMIUM|DIASPORA|ENGINEERING)$")
    offer_code: str | None = None
    project_type: str = Field(
        default="construction_neuve",
        pattern="^(construction_neuve|renovation|extension|rehabilitation|amenagement|etudes)$",
    )
    status: str = Field(
        default="etude",
        pattern="^(prospect|etude|conception|permis|preparation|execution|reception|garantie|clos|suspendu|annule)$",
    )
    address: str | None = None
    city: str | None = None
    country: str | None = "Cameroun"
    latitude: float | None = None
    longitude: float | None = None
    surface_m2: Decimal | None = None
    levels: int | None = None
    start_planned: date | None = None
    end_planned: date | None = None
    start_actual: date | None = None
    end_actual: date | None = None
    reception_date: date | None = None
    contract_amount: Decimal = Decimal("0")
    currency: str = "XAF"
    manager_id: uuid.UUID | None = None
    director_id: uuid.UUID | None = None
    commercial_id: uuid.UUID | None = None
    client_visible: bool = True
    is_diaspora: bool = False
    tags: list[str] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)


def _project_out(db: Session, project: Project, *, with_kpis: bool = False) -> dict[str, Any]:
    data = serialize(project)
    data["sites"] = [serialize(s) for s in project.sites if s.deleted_at is None]
    if with_kpis:
        data["kpis"] = service.project_kpis(db, project)
    return jsonable(data)


@router.get("/projects")
def list_projects(
    params: PageParams = Depends(),
    status: str | None = None,
    universe: str | None = None,
    health: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("projects:read")
    stmt = select(Project).where(Project.deleted_at.is_(None))
    stmt = access.filter_by_project(stmt, Project.id, allow_null=False)
    for col, value in ((Project.status, status), (Project.universe, universe), (Project.health, health)):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={
            "name": Project.name,
            "code": Project.code,
            "start": Project.start_planned,
            "progress": Project.progress_pct,
            "created_at": Project.created_at,
        },
        default_sort=Project.created_at.desc(),
        search_columns=[Project.name, Project.code, Project.city],
        transform=lambda p: _project_out(db, p),
    )


@router.post("/projects", status_code=201)
def create_project(
    data: ProjectIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("projects:write")
    project = Project(code=next_number(db, "project"), **data.model_dump())
    db.add(project)
    db.flush()
    if data.manager_id:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=data.manager_id,
                project_role="chef_projet",
                can_view_finance=True,
                added_by_id=access.p.id,
            )
        )
    if not access.p.global_scope:
        db.add(
            ProjectMember(
                project_id=project.id,
                user_id=access.p.id,
                project_role="chef_projet",
                can_view_finance=True,
                added_by_id=access.p.id,
            )
        )
    audit.record(
        db,
        family="business",
        module="projects",
        action="CREATE",
        resource_type="project",
        resource_id=project.id,
        project_id=project.id,
        diff={"name": project.name},
    )
    emit(
        db,
        "project.created",
        {"id": project.id, "code": project.code, "name": project.name},
        aggregate_type="project",
        aggregate_id=project.id,
        project_id=project.id,
    )
    db.commit()
    return _project_out(db, project, with_kpis=True)


@router.get("/projects/{project_id}")
def get_project(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return _project_out(db, _project(db, access, project_id, "projects:read"), with_kpis=True)


@router.get("/projects/{project_id}/trust")
def project_trust(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Indice de confiance du chantier : score, composantes détaillées, historique 12 semaines (R3)."""
    from app.modules.projects.trust import trust_payload

    return trust_payload(db, _project(db, access, project_id, "projects:read"), internal=True)


@router.patch("/projects/{project_id}")
def update_project(
    project_id: uuid.UUID,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> dict[str, Any]:
    project = _project(db, access, project_id, "projects:write")
    if if_match and if_match.strip('"') != str(project.version):
        raise Conflict(
            "Le projet a été modifié entre-temps", code="VERSION_CONFLICT", details={"server_version": project.version}
        )
    allowed = set(ProjectIn.model_fields)
    values = ProjectIn.model_validate(
        {**{k: getattr(project, k) for k in allowed}, **{k: v for k, v in data.items() if k in allowed}}
    ).model_dump()
    before = audit.snapshot(project, list(allowed))
    previous_status = project.status
    for key, value in values.items():
        setattr(project, key, value)
    db.flush()
    audit.record(
        db,
        family="business",
        module="projects",
        action="UPDATE",
        resource_type="project",
        resource_id=project.id,
        project_id=project.id,
        diff=audit.diff_dicts(before, audit.snapshot(project, list(allowed))),
    )
    if project.status != previous_status:
        emit(
            db,
            "project.status_changed",
            {
                "project_id": project.id,
                "code": project.code,
                "name": project.name,
                "previous": previous_status,
                "status": project.status,
            },
            aggregate_type="project",
            aggregate_id=project.id,
            project_id=project.id,
        )
    db.commit()
    return _project_out(db, project, with_kpis=True)


@router.post("/projects/{project_id}/archive")
def archive_project(
    project_id: uuid.UUID, data: dict[str, str], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    project = _project(db, access, project_id, "projects:delete")
    reason = (data or {}).get("reason", "")
    if len(reason) < 10:
        raise BusinessRuleError("Justification requise (10 caractères minimum)")
    project.deleted_at = utcnow()
    audit.record(
        db,
        family="business",
        module="projects",
        action="ARCHIVE",
        resource_type="project",
        resource_id=project.id,
        project_id=project.id,
        reason=reason,
        criticality="HIGH",
    )
    db.commit()
    return {"status": "archived"}


@router.get("/projects/{project_id}/kpis")
def project_kpis(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id, "projects:read")
    kpis = service.project_kpis(db, project)
    if not access.can_view_project_finance(project.id):
        for key in (
            "budget",
            "committed",
            "spent",
            "remaining_to_commit",
            "remaining_to_pay",
            "gross_margin",
            "gross_margin_pct",
            "contract_amount",
            "invoiced",
            "collected",
            "funds_calls_due",
        ):
            kpis.pop(key, None)
    return kpis


# ---------------------------------------------------------------------------- membres
class MemberIn(BaseModel):
    user_id: uuid.UUID
    project_role: str = Field(default="membre", max_length=40)
    lots: list[uuid.UUID] = Field(default_factory=list)
    disciplines: list[str] = Field(default_factory=list)
    sites: list[uuid.UUID] = Field(default_factory=list)
    can_view_finance: bool = False


@router.get("/projects/{project_id}/members")
def list_members(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    from app.modules.identity.models import User
    from app.websocket.hub import hub

    _project(db, access, project_id, "projects:read")
    rows = db.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
    ).all()
    return jsonable(
        [
            {
                **serialize(m),
                "full_name": u.full_name,
                "email": u.email,
                "job_title": u.job_title,
                "trade": u.trade,
                "online": hub.is_online(str(u.id)),
            }
            for m, u in rows
        ]
    )


@router.post("/projects/{project_id}/members", status_code=201)
def add_member(
    project_id: uuid.UUID, data: MemberIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id, "projects:members")
    existing = db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == data.user_id)
    ).scalar_one_or_none()
    from app.modules.bim.service import disciplines as project_disciplines
    from app.modules.bim.service import ensure_known_disciplines

    ensure_known_disciplines(
        data.disciplines, project_disciplines(db, project_id), tolerated=existing.disciplines if existing else None
    )
    member = existing or ProjectMember(project_id=project_id, user_id=data.user_id, added_by_id=access.p.id)
    member.project_role = data.project_role
    member.lots = [str(x) for x in data.lots]
    member.disciplines = data.disciplines
    member.sites = [str(x) for x in data.sites]
    member.can_view_finance = data.can_view_finance
    if existing is None:
        db.add(member)
    db.flush()
    emit(
        db,
        "project.member_added",
        {
            "user_id": data.user_id,
            "project_id": project.id,
            "project_code": project.code,
            "project_name": project.name,
            "project_role": data.project_role,
        },
        aggregate_type="project",
        aggregate_id=project.id,
        project_id=project.id,
    )
    audit.record(
        db,
        family="security",
        module="projects",
        action="MEMBER_ADD",
        resource_type="project",
        resource_id=project.id,
        project_id=project.id,
        diff={"user": str(data.user_id), "role": data.project_role, "finance": data.can_view_finance},
    )
    db.commit()
    return jsonable(serialize(member))


@router.delete("/projects/{project_id}/members/{user_id}")
def remove_member(
    project_id: uuid.UUID, user_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    _project(db, access, project_id, "projects:members")
    member = db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    ).scalar_one_or_none()
    if member is None:
        raise NotFound("Membre introuvable")
    db.delete(member)
    audit.record(
        db,
        family="security",
        module="projects",
        action="MEMBER_REMOVE",
        resource_type="project",
        resource_id=project_id,
        project_id=project_id,
        diff={"user": str(user_id)},
    )
    db.commit()
    return {"status": "removed"}


# ---------------------------------------------------------------------------- sous-entités simples
def _set_code(prefix: str) -> Any:
    def hook(db: Session, obj: Any, access: Access, values: dict[str, Any]) -> None:
        if not getattr(obj, "code", None):
            obj.code = next_number(db, prefix)

    return hook


router.include_router(
    make_crud_router(
        Site,
        prefix="/sites",
        tags=["Chantiers & planning"],
        module="projects",
        read_perm="projects:read",
        write_perm="projects:write",
        label="Chantier",
        project_attr="project_id",
        filters=["project_id", "status"],
        search=["name", "code", "city"],
        sort=["code", "name", "start_date"],
        before_create=_set_code("site"),
    )
)
router.include_router(
    make_crud_router(
        Phase,
        prefix="/phases",
        tags=["Chantiers & planning"],
        module="projects",
        read_perm="projects:read",
        write_perm="planning:write",
        label="Phase",
        project_attr="project_id",
        filters=["project_id", "status"],
        sort=["sort_order", "start_planned"],
        default_sort="sort_order",
    )
)
router.include_router(
    make_crud_router(
        Lot,
        prefix="/lots",
        tags=["Chantiers & planning"],
        module="projects",
        read_perm="projects:read",
        write_perm="projects:write",
        label="Lot",
        project_attr="project_id",
        filters=["project_id", "discipline", "status"],
        sort=["sort_order", "code"],
        default_sort="sort_order",
        search=["code", "name"],
    )
)
router.include_router(
    make_crud_router(
        Milestone,
        prefix="/milestones",
        tags=["Chantiers & planning"],
        module="planning",
        read_perm="planning:read",
        write_perm="planning:write",
        label="Jalon",
        project_attr="project_id",
        filters=["project_id", "status"],
        sort=["due_date", "sort_order"],
        default_sort="due_date",
    )
)
router.include_router(
    make_crud_router(
        Risk,
        prefix="/risks",
        tags=["Chantiers & planning"],
        module="projects",
        read_perm="projects:read",
        write_perm="projects:write",
        label="Risque",
        project_attr="project_id",
        filters=["project_id", "status", "category", "owner_id"],
        sort=["created_at", "due_date"],
        search=["title"],
    )
)
router.include_router(
    make_crud_router(
        WorkCalendar,
        prefix="/work-calendars",
        tags=["Chantiers & planning"],
        module="planning",
        read_perm="planning:read",
        write_perm="planning:write",
        label="Calendrier",
        filters=["project_id"],
        base_query=lambda stmt, access: stmt,
    )
)


def _file_in_project(db: Session, project_id: uuid.UUID, file_id: uuid.UUID) -> bool:
    """Le fichier appartient-il au projet (photo / vidéo de chantier ou version d'un document GED du projet) ?"""
    from app.modules.documents.models import Document, DocumentVersion

    media = db.execute(
        select(SiteMedia.id).where(SiteMedia.project_id == project_id, SiteMedia.file_id == file_id).limit(1)
    ).first()
    if media is not None:
        return True
    version = db.execute(
        select(DocumentVersion.id)
        .join(Document, Document.id == DocumentVersion.document_id)
        .where(
            Document.project_id == project_id,
            Document.deleted_at.is_(None),
            DocumentVersion.file_id == file_id,
        )
        .limit(1)
    ).first()
    return version is not None


def _immersive_file_guard(db: Session, obj: Any, access: Access, values: dict[str, Any]) -> None:
    """Un contenu immersif ne peut publier qu'un fichier du chantier : photo / vidéo du chantier ou document GED
    du projet (empêche d'exposer au client, par son identifiant, un fichier d'un autre module)."""
    if "file_id" not in values and "project_id" not in values:
        return
    file_id = values.get("file_id", obj.file_id)
    project_id = values.get("project_id") or obj.project_id
    if file_id is not None and not _file_in_project(db, project_id, file_id):
        raise BusinessRuleError(
            "Fichier inconnu pour ce chantier : choisissez une photo, une vidéo ou un document du projet",
            code="IMMERSIVE_FILE_NOT_IN_PROJECT",
        )


router.include_router(
    make_crud_router(
        ImmersiveContent,
        prefix="/immersive-contents",
        tags=["Chantiers & planning"],
        module="projects",
        read_perm="projects:read",
        write_perm="projects:publish_client",
        label="Contenu immersif",
        project_attr="project_id",
        filters=["project_id", "kind", "published_to_client"],
        sort=["captured_at", "created_at"],
        creator_attr="created_by_id",
        before_create=_immersive_file_guard,
        before_update=_immersive_file_guard,
    )
)
router.include_router(
    make_crud_router(
        Warranty,
        prefix="/warranties",
        tags=["Chantiers & planning"],
        module="projects",
        read_perm="projects:read",
        write_perm="projects:write",
        label="Garantie",
        project_attr="project_id",
        filters=["project_id", "kind"],
    )
)
router.include_router(
    make_crud_router(
        TranquilliteItem,
        prefix="/tranquillite-items",
        tags=["Dossier Tranquillité"],
        module="tranquillite",
        read_perm="projects:read",
        write_perm="projects:write",
        label="Pièce du dossier",
        project_attr="project_id",
        filters=["project_id", "category", "status", "responsible_id"],
        sort=["due_date", "created_at"],
        exclude_in={"verified_by_id", "verified_at", "anchor_hash", "anchor_receipt", "anchored_at"},
    )
)
router.include_router(
    make_crud_router(
        ClientDigest,
        prefix="/client-digests",
        tags=["Chantiers & planning"],
        module="projects",
        read_perm="projects:read",
        write_perm="projects:publish_client",
        label="Digest client",
        project_attr="project_id",
        filters=["project_id"],
        sort=["period_start"],
        allow_delete=False,
    )
)


class VerifyIn(BaseModel):
    status: str = Field(pattern="^(en_verification|verifie|anomalie|expire|en_cours)$")
    notes: str | None = Field(default=None, max_length=4000)
    anchor: bool = False


@router.post("/tranquillite-items/{item_id}/verify")
def verify_tranquillite(
    item_id: uuid.UUID, data: VerifyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    item = db.get(TranquilliteItem, item_id)
    if item is None:
        raise NotFound("Pièce introuvable")
    access.require_project(item.project_id, "projects:write")
    service.tranquillite_verify(db, item, user_id=access.p.id, status=data.status, notes=data.notes, anchor=data.anchor)
    db.commit()
    return jsonable(serialize(item))


# ---------------------------------------------------------------------------- tâches
class TaskIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    description: str | None = None
    phase_id: uuid.UUID | None = None
    lot_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    zone_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    wbs_code: str | None = None
    status: str = Field(default="todo", pattern="^(todo|in_progress|blocked|done|cancelled)$")
    priority: str = Field(default="normal", pattern="^(low|normal|high|critical)$")
    start_planned: date | None = None
    end_planned: date | None = None
    duration_days: int = Field(default=1, ge=1, le=2000)
    is_milestone: bool = False
    milestone_id: uuid.UUID | None = None
    estimated_hours: Decimal | None = None
    planned_cost: Decimal = Decimal("0")
    checklist: list[dict[str, Any]] = Field(default_factory=list)
    constraint_type: str = Field(default="asap", pattern="^(asap|snet|fnlt)$")
    constraint_date: date | None = None
    sort_order: int = 0
    client_visible: bool = False
    assignee_ids: list[uuid.UUID] = Field(default_factory=list)


def _task_out(task: Task) -> dict[str, Any]:
    data = serialize(task)
    data["assignee_ids"] = [str(a.user_id) for a in task.assignments if a.user_id]
    return jsonable(data)


def _apply_assignments(task: Task, user_ids: list[uuid.UUID]) -> None:
    current = {a.user_id for a in task.assignments}
    wanted = set(user_ids)
    task.assignments[:] = [a for a in task.assignments if a.user_id in wanted]
    for uid in wanted - current:
        task.assignments.append(TaskAssignment(user_id=uid))


@router.get("/projects/{project_id}/tasks")
def list_tasks(
    project_id: uuid.UUID,
    params: PageParams = Depends(),
    status: str | None = None,
    phase_id: uuid.UUID | None = None,
    lot_id: uuid.UUID | None = None,
    zone_id: uuid.UUID | None = None,
    mine: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    _project(db, access, project_id, "planning:read")
    stmt = select(Task).where(Task.project_id == project_id, Task.deleted_at.is_(None))
    for col, value in (
        (Task.status, status),
        (Task.phase_id, phase_id),
        (Task.lot_id, lot_id),
        (Task.zone_id, zone_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    lots = access.allowed_lots(project_id)
    if lots is not None:
        stmt = stmt.where(or_(Task.lot_id.in_(lots), Task.lot_id.is_(None)))
    if mine or ("TECHNICIEN" in access.p.roles and not access.p.has("planning:write")):
        stmt = stmt.join(TaskAssignment, TaskAssignment.task_id == Task.id).where(TaskAssignment.user_id == access.p.id)
    if access.p.is_client:
        stmt = stmt.where(Task.client_visible.is_(True))
    params.page_size = max(params.page_size, 200) if params.page_size == 25 else params.page_size
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"start": Task.start_planned, "title": Task.title, "sort_order": Task.sort_order},
        default_sort=Task.sort_order,
        search_columns=[Task.title, Task.wbs_code],
        transform=_task_out,
    )


@router.post("/projects/{project_id}/tasks", status_code=201)
def create_task(
    project_id: uuid.UUID, data: TaskIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id, "planning:write")
    values = data.model_dump(exclude={"assignee_ids"})
    task = Task(project_id=project.id, created_by_id=access.p.id, **values)
    if task.start_planned and not task.end_planned:
        task.end_planned = planning.load_calendar(db, project.id).add_working_days(
            task.start_planned, task.duration_days
        )
    _apply_assignments(task, data.assignee_ids)
    db.add(task)
    db.flush()
    audit.record(
        db,
        family="business",
        module="planning",
        action="CREATE",
        resource_type="task",
        resource_id=task.id,
        project_id=project.id,
        diff={"title": task.title},
    )
    db.commit()
    return _task_out(task)


def _task(db: Session, access: Access, task_id: uuid.UUID, *perms: str) -> Task:
    task = db.get(Task, task_id)
    if task is None or task.deleted_at is not None:
        raise NotFound("Tâche introuvable")
    access.require_project(task.project_id, *perms)
    return task


@router.get("/tasks/{task_id}")
def get_task(task_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Fiche d'une tâche (application terrain : avancement, checklist, zone) ; mêmes règles que la liste."""
    task = _task(db, access, task_id, "planning:read")
    lots = access.allowed_lots(task.project_id)
    if (lots is not None and task.lot_id is not None and task.lot_id not in lots) or (
        access.p.is_client and not task.client_visible
    ):
        raise NotFound("Tâche introuvable")
    return _task_out(task)


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: uuid.UUID,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
    if_match: str | None = Header(default=None, alias="If-Match"),
) -> dict[str, Any]:
    task = _task(db, access, task_id, "planning:write")
    if if_match and if_match.strip('"') != str(task.version):
        raise Conflict("Tâche modifiée entre-temps", code="VERSION_CONFLICT", details={"server_version": task.version})
    merged = {
        **{k: getattr(task, k) for k in TaskIn.model_fields if k != "assignee_ids"},
        "assignee_ids": [a.user_id for a in task.assignments if a.user_id],
        **{k: v for k, v in data.items() if k in TaskIn.model_fields},
    }
    values = TaskIn.model_validate(merged)
    before = audit.snapshot(task)
    for key, value in values.model_dump(exclude={"assignee_ids"}).items():
        setattr(task, key, value)
    if "assignee_ids" in data:
        _apply_assignments(task, values.assignee_ids)
    db.flush()
    audit.record(
        db,
        family="business",
        module="planning",
        action="UPDATE",
        resource_type="task",
        resource_id=task.id,
        project_id=task.project_id,
        diff=audit.diff_dicts(before, audit.snapshot(task)),
    )
    db.commit()
    return _task_out(task)


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    task = _task(db, access, task_id, "planning:write")
    task.deleted_at = utcnow()
    for dep in db.execute(
        select(TaskDependency).where(
            or_(TaskDependency.predecessor_id == task.id, TaskDependency.successor_id == task.id)
        )
    ).scalars():
        db.delete(dep)
    audit.record(
        db,
        family="business",
        module="planning",
        action="DELETE",
        resource_type="task",
        resource_id=task.id,
        project_id=task.project_id,
    )
    db.commit()
    return {"status": "deleted"}


class ProgressIn(BaseModel):
    progress_pct: Decimal = Field(ge=0, le=100)
    note: str | None = Field(default=None, max_length=4000)
    evidence_file_ids: list[uuid.UUID] = Field(default_factory=list)


@router.post("/tasks/{task_id}/progress")
def task_progress(
    task_id: uuid.UUID, data: ProgressIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    task = _task(db, access, task_id)
    assigned = any(a.user_id == access.p.id for a in task.assignments)
    if not (access.has("planning:write") or (access.has("site:report") and (assigned or access.has("projects:write")))):
        raise Forbidden("Seuls les responsables ou les personnes affectées peuvent déclarer l'avancement")
    service.update_task_progress(
        db,
        task,
        pct=data.progress_pct,
        note=data.note,
        evidence=[str(x) for x in data.evidence_file_ids],
        user_id=access.p.id,
    )
    db.commit()
    return _task_out(task)


@router.post("/tasks/{task_id}/checklist/{index}")
def toggle_checklist(
    task_id: uuid.UUID, index: int, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    task = _task(db, access, task_id, "site:report")
    items = list(task.checklist or [])
    if index < 0 or index >= len(items):
        raise NotFound("Élément de checklist introuvable")
    item = dict(items[index])
    item["done"] = not item.get("done", False)
    item["done_by"] = str(access.p.id) if item["done"] else None
    item["done_at"] = utcnow().isoformat() if item["done"] else None
    items[index] = item
    task.checklist = items
    db.commit()
    return _task_out(task)


class DependencyIn(BaseModel):
    predecessor_id: uuid.UUID
    successor_id: uuid.UUID
    type: str = Field(default="FS", pattern="^(FS|SS|FF|SF)$")
    lag_days: int = Field(default=0, ge=-365, le=365)


@router.post("/projects/{project_id}/dependencies", status_code=201)
def add_dependency(
    project_id: uuid.UUID, data: DependencyIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(db, access, project_id, "planning:write")
    if data.predecessor_id == data.successor_id:
        raise BusinessRuleError("Une tâche ne peut dépendre d'elle-même")
    for tid in (data.predecessor_id, data.successor_id):
        task = db.get(Task, tid)
        if task is None or task.project_id != project_id:
            raise BusinessRuleError("Les tâches doivent appartenir au projet")
    if planning.would_create_cycle(db, project_id, data.predecessor_id, data.successor_id):
        raise BusinessRuleError("Cette dépendance créerait une boucle", code="CIRCULAR_DEPENDENCY")
    dep = TaskDependency(project_id=project_id, **data.model_dump())
    db.add(dep)
    db.flush()
    audit.record(
        db,
        family="business",
        module="planning",
        action="CREATE",
        resource_type="task_dependency",
        resource_id=dep.id,
        project_id=project_id,
        diff=data.model_dump(mode="json"),
    )
    db.commit()
    return jsonable(serialize(dep))


@router.delete("/dependencies/{dep_id}")
def delete_dependency(
    dep_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    dep = db.get(TaskDependency, dep_id)
    if dep is None:
        raise NotFound("Dépendance introuvable")
    access.require_project(dep.project_id, "planning:write")
    db.delete(dep)
    db.commit()
    return {"status": "deleted"}


@router.post("/projects/{project_id}/schedule")
def run_schedule(
    project_id: uuid.UUID, apply: bool = True, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id, "planning:write" if apply else "planning:read")
    result = planning.schedule(db, project, apply=apply)
    if apply:
        audit.record(
            db,
            family="business",
            module="planning",
            action="RESCHEDULE",
            resource_type="project",
            resource_id=project.id,
            project_id=project.id,
            diff={"end": str(result["end_date"])},
        )
        db.commit()
    return jsonable(result)


@router.get("/projects/{project_id}/gantt")
def get_gantt(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return jsonable(planning.gantt(db, _project(db, access, project_id, "planning:read")))


class BaselineIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    reason: str | None = Field(default=None, max_length=2000)


@router.post("/projects/{project_id}/baselines", status_code=201)
def create_baseline(
    project_id: uuid.UUID, data: BaselineIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, project_id, "planning:write")
    baseline = planning.save_baseline(db, project, name=data.name, reason=data.reason, user_id=access.p.id)
    audit.record(
        db,
        family="business",
        module="planning",
        action="BASELINE",
        resource_type="schedule_baseline",
        resource_id=baseline.id,
        project_id=project.id,
        diff={"number": baseline.number},
    )
    db.commit()
    return jsonable({"id": baseline.id, "number": baseline.number, "name": baseline.name})


@router.get("/projects/{project_id}/baselines")
def list_baselines(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    from app.modules.projects.models import ScheduleBaseline

    _project(db, access, project_id, "planning:read")
    rows = (
        db.execute(
            select(ScheduleBaseline)
            .where(ScheduleBaseline.project_id == project_id)
            .order_by(ScheduleBaseline.number.desc())
        )
        .scalars()
        .all()
    )
    return jsonable(
        [
            {
                "id": b.id,
                "number": b.number,
                "name": b.name,
                "is_current": b.is_current,
                "reason": b.reason,
                "created_at": b.created_at,
                "tasks": len(b.data or {}),
            }
            for b in rows
        ]
    )


@router.get("/planning/capacity")
def planning_capacity(
    start: date | None = None,
    weeks: int = Query(8, ge=1, le=26),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("planning:read")
    scope = access.project_scope()
    return planning.capacity(db, list(scope) if scope is not None else None, start or date.today(), weeks)


# ---------------------------------------------------------------------------- avenants
class ChangeOrderIn(BaseModel):
    project_id: uuid.UUID
    lot_id: uuid.UUID | None = None
    title: str = Field(min_length=3, max_length=250)
    description: str | None = None
    reason: str = Field(default="client_request", pattern="^(client_request|technical|unforeseen|regulatory)$")
    cost_impact: Decimal = Decimal("0")
    delay_impact_days: int = 0
    lines: list[dict[str, Any]] = Field(default_factory=list)


@router.get("/change-orders")
def list_change_orders(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("projects:read")
    stmt = access.filter_by_project(select(ChangeOrder), ChangeOrder.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(ChangeOrder.project_id == project_id)
    if status:
        stmt = stmt.where(ChangeOrder.status == status)
    return paginate(
        db,
        stmt,
        params,
        default_sort=ChangeOrder.created_at.desc(),
        search_columns=[ChangeOrder.number, ChangeOrder.title],
        transform=lambda c: jsonable(serialize(c)),
    )


@router.post("/change-orders", status_code=201)
def create_change_order(
    data: ChangeOrderIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(db, access, data.project_id, "projects:write")
    values = data.model_dump()
    if (
        data.lines
    ):  # lignes chiffrées : montant de chaque ligne et impact coût = leur total (jamais une recopie manuelle)
        lines = []
        for line in data.lines:
            try:
                amount = money(Decimal(str(line.get("quantity") or 0)) * Decimal(str(line.get("unit_price") or 0)))
            except (ArithmeticError, ValueError) as exc:
                raise BusinessRuleError("Ligne chiffrée invalide : quantité et prix unitaire numériques") from exc
            lines.append({**line, "amount": str(amount)})
        values["lines"] = lines
        values["cost_impact"] = money(sum((Decimal(row["amount"]) for row in lines), Decimal("0")))
    co = ChangeOrder(
        number=next_number(db, "change_order"),
        status="draft",
        origin="manual",
        created_by_id=access.p.id,
        **values,
    )
    db.add(co)
    db.flush()
    audit.record(
        db,
        family="business",
        module="change_orders",
        action="CREATE",
        resource_type="change_order",
        resource_id=co.id,
        project_id=co.project_id,
        diff={"cost": str(co.cost_impact)},
    )
    db.commit()
    return jsonable(serialize(co))


@router.post("/change-orders/{co_id}/transition")
def change_order_transition(
    co_id: uuid.UUID, data: dict[str, str], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    co = db.get(ChangeOrder, co_id)
    if co is None:
        raise NotFound("Avenant introuvable")
    target = data.get("target", "")
    access.require_project(co.project_id, "finance:approve" if target == "approved" else "projects:write")
    service.transition_change_order(db, co, target, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(co))


# ---------------------------------------------------------------------------- décisions
class DecisionIn(BaseModel):
    project_id: uuid.UUID
    kind: str = Field(default="option", pattern="^(material|option|plan|budget|planning|other)$")
    title: str = Field(min_length=3, max_length=250)
    description: str | None = None
    options: list[dict[str, Any]] = Field(default_factory=list, max_length=10)
    price_impact: Decimal = Decimal("0")
    delay_impact_days: int = 0
    currency: str = "XAF"
    reference_type: str | None = Field(default=None, pattern="^(document_version|bim_version|scenario)$")
    reference_id: uuid.UUID | None = None
    version_label: str | None = Field(default=None, max_length=60)
    due_date: date | None = None


@router.get("/decisions")
def list_decisions(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("projects:read")
    stmt = access.filter_by_project(select(Decision), Decision.project_id, allow_null=False)
    if project_id:
        stmt = stmt.where(Decision.project_id == project_id)
    if status:
        stmt = stmt.where(Decision.status == status)
    return paginate(
        db,
        stmt,
        params,
        default_sort=Decision.created_at.desc(),
        search_columns=[Decision.title],
        transform=lambda d: jsonable(serialize(d)),
    )


@router.post("/decisions", status_code=201)
def create_decision(
    data: DecisionIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    project = _project(db, access, data.project_id, "projects:publish_client")
    decision = service.request_decision(
        db, project=project, data=data.model_dump(exclude={"project_id"}), user_id=access.p.id
    )
    db.commit()
    return jsonable(serialize(decision))


# ---------------------------------------------------------------------------- journal de chantier
class DailyLogIn(BaseModel):
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    log_date: date
    weather: str | None = Field(default=None, max_length=120)
    temperature_c: float | None = None
    workforce_count: int = Field(default=0, ge=0)
    subcontractor_workforce: int = Field(default=0, ge=0)
    activities: str | None = None
    issues: str | None = None
    deliveries_summary: str | None = None
    visitors: str | None = None
    safety_notes: str | None = None
    delay_hours: Decimal | None = None
    needs: str | None = None
    is_critical: bool = False
    client_visible: bool = False


@router.get("/daily-logs")
def list_daily_logs(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("projects:read")
    stmt = access.filter_by_project(select(DailyLog), DailyLog.project_id, allow_null=False)
    for col, value in ((DailyLog.project_id, project_id), (DailyLog.site_id, site_id), (DailyLog.status, status)):
        if value:
            stmt = stmt.where(col == value)
    return paginate(db, stmt, params, default_sort=DailyLog.log_date.desc(), transform=lambda d: jsonable(serialize(d)))


@router.post("/daily-logs", status_code=201)
def create_daily_log(
    data: DailyLogIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    _project(db, access, data.project_id, "site:report")
    log = DailyLog(author_id=access.p.id, status="draft", **data.model_dump())
    db.add(log)
    db.flush()
    audit.record(
        db,
        family="business",
        module="site_log",
        action="CREATE",
        resource_type="daily_log",
        resource_id=log.id,
        project_id=log.project_id,
    )
    db.commit()
    return jsonable(serialize(log))


@router.patch("/daily-logs/{log_id}")
def update_daily_log(
    log_id: uuid.UUID, data: dict[str, Any], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    log = db.get(DailyLog, log_id)
    if log is None:
        raise NotFound("Journal introuvable")
    access.require_project(log.project_id, "site:report")
    if log.status == "validated":
        raise BusinessRuleError("Journal validé : non modifiable")
    values = DailyLogIn.model_validate({**{k: getattr(log, k) for k in DailyLogIn.model_fields}, **data}).model_dump()
    before = audit.snapshot(log)
    for key, value in values.items():
        setattr(log, key, value)
    db.flush()
    audit.record(
        db,
        family="business",
        module="site_log",
        action="UPDATE",
        resource_type="daily_log",
        resource_id=log.id,
        project_id=log.project_id,
        diff=audit.diff_dicts(before, audit.snapshot(log)),
    )
    db.commit()
    return jsonable(serialize(log))


@router.post("/daily-logs/{log_id}/submit")
def submit_daily_log(
    log_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    log = db.get(DailyLog, log_id)
    if log is None:
        raise NotFound("Journal introuvable")
    access.require_project(log.project_id, "site:report")
    service.submit_daily_log(db, log, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(log))


@router.post("/daily-logs/{log_id}/validate")
def validate_daily_log(
    log_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    log = db.get(DailyLog, log_id)
    if log is None:
        raise NotFound("Journal introuvable")
    access.require_project(log.project_id, "projects:write")
    log.status = "validated"
    log.validated_by_id = access.p.id
    log.validated_at = utcnow()
    audit.record(
        db,
        family="business",
        module="site_log",
        action="VALIDATE",
        resource_type="daily_log",
        resource_id=log.id,
        project_id=log.project_id,
    )
    db.commit()
    return jsonable(serialize(log))


# ---------------------------------------------------------------------------- photos / vidéos chantier
def _check_media_stage(stage: Any) -> None:
    if stage not in SITE_MEDIA_STAGES:
        raise BusinessRuleError(
            "Étape invalide : avant, pendant ou après travaux, inspection, livraison ou incident",
            code="INVALID_MEDIA_STAGE",
        )


def _media_out(media: SiteMedia, stored: StoredFile | None, user_id: uuid.UUID) -> dict[str, Any]:
    data = serialize(media)
    if stored:
        data["file"] = {
            "name": stored.original_name,
            "mime": stored.mime_type,
            "size": stored.size_bytes,
            "url": signed_url(stored.id, user_id=user_id, ttl=3600),
        }
    return jsonable(data)


@router.post("/projects/{project_id}/media", status_code=201)
async def upload_site_media(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    caption: str | None = Form(None),
    stage: str = Form("during"),
    site_id: uuid.UUID | None = Form(None),
    task_id: uuid.UUID | None = Form(None),
    zone_id: uuid.UUID | None = Form(None),
    daily_log_id: uuid.UUID | None = Form(None),
    taken_at: datetime | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    publish: bool = Form(False),
    client_mutation_id: str | None = Form(None, max_length=80),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    _project(db, access, project_id, "site:report")
    _check_media_stage(stage)
    upload = validate_upload(file.filename or "media", await file.read(), category="media", max_mb=500)
    if client_mutation_id:
        # Envoi rejoué par la file hors ligne de l'application terrain : même fichier, même auteur, même projet
        # → le média déjà enregistré est renvoyé (aucun doublon).
        replay = db.execute(
            select(SiteMedia, StoredFile)
            .join(StoredFile, StoredFile.id == SiteMedia.file_id)
            .where(
                SiteMedia.project_id == project_id,
                SiteMedia.uploaded_by_id == access.p.id,
                StoredFile.checksum_sha256 == upload.sha256,
            )
        ).first()
        if replay is not None:
            return _media_out(replay[0], replay[1], access.p.id)
    extra: dict[str, Any] = {}
    if latitude is not None and longitude is not None:
        extra["geo"] = {"lat": latitude, "lng": longitude}
    if taken_at:
        extra["taken_at"] = taken_at
    stored = store_private(
        db, upload, purpose="site_media", classification="internal", uploaded_by_id=access.p.id, extra=extra
    )
    if publish:
        access.require("projects:publish_client")
    media = SiteMedia(
        project_id=project_id,
        site_id=site_id,
        task_id=task_id,
        zone_id=zone_id,
        daily_log_id=daily_log_id,
        file_id=stored.id,
        media_type="video" if upload.mime.startswith("video/") else "photo",
        caption=caption,
        stage=stage,
        taken_at=stored.taken_at or taken_at,
        latitude=(stored.geo or {}).get("lat"),
        longitude=(stored.geo or {}).get("lng"),
        published_to_client=publish,
        uploaded_by_id=access.p.id,
    )
    db.add(media)
    db.flush()
    audit.record(
        db,
        family="business",
        module="site_media",
        action="CREATE",
        resource_type="site_media",
        resource_id=media.id,
        project_id=project_id,
        diff={"type": media.media_type, "published": publish},
    )
    db.commit()
    return _media_out(media, stored, access.p.id)


@router.get("/projects/{project_id}/media")
def list_site_media(
    project_id: uuid.UUID,
    params: PageParams = Depends(),
    stage: str | None = None,
    task_id: uuid.UUID | None = None,
    zone_id: uuid.UUID | None = None,
    published: bool | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    _project(db, access, project_id, "projects:read")
    stmt = select(SiteMedia).where(SiteMedia.project_id == project_id)
    for col, value in ((SiteMedia.stage, stage), (SiteMedia.task_id, task_id), (SiteMedia.zone_id, zone_id)):
        if value:
            stmt = stmt.where(col == value)
    if published is not None:
        stmt = stmt.where(SiteMedia.published_to_client.is_(published))
    result = paginate(db, stmt, params, default_sort=SiteMedia.created_at.desc())
    files = (
        {
            f.id: f
            for f in db.execute(
                select(StoredFile).where(StoredFile.id.in_([m.file_id for m in result["items"]]))
            ).scalars()
        }
        if result["items"]
        else {}
    )
    result["items"] = [_media_out(m, files.get(m.file_id), access.p.id) for m in result["items"]]
    return result


@router.patch("/site-media/{media_id}")
def update_site_media(
    media_id: uuid.UUID, data: dict[str, Any], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    media = db.get(SiteMedia, media_id)
    if media is None:
        raise NotFound("Média introuvable")
    access.require_project(media.project_id, "site:report")
    if "published_to_client" in data:
        access.require("projects:publish_client")
        media.published_to_client = bool(data["published_to_client"])
    if "caption" in data:
        media.caption = str(data["caption"])[:500]
    if "stage" in data:
        _check_media_stage(data["stage"])
        media.stage = data["stage"]
    audit.record(
        db,
        family="business",
        module="site_media",
        action="UPDATE",
        resource_type="site_media",
        resource_id=media.id,
        project_id=media.project_id,
        diff={k: [None, v] for k, v in data.items()},
    )
    db.commit()
    return _media_out(media, db.get(StoredFile, media.file_id), access.p.id)


@router.get("/site-media/{media_id}/file")
def site_media_file(media_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Any:
    media = db.get(SiteMedia, media_id)
    if media is None:
        raise NotFound("Média introuvable")
    access.require_project(media.project_id)
    if access.p.is_client and not media.published_to_client:
        raise NotFound("Média introuvable")
    return file_response(db.get(StoredFile, media.file_id))
