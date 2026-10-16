"""API Matériel (§17.2) : parc, QR, affectations, relevés d'utilisation, maintenance, incidents, coûts, localisation."""

from __future__ import annotations

import io
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

import qrcode
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.downloads import file_response
from app.core.errors import BusinessRuleError, Forbidden, NotFound
from app.core.files import store_private, validate_upload
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable, utcnow
from app.modules.equipment import service
from app.modules.equipment.models import (
    Equipment,
    EquipmentAssignment,
    EquipmentConsumable,
    EquipmentIncident,
    EquipmentUsage,
    MaintenanceOrder,
    MaintenancePlan,
)
from app.modules.system.models import StoredFile

TAG = "Matériel"
router = APIRouter(tags=[TAG])
LOCATION_FIELDS = ("last_latitude", "last_longitude", "last_located_at")


def equipment_out(equipment: Equipment, access: Access) -> dict[str, Any]:
    data = serialize(equipment)
    data.pop("qr_token", None)
    if not access.has("equipment:write"):
        for key in LOCATION_FIELDS:
            data.pop(key, None)
    return jsonable(data)


def _equipment(db: Session, equipment_id: uuid.UUID) -> Equipment:
    equipment = db.get(Equipment, equipment_id)
    if equipment is None or equipment.deleted_at is not None:
        raise NotFound("Matériel introuvable")
    return equipment


class EquipmentIn(BaseModel):
    code: str | None = Field(default=None, max_length=40)
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(
        default="outillage", pattern="^(engin|vehicule|outillage|echafaudage|topographie|informatique)$"
    )
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    serial_number: str | None = Field(default=None, max_length=100)
    registration: str | None = Field(default=None, max_length=40)
    acquisition_date: date | None = None
    acquisition_cost: Decimal = Field(default=Decimal("0"), ge=0)
    ownership: str = Field(default="owned", pattern="^(owned|rented|leased)$")
    rental_supplier_id: uuid.UUID | None = None
    condition: str = Field(default="good", pattern="^(new|good|fair|poor)$")
    hourly_cost: Decimal = Field(default=Decimal("0"), ge=0)
    daily_cost: Decimal = Field(default=Decimal("0"), ge=0)
    meter_hours: Decimal = Field(default=Decimal("0"), ge=0)
    meter_km: Decimal = Field(default=Decimal("0"), ge=0)
    tracker_id: str | None = Field(default=None, max_length=100)
    location_tracking: bool = False
    insurance_until: date | None = None
    inspection_until: date | None = None
    notes: str | None = Field(default=None, max_length=4000)


class EquipmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    serial_number: str | None = Field(default=None, max_length=100)
    registration: str | None = Field(default=None, max_length=40)
    condition: str | None = Field(default=None, pattern="^(new|good|fair|poor)$")
    status: str | None = Field(default=None, pattern="^(available|broken|retired)$")
    hourly_cost: Decimal | None = Field(default=None, ge=0)
    daily_cost: Decimal | None = Field(default=None, ge=0)
    tracker_id: str | None = Field(default=None, max_length=100)
    location_tracking: bool | None = None
    insurance_until: date | None = None
    inspection_until: date | None = None
    notes: str | None = Field(default=None, max_length=4000)


