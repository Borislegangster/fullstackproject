"""API Configurateur de matériaux (§11, V4-3D-24/25/26/27) : catalogue (ERP), maquettes configurables par projet,
zones / pièces, scénarios client, delta prix/délai, comparaison, soumission en décision OTP, verrouillage."""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
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
from app.core.utils import jsonable
from app.modules.configurator import service
from app.modules.configurator.models import (
    ConfiguratorModel,
    ConfiguratorZone,
    Material,
    MaterialCategory,
    Scenario,
)
from app.modules.system.models import StoredFile

TAG = "Configurateur 3D"
router = APIRouter(tags=[TAG])

router.include_router(
    make_crud_router(
        MaterialCategory,
        prefix="/configurator/material-categories",
        tags=[TAG],
        module="configurator",
        read_perm="configurator:manage",
        write_perm="configurator:manage",
        label="Catégorie de matériaux",
        sort=["sort_order"],
        default_sort="sort_order",
        allow_delete=False,
    )
)
router.include_router(
    make_crud_router(
        Material,
        prefix="/configurator/materials",
        tags=[TAG],
        module="configurator",
        read_perm="configurator:manage",
        write_perm="configurator:manage",
        label="Matériau",
        filters=["category_id", "tier", "availability", "is_active", "supplier_id"],
        search=["name", "supplier_reference"],
        sort=["name", "unit_price", "tier"],
        default_sort="name",
        exclude_in={"image_file_id", "texture_file_id", "normal_map_file_id"},
    )
)


def _material_out(material: Material) -> dict[str, Any]:
    data = serialize(material)
    for key, kind in (("image_file_id", "image"), ("texture_file_id", "texture"), ("normal_map_file_id", "normal")):
        data[f"{kind}_url"] = f"/api/v1/configurator/materials/{material.id}/{kind}" if getattr(material, key) else None
    return jsonable(data)


