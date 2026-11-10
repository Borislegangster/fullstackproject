"""Géolocalisation : continent des sessions de la vitrine et lieu détecté des prospects.

- analytics_sessions.continent (AF / EU / NA / SA / AS / OC / AN), à côté du pays, de la région et de la ville ;
- leads.geo_country / geo_region / geo_city / geo_continent / geo_source : lieu détecté à l'envoi de la demande
  (adresse IP, jamais conservée, sinon indicatif téléphonique), distinct du pays de résidence déclaré.

Les prospects existants reçoivent le pays déduit de leur indicatif téléphonique international quand il est connu,
et le marquage « diaspora » est recalculé pour ceux qui n'ont pas déclaré de pays.

Revision ID: 0019
Revises: 0018
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0019"
down_revision: str | None = "0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("analytics_sessions", sa.Column("continent", sa.String(length=2), nullable=True))
    op.add_column("leads", sa.Column("geo_country", sa.String(length=2), nullable=True))
    op.add_column("leads", sa.Column("geo_region", sa.String(length=100), nullable=True))
    op.add_column("leads", sa.Column("geo_city", sa.String(length=100), nullable=True))
    op.add_column("leads", sa.Column("geo_continent", sa.String(length=2), nullable=True))
    op.add_column("leads", sa.Column("geo_source", sa.String(length=10), nullable=True))
    op.create_index(op.f("ix_leads_geo_country"), "leads", ["geo_country"], unique=False)

    from app.core.geoip import from_phone

    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT id, phone, whatsapp, country FROM leads WHERE geo_country IS NULL AND deleted_at IS NULL")
    ).all()
    update = sa.text(
        "UPDATE leads SET geo_country = :country, geo_continent = :continent, geo_source = 'phone', "
        "is_diaspora = CASE WHEN coalesce(trim(country), '') = '' THEN :abroad ELSE is_diaspora END WHERE id = :id"
    )
    for row_id, phone, whatsapp, _country in rows:
        geo = from_phone(phone) or from_phone(whatsapp)
        if geo is None:
            continue
        bind.execute(
            update, {"id": row_id, "country": geo.country, "continent": geo.continent, "abroad": bool(geo.is_abroad)}
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_geo_country"), table_name="leads")
    for column in ("geo_source", "geo_continent", "geo_city", "geo_region", "geo_country"):
        op.drop_column("leads", column)
    op.drop_column("analytics_sessions", "continent")
