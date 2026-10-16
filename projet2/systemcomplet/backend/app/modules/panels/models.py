"""Panneau de chantier connecté (innovation I4) : le panneau réglementaire posé sur la clôture porte un QR code qui
ouvre la page publique du chantier — avancement, photos choisies, horaires, recrutement local, contact riverains."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, Timestamps, UUIDPk, bool_col, dt_col, fk, int_col, json_col, str_col, text_col

MESSAGE_KINDS = ("info", "devis", "riverain", "candidature")


class SitePanel(UUIDPk, Timestamps, Base):
    __tablename__ = "site_panels"
    __table_args__ = (UniqueConstraint("project_id"),)

    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE", index=False)
    slug: Mapped[str] = str_col(80, nullable=False, unique=True)
    enabled: Mapped[bool] = bool_col(False)
    title: Mapped[str] = str_col(250, nullable=False)
    location_label: Mapped[str | None] = str_col(200)  # quartier / ville — jamais l'adresse exacte par défaut
    owner_label: Mapped[str | None] = str_col(200)  # maître d'ouvrage tel qu'affiché (avec l'accord du client)
    contractor_label: Mapped[str] = str_col(200, nullable=False, default="GLOBUS ENGINEERING")
    permit_number: Mapped[str | None] = str_col(80)
    permit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    permit_authority: Mapped[str | None] = str_col(200)
    works_description: Mapped[str | None] = text_col()
    working_hours: Mapped[str | None] = str_col(200)
    contact_phone: Mapped[str | None] = str_col(30)
    show_progress: Mapped[bool] = bool_col(True)
    show_milestones: Mapped[bool] = bool_col(True)
    show_photos: Mapped[bool] = bool_col(True)
    photos: Mapped[list[Any]] = json_col(list)  # [{site_media_id, media_id}] — copies publiques sans métadonnées
    hiring_open: Mapped[bool] = bool_col(False)
    hiring_text: Mapped[str | None] = text_col()
    views: Mapped[int] = int_col(0)
    scans: Mapped[int] = int_col(0)
    last_scan_at: Mapped[datetime | None] = dt_col()
    updated_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)


class SitePanelMessage(UUIDPk, Timestamps, Base):
    """Message laissé depuis la page du chantier : demande d'information, devis, riverain, candidature."""

    __tablename__ = "site_panel_messages"

    panel_id: Mapped[uuid.UUID] = fk("site_panels.id", nullable=False, ondelete="CASCADE")
    project_id: Mapped[uuid.UUID] = fk("projects.id", nullable=False, ondelete="CASCADE")
    kind: Mapped[str] = str_col(20, nullable=False)  # info / devis / riverain / candidature
    name: Mapped[str] = str_col(150, nullable=False)
    phone: Mapped[str | None] = str_col(30)
    email: Mapped[str | None] = str_col(254)
    message: Mapped[str] = text_col(nullable=False)
    status: Mapped[str] = str_col(20, nullable=False, default="new")  # new / handled
    lead_id: Mapped[uuid.UUID | None] = fk("leads.id")
    ip_hash: Mapped[str | None] = str_col(64)
    handled_by_id: Mapped[uuid.UUID | None] = fk("users.id", index=False)
    handled_at: Mapped[datetime | None] = dt_col()
    handling_note: Mapped[str | None] = text_col()


__all__ = ["MESSAGE_KINDS", "SitePanel", "SitePanelMessage"]
