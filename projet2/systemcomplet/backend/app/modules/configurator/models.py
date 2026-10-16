"""3D client & configurateur de matériaux : catalogue, maquettes configurables, zones, scénarios (§11)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, ForeignKey, Numeric, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import (
    Base,
    Quantity,
    SoftDelete,
    Timestamps,
    UUIDPk,
    bool_col,
    dt_col,
    fk,
    int_col,
    json_col,
    money_col,
    str_col,
    text_col,
)


class MaterialCategory(UUIDPk, Timestamps, Base):
    __tablename__ = "material_categories"

    key: Mapped[str] = str_col(
        40, nullable=False, unique=True
    )  # sol / mur / facade / toiture / menuiserie / sanitaire / cuisine / eclairage
    name: Mapped[str] = str_col(120, nullable=False)
    sort_order: Mapped[int] = int_col(0)


class Material(UUIDPk, Timestamps, SoftDelete, Base):
    """Matériau du catalogue (géré ERP/CMS) avec référence fournisseur, prix, texture 3D, validité."""

    __tablename__ = "materials"

    category_id: Mapped[uuid.UUID] = fk("material_categories.id", nullable=False)
    name: Mapped[str] = str_col(200, nullable=False, index=True)
    description: Mapped[str | None] = text_col()
    supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    supplier_product_id: Mapped[uuid.UUID | None] = fk("supplier_products.id")
    supplier_reference: Mapped[str | None] = str_col(80)
    unit: Mapped[str] = str_col(20, nullable=False, default="m2")
    unit_price: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    availability: Mapped[str] = str_col(20, nullable=False, default="in_stock")  # in_stock / on_order / unavailable
    lead_time_days: Mapped[int] = int_col(0)
    image_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    texture_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    normal_map_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    color_hex: Mapped[str | None] = str_col(9)
    roughness: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False, default=Decimal("0.6"))
    metalness: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False, default=Decimal("0"))
    texture_repeat: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=Decimal("1"))
    target_mesh_tags: Mapped[list[Any]] = json_col(list)  # objets/maillages cibles
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    tier: Mapped[str] = str_col(20, nullable=False, default="standard")  # standard / confort / premium
    is_active: Mapped[bool] = bool_col(True)


class ConfiguratorModel(UUIDPk, Timestamps, Base):
    """Maquette 3D client configurable d'un projet (GLB publié ou modèle paramétrique)."""

    __tablename__ = "configurator_models"

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(200, nullable=False)
    source: Mapped[str] = str_col(20, nullable=False, default="parametric")  # glb / parametric / bim_version
    file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    bim_version_id: Mapped[uuid.UUID | None] = fk("bim_versions.id")
    parameters: Mapped[dict[str, Any]] = json_col(dict)  # gabarit paramétrique (niveaux, pièces, dimensions)
    presets: Mapped[list[Any]] = json_col(list)  # vues prédéfinies / par pièce
    published_to_client: Mapped[bool] = bool_col(False)
    lock_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # date limite des choix

    zones: Mapped[list[ConfiguratorZone]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="ConfiguratorZone.sort_order"
    )


class ConfiguratorZone(UUIDPk, Base):
    __tablename__ = "configurator_zones"
    __table_args__ = (UniqueConstraint("model_id", "key"),)

    model_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("configurator_models.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str] = str_col(60, nullable=False)
    label: Mapped[str] = str_col(150, nullable=False)  # libellé sans jargon (« Sol du salon »)
    room: Mapped[str | None] = str_col(80)
    category_key: Mapped[str] = str_col(40, nullable=False)
    mesh_names: Mapped[list[Any]] = json_col(list)
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit: Mapped[str] = str_col(20, nullable=False, default="m2")
    default_material_id: Mapped[uuid.UUID | None] = fk("materials.id")
    allowed_material_ids: Mapped[list[Any]] = json_col(list)  # vide = toute la catégorie
    planning_task_id: Mapped[uuid.UUID | None] = fk("tasks.id")  # calcul d'impact délai
    sort_order: Mapped[int] = int_col(0)


class Scenario(UUIDPk, Timestamps, Base):
    __tablename__ = "configurator_scenarios"

    model_id: Mapped[uuid.UUID] = fk("configurator_models.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    name: Mapped[str] = str_col(150, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = fk("users.id")
    status: Mapped[str] = str_col(
        20, nullable=False, default="draft"
    )  # draft / submitted / validated / locked / rejected / superseded
    revision: Mapped[int] = int_col(1)
    base_total: Mapped[Decimal] = money_col()
    scenario_total: Mapped[Decimal] = money_col()
    price_delta: Mapped[Decimal] = money_col()
    delay_delta_days: Mapped[int] = int_col(0)
    computed_at: Mapped[datetime | None] = dt_col()
    decision_id: Mapped[uuid.UUID | None] = fk("decisions.id")
    change_order_id: Mapped[uuid.UUID | None] = fk("change_orders.id")
    snapshot_file_id: Mapped[uuid.UUID | None] = fk("stored_files.id")
    locked_at: Mapped[datetime | None] = dt_col()
    notes: Mapped[str | None] = text_col()

    items: Mapped[list[ScenarioItem]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class ScenarioItem(UUIDPk, Base):
    __tablename__ = "configurator_scenario_items"
    __table_args__ = (UniqueConstraint("scenario_id", "zone_id"),)

    scenario_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("configurator_scenarios.id", ondelete="CASCADE"), index=True
    )
    zone_id: Mapped[uuid.UUID] = fk("configurator_zones.id", nullable=False, ondelete="CASCADE")
    material_id: Mapped[uuid.UUID] = fk("materials.id", nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False, default=Decimal("1"))
    unit_price: Mapped[Decimal] = money_col()
    line_total: Mapped[Decimal] = money_col()
    default_line_total: Mapped[Decimal] = money_col()
    delta: Mapped[Decimal] = money_col()
    delay_days: Mapped[int] = int_col(0)


__all__ = ["ConfiguratorModel", "ConfiguratorZone", "Material", "MaterialCategory", "Scenario", "ScenarioItem"]
