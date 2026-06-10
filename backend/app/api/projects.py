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
from app.models.erp import (
    Project, ProjectPhase, ProjectMedia, ProjectTemplate, Equipment, Attendance,
    ProjectAssignment,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/projects", tags=["Projects"])


from app.utils.time import utcnow_naive as _now


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
    code = f"PRJ-{_now().strftime('%Y')}-{count + 1:03d}"

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


@router.get("/resource-allocation")
async def resource_allocation(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Per active project: headcount (distinct workers pointed) + equipment + budget.

    Declared BEFORE /{project_id} so the literal path matches first. Feeds the
    "allocation des ressources" chart on the Chantiers page.
    """
    proj_r = await db.execute(
        select(Project).where(
            Project.status == "EN_COURS", Project.deleted_at.is_(None)
        ).order_by(Project.created_at.desc())
    )
    out = []
    for p in proj_r.scalars().all():
        workers_r = await db.execute(
            select(func.count(func.distinct(Attendance.worker_id))).where(
                Attendance.project_id == p.id
            )
        )
        equip_r = await db.execute(
            select(func.count(Equipment.id)).where(
                Equipment.current_project_id == p.id, Equipment.deleted_at.is_(None)
            )
        )
        budget = float(p.budget_initial or 0)
        spent = float(p.budget_spent or 0)
        out.append({
            "project_id": p.id,
            "project_name": p.name,
            "workers": workers_r.scalar() or 0,
            "equipment": equip_r.scalar() or 0,
            "budget_used_pct": round(spent / budget * 100, 1) if budget else 0.0,
        })
    return out


# ── Team assignments (Phase 13) ──────────────────────────────
# Declared BEFORE /{project_id} so the literal paths match first.

class TeamAssignmentCreate(BaseModel):
    project_id: str
    member_name: str
    role: str = ""
    hours: int = 0
    status: str = "Sur site"
    worker_type: str = ""
    worker_id: Optional[str] = None


@router.get("/team-assignments")
async def list_team_assignments(
    project_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """List active team assignments (optionally for one project), project name resolved."""
    q = select(ProjectAssignment).where(
        ProjectAssignment.removed_at.is_(None), ProjectAssignment.deleted_at.is_(None)
    ).order_by(ProjectAssignment.assigned_at.desc())
    if project_id:
        q = q.where(ProjectAssignment.project_id == project_id)
    r = await db.execute(q)
    rows = r.scalars().all()
    # Resolve project names in one query.
    proj_ids = {a.project_id for a in rows}
    names: dict[str, str] = {}
    if proj_ids:
        pr = await db.execute(select(Project.id, Project.name).where(Project.id.in_(proj_ids)))
        names = {pid: pname for pid, pname in pr.all()}
    return [
        {
            "id": a.id, "project_id": a.project_id,
            "project_name": names.get(a.project_id, ""),
            "member_name": a.member_name, "role": a.role,
            "hours": a.hours, "status": a.status,
            "worker_type": a.worker_type, "worker_id": a.worker_id,
            "assigned_at": a.assigned_at,
        }
        for a in rows
    ]


@router.post("/team-assignments")
async def create_team_assignment(
    data: TeamAssignmentCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    proj_r = await db.execute(select(Project).where(Project.id == data.project_id, Project.deleted_at.is_(None)))
    if not proj_r.scalars().first():
        raise HTTPException(404, "Projet introuvable")
    a = ProjectAssignment(**data.model_dump())
    db.add(a)
    await log_activity(db, user.id, "TEAM_ASSIGNED", "project", data.project_id,
                       new_value={"member": data.member_name, "role": data.role})
    await db.commit()
    await db.refresh(a)
    return {"id": a.id}


@router.delete("/team-assignments/{assignment_id}")
async def remove_team_assignment(
    assignment_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(ProjectAssignment).where(ProjectAssignment.id == assignment_id))
    a = r.scalars().first()
    if not a:
        raise HTTPException(404, "Affectation introuvable")
    a.removed_at = _now()
    await db.commit()
    return {"detail": "Affectation retirée"}


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
    p.updated_at = _now()
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
        phase.validated_at = _now()
    phase.updated_at = _now()

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
            proj.updated_at = _now()

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
    # Seed the default templates (Villa R+1, Immeuble R+3, …) on first access.
    from app.services.project_templates import ensure_default_templates
    await ensure_default_templates(db)
    r = await db.execute(select(ProjectTemplate).order_by(ProjectTemplate.name))
    templates = r.scalars().all()
    return [{"id": t.id, "name": t.name, "description": t.description, "phases": t.phases} for t in templates]


class TemplateCreateIn(BaseModel):
    name: str
    description: str = ""
    phases: list = []


@router.post("/templates")
async def create_template(
    data: TemplateCreateIn,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    t = ProjectTemplate(**data.model_dump())
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return {"id": t.id}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(ProjectTemplate).where(ProjectTemplate.id == template_id))
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Modèle introuvable")
    await db.delete(t)
    await db.commit()
    return {"detail": "Modèle supprimé"}


# ── Project expenses (granular cost tracking) ───────────────

class ExpenseCreate(BaseModel):
    phase_id: Optional[str] = None
    category: str = "materials"
    description: str
    amount: float
    receipt_url: Optional[str] = None
    supplier_invoice_id: Optional[str] = None
    expense_date: Optional[datetime] = None


@router.get("/{project_id}/expenses")
async def list_expenses(
    project_id: str,
    category: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.models.erp import ProjectExpense
    q = select(ProjectExpense).where(
        ProjectExpense.project_id == project_id,
        ProjectExpense.deleted_at.is_(None),
    ).order_by(ProjectExpense.expense_date.desc())
    if category:
        q = q.where(ProjectExpense.category == category)
    r = await db.execute(q)
    return [
        {
            "id": e.id, "phase_id": e.phase_id, "category": e.category,
            "description": e.description, "amount": e.amount,
            "receipt_url": e.receipt_url,
            "supplier_invoice_id": e.supplier_invoice_id,
            "expense_date": e.expense_date, "created_at": e.created_at,
        }
        for e in r.scalars().all()
    ]


@router.post("/{project_id}/expenses")
async def add_expense(
    project_id: str,
    data: ExpenseCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    from app.models.erp import ProjectExpense
    exp = ProjectExpense(
        project_id=project_id,
        **{k: v for k, v in data.model_dump().items() if k != "expense_date" or v is not None},
        expense_date=data.expense_date or _now(),
        recorded_by=user.id,
    )
    db.add(exp)
    # Increment budget_spent
    p_r = await db.execute(select(Project).where(Project.id == project_id))
    p = p_r.scalars().first()
    if p:
        p.budget_spent = (p.budget_spent or 0) + data.amount
        p.updated_at = _now()
    await db.commit()
    await db.refresh(exp)
    return {"id": exp.id}


# ── Media upload (project gallery) ──────────────────────────

class MediaCreate(BaseModel):
    phase_id: Optional[str] = None
    url: str
    thumbnail: str = ""
    caption: str = ""
    media_type: str = "photo"


@router.post("/{project_id}/media")
async def add_media(
    project_id: str,
    data: MediaCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Add a media entry to a project's gallery (URL produced by /admin/media/upload)."""
    media = ProjectMedia(
        project_id=project_id,
        phase_id=data.phase_id,
        url=data.url,
        thumbnail=data.thumbnail or data.url,
        caption=data.caption,
        media_type=data.media_type,
        uploaded_by=user.id,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return {"id": media.id}


@router.delete("/{project_id}/media/{media_id}")
async def delete_media(
    project_id: str,
    media_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(ProjectMedia).where(
            ProjectMedia.id == media_id, ProjectMedia.project_id == project_id
        )
    )
    m = r.scalars().first()
    if not m:
        raise HTTPException(404, "Média introuvable")
    await db.delete(m)
    await db.commit()
    return {"detail": "Média supprimé"}


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Project).where(Project.id == project_id))
    p = r.scalars().first()
    if not p:
        raise HTTPException(404, "Projet introuvable")
    p.deleted_at = _now()
    await log_activity(db, user.id, "PROJECT_DELETED", "project", project_id)
    await db.commit()
    return {"detail": "Projet supprimé"}
