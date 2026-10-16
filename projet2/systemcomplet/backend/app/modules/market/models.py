"""Achats prédictifs (innovation A3) : observations de prix des matériaux (catalogues et historiques fournisseurs,
bons de commande, factures) normalisées par famille, et recommandations d'achat anticipé."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Date, Index, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Quantity, Timestamps, UUIDPk, dt_col, fk, json_col, money_col, str_col, text_col
from app.core.utils import utcnow


class PriceObservation(UUIDPk, Base):
    __tablename__ = "price_observations"
    __table_args__ = (
        UniqueConstraint("source_type", "source_id"),
        Index("ix_price_observations_family_date", "family", "observed_on"),
    )

    family: Mapped[str] = str_col(40, nullable=False)  # clé du panier (ciment, fer_ha10…)
    label: Mapped[str] = str_col(300, nullable=False)  # désignation d'origine
    unit: Mapped[str] = str_col(20, nullable=False)  # unité de référence de la famille
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)  # prix ramené à l'unité de référence
    raw_unit: Mapped[str] = str_col(20, nullable=False)
    raw_price: Mapped[Decimal] = money_col()
    currency: Mapped[str] = str_col(3, nullable=False, default="XAF")
    observed_on: Mapped[date] = mapped_column(Date, nullable=False)
    supplier_id: Mapped[uuid.UUID | None] = fk("suppliers.id")
    project_id: Mapped[uuid.UUID | None] = fk("projects.id")
    source_type: Mapped[str] = str_col(20, nullable=False)  # catalog / price_history / po / invoice
    source_id: Mapped[str] = str_col(80, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class PurchaseRecommendation(UUIDPk, Timestamps, Base):
    __tablename__ = "purchase_recommendations"

    family: Mapped[str] = str_col(40, nullable=False, index=True)
    label: Mapped[str] = str_col(200, nullable=False)
    unit: Mapped[str] = str_col(20, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Quantity, nullable=False)
    current_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    forecast_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    trend_pct: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False)  # variation prévue à 4 semaines
    expected_saving: Mapped[Decimal] = money_col()
    project_ids: Mapped[list[Any]] = json_col(list)
    request_line_ids: Mapped[list[Any]] = json_col(list)
    stock_item_ids: Mapped[list[Any]] = json_col(list)
    reason: Mapped[str] = text_col(nullable=False)
    status: Mapped[str] = str_col(
        20, nullable=False, default="open", index=True
    )  # open / accepted / dismissed / expired
    decided_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    decided_at: Mapped[datetime | None] = dt_col()
    decision_note: Mapped[str | None] = text_col()


__all__ = ["PriceObservation", "PurchaseRecommendation"]
