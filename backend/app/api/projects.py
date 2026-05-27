"""Projects / Chantiers API."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.auth.models import User
from app.auth.service import require_staff, require_admin, get_current_user
from app.models.erp import Project, ProjectPhase, ProjectMedia, ProjectTemplate
from app.services.activity_service import log_activity

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Schemas ──────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    project_type: str = ""
    location: str = ""
    description: str = ""
    client_id: Optional[str] = None
    chef_projet_id: Optional[str] = None
    budget_initial: float = 0.0
    template_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    chef_projet_id: Optional[str] = None
    budget_initial: Optional[float] = None
    start_date: Optional[datetime] = None
    estimated_end_date: Optional[datetime] = None

class PhaseUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


# ── Routes ───────────────────────────────────────────────────

@router.get("")
async def list_projects(
    status_filter: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    query = select(Project).where(Project.deleted_at.is_(None)).order_by(Project.created_at.desc())
    if status_filter:
        query = query.where(Project.status == status_filter)
    result = await db.execute(query)
    projects = result.scalars().all()
    return [
        {
            "id": p.id, "code": p.code, "name": p.name, "location": p.location,
            "project_type": p.project_type, "client_id": p.client_id,
            "chef_projet_id": p.chef_projet_id, "budget_initial": p.budget_initial,
            "budget_spent": p.budget_spent, "status": p.status, "progress": p.progress,
            "start_date": p.start_date, "end_date": p.end_date,
            "estimated_end_date": p.estimated_end_date,
            "created_at": p.created_at, "updated_at": p.updated_at,
        }
        for p in projects
    ]


@router.post("")
async def create_project(
    data: ProjectCreate,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(Project.id)))
    count = count_r.scalar() or 0
    code = f"PRJ-{datetime.utcnow().strftime('%Y')}-{count + 1:03d}"

    project = Project(
        code=code, name=data.name, project_type=data.project_type,
        location=data.location, description=data.description,
        client_id=data.client_id, chef_projet_id=data.chef_projet_id,
        budget_initial=data.budget_initial,
    )
    db.add(project)
    await db.flush()

    # Apply template
    if data.template_id:
        tmpl_r = await db.execute(select(ProjectTemplate).where(ProjectTemplate.id == data.template_id))
        tmpl = tmpl_r.scalars().first()
        if tmpl and tmpl.phases:
            for idx, ph in enumerate(tmpl.phases):
                db.add(ProjectPhase(
                    project_id=project.id, name=ph["name"],
                    duration_days=ph.get("duration_days", 0), sort_order=idx,
                ))

    await log_activity(db, user.id, "PROJECT_CREATED", "project", project.id,
                       new_value={"code": code, "name": data.name})
    await db.commit()
    return {"id": project.id, "code": code}


@router.get("/{project_id}")
async def get_project(project_id: str, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project).where(Project.id == project_id, Project.deleted_at.is_(None)))
    p = r.scalars().first()
    if not p:
        raise HTTPException(404, "Projet introuvable")
    return {
        "id": p.id, "code": p.code, "name": p.name, "description": p.description,
        "location": p.location, "project_type": p.project_type,
        "client_id": p.client_id, "chef_projet_id": p.chef_projet_id,
        "budget_initial": p.budget_initial, "budget_spent": p.budget_spent,
        "status": p.status, "progress": p.progress,
        "start_date": p.start_date, "end_date": p.end_date,
        "estimated_end_date": p.estimated_end_date, "bim_urn": p.bim_urn,
        "created_at": p.created_at, "updated_at": p.updated_at,
    }


@router.patch("/{project_id}")
async def update_project(project_id: str, data: ProjectUpdate, user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Project).where(Project.id == project_id, Project.deleted_at.is_(None)))
    p = r.scalars().first()
    if not p:
        raise HTTPException(404, "Projet introuvable")
    updates = data.model_dump(exclude_unset=True)
    old = {k: getattr(p, k) for k in updates}
    for k, v in updates.items():
        setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    await log_activity(db, user.id, "PROJECT_UPDATED", "project", p.id, old_value=old, new_value=updates)
    await db.commit()
    return {"detail": "Projet mis à jour"}


# ── Phases / Timeline ────────────────────────────────────────

@router.get("/{project_id}/timeline")
async def get_timeline(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(ProjectPhase).where(ProjectPhase.project_id == project_id).order_by(ProjectPhase.sort_order)
    )
    phases = r.scalars().all()
    return [
        {
            "id": ph.id, "name": ph.name, "status": ph.status,
            "progress": ph.progress, "duration_days": ph.duration_days,
            "start_date": ph.start_date, "end_date": ph.end_date,
            "sort_order": ph.sort_order, "validated_by": ph.validated_by,
            "validated_at": ph.validated_at,
        }
        for ph in phases
    ]


@router.patch("/{project_id}/phases/{phase_id}")
async def update_phase(
    project_id: str, phase_id: str, data: PhaseUpdate,
    user: User = Depends(require_staff), db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(ProjectPhase).where(ProjectPhase.id == phase_id, ProjectPhase.project_id == project_id))
    phase = r.scalars().first()
    if not phase:
        raise HTTPException(404, "Phase introuvable")

    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(phase, k, v)

    if data.status == "TERMINE":
        phase.progress = 100
        phase.validated_by = user.id
        phase.validated_at = datetime.utcnow()
    phase.updated_at = datetime.utcnow()

    # Recalculate project progress
    all_phases_r = await db.execute(
        select(ProjectPhase).where(ProjectPhase.project_id == project_id)
    )
    all_phases = all_phases_r.scalars().all()
    if all_phases:
        total_progress = sum(ph.progress for ph in all_phases) / len(all_phases)
        proj_r = await db.execute(select(Project).where(Project.id == project_id))
        proj = proj_r.scalars().first()
        if proj:
            proj.progress = int(total_progress)
            proj.updated_at = datetime.utcnow()

    await log_activity(db, user.id, "PHASE_UPDATED", "project_phase", phase_id, new_value=updates)
    await db.commit()
    return {"detail": "Phase mise à jour", "project_progress": int(total_progress) if all_phases else 0}


# ── Gallery ──────────────────────────────────────────────────

@router.get("/{project_id}/gallery")
async def get_gallery(project_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(ProjectMedia).where(ProjectMedia.project_id == project_id).order_by(ProjectMedia.created_at.desc())
    )
    media = r.scalars().all()
    return [
        {"id": m.id, "url": m.url, "thumbnail": m.thumbnail, "caption": m.caption,
         "media_type": m.media_type, "phase_id": m.phase_id, "created_at": m.created_at}
        for m in media
    ]


# ── Templates ────────────────────────────────────────────────

@router.get("/templates/list")
async def list_templates(user: User = Depends(require_staff), db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(ProjectTemplate).order_by(ProjectTemplate.name))
    templates = r.scalars().all()
    return [{"id": t.id, "name": t.name, "description": t.description, "phases": t.phases} for t in templates]
