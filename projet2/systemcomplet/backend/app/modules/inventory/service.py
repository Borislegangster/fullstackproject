"""Stocks (§7) : entrées/sorties, lots, emplacements, transferts, affectations chantier, inventaires,
coût moyen unitaire pondéré (CMUP). Grand livre des mouvements + niveaux matérialisés."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, NotFound
from app.core.events import emit
from app.core.numbering import next_number
from app.core.utils import qty as q
from app.core.utils import utcnow
from app.modules.inventory.models import (
    InventoryCount,
    InventoryCountLine,
    MaterialBatch,
    StockAllocation,
    StockItem,
    StockLevel,
    StockMovement,
    Warehouse,
)


def _level(
    db: Session, item_id: uuid.UUID, warehouse_id: uuid.UUID, location_id: uuid.UUID | None, batch_id: uuid.UUID | None
) -> StockLevel:
    level = db.execute(
        select(StockLevel)
        .where(
            StockLevel.item_id == item_id,
            StockLevel.warehouse_id == warehouse_id,
            StockLevel.location_id.is_(None) if location_id is None else StockLevel.location_id == location_id,
            StockLevel.batch_id.is_(None) if batch_id is None else StockLevel.batch_id == batch_id,
        )
        .with_for_update()
    ).scalar_one_or_none()
    if level is None:
        level = StockLevel(
            item_id=item_id,
            warehouse_id=warehouse_id,
            location_id=location_id,
            batch_id=batch_id,
            quantity=Decimal("0"),
            reserved=Decimal("0"),
        )
        db.add(level)
        db.flush()
    return level


def available(db: Session, item_id: uuid.UUID, warehouse_id: uuid.UUID | None = None) -> Decimal:
    stmt = select(func.coalesce(func.sum(StockLevel.quantity - StockLevel.reserved), 0)).where(
        StockLevel.item_id == item_id
    )
    if warehouse_id:
        stmt = stmt.where(StockLevel.warehouse_id == warehouse_id)
    return Decimal(db.execute(stmt).scalar_one())


def on_hand(db: Session, item_id: uuid.UUID) -> Decimal:
    return Decimal(
        db.execute(
            select(func.coalesce(func.sum(StockLevel.quantity), 0)).where(StockLevel.item_id == item_id)
        ).scalar_one()
    )


def on_hand_in(db: Session, item_id: uuid.UUID, warehouse_id: uuid.UUID) -> Decimal:
    return Decimal(
        db.execute(
            select(func.coalesce(func.sum(StockLevel.quantity), 0)).where(
                StockLevel.item_id == item_id, StockLevel.warehouse_id == warehouse_id
            )
        ).scalar_one()
    )


def receive(
    db: Session,
    *,
    item: StockItem,
    warehouse_id: uuid.UUID,
    quantity: Decimal,
    unit_cost: Decimal,
    user_id: uuid.UUID | None,
    reference_type: str,
    reference_id: uuid.UUID | None,
    batch_number: str | None = None,
    supplier_id: uuid.UUID | None = None,
    expiry: Any = None,
    location_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    goods_receipt_id: uuid.UUID | None = None,
    client_mutation_id: str | None = None,
) -> StockMovement:
    quantity = q(quantity)
    if quantity <= 0:
        raise BusinessRuleError("Quantité reçue invalide")
    batch = None
    if batch_number:
        batch = MaterialBatch(
            item_id=item.id,
            batch_number=batch_number,
            supplier_id=supplier_id,
            goods_receipt_id=goods_receipt_id,
            received_at=utcnow(),
            expiry_date=expiry,
            quantity_initial=quantity,
        )
        db.add(batch)
        db.flush()
    current = on_hand(db, item.id)
    total_value = current * Decimal(item.average_cost or 0) + quantity * Decimal(unit_cost)
    item.average_cost = (
        (total_value / (current + quantity)).quantize(Decimal("0.0001")) if current + quantity > 0 else unit_cost
    )
    level = _level(db, item.id, warehouse_id, location_id, batch.id if batch else None)
    level.quantity = q(Decimal(level.quantity) + quantity)
    movement = StockMovement(
        item_id=item.id,
        kind="in",
        quantity=quantity,
        unit_cost=unit_cost,
        to_warehouse_id=warehouse_id,
        location_id=location_id,
        batch_id=batch.id if batch else None,
        project_id=project_id,
        reference_type=reference_type,
        reference_id=reference_id,
        performed_by_id=user_id,
        client_mutation_id=client_mutation_id,
    )
    db.add(movement)
    db.flush()
    return movement


def issue(
    db: Session,
    *,
    item: StockItem,
    warehouse_id: uuid.UUID,
    quantity: Decimal,
    user_id: uuid.UUID | None,
    project_id: uuid.UUID | None,
    site_id: uuid.UUID | None = None,
    lot_id: uuid.UUID | None = None,
    task_id: uuid.UUID | None = None,
    reason: str | None = None,
    reference_type: str = "manual",
    reference_id: uuid.UUID | None = None,
    kind: str = "out",
    client_mutation_id: str | None = None,
    consume_reserved: bool = False,
) -> StockMovement:
    """Sortie FIFO par lot (les lots les plus anciens d'abord)."""
    quantity = q(quantity)
    if quantity <= 0:
        raise BusinessRuleError("Quantité invalide")
    levels = (
        db.execute(
            select(StockLevel)
            .outerjoin(MaterialBatch, MaterialBatch.id == StockLevel.batch_id)
            .where(StockLevel.item_id == item.id, StockLevel.warehouse_id == warehouse_id, StockLevel.quantity > 0)
            .order_by(MaterialBatch.received_at.asc().nulls_last(), StockLevel.updated_at)
            .with_for_update(of=StockLevel)
        )
        .scalars()
        .all()
    )
    free = sum(
        (Decimal(lv.quantity) - (Decimal("0") if consume_reserved else Decimal(lv.reserved)) for lv in levels),
        Decimal("0"),
    )
    if free < quantity:
        raise BusinessRuleError(
            f"Stock insuffisant pour {item.name} (disponible {free} {item.unit})", code="INSUFFICIENT_STOCK"
        )
    remaining = quantity
    for level in levels:
        if remaining <= 0:
            break
        take = min(remaining, Decimal(level.quantity))
        level.quantity = q(Decimal(level.quantity) - take)
        if consume_reserved:
            level.reserved = q(max(Decimal("0"), Decimal(level.reserved) - take))
        remaining -= take
    movement = StockMovement(
        item_id=item.id,
        kind=kind,
        quantity=quantity,
        unit_cost=item.average_cost,
        from_warehouse_id=warehouse_id,
        project_id=project_id,
        site_id=site_id,
        lot_id=lot_id,
        task_id=task_id,
        reason=reason,
        reference_type=reference_type,
        reference_id=reference_id,
        performed_by_id=user_id,
        client_mutation_id=client_mutation_id,
    )
    db.add(movement)
    db.flush()
    if project_id and kind in ("out", "allocation"):
        from app.modules.finance.service import record_expense

        record_expense(
            db,
            project_id=project_id,
            lot_id=lot_id,
            category="materiaux",
            label=f"Consommation stock — {item.name}",
            amount=quantity * Decimal(item.average_cost or 0),
            expense_date=utcnow().date(),
            source_type="stock",
            source_id=movement.id,
            user_id=user_id,
        )
    check_threshold(db, item)
    return movement


def check_threshold(db: Session, item: StockItem) -> bool:
    """Alerte « stock bas » quand la quantité passe sous le seuil minimum (une alerte par passage)."""
    threshold = Decimal(item.min_threshold or 0)
    if threshold <= 0:
        return False
    quantity = on_hand(db, item.id)
    if quantity >= threshold:
        return False
    from app.modules.system.models import ActionItem

    open_alert = db.execute(
        select(ActionItem.id).where(
            ActionItem.entity_type == "stock_item", ActionItem.entity_id == str(item.id), ActionItem.status == "open"
        )
    ).first()
    if open_alert:
        return True
    db.add(
        ActionItem(
            title=f"Réapprovisionner {item.name}",
            module="inventory",
            entity_type="stock_item",
            entity_id=str(item.id),
            assignee_role="ACHETEUR",
            priority="high",
            description=f"Stock {quantity} {item.unit} < seuil {threshold} {item.unit}. "
            f"Quantité de réapprovisionnement suggérée : {item.reorder_quantity} {item.unit}.",
        )
    )
    emit(
        db,
        "stock.low",
        {"id": item.id, "item": item.name, "quantity": quantity, "unit": item.unit, "threshold": threshold},
        aggregate_type="stock_item",
        aggregate_id=item.id,
    )
    return True


def transfer(
    db: Session,
    *,
    item: StockItem,
    from_warehouse: uuid.UUID,
    to_warehouse: uuid.UUID,
    quantity: Decimal,
    user_id: uuid.UUID,
    reason: str | None,
) -> StockMovement:
    if from_warehouse == to_warehouse:
        raise BusinessRuleError("Entrepôts identiques")
    out = issue(
        db,
        item=item,
        warehouse_id=from_warehouse,
        quantity=quantity,
        user_id=user_id,
        project_id=None,
        reason=reason,
        kind="transfer",
        reference_type="transfer",
    )
    level = _level(db, item.id, to_warehouse, None, None)
    level.quantity = q(Decimal(level.quantity) + q(quantity))
    out.to_warehouse_id = to_warehouse
    db.flush()
    return out


def reserve(db: Session, allocation: StockAllocation) -> None:
    if allocation.warehouse_id is None:
        raise BusinessRuleError("Entrepôt source requis")
    if available(db, allocation.item_id, allocation.warehouse_id) < Decimal(allocation.quantity):
        raise BusinessRuleError("Stock disponible insuffisant pour la réservation", code="INSUFFICIENT_STOCK")
    remaining = Decimal(allocation.quantity)
    levels = (
        db.execute(
            select(StockLevel).where(
                StockLevel.item_id == allocation.item_id, StockLevel.warehouse_id == allocation.warehouse_id
            )
        )
        .scalars()
        .all()
    )
    for lv in levels:
        free = Decimal(lv.quantity) - Decimal(lv.reserved)
        take = min(free, remaining)
        if take > 0:
            lv.reserved = q(Decimal(lv.reserved) + take)
            remaining -= take
    allocation.status = "reserved"
    db.flush()


def issue_allocation(
    db: Session, allocation: StockAllocation, *, quantity: Decimal, user_id: uuid.UUID
) -> StockMovement:
    item = db.get(StockItem, allocation.item_id)
    if item is None or allocation.warehouse_id is None:
        raise NotFound("Article ou entrepôt introuvable")
    remaining = Decimal(allocation.quantity) - Decimal(allocation.quantity_issued)
    if quantity > remaining:
        raise BusinessRuleError(f"Quantité supérieure au reliquat réservé ({remaining})")
    movement = issue(
        db,
        item=item,
        warehouse_id=allocation.warehouse_id,
        quantity=quantity,
        user_id=user_id,
        project_id=allocation.project_id,
        site_id=allocation.site_id,
        lot_id=allocation.lot_id,
        task_id=allocation.task_id,
        reference_type="allocation",
        reference_id=allocation.id,
        kind="allocation",
        consume_reserved=True,
    )
    allocation.quantity_issued = q(Decimal(allocation.quantity_issued) + quantity)
    allocation.status = "issued" if allocation.quantity_issued >= allocation.quantity else "reserved"
    return movement


def release_allocation(db: Session, allocation: StockAllocation, *, user_id: uuid.UUID, reason: str | None) -> None:
    """Annulation d'une réservation : libère le reliquat réservé non sorti."""
    if allocation.status not in ("reserved",):
        raise BusinessRuleError("Seule une réservation en cours peut être annulée")
    remaining = Decimal(allocation.quantity) - Decimal(allocation.quantity_issued)
    if allocation.warehouse_id and remaining > 0:
        levels = (
            db.execute(
                select(StockLevel)
                .where(
                    StockLevel.item_id == allocation.item_id,
                    StockLevel.warehouse_id == allocation.warehouse_id,
                    StockLevel.reserved > 0,
                )
                .with_for_update()
            )
            .scalars()
            .all()
        )
        for level in levels:
            take = min(remaining, Decimal(level.reserved))
            level.reserved = q(Decimal(level.reserved) - take)
            remaining -= take
            if remaining <= 0:
                break
    allocation.status = "cancelled" if Decimal(allocation.quantity_issued) == 0 else "issued"
    audit.record(
        db,
        family="business",
        module="inventory",
        action="ALLOCATION_RELEASE",
        resource_type="stock_allocation",
        resource_id=allocation.id,
        project_id=allocation.project_id,
        actor_id=user_id,
        reason=reason,
    )


def return_allocation(
    db: Session,
    allocation: StockAllocation,
    *,
    quantity: Decimal,
    warehouse_id: uuid.UUID,
    user_id: uuid.UUID,
    reason: str | None,
    client_mutation_id: str | None = None,
) -> StockMovement:
    """Retour au magasin de matériaux non consommés : ré-entrée en stock et avoir sur le coût chantier."""
    quantity = q(quantity)
    net_issued = Decimal(allocation.quantity_issued) - Decimal(allocation.quantity_returned)
    if quantity <= 0 or quantity > net_issued:
        raise BusinessRuleError(f"Quantité de retour invalide (sortie nette {net_issued})")
    item = db.get(StockItem, allocation.item_id)
    if item is None:
        raise NotFound("Article introuvable")
    cost = Decimal(allocation.unit_cost or 0) or Decimal(item.average_cost or 0)
    movement = receive(
        db,
        item=item,
        warehouse_id=warehouse_id,
        quantity=quantity,
        unit_cost=cost,
        user_id=user_id,
        reference_type="allocation_return",
        reference_id=allocation.id,
        project_id=allocation.project_id,
        client_mutation_id=client_mutation_id,
    )
    movement.kind = "return"
    movement.reason = reason
    movement.site_id = allocation.site_id
    movement.lot_id = allocation.lot_id
    allocation.quantity_returned = q(Decimal(allocation.quantity_returned) + quantity)
    if allocation.quantity_returned >= allocation.quantity_issued:
        allocation.status = "returned"
    from app.modules.finance.service import record_expense

    record_expense(
        db,
        project_id=allocation.project_id,
        lot_id=allocation.lot_id,
        category="materiaux",
        label=f"Retour stock — {item.name}",
        amount=-(quantity * cost),
        expense_date=utcnow().date(),
        source_type="stock_return",
        source_id=movement.id,
        user_id=user_id,
    )
    audit.record(
        db,
        family="business",
        module="inventory",
        action="ALLOCATION_RETURN",
        resource_type="stock_allocation",
        resource_id=allocation.id,
        project_id=allocation.project_id,
        actor_id=user_id,
        diff={"quantity": str(quantity)},
        reason=reason,
    )
    return movement


def start_count(db: Session, warehouse: Warehouse, *, user_id: uuid.UUID) -> InventoryCount:
    count = InventoryCount(number=next_number(db, "inventory_count"), warehouse_id=warehouse.id, counted_by_id=user_id)
    rows = db.execute(
        select(StockLevel.item_id, func.sum(StockLevel.quantity))
        .where(StockLevel.warehouse_id == warehouse.id)
        .group_by(StockLevel.item_id)
    ).all()
    for item_id, quantity in rows:
        count.lines.append(InventoryCountLine(item_id=item_id, expected=quantity))
    db.add(count)
    db.flush()
    return count


def validate_count(db: Session, count: InventoryCount, *, user_id: uuid.UUID) -> dict[str, Any]:
    if count.status != "in_progress":
        raise BusinessRuleError("Inventaire déjà clos")
    if any(line.counted is None for line in count.lines):
        raise BusinessRuleError("Toutes les lignes doivent être comptées", code="COUNT_INCOMPLETE")
    adjustments = []
    for line in count.lines:
        variance = Decimal(line.counted) - Decimal(line.expected)
        if variance == 0:
            continue
        item = db.get(StockItem, line.item_id)
        if item is None:
            continue
        if variance > 0:
            receive(
                db,
                item=item,
                warehouse_id=count.warehouse_id,
                quantity=variance,
                unit_cost=item.average_cost,
                user_id=user_id,
                reference_type="inventory_count",
                reference_id=count.id,
            )
        else:
            issue(
                db,
                item=item,
                warehouse_id=count.warehouse_id,
                quantity=-variance,
                user_id=user_id,
                project_id=None,
                reason=f"Écart d'inventaire {count.number}",
                kind="adjustment",
                reference_type="inventory_count",
                reference_id=count.id,
            )
        adjustments.append({"item": item.name, "variance": str(variance)})
    count.status = "validated"
    count.validated_by_id = user_id
    count.validated_at = utcnow()
    audit.record(
        db,
        family="business",
        module="inventory",
        action="COUNT_VALIDATE",
        resource_type="inventory_count",
        resource_id=count.id,
        diff={"adjustments": adjustments},
        criticality="MEDIUM",
    )
    return {"adjustments": adjustments}


def stock_overview(db: Session, *, warehouse_id: uuid.UUID | None = None) -> list[dict[str, Any]]:
    stmt = select(
        StockItem, func.coalesce(func.sum(StockLevel.quantity), 0), func.coalesce(func.sum(StockLevel.reserved), 0)
    ).join(StockLevel, StockLevel.item_id == StockItem.id, isouter=True)
    if warehouse_id:
        stmt = stmt.where(StockLevel.warehouse_id == warehouse_id)
    stmt = stmt.where(StockItem.deleted_at.is_(None)).group_by(StockItem.id).order_by(StockItem.name)
    out = []
    for item, quantity, reserved in db.execute(stmt).all():
        out.append(
            {
                "id": item.id,
                "sku": item.sku,
                "name": item.name,
                "category": item.category,
                "unit": item.unit,
                "quantity": quantity,
                "reserved": reserved,
                "available": Decimal(quantity) - Decimal(reserved),
                "min_threshold": item.min_threshold,
                "average_cost": item.average_cost,
                "value": Decimal(quantity) * Decimal(item.average_cost or 0),
                "below_threshold": Decimal(quantity) < Decimal(item.min_threshold or 0),
            }
        )
    return out
