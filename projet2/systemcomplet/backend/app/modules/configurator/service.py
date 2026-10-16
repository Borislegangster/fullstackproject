"""Configurateur 3D client §11 (étapes 75 → 83) : catalogue matériaux (référence fournisseur, prix, unité,
disponibilité, texture, validité, maillages cibles), scénarios, calcul delta prix/délai, comparaison, validation
OTP via décision versionnée, avenant si impact, verrouillage pour exécution."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.utils import money, utcnow
from app.modules.configurator.models import (
    ConfiguratorModel,
    ConfiguratorZone,
    Material,
    MaterialCategory,
    Scenario,
    ScenarioItem,
)

EDITABLE = ("draft",)


def material_available(material: Material, on: date | None = None) -> bool:
    today = on or date.today()
    if not material.is_active or material.deleted_at is not None or material.availability == "unavailable":
        return False
    if material.valid_from and material.valid_from > today:
        return False
    return not (material.valid_until and material.valid_until < today)


def allowed_materials(db: Session, zone: ConfiguratorZone) -> list[Material]:
    stmt = (
        select(Material)
        .join(MaterialCategory, MaterialCategory.id == Material.category_id)
        .where(Material.deleted_at.is_(None), Material.is_active.is_(True), MaterialCategory.key == zone.category_key)
    )
    if zone.allowed_material_ids:
        stmt = stmt.where(Material.id.in_([uuid.UUID(str(x)) for x in zone.allowed_material_ids]))
    return [m for m in db.execute(stmt.order_by(Material.tier, Material.unit_price)).scalars() if material_available(m)]


def _default_material(db: Session, zone: ConfiguratorZone) -> Material | None:
    return db.get(Material, zone.default_material_id) if zone.default_material_id else None


def _check_open(model: ConfiguratorModel) -> None:
    if model.lock_date and model.lock_date < date.today():
        raise BusinessRuleError(f"Choix clos depuis le {model.lock_date:%d/%m/%Y}", code="CHOICES_LOCKED")


def create_scenario(db: Session, model: ConfiguratorModel, *, name: str, user_id: uuid.UUID) -> Scenario:
    _check_open(model)
    scenario = Scenario(model_id=model.id, project_id=model.project_id, name=name, created_by_id=user_id)
    for zone in model.zones:
        default = _default_material(db, zone)
        if default is not None:
            scenario.items.append(ScenarioItem(zone_id=zone.id, material_id=default.id, quantity=zone.quantity))
    db.add(scenario)
    db.flush()
    compute(db, scenario)
    return scenario


def set_choice(db: Session, scenario: Scenario, *, zone_id: uuid.UUID, material_id: uuid.UUID) -> Scenario:
    if scenario.status not in EDITABLE:
        raise Conflict("Scénario soumis ou verrouillé : créer une nouvelle variante", code="SCENARIO_LOCKED")
    model = db.get(ConfiguratorModel, scenario.model_id)
    _check_open(model)
    zone = next((z for z in model.zones if z.id == zone_id), None)
    if zone is None:
        raise NotFound("Zone introuvable")
    material = db.get(Material, material_id)
    if material is None or material.id not in {m.id for m in allowed_materials(db, zone)}:
        raise BusinessRuleError("Matériau non proposé pour cette zone ou indisponible", code="MATERIAL_NOT_ALLOWED")
    item = next((i for i in scenario.items if i.zone_id == zone.id), None)
    if item is None:
        scenario.items.append(ScenarioItem(zone_id=zone.id, material_id=material.id, quantity=zone.quantity))
    else:
        item.material_id = material.id
        item.quantity = zone.quantity
    db.flush()
    compute(db, scenario)
    return scenario


def _task_buffer_days(db: Session, zone: ConfiguratorZone) -> int | None:
    """Marge avant la pose prévue au planning (tâche liée à la zone)."""
    if not zone.planning_task_id:
        return None
    from app.modules.projects.models import Task

    task = db.get(Task, zone.planning_task_id)
    start = task.start_planned if task else None
    return (start - date.today()).days if start else None


def compute(db: Session, scenario: Scenario) -> Scenario:
    """Delta prix (vs matériau de base) et délai (délai d'approvisionnement au-delà de la marge planning)."""
    model = db.get(ConfiguratorModel, scenario.model_id)
    zones = {z.id: z for z in model.zones}
    base_total = Decimal("0")
    scenario_total = Decimal("0")
    delay = 0
    for item in scenario.items:
        zone = zones.get(item.zone_id)
        material = db.get(Material, item.material_id)
        default = _default_material(db, zone) if zone else None
        quantity = Decimal(item.quantity)
        item.unit_price = money(material.unit_price)
        item.line_total = money(quantity * Decimal(material.unit_price))
        item.default_line_total = money(quantity * Decimal(default.unit_price)) if default else item.line_total
        item.delta = money(Decimal(item.line_total) - Decimal(item.default_line_total))
        extra_lead = max(0, (material.lead_time_days or 0) - ((default.lead_time_days or 0) if default else 0))
        if material.availability == "on_order":
            extra_lead = max(extra_lead, material.lead_time_days or 0)
        buffer = _task_buffer_days(db, zone) if zone else None
        item.delay_days = max(0, extra_lead - buffer) if buffer is not None else extra_lead
        base_total += Decimal(item.default_line_total)
        scenario_total += Decimal(item.line_total)
        delay = max(delay, item.delay_days)
    scenario.base_total = money(base_total)
    scenario.scenario_total = money(scenario_total)
    scenario.price_delta = money(scenario_total - base_total)
    scenario.delay_delta_days = delay
    scenario.computed_at = utcnow()
    return scenario


def compare(db: Session, scenarios: list[Scenario]) -> dict[str, Any]:
    zones: dict[str, dict[str, Any]] = {}
    for scenario in scenarios:
        for item in scenario.items:
            material = db.get(Material, item.material_id)
            zone = db.get(ConfiguratorZone, item.zone_id)
            row = zones.setdefault(str(item.zone_id), {"zone": zone.label if zone else "", "choices": {}})
            row["choices"][str(scenario.id)] = {
                "material": material.name if material else "",
                "tier": material.tier if material else None,
                "line_total": item.line_total,
                "delta": item.delta,
                "delay_days": item.delay_days,
            }
    return {
        "scenarios": [
            {
                "id": s.id,
                "name": s.name,
                "status": s.status,
                "total": s.scenario_total,
                "price_delta": s.price_delta,
                "delay_delta_days": s.delay_delta_days,
            }
            for s in scenarios
        ],
        "zones": list(zones.values()),
    }


def submit(db: Session, scenario: Scenario, *, user_id: uuid.UUID) -> Any:
    """Soumission → décision versionnée en attente de validation OTP du client (prix/délai figés)."""
    from app.modules.projects.models import Project
    from app.modules.projects.service import request_decision

    if scenario.status != "draft":
        raise BusinessRuleError("Scénario déjà soumis")
    if not scenario.items:
        raise BusinessRuleError("Scénario vide")
    model = db.get(ConfiguratorModel, scenario.model_id)
    _check_open(model)
    compute(db, scenario)
    for item in scenario.items:
        material = db.get(Material, item.material_id)
        if not material_available(material):
            raise BusinessRuleError(f"Matériau devenu indisponible : {material.name}", code="MATERIAL_UNAVAILABLE")
    project = db.get(Project, scenario.project_id)
    lines = []
    for item in scenario.items:
        zone = db.get(ConfiguratorZone, item.zone_id)
        material = db.get(Material, item.material_id)
        lines.append(f"{zone.label if zone else ''} : {material.name if material else ''} ({item.delta:+,.0f} FCFA)")
    decision = request_decision(
        db,
        project=project,
        user_id=user_id,
        data={
            "kind": "material",
            "title": f"Choix de finitions — {scenario.name}",
            "description": "\n".join(lines).replace(",", " "),
            "price_impact": scenario.price_delta,
            "delay_impact_days": scenario.delay_delta_days,
            "reference_type": "scenario",
            "reference_id": scenario.id,
            "version_label": f"Scénario {scenario.name} r{scenario.revision}",
        },
    )
    scenario.status = "submitted"
    scenario.decision_id = decision.id
    audit.record(
        db,
        family="business",
        module="configurator",
        action="SCENARIO_SUBMIT",
        resource_type="scenario",
        resource_id=scenario.id,
        project_id=scenario.project_id,
        actor_id=user_id,
        diff={"price_delta": str(scenario.price_delta), "delay": scenario.delay_delta_days},
    )
    return decision


def on_decision_validated(db: Session, decision: Any) -> None:
    """Décision validée → scénario verrouillé pour exécution ; les autres variantes du modèle sont remplacées."""
    if decision.reference_type != "scenario" or not decision.reference_id:
        return
    scenario = db.get(Scenario, decision.reference_id)
    if scenario is None:
        return
    scenario.status = "locked"
    scenario.locked_at = utcnow()
    scenario.change_order_id = decision.change_order_id
    for other in db.execute(
        select(Scenario).where(
            Scenario.model_id == scenario.model_id,
            Scenario.id != scenario.id,
            Scenario.status.in_(["draft", "submitted", "validated"]),
        )
    ).scalars():
        other.status = "superseded"


def on_decision_rejected(db: Session, decision: Any) -> None:
    if decision.reference_type != "scenario" or not decision.reference_id:
        return
    scenario = db.get(Scenario, decision.reference_id)
    if scenario is not None and scenario.status == "submitted":
        scenario.status = "rejected"


def duplicate(db: Session, scenario: Scenario, *, name: str, user_id: uuid.UUID) -> Scenario:
    model = db.get(ConfiguratorModel, scenario.model_id)
    _check_open(model)
    copy = Scenario(
        model_id=scenario.model_id,
        project_id=scenario.project_id,
        name=name,
        created_by_id=user_id,
        revision=scenario.revision + 1,
    )
    for item in scenario.items:
        copy.items.append(ScenarioItem(zone_id=item.zone_id, material_id=item.material_id, quantity=item.quantity))
    db.add(copy)
    db.flush()
    compute(db, copy)
    return copy
