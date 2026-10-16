"""API Stocks (§19) : entrepôts, emplacements, articles, niveaux, mouvements, affectations chantier, inventaires,
lots (traçabilité), valorisation CMUP. Les mutations terrain acceptent un `client_mutation_id` (synchronisation
hors ligne sans doublon)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.crud import make_crud_router, serialize
from app.core.database import get_db
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.pagination import PageParams, paginate
from app.core.utils import jsonable
from app.modules.inventory import service
from app.modules.inventory.models import (
    InventoryCount,
    InventoryCountLine,
    MaterialBatch,
    StockAllocation,
    StockItem,
    StockLevel,
    StockLocation,
    StockMovement,
    Warehouse,
)
from app.modules.projects.models import Site

TAG = "Stocks"
router = APIRouter(tags=[TAG])

router.include_router(
    make_crud_router(
        Warehouse,
        prefix="/warehouses",
        tags=[TAG],
        module="inventory",
        read_perm="inventory:read",
        write_perm="inventory:write",
        label="Entrepôt",
        project_attr="project_id",
        filters=["kind", "site_id", "is_active"],
        search=["name", "code"],
        sort=["name", "code"],
        default_sort="name",
        allow_delete=False,
    )
)
router.include_router(
    make_crud_router(
        StockLocation,
        prefix="/stock-locations",
        tags=[TAG],
        module="inventory",
        read_perm="inventory:read",
        write_perm="inventory:write",
        label="Emplacement",
        filters=["warehouse_id"],
        search=["code", "label"],
        sort=["code"],
        default_sort="code",
    )
)
router.include_router(
    make_crud_router(
        StockItem,
        prefix="/stock-items",
        tags=[TAG],
        module="inventory",
        read_perm="inventory:read",
        write_perm="inventory:write",
        label="Article",
        filters=["category", "is_active", "preferred_supplier_id"],
        search=["name", "sku", "barcode"],
        sort=["name", "sku", "category"],
        default_sort="name",
        exclude_in={"average_cost"},
    )
)


def _item(db: Session, item_id: uuid.UUID) -> StockItem:
    item = db.get(StockItem, item_id)
    if item is None or item.deleted_at is not None:
        raise NotFound("Article introuvable")
    return item


def _warehouse(db: Session, access: Access, warehouse_id: uuid.UUID) -> Warehouse:
    warehouse = db.get(Warehouse, warehouse_id)
    if warehouse is None or not warehouse.is_active:
        raise NotFound("Entrepôt introuvable ou inactif")
    if warehouse.project_id:
        access.require_project(warehouse.project_id)
    return warehouse


def _replayed(db: Session, client_mutation_id: str | None) -> StockMovement | None:
    if not client_mutation_id:
        return None
    return db.execute(
        select(StockMovement).where(StockMovement.client_mutation_id == client_mutation_id)
    ).scalar_one_or_none()


# ---------------------------------------------------------------------------- consultation
@router.get("/inventory/overview")
def overview(
    warehouse_id: uuid.UUID | None = None,
    below_threshold: bool = False,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    access.require("inventory:read")
    rows = service.stock_overview(db, warehouse_id=warehouse_id)
    if below_threshold:
        rows = [r for r in rows if r["below_threshold"]]
    return jsonable(rows)


@router.get("/inventory/valuation")
def valuation(db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("inventory:read")
    rows = db.execute(
        select(
            Warehouse.id,
            Warehouse.name,
            StockItem.category,
            func.coalesce(func.sum(StockLevel.quantity * StockItem.average_cost), 0),
        )
        .join(StockLevel, StockLevel.warehouse_id == Warehouse.id)
        .join(StockItem, StockItem.id == StockLevel.item_id)
        .group_by(Warehouse.id, Warehouse.name, StockItem.category)
    ).all()
    by_warehouse: dict[str, dict[str, Any]] = {}
    total = Decimal("0")
    for wid, name, category, value in rows:
        entry = by_warehouse.setdefault(
            str(wid), {"warehouse_id": wid, "warehouse": name, "value": Decimal("0"), "by_category": {}}
        )
        entry["value"] += Decimal(value)
        entry["by_category"][category or "non classé"] = Decimal(value)
        total += Decimal(value)
    return jsonable({"total": total, "warehouses": list(by_warehouse.values())})


@router.get("/inventory/lookup")
def lookup_item(
    code: str = Query(min_length=1, max_length=120), db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Scan code-barres / QR / SKU (application terrain)."""
    access.require("inventory:read")
    value = code.strip()
    if value.startswith("GLOBUS:ITEM:"):
        value = value.split("GLOBUS:ITEM:", 1)[1]
    item = db.execute(
        select(StockItem).where(StockItem.deleted_at.is_(None), or_(StockItem.sku == value, StockItem.barcode == value))
    ).scalar_one_or_none()
    if item is None:
        raise NotFound("Article introuvable")
    return item_levels(item.id, db, access)


