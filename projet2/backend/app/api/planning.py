"""Planning API — Gantt tasks & dependencies for project planning."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_staff
from app.database import get_db
from app.models.erp import PlanningDependency, PlanningTask
from app.services.activity_service import log_activity

router = APIRouter(prefix="/planning", tags=["Planning"])


from app.utils.time import utcnow_naive as _now


class TaskCreate(BaseModel):
    project_id: str
    phase_id: Optional[str] = None
    name: str
    description: str = ""
    start_date: datetime
    end_date: datetime
    duration_days: int = 1
    priority: str = "NORMAL"
    assignee_id: Optional[str] = None
    sort_order: int = 0


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    duration_days: Optional[int] = None
    progress: Optional[int] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    sort_order: Optional[int] = None


class DependencyCreate(BaseModel):
    predecessor_id: str
    successor_id: str
    dep_type: str = "FS"
    lag_days: int = 0


def _serialize(t: PlanningTask) -> dict:
    return {
        "id": t.id,
        "project_id": t.project_id,
        "phase_id": t.phase_id,
        "name": t.name,
        "description": t.description,
        "start_date": t.start_date,
        "end_date": t.end_date,
        "duration_days": t.duration_days,
        "progress": t.progress,
        "status": t.status,
        "priority": t.priority,
        "assignee_id": t.assignee_id,
        "sort_order": t.sort_order,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


@router.get("/tasks")
async def list_tasks(
    project_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(PlanningTask).where(PlanningTask.deleted_at.is_(None)).order_by(
        PlanningTask.sort_order, PlanningTask.start_date
    )
    if project_id:
        q = q.where(PlanningTask.project_id == project_id)
    if status_filter:
        q = q.where(PlanningTask.status == status_filter)
    r = await db.execute(q)
    return [_serialize(t) for t in r.scalars().all()]


@router.post("/tasks")
async def create_task(
    data: TaskCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    if data.end_date < data.start_date:
        raise HTTPException(400, "La date de fin doit être après la date de début")
    task = PlanningTask(**data.model_dump())
    db.add(task)
    await log_activity(db, user.id, "PLANNING_TASK_CREATED", "planning_task",
                        new_value={"name": data.name})
    await db.commit()
    await db.refresh(task)
    return _serialize(task)


@router.patch("/tasks/{task_id}")
async def update_task(
    task_id: str,
    data: TaskUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(PlanningTask).where(PlanningTask.id == task_id, PlanningTask.deleted_at.is_(None)))
    task = r.scalars().first()
    if not task:
        raise HTTPException(404, "Tâche introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(task, k, v)
    if updates.get("status") == "DONE":
        task.progress = 100
    task.updated_at = _now()
    await db.commit()
    return _serialize(task)


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(PlanningTask).where(PlanningTask.id == task_id))
    task = r.scalars().first()
    if not task:
        raise HTTPException(404, "Tâche introuvable")
    task.deleted_at = _now()
    await db.commit()
    return {"detail": "Tâche supprimée"}


# ── Dependencies ─────────────────────────────────────────────

@router.get("/dependencies")
async def list_dependencies(
    project_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(PlanningDependency)
    if project_id:
        # Filter through predecessor's project
        q = q.join(PlanningTask, PlanningTask.id == PlanningDependency.predecessor_id).where(
            PlanningTask.project_id == project_id
        )
    r = await db.execute(q)
    return [
        {
            "id": d.id,
            "predecessor_id": d.predecessor_id,
            "successor_id": d.successor_id,
            "dep_type": d.dep_type,
            "lag_days": d.lag_days,
        }
        for d in r.scalars().all()
    ]


@router.post("/dependencies")
async def create_dependency(
    data: DependencyCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    if data.predecessor_id == data.successor_id:
        raise HTTPException(400, "Une tâche ne peut pas dépendre d'elle-même")
    dep = PlanningDependency(**data.model_dump())
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
    return {"id": dep.id}


@router.delete("/dependencies/{dep_id}")
async def delete_dependency(
    dep_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(PlanningDependency).where(PlanningDependency.id == dep_id))
    dep = r.scalars().first()
    if not dep:
        raise HTTPException(404, "Dépendance introuvable")
    await db.delete(dep)
    await db.commit()
    return {"detail": "Dépendance supprimée"}
