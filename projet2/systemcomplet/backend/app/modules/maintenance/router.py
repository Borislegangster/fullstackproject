"""API Passeport du bâtiment et maintenance (I2) : équipements, carnet d'entretien, rappels, passeport certifié."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import NotFound
from app.modules.maintenance import service
from app.modules.maintenance.models import BuildingEquipment, MaintenanceTask

router = APIRouter(tags=["Bâtiment et maintenance"])

CATEGORIES = (
    "^(climatisation|plomberie|pompe|fosse|electricite|solaire|groupe_electrogene|toiture|menuiserie|peinture|autre)$"
)


def _project(db: Session, access: Access, project_id: uuid.UUID, *perms: str) -> Any:
    from app.modules.projects.models import Project

    if perms:
        access.require(*perms)
    access.require_project(project_id)
    project = db.get(Project, project_id)
    if project is None or project.deleted_at is not None:
        raise NotFound("Projet introuvable")
    return project


class EquipmentIn(BaseModel):
    category: str = Field(pattern=CATEGORIES)
    name: str = Field(min_length=2, max_length=200)
    brand: str | None = Field(default=None, max_length=120)
    model: str | None = Field(default=None, max_length=120)
    serial_number: str | None = Field(default=None, max_length=120)
    location: str | None = Field(default=None, max_length=200)
    zone_id: uuid.UUID | None = None
    installed_on: date | None = None
    warranty_until: date | None = None
    maintenance_interval_days: int | None = Field(default=None, ge=7, le=3650)
    notes: str | None = Field(default=None, max_length=2000)
    client_visible: bool = True


@router.get("/projects/{project_id}/equipment")
def equipment_list(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(db, access, project_id, "projects:read")
    rows = db.execute(
        select(BuildingEquipment)
        .where(BuildingEquipment.project_id == project_id)
        .order_by(BuildingEquipment.category, BuildingEquipment.name)
    ).scalars()
    return [service.equipment_out(db, e, user_id=access.p.id) for e in rows]


@router.post("/projects/{project_id}/equipment", status_code=201)
def equipment_create(
    project_id: uuid.UUID, data: EquipmentIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Ajoute un équipement et programme son carnet d'entretien type."""
    project = _project(db, access, project_id, "projects:write")
    equipment = BuildingEquipment(project_id=project.id, created_by_id=access.p.id, **data.model_dump())
    db.add(equipment)
    db.flush()
    service.schedule_for(db, equipment)
    audit.record(
        db,
        family="business",
        module="maintenance",
        action="CREATE",
        resource_type="building_equipment",
        resource_id=equipment.id,
        project_id=project.id,
    )
    db.commit()
    return service.equipment_out(db, equipment, user_id=access.p.id)


def _equipment(db: Session, access: Access, equipment_id: uuid.UUID, perm: str) -> BuildingEquipment:
    equipment = db.get(BuildingEquipment, equipment_id)
    if equipment is None:
        raise NotFound("Équipement introuvable")
    _project(db, access, equipment.project_id, perm)
    return equipment


