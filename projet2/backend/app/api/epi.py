"""QHSE — EPI (équipements de protection individuelle) distributions."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_staff
from app.database import get_db
from app.models.erp import EPIDistribution, Employee, TempWorker, Project
from app.services.activity_service import log_activity

router = APIRouter(prefix="/qhse/epi", tags=["QHSE - EPI"])


from app.utils.time import utcnow_naive as _now


class EPICreate(BaseModel):
    worker_type: str  # employee or temp_worker
    worker_id: str
    equipment_type: str
    quantity: int = 1
    project_id: Optional[str] = None
    signed: bool = False
    signature_url: Optional[str] = None
    notes: str = ""


async def _worker_name(db: AsyncSession, worker_type: str, worker_id: str) -> str:
    if worker_type == "employee":
        r = await db.execute(select(Employee).where(Employee.id == worker_id))
        e = r.scalars().first()
        return f"{e.first_name} {e.last_name}".strip() if e else ""
    r = await db.execute(select(TempWorker).where(TempWorker.id == worker_id))
    w = r.scalars().first()
    return f"{w.first_name} {w.last_name}".strip() if w else ""


async def _project_name(db: AsyncSession, project_id: Optional[str]) -> str:
    if not project_id:
        return ""
    r = await db.execute(select(Project).where(Project.id == project_id))
    p = r.scalars().first()
    return p.name if p else ""


@router.get("")
async def list_distributions(
    project_id: Optional[str] = None,
    worker_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(EPIDistribution).order_by(EPIDistribution.distributed_at.desc())
    if project_id:
        q = q.where(EPIDistribution.project_id == project_id)
    if worker_id:
        q = q.where(EPIDistribution.worker_id == worker_id)
    r = await db.execute(q)
    items = r.scalars().all()
    out = []
    for d in items:
        out.append({
            "id": d.id,
            "worker_type": d.worker_type,
            "worker_id": d.worker_id,
            "worker_name": await _worker_name(db, d.worker_type, d.worker_id),
            "equipment_type": d.equipment_type,
            "quantity": d.quantity,
            "project_id": d.project_id,
            "project_name": await _project_name(db, d.project_id),
            "signed": d.signed,
            "signature_url": d.signature_url,
            "notes": d.notes,
            "distributed_at": d.distributed_at,
        })
    return out


@router.post("")
async def create_distribution(
    data: EPICreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    if data.worker_type not in ("employee", "temp_worker"):
        raise HTTPException(400, "worker_type doit être 'employee' ou 'temp_worker'")
    dist = EPIDistribution(**data.model_dump(), distributed_by=user.id)
    db.add(dist)
    await log_activity(db, user.id, "EPI_DISTRIBUTED", "epi_distribution",
                        new_value={"type": data.equipment_type, "qty": data.quantity})
    await db.commit()
    await db.refresh(dist)
    return {"id": dist.id}


@router.patch("/{dist_id}/sign")
async def sign_distribution(
    dist_id: str,
    signature_url: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(EPIDistribution).where(EPIDistribution.id == dist_id))
    d = r.scalars().first()
    if not d:
        raise HTTPException(404, "Distribution introuvable")
    d.signed = True
    d.signature_url = signature_url
    await db.commit()
    return {"detail": "Distribution signée"}


@router.get("/stats")
async def epi_stats(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Returns total quantity distributed per equipment type."""
    rows = await db.execute(
        select(EPIDistribution.equipment_type, func.sum(EPIDistribution.quantity))
        .group_by(EPIDistribution.equipment_type)
    )
    return [{"type": t, "quantity": int(qty or 0)} for t, qty in rows.all()]