@router.get("/stock-items/{item_id}/levels")
def item_levels(
    item_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("inventory:read")
    item = _item(db, item_id)
    rows = db.execute(
        select(StockLevel, Warehouse.name, StockLocation.code, MaterialBatch.batch_number, MaterialBatch.expiry_date)
        .join(Warehouse, Warehouse.id == StockLevel.warehouse_id)
        .outerjoin(StockLocation, StockLocation.id == StockLevel.location_id)
        .outerjoin(MaterialBatch, MaterialBatch.id == StockLevel.batch_id)
        .where(StockLevel.item_id == item.id, StockLevel.quantity != 0)
    ).all()
    return jsonable(
        {
            "item": serialize(item),
            "on_hand": service.on_hand(db, item.id),
            "available": service.available(db, item.id),
            "levels": [
                {
                    "warehouse_id": lv.warehouse_id,
                    "warehouse": wname,
                    "location": loc,
                    "batch": batch,
                    "expiry_date": expiry,
                    "quantity": lv.quantity,
                    "reserved": lv.reserved,
                }
                for lv, wname, loc, batch, expiry in rows
            ],
        }
    )


@router.get("/stock-movements")
def list_movements(
    params: PageParams = Depends(),
    item_id: uuid.UUID | None = None,
    warehouse_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    kind: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("inventory:read")
    stmt = access.filter_by_project(select(StockMovement), StockMovement.project_id)
    if item_id:
        stmt = stmt.where(StockMovement.item_id == item_id)
    if warehouse_id:
        stmt = stmt.where(
            or_(StockMovement.from_warehouse_id == warehouse_id, StockMovement.to_warehouse_id == warehouse_id)
        )
    if project_id:
        stmt = stmt.where(StockMovement.project_id == project_id)
    if kind:
        stmt = stmt.where(StockMovement.kind == kind)
    if date_from:
        stmt = stmt.where(StockMovement.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(StockMovement.created_at <= datetime.combine(date_to, time.max))
    items = {}

    def transform(m: StockMovement) -> dict[str, Any]:
        if m.item_id not in items:
            item = db.get(StockItem, m.item_id)
            items[m.item_id] = (item.name, item.unit) if item else ("", "")
        name, unit = items[m.item_id]
        return jsonable({**serialize(m), "item": name, "unit": unit})

    return paginate(db, stmt, params, default_sort=StockMovement.created_at.desc(), transform=transform)


@router.get("/material-batches")
def list_batches(
    item_id: uuid.UUID | None = None,
    batch_number: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> list[dict[str, Any]]:
    """Traçabilité lot : réception d'origine, fournisseur, certificats, mouvements."""
    access.require("inventory:read")
    stmt = select(MaterialBatch)
    if item_id:
        stmt = stmt.where(MaterialBatch.item_id == item_id)
    if batch_number:
        stmt = stmt.where(MaterialBatch.batch_number.ilike(f"%{batch_number}%"))
    out = []
    for batch in db.execute(stmt.order_by(MaterialBatch.created_at.desc()).limit(200)).scalars():
        movements = (
            db.execute(
                select(StockMovement).where(StockMovement.batch_id == batch.id).order_by(StockMovement.created_at)
            )
            .scalars()
            .all()
        )
        out.append({**serialize(batch), "movements": [serialize(m) for m in movements]})
    return jsonable(out)


# ---------------------------------------------------------------------------- mouvements
class ReceiveIn(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    location_id: uuid.UUID | None = None
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal = Field(ge=0)
    batch_number: str | None = Field(default=None, max_length=80)
    expiry_date: date | None = None
    supplier_id: uuid.UUID | None = None
    reason: str = Field(min_length=3, max_length=1000)
    client_mutation_id: str | None = Field(default=None, max_length=80)


@router.post("/inventory/receive", status_code=201)
def manual_receive(
    data: ReceiveIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Entrée hors bon de commande (stock initial, don, régularisation) — motif obligatoire, tracée."""
    access.require("inventory:write")
    replay = _replayed(db, data.client_mutation_id)
    if replay is not None:
        return jsonable(serialize(replay))
    item = _item(db, data.item_id)
    _warehouse(db, access, data.warehouse_id)
    movement = service.receive(
        db,
        item=item,
        warehouse_id=data.warehouse_id,
        quantity=data.quantity,
        unit_cost=data.unit_cost,
        user_id=access.p.id,
        reference_type="manual",
        reference_id=None,
        batch_number=data.batch_number,
        supplier_id=data.supplier_id,
        expiry=data.expiry_date,
        location_id=data.location_id,
        client_mutation_id=data.client_mutation_id,
    )
    movement.reason = data.reason
    audit.record(
        db,
        family="business",
        module="inventory",
        action="RECEIVE",
        resource_type="stock_item",
        resource_id=item.id,
        diff={"quantity": str(data.quantity), "warehouse": str(data.warehouse_id)},
        reason=data.reason,
    )
    db.commit()
    return jsonable(serialize(movement))


class IssueIn(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    quantity: Decimal = Field(gt=0)
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    lot_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    reason: str | None = Field(default=None, max_length=1000)
    client_mutation_id: str | None = Field(default=None, max_length=80)


@router.post("/inventory/issue", status_code=201)
def issue_to_site(data: IssueIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Sortie de stock vers un chantier (FIFO par lot, coût CMUP imputé au projet)."""
    access.require_project(data.project_id, "inventory:write")
    replay = _replayed(db, data.client_mutation_id)
    if replay is not None:
        return jsonable(serialize(replay))
    if data.site_id:
        site = db.get(Site, data.site_id)
        if site is None or site.project_id != data.project_id:
            raise BusinessRuleError("Chantier hors projet")
    item = _item(db, data.item_id)
    _warehouse(db, access, data.warehouse_id)
    movement = service.issue(
        db,
        item=item,
        warehouse_id=data.warehouse_id,
        quantity=data.quantity,
        user_id=access.p.id,
        project_id=data.project_id,
        site_id=data.site_id,
        lot_id=data.lot_id,
        task_id=data.task_id,
        reason=data.reason,
        client_mutation_id=data.client_mutation_id,
    )
    audit.record(
        db,
        family="business",
        module="inventory",
        action="ISSUE",
        resource_type="stock_item",
        resource_id=item.id,
        project_id=data.project_id,
        diff={"quantity": str(data.quantity)},
    )
    db.commit()
    return jsonable(serialize(movement))


class TransferIn(BaseModel):
    item_id: uuid.UUID
    from_warehouse_id: uuid.UUID
    to_warehouse_id: uuid.UUID
    quantity: Decimal = Field(gt=0)
    reason: str | None = Field(default=None, max_length=1000)
    client_mutation_id: str | None = Field(default=None, max_length=80)


@router.post("/inventory/transfer", status_code=201)
def transfer(data: TransferIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("inventory:write")
    replay = _replayed(db, data.client_mutation_id)
    if replay is not None:
        return jsonable(serialize(replay))
    item = _item(db, data.item_id)
    _warehouse(db, access, data.from_warehouse_id)
    _warehouse(db, access, data.to_warehouse_id)
    movement = service.transfer(
        db,
        item=item,
        from_warehouse=data.from_warehouse_id,
        to_warehouse=data.to_warehouse_id,
        quantity=data.quantity,
        user_id=access.p.id,
        reason=data.reason,
    )
    movement.client_mutation_id = data.client_mutation_id
    audit.record(
        db,
        family="business",
        module="inventory",
        action="TRANSFER",
        resource_type="stock_item",
        resource_id=item.id,
        diff={"quantity": str(data.quantity), "from": str(data.from_warehouse_id), "to": str(data.to_warehouse_id)},
    )
    db.commit()
    return jsonable(serialize(movement))


class AdjustIn(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    delta: Decimal
    reason: str = Field(min_length=5, max_length=1000)


@router.post("/inventory/adjust", status_code=201)
def adjust(data: AdjustIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    """Ajustement ponctuel (casse, perte, erreur de saisie) — motif obligatoire, criticité moyenne."""
    access.require("inventory:write")
    if data.delta == 0:
        raise BusinessRuleError("Écart nul")
    item = _item(db, data.item_id)
    _warehouse(db, access, data.warehouse_id)
    if data.delta > 0:
        movement = service.receive(
            db,
            item=item,
            warehouse_id=data.warehouse_id,
            quantity=data.delta,
            unit_cost=Decimal(item.average_cost or 0),
            user_id=access.p.id,
            reference_type="adjustment",
            reference_id=None,
        )
        movement.kind = "adjustment"
    else:
        movement = service.issue(
            db,
            item=item,
            warehouse_id=data.warehouse_id,
            quantity=-data.delta,
            user_id=access.p.id,
            project_id=None,
            reason=data.reason,
            kind="adjustment",
            reference_type="adjustment",
        )
    movement.reason = data.reason
    audit.record(
        db,
        family="business",
        module="inventory",
        action="ADJUST",
        resource_type="stock_item",
        resource_id=item.id,
        diff={"delta": str(data.delta)},
        reason=data.reason,
        criticality="MEDIUM",
    )
    db.commit()
    return jsonable(serialize(movement))


# ---------------------------------------------------------------------------- affectations chantier
class AllocationIn(BaseModel):
    item_id: uuid.UUID
    warehouse_id: uuid.UUID
    project_id: uuid.UUID
    site_id: uuid.UUID | None = None
    lot_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    quantity: Decimal = Field(gt=0)


def _allocation_out(db: Session, allocation: StockAllocation) -> dict[str, Any]:
    item = db.get(StockItem, allocation.item_id)
    return jsonable({**serialize(allocation), "item": item.name if item else "", "unit": item.unit if item else ""})


@router.get("/stock-allocations")
def list_allocations(
    params: PageParams = Depends(),
    project_id: uuid.UUID | None = None,
    site_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("inventory:read")
    stmt = access.filter_by_project(select(StockAllocation), StockAllocation.project_id, allow_null=False)
    for col, value in (
        (StockAllocation.project_id, project_id),
        (StockAllocation.site_id, site_id),
        (StockAllocation.status, status),
    ):
        if value:
            stmt = stmt.where(col == value)
    return paginate(
        db, stmt, params, default_sort=StockAllocation.created_at.desc(), transform=lambda a: _allocation_out(db, a)
    )


@router.post("/stock-allocations", status_code=201)
def create_allocation(
    data: AllocationIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require_project(data.project_id, "inventory:write")
    item = _item(db, data.item_id)
    _warehouse(db, access, data.warehouse_id)
    allocation = StockAllocation(
        item_id=item.id,
        warehouse_id=data.warehouse_id,
        project_id=data.project_id,
        site_id=data.site_id,
        lot_id=data.lot_id,
        task_id=data.task_id,
        quantity=data.quantity,
        requested_by_id=access.p.id,
        unit_cost=item.average_cost,
    )
    db.add(allocation)
    db.flush()
    service.reserve(db, allocation)
    audit.record(
        db,
        family="business",
        module="inventory",
        action="ALLOCATE",
        resource_type="stock_allocation",
        resource_id=allocation.id,
        project_id=data.project_id,
        diff={"quantity": str(data.quantity)},
    )
    db.commit()
    return _allocation_out(db, allocation)


class QuantityIn(BaseModel):
    quantity: Decimal = Field(gt=0)
    warehouse_id: uuid.UUID | None = None
    reason: str | None = Field(default=None, max_length=1000)
    client_mutation_id: str | None = Field(default=None, max_length=80)


def _allocation(db: Session, access: Access, allocation_id: uuid.UUID) -> StockAllocation:
    allocation = db.get(StockAllocation, allocation_id)
    if allocation is None:
        raise NotFound("Affectation introuvable")
    access.require_project(allocation.project_id, "inventory:write")
    return allocation


@router.post("/stock-allocations/{allocation_id}/issue")
def issue_allocation(
    allocation_id: uuid.UUID, data: QuantityIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    allocation = _allocation(db, access, allocation_id)
    if _replayed(db, data.client_mutation_id) is not None:
        return _allocation_out(db, allocation)
    if allocation.status != "reserved":
        raise BusinessRuleError("Affectation non réservée")
    movement = service.issue_allocation(db, allocation, quantity=data.quantity, user_id=access.p.id)
    movement.client_mutation_id = data.client_mutation_id
    db.commit()
    return _allocation_out(db, allocation)


@router.post("/stock-allocations/{allocation_id}/return")
def return_allocation(
    allocation_id: uuid.UUID, data: QuantityIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    allocation = _allocation(db, access, allocation_id)
    if _replayed(db, data.client_mutation_id) is not None:
        return _allocation_out(db, allocation)
    warehouse_id = data.warehouse_id or allocation.warehouse_id
    if warehouse_id is None:
        raise BusinessRuleError("Entrepôt de retour requis")
    _warehouse(db, access, warehouse_id)
    service.return_allocation(
        db,
        allocation,
        quantity=data.quantity,
        warehouse_id=warehouse_id,
        user_id=access.p.id,
        reason=data.reason,
        client_mutation_id=data.client_mutation_id,
    )
    db.commit()
    return _allocation_out(db, allocation)


@router.post("/stock-allocations/{allocation_id}/consume")
def consume_allocation(
    allocation_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    allocation = _allocation(db, access, allocation_id)
    if allocation.status not in ("issued",):
        raise BusinessRuleError("Seule une affectation sortie peut être déclarée consommée")
    allocation.status = "consumed"
    audit.record(
        db,
        family="business",
        module="inventory",
        action="ALLOCATION_CONSUMED",
        resource_type="stock_allocation",
        resource_id=allocation.id,
        project_id=allocation.project_id,
    )
    db.commit()
    return _allocation_out(db, allocation)


@router.post("/stock-allocations/{allocation_id}/cancel")
def cancel_allocation(
    allocation_id: uuid.UUID,
    data: QuantityIn | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    allocation = _allocation(db, access, allocation_id)
    service.release_allocation(db, allocation, user_id=access.p.id, reason=data.reason if data else None)
    db.commit()
    return _allocation_out(db, allocation)


# ---------------------------------------------------------------------------- inventaires
def _count_out(db: Session, count: InventoryCount) -> dict[str, Any]:
    names = {
        i.id: (i.name, i.sku, i.unit)
        for i in db.execute(
            select(StockItem).where(StockItem.id.in_([line.item_id for line in count.lines] or [uuid.uuid4()]))
        ).scalars()
    }
    return jsonable(
        {
            **serialize(count),
            "lines": [
                {
                    **serialize(line),
                    "item": names.get(line.item_id, ("", "", ""))[0],
                    "sku": names.get(line.item_id, ("", "", ""))[1],
                    "unit": names.get(line.item_id, ("", "", ""))[2],
                    "variance": (Decimal(line.counted) - Decimal(line.expected)) if line.counted is not None else None,
                }
                for line in count.lines
            ],
        }
    )


class CountIn(BaseModel):
    warehouse_id: uuid.UUID
    notes: str | None = Field(default=None, max_length=2000)


@router.get("/inventory-counts")
def list_counts(
    params: PageParams = Depends(),
    warehouse_id: uuid.UUID | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("inventory:read")
    stmt = select(InventoryCount)
    if warehouse_id:
        stmt = stmt.where(InventoryCount.warehouse_id == warehouse_id)
    if status:
        stmt = stmt.where(InventoryCount.status == status)
    return paginate(
        db,
        stmt,
        params,
        default_sort=InventoryCount.created_at.desc(),
        transform=lambda c: jsonable({**serialize(c), "lines_count": len(c.lines)}),
    )


@router.post("/inventory-counts", status_code=201)
def start_count(data: CountIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require("inventory:write")
    warehouse = _warehouse(db, access, data.warehouse_id)
    existing = db.execute(
        select(InventoryCount.id).where(
            InventoryCount.warehouse_id == warehouse.id, InventoryCount.status == "in_progress"
        )
    ).first()
    if existing:
        raise Conflict("Un inventaire est déjà en cours sur cet entrepôt", code="COUNT_IN_PROGRESS")
    count = service.start_count(db, warehouse, user_id=access.p.id)
    count.notes = data.notes
    audit.record(
        db,
        family="business",
        module="inventory",
        action="COUNT_START",
        resource_type="inventory_count",
        resource_id=count.id,
    )
    db.commit()
    return _count_out(db, count)


@router.get("/inventory-counts/{count_id}")
def get_count(
    count_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("inventory:read")
    count = db.get(InventoryCount, count_id)
    if count is None:
        raise NotFound("Inventaire introuvable")
    return _count_out(db, count)


class CountLineIn(BaseModel):
    item_id: uuid.UUID
    counted: Decimal = Field(ge=0)
    note: str | None = Field(default=None, max_length=250)


class CountLinesIn(BaseModel):
    lines: list[CountLineIn] = Field(min_length=1, max_length=5000)


@router.put("/inventory-counts/{count_id}/lines")
def record_counts(
    count_id: uuid.UUID, data: CountLinesIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("inventory:write")
    count = db.get(InventoryCount, count_id)
    if count is None:
        raise NotFound("Inventaire introuvable")
    if count.status != "in_progress":
        raise BusinessRuleError("Inventaire clos")
    by_item = {line.item_id: line for line in count.lines}
    for entry in data.lines:
        line = by_item.get(entry.item_id)
        if line is None:
            _item(db, entry.item_id)
            line = InventoryCountLine(
                item_id=entry.item_id, expected=service.on_hand_in(db, entry.item_id, count.warehouse_id)
            )
            count.lines.append(line)
            by_item[entry.item_id] = line
        line.counted = entry.counted
        line.note = entry.note
    db.commit()
    return _count_out(db, count)


@router.post("/inventory-counts/{count_id}/validate")
def validate_count(
    count_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    access.require("inventory:write")
    count = db.get(InventoryCount, count_id)
    if count is None:
        raise NotFound("Inventaire introuvable")
    if count.counted_by_id == access.p.id and "ADMIN" not in access.p.roles and not access.has("procurement:approve"):
        raise BusinessRuleError(
            "Validation par une personne distincte du compteur (ou responsable)", code="SEGREGATION_OF_DUTIES"
        )
    result = service.validate_count(db, count, user_id=access.p.id)
    db.commit()
    return {**_count_out(db, count), **jsonable(result)}
