"""Equipment — Extended routes: details, assignments, movements, maintenance.

IMPORTANT: literal sub-paths (/assignments, /movements, /maintenance) MUST be
declared BEFORE the parameterised /{equipment_id} routes, otherwise FastAPI's
path matcher treats "assignments" as an equipment_id and returns 404.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import require_admin, require_staff
from app.database import get_db
from app.models.erp import (
    Equipment,
    EquipmentAssignment,
    EquipmentMovement,
    MaintenanceTicket,
)
from app.services.activity_service import log_activity

router = APIRouter(prefix="/equipment", tags=["Equipment - Extended"])


from app.utils.time import utcnow_naive as _now


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    status: Optional[str] = None
    current_project_id: Optional[str] = None
    photo_url: Optional[str] = None
    purchase_date: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None


class AssignmentCreate(BaseModel):
    equipment_id: str
    project_id: str
    responsible_id: Optional[str] = None
    assigned_from: Optional[datetime] = None
    notes: str = ""


class MovementCreate(BaseModel):
    equipment_id: str
    from_location: str = ""
    to_location: str
    from_project_id: Optional[str] = None
    to_project_id: Optional[str] = None
    reason: str = ""


class MaintenanceCreate(BaseModel):
    equipment_id: str
    maintenance_type: str = "CURATIVE"
    description: str
    cost: float = 0.0
    scheduled_for: Optional[datetime] = None
    technician: str = ""


# ═════════════════════════════════════════════════════════════
# LITERAL SUB-PATHS — must come BEFORE /{equipment_id}
# ═════════════════════════════════════════════════════════════

# ── Assignments ──────────────────────────────────────────────

@router.get("/assignments")
async def list_assignments(
    project_id: Optional[str] = None,
    equipment_id: Optional[str] = None,
    active: Optional[bool] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(EquipmentAssignment).where(EquipmentAssignment.deleted_at.is_(None)).order_by(
        EquipmentAssignment.assigned_from.desc()
    )
    if project_id:
        q = q.where(EquipmentAssignment.project_id == project_id)
    if equipment_id:
        q = q.where(EquipmentAssignment.equipment_id == equipment_id)
    if active is not None:
        q = q.where(EquipmentAssignment.status == ("ACTIVE" if active else "RETURNED"))
    r = await db.execute(q)
    items = r.scalars().all()
    out = []
    for a in items:
        eq_r = await db.execute(select(Equipment).where(Equipment.id == a.equipment_id))
        eq = eq_r.scalars().first()
        out.append({
            "id": a.id,
            "equipment_id": a.equipment_id,
            "equipment_name": eq.name if eq else "",
            "project_id": a.project_id,
            "responsible_id": a.responsible_id,
            "assigned_from": a.assigned_from,
            "assigned_to": a.assigned_to,
            "status": a.status,
            "notes": a.notes,
        })
    return out


@router.post("/assignments")
async def create_assignment(
    data: AssignmentCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    existing_r = await db.execute(
        select(EquipmentAssignment).where(
            EquipmentAssignment.equipment_id == data.equipment_id,
            EquipmentAssignment.status == "ACTIVE",
            EquipmentAssignment.deleted_at.is_(None),
        )
    )
    for existing in existing_r.scalars().all():
        existing.status = "RETURNED"
        existing.assigned_to = _now()

    a = EquipmentAssignment(
        equipment_id=data.equipment_id,
        project_id=data.project_id,
        responsible_id=data.responsible_id,
        notes=data.notes,
        assigned_from=data.assigned_from or _now(),
    )
    db.add(a)

    eq_r = await db.execute(select(Equipment).where(Equipment.id == data.equipment_id))
    eq = eq_r.scalars().first()
    if eq:
        eq.current_project_id = data.project_id
        eq.status = "EN_UTILISATION"
        eq.updated_at = _now()

    await log_activity(db, user.id, "EQUIPMENT_ASSIGNED", "equipment", data.equipment_id,
                        new_value={"project_id": data.project_id})
    await db.commit()
    await db.refresh(a)
    return {"id": a.id}


@router.patch("/assignments/{assignment_id}/return")
async def return_assignment(
    assignment_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(EquipmentAssignment).where(EquipmentAssignment.id == assignment_id))
    a = r.scalars().first()
    if not a:
        raise HTTPException(404, "Affectation introuvable")
    a.status = "RETURNED"
    a.assigned_to = _now()
    a.updated_at = _now()
    eq_r = await db.execute(select(Equipment).where(Equipment.id == a.equipment_id))
    eq = eq_r.scalars().first()
    if eq:
        eq.current_project_id = None
        eq.status = "DISPONIBLE"
    await db.commit()
    return {"detail": "Affectation clôturée"}


# ── Movements ────────────────────────────────────────────────

@router.get("/movements")
async def list_movements(
    equipment_id: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(EquipmentMovement).order_by(EquipmentMovement.moved_at.desc())
    if equipment_id:
        q = q.where(EquipmentMovement.equipment_id == equipment_id)
    r = await db.execute(q)
    return [
        {
            "id": m.id,
            "equipment_id": m.equipment_id,
            "from_location": m.from_location,
            "to_location": m.to_location,
            "from_project_id": m.from_project_id,
            "to_project_id": m.to_project_id,
            "reason": m.reason,
            "moved_at": m.moved_at,
        }
        for m in r.scalars().all()
    ]


@router.post("/movements")
async def create_movement(
    data: MovementCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    m = EquipmentMovement(**data.model_dump(), recorded_by=user.id)
    db.add(m)
    await db.commit()
    return {"id": m.id}


# ── Maintenance ──────────────────────────────────────────────

@router.get("/maintenance")
async def list_maintenance(
    equipment_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    q = select(MaintenanceTicket).where(MaintenanceTicket.deleted_at.is_(None)).order_by(
        MaintenanceTicket.scheduled_for.desc().nulls_last()
    )
    if equipment_id:
        q = q.where(MaintenanceTicket.equipment_id == equipment_id)
    if status_filter:
        q = q.where(MaintenanceTicket.status == status_filter)
    r = await db.execute(q)
    return [
        {
            "id": t.id,
            "code": t.code,
            "equipment_id": t.equipment_id,
            "maintenance_type": t.maintenance_type,
            "description": t.description,
            "cost": t.cost,
            "status": t.status,
            "scheduled_for": t.scheduled_for,
            "completed_at": t.completed_at,
            "technician": t.technician,
        }
        for t in r.scalars().all()
    ]


@router.post("/maintenance")
async def create_maintenance(
    data: MaintenanceCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    count_r = await db.execute(select(func.count(MaintenanceTicket.id)))
    count = count_r.scalar() or 0
    code = f"MAINT-{_now().strftime('%Y')}-{count + 1:03d}"
    t = MaintenanceTicket(code=code, **data.model_dump(), reported_by=user.id)
    db.add(t)

    eq_r = await db.execute(select(Equipment).where(Equipment.id == data.equipment_id))
    eq = eq_r.scalars().first()
    if eq:
        eq.status = "EN_MAINTENANCE"
        eq.updated_at = _now()

    await log_activity(db, user.id, "MAINTENANCE_CREATED", "maintenance_ticket", t.id)
    await db.commit()
    return {"id": t.id, "code": code}


@router.patch("/maintenance/{ticket_id}/complete")
async def complete_maintenance(
    ticket_id: str,
    cost: Optional[float] = None,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(MaintenanceTicket).where(MaintenanceTicket.id == ticket_id))
    t = r.scalars().first()
    if not t:
        raise HTTPException(404, "Ticket introuvable")
    t.status = "DONE"
    t.completed_at = _now()
    if cost is not None:
        t.cost = cost
    t.updated_at = _now()
    eq_r = await db.execute(select(Equipment).where(Equipment.id == t.equipment_id))
    eq = eq_r.scalars().first()
    if eq:
        eq.status = "DISPONIBLE"
        eq.updated_at = _now()
    await db.commit()
    return {"detail": "Maintenance clôturée"}


# ═════════════════════════════════════════════════════════════
# PARAMETERISED PATHS — must come AFTER literal sub-paths
# ═════════════════════════════════════════════════════════════

@router.get("/{equipment_id}")
async def get_equipment(
    equipment_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Equipment).where(Equipment.id == equipment_id, Equipment.deleted_at.is_(None)))
    eq = r.scalars().first()
    if not eq:
        raise HTTPException(404, "Équipement introuvable")
    return {
        "id": eq.id, "code": eq.code, "name": eq.name, "category": eq.category,
        "brand": eq.brand, "model": eq.model, "serial_number": eq.serial_number,
        "status": eq.status, "current_project_id": eq.current_project_id,
        "photo_url": eq.photo_url, "purchase_date": eq.purchase_date,
        "next_maintenance": eq.next_maintenance,
        "maintenance_history": eq.maintenance_history or [],
    }


@router.patch("/{equipment_id}")
async def update_equipment(
    equipment_id: str,
    data: EquipmentUpdate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Equipment).where(Equipment.id == equipment_id, Equipment.deleted_at.is_(None)))
    eq = r.scalars().first()
    if not eq:
        raise HTTPException(404, "Équipement introuvable")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(eq, k, v)
    eq.updated_at = _now()
    await db.commit()
    return {"detail": "Équipement mis à jour"}


@router.delete("/{equipment_id}")
async def delete_equipment(
    equipment_id: str,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    eq = r.scalars().first()
    if not eq:
        raise HTTPException(404, "Équipement introuvable")
    eq.deleted_at = _now()
    await db.commit()
    return {"detail": "Équipement supprimé"}