@router.patch("/building-equipment/{equipment_id}")
def equipment_update(
    equipment_id: uuid.UUID, data: dict[str, Any], db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    equipment = _equipment(db, access, equipment_id, "projects:write")
    try:
        values = EquipmentIn.model_validate(
            {**{k: getattr(equipment, k) for k in EquipmentIn.model_fields}, **data}
        ).model_dump()
    except ValidationError as exc:  # corps libre fusionné : même réponse 422 qu'un corps typé, pas une erreur 500
        raise RequestValidationError(exc.errors()) from exc
    for key, value in values.items():
        setattr(equipment, key, value)
    service.schedule_for(db, equipment)
    db.commit()
    return service.equipment_out(db, equipment, user_id=access.p.id)


@router.post("/building-equipment/{equipment_id}/manual")
async def equipment_manual(
    equipment_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Notice d'utilisation / d'entretien (PDF ou image), consultable par le client."""
    from app.core.files import store_private, validate_upload

    equipment = _equipment(db, access, equipment_id, "projects:write")
    upload = validate_upload(file.filename or "notice.pdf", await file.read(), category="document", max_mb=50)
    stored = store_private(
        db, upload, purpose="building_manuals", classification="internal", uploaded_by_id=access.p.id
    )
    equipment.manual_file_id = stored.id
    db.commit()
    return service.equipment_out(db, equipment, user_id=access.p.id)


@router.delete("/building-equipment/{equipment_id}")
def equipment_delete(
    equipment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, str]:
    equipment = _equipment(db, access, equipment_id, "projects:write")
    db.delete(equipment)
    db.commit()
    return {"status": "deleted"}


@router.get("/projects/{project_id}/maintenance-tasks")
def tasks(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    _project(db, access, project_id, "projects:read")
    rows = db.execute(
        select(MaintenanceTask).where(MaintenanceTask.project_id == project_id).order_by(MaintenanceTask.due_on)
    ).scalars()
    return [service.task_out(t) for t in rows]


class DoneIn(BaseModel):
    note: str | None = Field(default=None, max_length=2000)
    done_on: date | None = None


def _task(db: Session, access: Access, task_id: uuid.UUID, *perms: str) -> MaintenanceTask:
    task = service.get_task(db, task_id)
    _project(db, access, task.project_id, *perms)
    return task


@router.post("/maintenance-tasks/{task_id}/complete")
def task_complete(
    task_id: uuid.UUID, data: DoneIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """« C'est fait » (client ou technicien) : l'occurrence suivante est programmée automatiquement."""
    perm = "client:portal" if access.p.is_client else "projects:write"
    task = _task(db, access, task_id, perm)
    service.complete(db, task, note=data.note, done_on=data.done_on)
    db.commit()
    return service.task_out(task)


@router.post("/maintenance-tasks/{task_id}/book", status_code=201)
def task_book(
    task_id: uuid.UUID, data: DoneIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """« Planifier une intervention » : ticket SAV pré-rempli."""
    perm = "client:portal" if access.p.is_client else "support:write"
    task = _task(db, access, task_id, perm)
    ticket = service.book_intervention(db, task, requester=access.p.user, note=data.note)
    db.commit()
    return {**service.task_out(task), "ticket_number": ticket.number}


@router.get("/client/projects/{project_id}/building")
def client_building(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    from app.core.utils import jsonable
    from app.modules.projects.models import Warranty

    _project(db, access, project_id, "client:portal")
    equipment = db.execute(
        select(BuildingEquipment)
        .where(BuildingEquipment.project_id == project_id, BuildingEquipment.client_visible.is_(True))
        .order_by(BuildingEquipment.category, BuildingEquipment.name)
    ).scalars()
    visible = select(BuildingEquipment.id).where(
        BuildingEquipment.project_id == project_id, BuildingEquipment.client_visible.is_(True)
    )
    rows = db.execute(
        select(MaintenanceTask)
        .where(
            MaintenanceTask.project_id == project_id,
            MaintenanceTask.status.in_(["planned", "booked"]),
            (MaintenanceTask.equipment_id.is_(None)) | (MaintenanceTask.equipment_id.in_(visible)),
        )
        .order_by(MaintenanceTask.due_on)
        .limit(100)
    ).scalars()
    warranties = db.execute(
        select(Warranty).where(Warranty.project_id == project_id).order_by(Warranty.end_date)
    ).scalars()
    return {
        "equipment": [service.equipment_out(db, e, user_id=access.p.id) for e in equipment],
        "tasks": [service.task_out(t) for t in rows],
        "warranties": jsonable(
            [
                {
                    "kind": w.kind,
                    "start_date": w.start_date,
                    "end_date": w.end_date,
                    "insurer": w.insurer,
                    "coverage": w.coverage,
                }
                for w in warranties
            ]
        ),
    }


@router.get("/projects/{project_id}/building-passport.pdf")
def passport_pdf(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    """Passeport du bâtiment certifié (staff : projects:read ; client : son projet)."""
    project = _project(db, access, project_id, "client:portal" if access.p.is_client else "projects:read")
    data, proof = service.certified_passport(db, project, actor_id=access.p.id)
    db.commit()
    return Response(
        data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="passeport-batiment-{project.code}.pdf"',
            "X-Proof-Code": proof.public_code,
        },
    )
