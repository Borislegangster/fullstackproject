"""Offre « énergie & confort » (innovation I3) : études de simulation (isolation, protections solaires, solaire
photovoltaïque, batterie) enregistrées par projet ou par prospect."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Mapped

from app.core.database import Base, Timestamps, UUIDPk, fk, json_col, str_col


class EnergyStudy(UUIDPk, Timestamps, Base):
    __tablename__ = "energy_studies"

    project_id: Mapped[uuid.UUID | None] = fk("projects.id", ondelete="CASCADE")
    user_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    title: Mapped[str] = str_col(200, nullable=False, default="Étude énergie & confort")
    inputs: Mapped[dict[str, Any]] = json_col(dict)
    results: Mapped[dict[str, Any]] = json_col(dict)
    status: Mapped[str] = str_col(20, nullable=False, default="draft")  # draft / requested / quoted


__all__ = ["EnergyStudy"]