@router.get("/equipment")
def list_equipment(
    params: PageParams = Depends(),
    status: str | None = None,
    category: str | None = None,
    project_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("equipment:read")
    stmt = select(Equipment).where(Equipment.deleted_at.is_(None))
    for col, value in (
        (Equipment.status, status),
        (Equipment.category, category),
        (Equipment.current_project_id, project_id),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db,
        stmt,
        params,
        sort_fields={"name": Equipment.name, "code": Equipment.code},
        default_sort=Equipment.code.asc(),
        search_columns=[Equipment.name, Equipment.code, Equipment.serial_number, Equipment.registration],
        transform=lambda e: equipment_out(e, access),
    )


@router.post("/equipment", status_code=201)
def create_equipment(
    data: EquipmentIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:write")
    equipment = service.create_equipment(db, data=data.model_dump(), user_id=access.p.id)
    db.commit()
    return equipment_out(equipment, access)


@router.get("/equipment/lookup")
def lookup(code: str, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("equipment:read")
    return equipment_detail(service.by_qr(db, code.strip()).id, db, access)


@router.get("/equipment/{equipment_id}")
def equipment_detail(
    equipment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:read")
    equipment = _equipment(db, equipment_id)
    assignments = (
        db.execute(
            select(EquipmentAssignment)
            .where(EquipmentAssignment.equipment_id == equipment.id)
            .order_by(EquipmentAssignment.start_date.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    plans = db.execute(select(MaintenancePlan).where(MaintenancePlan.equipment_id == equipment.id)).scalars().all()
    orders = (
        db.execute(
            select(MaintenanceOrder)
            .where(MaintenanceOrder.equipment_id == equipment.id)
            .order_by(MaintenanceOrder.created_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    incidents = (
        db.execute(
            select(EquipmentIncident)
            .where(EquipmentIncident.equipment_id == equipment.id)
            .order_by(EquipmentIncident.occurred_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )
    consumables = (
        db.execute(select(EquipmentConsumable).where(EquipmentConsumable.equipment_id == equipment.id)).scalars().all()
    )
    return jsonable(
        {
            **equipment_out(equipment, access),
            "assignments": [serialize(a) for a in assignments],
            "maintenance_plans": [serialize(p) for p in plans],
            "maintenance_orders": [serialize(o) for o in orders],
            "incidents": [serialize(i) for i in incidents],
            "consumables": [serialize(c) for c in consumables],
        }
    )


@router.patch("/equipment/{equipment_id}")
def update_equipment(
    equipment_id: uuid.UUID, data: EquipmentUpdate, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:write")
    equipment = _equipment(db, equipment_id)
    values = data.model_dump(exclude_unset=True)
    if values.get("status") == "available" and equipment.status == "assigned":
        raise BusinessRuleError("Enregistrer le retour d'affectation")
    for key, value in values.items():
        setattr(equipment, key, value)
    audit.record(
        db,
        family="business",
        module="equipment",
        action="UPDATE",
        resource_type="equipment",
        resource_id=equipment.id,
        diff={"fields": sorted(values)},
    )
    db.commit()
    return equipment_out(equipment, access)


@router.get("/equipment/{equipment_id}/qr")
def equipment_qr(
    equipment_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("equipment:write")
    equipment = _equipment(db, equipment_id)
    buf = io.BytesIO()
    qrcode.make(f"GLOBUS:EQP:{equipment.qr_token}", box_size=8, border=2).save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


class AssignIn(BaseModel):
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    operator_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)


@router.post("/equipment/{equipment_id}/assign", status_code=201)
def assign(
    equipment_id: uuid.UUID, data: AssignIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require_project(data.project_id, "equipment:write")
    equipment = _equipment(db, equipment_id)
    start = data.start_date or date.today()
    if data.end_date and data.end_date < start:
        raise BusinessRuleError("Dates incohérentes")
    row = service.assign(
        db,
        equipment,
        project_id=data.project_id,
        site_id=data.site_id,
        operator_id=data.operator_id,
        start=start,
        end=data.end_date,
        notes=data.notes,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(row))


class ReturnIn(BaseModel):
    condition: str | None = Field(default=None, pattern="^(new|good|fair|poor)$")
    notes: str | None = Field(default=None, max_length=2000)


@router.post("/equipment/{equipment_id}/return")
def return_equipment(
    equipment_id: uuid.UUID, data: ReturnIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:write")
    row = service.return_equipment(
        db, _equipment(db, equipment_id), condition=data.condition, notes=data.notes, user_id=access.p.id
    )
    db.commit()
    return jsonable(serialize(row))


class UsageIn(BaseModel):
    usage_date: date | None = None
    hours: Decimal = Field(default=Decimal("0"), ge=0, le=24)
    km: Decimal = Field(default=Decimal("0"), ge=0, le=5000)
    fuel_liters: Decimal = Field(default=Decimal("0"), ge=0)
    fuel_cost: Decimal = Field(default=Decimal("0"), ge=0)
    project_id: uuid.UUID | None = None
    site_id: uuid.UUID | None = None
    operator_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=300)


@router.post("/equipment/{equipment_id}/usage", status_code=201)
def log_usage(
    equipment_id: uuid.UUID, data: UsageIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    if not access.p.has_any("equipment:write", "site:report"):
        raise Forbidden("Relevé réservé au parc / chef de chantier", code="PERMISSION_DENIED")
    equipment = _equipment(db, equipment_id)
    project_id = data.project_id or equipment.current_project_id
    if project_id:
        access.require_project(project_id)
    row = service.log_usage(
        db,
        equipment,
        usage_date=data.usage_date or date.today(),
        hours=data.hours,
        km=data.km,
        fuel_liters=data.fuel_liters,
        fuel_cost=data.fuel_cost,
        project_id=project_id,
        site_id=data.site_id,
        operator_id=data.operator_id or access.p.id,
        notes=data.notes,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(row))


@router.get("/equipment/{equipment_id}/usage")
def list_usage(
    equipment_id: uuid.UUID,
    params: PageParams = Depends(),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("equipment:read")
    stmt = select(EquipmentUsage).where(EquipmentUsage.equipment_id == equipment_id)
    return paginate(
        db, stmt, params, default_sort=EquipmentUsage.usage_date.desc(), transform=lambda u: jsonable(serialize(u))
    )


class LocationIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    at: datetime | None = None


@router.post("/equipment/{equipment_id}/location")
def update_location(
    equipment_id: uuid.UUID, data: LocationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Localisation uniquement si la politique de suivi est activée pour ce matériel."""
    if not access.p.has_any("equipment:write", "site:report"):
        raise Forbidden("Permission manquante", code="PERMISSION_DENIED")
    equipment = _equipment(db, equipment_id)
    if not equipment.location_tracking:
        raise BusinessRuleError(
            "Suivi de localisation désactivé pour ce matériel (politique)", code="TRACKING_DISABLED"
        )
    equipment.last_latitude = data.latitude
    equipment.last_longitude = data.longitude
    equipment.last_located_at = data.at or utcnow()
    db.commit()
    return {"status": "ok"}


@router.post("/equipment/{equipment_id}/documents", status_code=201)
async def add_document(
    equipment_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("equipment:write")
    equipment = _equipment(db, equipment_id)
    upload = validate_upload(file.filename or "document", await file.read(), category="media")
    stored = store_private(db, upload, purpose="equipment", classification="internal", uploaded_by_id=access.p.id)
    equipment.document_ids = [*equipment.document_ids, str(stored.id)]
    db.commit()
    return jsonable({"file_id": stored.id, "filename": stored.original_name})


@router.get("/equipment/{equipment_id}/documents/{file_id}")
def get_document(
    equipment_id: uuid.UUID, file_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    access.require("equipment:read")
    equipment = _equipment(db, equipment_id)
    if str(file_id) not in equipment.document_ids and str(file_id) != str(equipment.photo_file_id):
        raise NotFound("Document introuvable")
    return file_response(db.get(StoredFile, file_id))


# ---------------------------------------------------------------------------- maintenance
router.include_router(
    make_crud_router(
        MaintenancePlan,
        prefix="/maintenance-plans",
        tags=[TAG],
        module="equipment",
        read_perm="equipment:read",
        write_perm="equipment:write",
        label="Plan de maintenance",
        filters=["equipment_id", "is_active"],
        sort=["next_due_date"],
        default_sort="next_due_date",
        before_create=lambda db, obj, access, values: setattr(
            obj, "next_due_date", obj.next_due_date or service.plan_next_due(obj)
        ),
    )
)
router.include_router(
    make_crud_router(
        EquipmentConsumable,
        prefix="/equipment-consumables",
        tags=[TAG],
        module="equipment",
        read_perm="equipment:read",
        write_perm="equipment:write",
        label="Consommable",
        filters=["equipment_id"],
        search=["name"],
    )
)


class OrderIn(BaseModel):
    kind: str = Field(default="preventive", pattern="^(preventive|corrective)$")
    plan_id: uuid.UUID | None = None
    description: str | None = Field(default=None, max_length=4000)
    scheduled_date: date | None = None
    technician_id: uuid.UUID | None = None
    vendor: str | None = Field(default=None, max_length=200)


@router.post("/equipment/{equipment_id}/maintenance-orders", status_code=201)
def create_order(
    equipment_id: uuid.UUID, data: OrderIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:write")
    equipment = _equipment(db, equipment_id)
    plan = db.get(MaintenancePlan, data.plan_id) if data.plan_id else None
    if data.plan_id and (plan is None or plan.equipment_id != equipment.id):
        raise BusinessRuleError("Plan d'un autre matériel")
    order = service.create_order(
        db,
        equipment,
        kind=data.kind,
        plan=plan,
        description=data.description,
        scheduled=data.scheduled_date,
        technician_id=data.technician_id,
        vendor=data.vendor,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(order))


@router.get("/maintenance-orders")
def list_orders(
    params: PageParams = Depends(),
    status: str | None = None,
    equipment_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("equipment:read")
    stmt = select(MaintenanceOrder)
    if status:
        stmt = stmt.where(MaintenanceOrder.status == status)
    if equipment_id:
        stmt = stmt.where(MaintenanceOrder.equipment_id == equipment_id)
    return paginate(
        db,
        stmt,
        params,
        default_sort=MaintenanceOrder.scheduled_date.asc(),
        search_columns=[MaintenanceOrder.number],
        transform=lambda o: jsonable(serialize(o)),
    )


def _order(db: Session, order_id: uuid.UUID) -> tuple[MaintenanceOrder, Equipment]:
    order = db.get(MaintenanceOrder, order_id)
    if order is None:
        raise NotFound("Ordre introuvable")
    return order, _equipment(db, order.equipment_id)


@router.post("/maintenance-orders/{order_id}/start")
def start_order(
    order_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:write")
    order, equipment = _order(db, order_id)
    service.start_order(db, order, equipment, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(order))


class CompleteOrderIn(BaseModel):
    cost: Decimal = Field(default=Decimal("0"), ge=0)
    downtime_hours: Decimal = Field(default=Decimal("0"), ge=0)
    report: str = Field(min_length=5, max_length=8000)
    condition: str | None = Field(default=None, pattern="^(new|good|fair|poor)$")


@router.post("/maintenance-orders/{order_id}/complete")
def complete_order(
    order_id: uuid.UUID, data: CompleteOrderIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:write")
    order, equipment = _order(db, order_id)
    service.complete_order(
        db,
        order,
        equipment,
        cost=data.cost,
        downtime_hours=data.downtime_hours,
        report=data.report,
        condition=data.condition,
        user_id=access.p.id,
    )
    db.commit()
    return jsonable(serialize(order))


# ---------------------------------------------------------------------------- incidents & coûts
class EquipmentIncidentIn(BaseModel):
    kind: str = Field(default="breakdown", pattern="^(breakdown|damage|theft|accident)$")
    occurred_at: datetime
    severity: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    description: str | None = Field(default=None, max_length=4000)
    photo_file_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    project_id: uuid.UUID | None = None
    cost: Decimal = Field(default=Decimal("0"), ge=0)


@router.post("/equipment/{equipment_id}/incidents", status_code=201)
def declare_incident(
    equipment_id: uuid.UUID,
    data: EquipmentIncidentIn,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    if not access.p.has_any("equipment:write", "site:report"):
        raise Forbidden("Permission manquante", code="PERMISSION_DENIED")
    equipment = _equipment(db, equipment_id)
    for fid in data.photo_file_ids:
        stored = db.get(StoredFile, fid)
        if stored is None or stored.uploaded_by_id != access.p.id:
            raise BusinessRuleError("Pièce jointe inconnue")
    values = data.model_dump()
    values["photo_file_ids"] = [str(f) for f in data.photo_file_ids]
    incident = service.declare_incident(db, equipment, data=values, user_id=access.p.id)
    db.commit()
    return jsonable(serialize(incident))


@router.post("/equipment-incidents/{incident_id}/resolve")
def resolve_incident(
    incident_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("equipment:write")
    incident = db.get(EquipmentIncident, incident_id)
    if incident is None:
        raise NotFound("Incident introuvable")
    incident.status = "resolved"
    db.commit()
    return jsonable(serialize(incident))


@router.get("/equipment/{equipment_id}/costs")
def costs(
    equipment_id: uuid.UUID,
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("equipment:read")
    end = end or date.today()
    start = start or end - timedelta(days=365)
    return jsonable(service.cost_report(db, _equipment(db, equipment_id), start=start, end=end))