@router.post("/configurator/materials/{material_id}/assets", status_code=201)
async def upload_material_asset(
    material_id: uuid.UUID,
    kind: str = Form(..., pattern="^(image|texture|normal)$"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    access.require("configurator:manage")
    material = db.get(Material, material_id)
    if material is None or material.deleted_at is not None:
        raise NotFound("Matériau introuvable")
    upload = validate_upload(file.filename or kind, await file.read(), category="image", max_mb=40)
    stored = store_private(db, upload, purpose="materials", classification="public", uploaded_by_id=access.p.id)
    setattr(
        material,
        {"image": "image_file_id", "texture": "texture_file_id", "normal": "normal_map_file_id"}[kind],
        stored.id,
    )
    db.commit()
    return _material_out(material)


@router.get("/configurator/materials/{material_id}/{kind}")
def material_asset(
    material_id: uuid.UUID, kind: str, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    if not access.p.has_any("configurator:manage", "client:portal", "projects:read"):
        access.require("configurator:manage")
    material = db.get(Material, material_id)
    field = {"image": "image_file_id", "texture": "texture_file_id", "normal": "normal_map_file_id"}.get(kind)
    if material is None or field is None or not getattr(material, field):
        raise NotFound("Ressource introuvable")
    response = file_response(db.get(StoredFile, getattr(material, field)))
    response.headers["Cache-Control"] = "private, max-age=86400"
    return response


# ============================================================================ maquettes configurables
class ZoneIn(BaseModel):
    key: str = Field(min_length=1, max_length=60, pattern="^[a-z0-9_\\-]+$")
    label: str = Field(min_length=2, max_length=150)
    room: str | None = Field(default=None, max_length=80)
    category_key: str = Field(min_length=2, max_length=40)
    mesh_names: list[str] = Field(default_factory=list, max_length=500)
    quantity: Decimal = Field(gt=0)
    unit: str = Field(default="m2", max_length=20)
    default_material_id: uuid.UUID
    allowed_material_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)
    planning_task_id: uuid.UUID | None = None
    sort_order: int = Field(default=0, ge=0, le=999)


class ModelIn(BaseModel):
    project_id: uuid.UUID
    name: str = Field(min_length=2, max_length=200)
    source: str = Field(default="bim_version", pattern="^(glb|parametric|bim_version)$")
    bim_version_id: uuid.UUID | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)
    presets: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    lock_date: date | None = None
    zones: list[ZoneIn] = Field(min_length=1, max_length=300)


def _model_out(db: Session, model: ConfiguratorModel, *, client: bool = False) -> dict[str, Any]:
    zones = []
    for zone in model.zones:
        entry = serialize(zone)
        entry["materials"] = [_material_out(m) for m in service.allowed_materials(db, zone)]
        zones.append(entry)
    data = {
        **serialize(model),
        "zones": zones,
        "file_url": f"/api/v1/configurator/models/{model.id}/file" if model.file_id else None,
        "choices_open": not (model.lock_date and model.lock_date < date.today()),
    }
    if client:
        data.pop("parameters", None)
    return jsonable(data)


def _validate_zones(db: Session, zones: list[ZoneIn]) -> None:
    categories = {c.key for c in db.execute(select(MaterialCategory)).scalars()}
    for zone in zones:
        if zone.category_key not in categories:
            raise BusinessRuleError(f"Catégorie inconnue : {zone.category_key}")
        material = db.get(Material, zone.default_material_id)
        category = db.get(MaterialCategory, material.category_id) if material else None
        if material is None or category is None or category.key != zone.category_key:
            raise BusinessRuleError(f"Matériau de base incohérent pour « {zone.label} »")


@router.post("/configurator/models", status_code=201)
def create_model(data: ModelIn, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> dict[str, Any]:
    access.require_project(data.project_id, "configurator:manage")
    if data.source == "bim_version":
        from app.modules.bim.models import BimModel, BimVersion

        version = db.get(BimVersion, data.bim_version_id) if data.bim_version_id else None
        bim_model = db.get(BimModel, version.model_id) if version else None
        if bim_model is None or bim_model.project_id != data.project_id:
            raise BusinessRuleError("Version BIM requise (même projet)")
    _validate_zones(db, data.zones)
    model = ConfiguratorModel(
        project_id=data.project_id,
        name=data.name,
        source=data.source,
        bim_version_id=data.bim_version_id,
        parameters=data.parameters,
        presets=data.presets,
        lock_date=data.lock_date,
    )
    for zone in data.zones:
        values = zone.model_dump()
        values["allowed_material_ids"] = [str(x) for x in zone.allowed_material_ids]
        model.zones.append(ConfiguratorZone(**values))
    db.add(model)
    db.flush()
    audit.record(
        db,
        family="business",
        module="configurator",
        action="MODEL_CREATE",
        resource_type="configurator_model",
        resource_id=model.id,
        project_id=model.project_id,
        diff={"zones": len(data.zones)},
    )
    db.commit()
    return _model_out(db, model)


@router.post("/configurator/models/{model_id}/file", status_code=201)
async def upload_model_file(
    model_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    model = _model(db, access, model_id, manage=True)
    if not (file.filename or "").lower().endswith((".glb", ".gltf")):
        raise BusinessRuleError("Format attendu : GLB / glTF")
    upload = validate_upload(
        file.filename or "modele.glb", await file.read(), category="any", allow_bim=True, max_mb=200
    )
    stored = store_private(db, upload, purpose="configurator", classification="internal", uploaded_by_id=access.p.id)
    model.file_id = stored.id
    model.source = "glb"
    db.commit()
    return _model_out(db, model)


def _model(db: Session, access: Access, model_id: uuid.UUID, *, manage: bool = False) -> ConfiguratorModel:
    model = db.get(ConfiguratorModel, model_id)
    if model is None:
        raise NotFound("Maquette introuvable")
    if manage:
        access.require_project(model.project_id, "configurator:manage")
        return model
    access.require_project(model.project_id)
    if access.p.is_client and not model.published_to_client:
        raise NotFound("Maquette introuvable")
    if not access.p.has_any("configurator:manage", "client:portal", "projects:read"):
        raise Forbidden("Accès au configurateur refusé", code="PERMISSION_DENIED")
    return model


@router.get("/projects/{project_id}/configurator/models")
def list_models(
    project_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    access.require_project(project_id)
    stmt = select(ConfiguratorModel).where(ConfiguratorModel.project_id == project_id)
    if access.p.is_client:
        stmt = stmt.where(ConfiguratorModel.published_to_client.is_(True))
    elif not access.p.has_any("configurator:manage", "projects:read"):
        raise Forbidden("Accès au configurateur refusé", code="PERMISSION_DENIED")
    return [_model_out(db, m, client=access.p.is_client) for m in db.execute(stmt).scalars()]


@router.get("/configurator/models/{model_id}")
def get_model(
    model_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    return _model_out(db, _model(db, access, model_id), client=access.p.is_client)


@router.get("/configurator/models/{model_id}/file")
def model_file(model_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)) -> Response:
    model = _model(db, access, model_id)
    if not model.file_id:
        raise NotFound("Aucun fichier 3D")
    return file_response(db.get(StoredFile, model.file_id), inline=False)


class PublishIn(BaseModel):
    published: bool
    lock_date: date | None = None


@router.post("/configurator/models/{model_id}/publish")
def publish_model(
    model_id: uuid.UUID, data: PublishIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    model = _model(db, access, model_id, manage=True)
    access.require("projects:publish_client")
    # « Sans maquette 3D » (parametric) : le client choisit sur catalogue, zone par zone.
    if data.published and model.source != "parametric" and not (model.file_id or model.bim_version_id):
        raise BusinessRuleError("Maquette 3D requise avant publication")
    model.published_to_client = data.published
    if data.lock_date:
        model.lock_date = data.lock_date
    audit.record(
        db,
        family="business",
        module="configurator",
        action="MODEL_PUBLISH",
        resource_type="configurator_model",
        resource_id=model.id,
        project_id=model.project_id,
        diff={"published": data.published},
    )
    db.commit()
    return _model_out(db, model)


# ============================================================================ scénarios
def _scenario_out(db: Session, scenario: Scenario) -> dict[str, Any]:
    items = []
    for item in scenario.items:
        material = db.get(Material, item.material_id)
        zone = db.get(ConfiguratorZone, item.zone_id)
        items.append(
            {
                **serialize(item),
                "zone": zone.label if zone else "",
                "zone_key": zone.key if zone else "",
                "mesh_names": zone.mesh_names if zone else [],
                "material": _material_out(material) if material else None,
            }
        )
    return jsonable({**serialize(scenario), "items": items})


def _scenario(db: Session, access: Access, scenario_id: uuid.UUID) -> Scenario:
    scenario = db.get(Scenario, scenario_id)
    if scenario is None:
        raise NotFound("Scénario introuvable")
    _model(db, access, scenario.model_id)
    return scenario


class ScenarioIn(BaseModel):
    name: str = Field(min_length=2, max_length=150)


@router.get("/configurator/models/{model_id}/scenarios")
def list_scenarios(
    model_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> list[dict[str, Any]]:
    model = _model(db, access, model_id)
    rows = db.execute(select(Scenario).where(Scenario.model_id == model.id).order_by(Scenario.created_at)).scalars()
    return [_scenario_out(db, s) for s in rows]


@router.post("/configurator/models/{model_id}/scenarios", status_code=201)
def create_scenario(
    model_id: uuid.UUID, data: ScenarioIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    model = _model(db, access, model_id)
    if not access.p.has_any("client:decide", "configurator:manage"):
        raise Forbidden("Création de scénario non autorisée", code="PERMISSION_DENIED")
    scenario = service.create_scenario(db, model, name=data.name, user_id=access.p.id)
    db.commit()
    return _scenario_out(db, scenario)


class ChoiceIn(BaseModel):
    zone_id: uuid.UUID
    material_id: uuid.UUID


@router.put("/configurator/scenarios/{scenario_id}/choices")
def set_choice(
    scenario_id: uuid.UUID, data: ChoiceIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Choix d'un matériau pour une zone : prévisualisation 3D côté client + delta prix/délai recalculé."""
    scenario = _scenario(db, access, scenario_id)
    if not access.p.has_any("client:decide", "configurator:manage"):
        raise Forbidden("Modification non autorisée", code="PERMISSION_DENIED")
    service.set_choice(db, scenario, zone_id=data.zone_id, material_id=data.material_id)
    db.commit()
    return _scenario_out(db, scenario)


@router.post("/configurator/scenarios/{scenario_id}/duplicate", status_code=201)
def duplicate(
    scenario_id: uuid.UUID, data: ScenarioIn, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    scenario = _scenario(db, access, scenario_id)
    copy = service.duplicate(db, scenario, name=data.name, user_id=access.p.id)
    db.commit()
    return _scenario_out(db, copy)


@router.get("/configurator/models/{model_id}/compare")
def compare(
    model_id: uuid.UUID, ids: str, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    model = _model(db, access, model_id)
    wanted = [uuid.UUID(x) for x in ids.split(",") if x.strip()][:4]
    scenarios = [s for s in (db.get(Scenario, sid) for sid in wanted) if s is not None and s.model_id == model.id]
    if len(scenarios) < 2:
        raise BusinessRuleError("Sélectionner au moins deux scénarios")
    return jsonable(service.compare(db, scenarios))


@router.post("/configurator/scenarios/{scenario_id}/snapshot", status_code=201)
async def snapshot(
    scenario_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    access: Access = Depends(get_access),
) -> dict[str, Any]:
    """Capture partageable de la prévisualisation 3D."""
    scenario = _scenario(db, access, scenario_id)
    upload = validate_upload(file.filename or "capture.png", await file.read(), category="image", max_mb=15)
    stored = store_private(db, upload, purpose="configurator", classification="internal", uploaded_by_id=access.p.id)
    scenario.snapshot_file_id = stored.id
    db.commit()
    return _scenario_out(db, scenario)


@router.get("/configurator/scenarios/{scenario_id}/snapshot")
def get_snapshot(
    scenario_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> Response:
    scenario = _scenario(db, access, scenario_id)
    if not scenario.snapshot_file_id:
        raise NotFound("Aucune capture")
    return file_response(db.get(StoredFile, scenario.snapshot_file_id))


@router.post("/configurator/scenarios/{scenario_id}/submit")
def submit(
    scenario_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
) -> dict[str, Any]:
    """Soumission → décision OTP (§11.2 étape 79) ; la validation se fait dans l'espace client « Validations »."""
    scenario = _scenario(db, access, scenario_id)
    if not access.p.has_any("client:decide", "configurator:manage"):
        raise Forbidden("Soumission non autorisée", code="PERMISSION_DENIED")
    decision = service.submit(db, scenario, user_id=access.p.id)
    db.commit()
    return {**_scenario_out(db, scenario), "decision": jsonable(serialize(decision))}
