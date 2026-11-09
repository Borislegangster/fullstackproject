"""Migration 0018 : pixel Meta de GLOBUS enregistré dans les réglages du site, en production uniquement, sans jamais
remplacer un identifiant déjà saisi ni l'effacer au retour arrière ; publié tel quel par l'API publique du site."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any

from sqlalchemy import select

MIGRATION = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "0018_meta_pixel_globus.py"


def _run(db: Any, step: str) -> None:
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    spec = importlib.util.spec_from_file_location("migration_0018", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    with Operations.context(MigrationContext.configure(db.connection())):
        getattr(module, step)()


def _site(db: Any, tracking: dict[str, Any]) -> Any:
    from app.modules.cms.models import SiteSettings

    site = db.execute(select(SiteSettings)).scalars().first() or SiteSettings(company_name="GLOBUS ENGINEERING")
    site.tracking = tracking
    db.add(site)
    db.commit()
    return site


def test_meta_pixel_set_in_production_only(client: Any, db: Any, monkeypatch: Any) -> None:
    from app.core.config import settings

    site = _site(db, {"ga4_id": "G-ABC123"})
    _run(db, "upgrade")  # base de test : rien n'est envoyé au compte Meta de GLOBUS
    db.refresh(site)
    assert site.tracking == {"ga4_id": "G-ABC123"}

    monkeypatch.setattr(settings, "ENV", "production")
    _run(db, "upgrade")
    db.commit()
    db.refresh(site)
    assert site.tracking == {"ga4_id": "G-ABC123", "meta_pixel": "1105423749001867"}
    public = client.get("/api/v1/public/site").json()
    assert public["tracking"]["meta_pixel"] == "1105423749001867", "la vitrine reçoit le pixel"

    _run(db, "downgrade")  # un retour arrière n'efface jamais un réglage (rien ne distingue un identifiant saisi)
    db.commit()
    db.refresh(site)
    assert site.tracking == {"ga4_id": "G-ABC123", "meta_pixel": "1105423749001867"}


def test_meta_pixel_never_replaces_an_existing_id(db: Any, monkeypatch: Any) -> None:
    from app.core.config import settings

    site = _site(db, {"meta_pixel": "999999999"})
    monkeypatch.setattr(settings, "ENV", "production")
    _run(db, "upgrade")
    _run(db, "downgrade")
    db.commit()
    db.refresh(site)
    assert site.tracking == {"meta_pixel": "999999999"}
