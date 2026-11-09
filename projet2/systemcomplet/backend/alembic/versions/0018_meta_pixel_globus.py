"""Site web : pixel Meta (Facebook) de GLOBUS ENGINEERING enregistré dans les réglages du site de production.

Le pixel est chargé par la vitrine seulement après l'accord du visiteur pour les cookies marketing (bandeau de
consentement), comme les autres balises tierces. L'identifiant apparaît dans Site web › Contenus (CMS) › Réglages
du site › Pixel Meta, où il reste modifiable.

Seul le site de production le reçoit (les bases de développement et de test n'envoient rien au compte Meta de
GLOBUS) ; un identifiant déjà saisi n'est jamais remplacé, et le retour arrière ne retire rien.

Revision ID: 0018
Revises: 0017
"""

from __future__ import annotations

import json
import os
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

META_PIXEL_ID = "1105423749001867"


def _production() -> bool:
    try:
        from app.core.config import settings

        return settings.ENV == "production"
    except Exception:  # noqa: BLE001 — migration lancée hors de l'application : variable d'environnement
        return os.environ.get("ENV") == "production"


def upgrade() -> None:
    if not _production():
        return
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, tracking FROM cms_site_settings")).all()
    update = sa.text(
        "UPDATE cms_site_settings SET tracking = CAST(:tracking AS jsonb), updated_at = now() WHERE id = :id"
    )
    for row_id, tracking in rows:
        current = dict(tracking or {}) if isinstance(tracking, dict) else {}
        if current.get("meta_pixel"):
            continue
        current["meta_pixel"] = META_PIXEL_ID
        bind.execute(update, {"id": row_id, "tracking": json.dumps(current)})


def downgrade() -> None:
    """Sans effet : rien ne distingue l'identifiant posé ici d'un identifiant saisi par l'équipe (le même, ou
    ressaisi depuis) ; un retour arrière ne doit pas effacer un réglage. Le pixel se retire depuis l'ERP."""
