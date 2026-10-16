"""Seeders : contenu éditorial (aucune donnée inventée, idempotent) et jeu de démonstration complet."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select

from tests.conftest import make_user


def test_editorial_content_is_idempotent_and_contains_no_invented_data(client: Any, db: Any) -> None:
    from app.modules.cms import models as m
    from app.seeds.content import seed_content

    make_user(db, roles=["ADMIN"])
    first = seed_content(db, publish=True)
    assert first["universes"] == 5 and first["pages"] >= 10 and first["offers"] >= 10
    second = seed_content(db, publish=True)
    assert all(count == 0 for count in second.values()), "idempotent"
    for model in (m.KeyFigure, m.Testimonial, m.PortfolioProject):
        assert db.execute(select(func.count()).select_from(model)).scalar_one() == 0, model.__name__
    # seuls médias versés : le logo officiel et l'icône de la plateforme (marque), distincts et référencés par les
    # réglages du site (V4-MEDIA-07)
    assets = db.execute(select(m.MediaAsset)).scalars().all()
    assert sorted(a.folder for a in assets) == ["marque", "marque"]
    by_name = {a.original_name: a.id for a in assets}
    assert set(by_name) == {"logo-globus.png", "icon-globus.png"}
    site = db.execute(select(m.SiteSettings)).scalars().first()
    if site is not None:
        assert site.logo_media_id == by_name["logo-globus.png"]
        assert site.favicon_media_id == by_name["icon-globus.png"]
    home = client.get("/api/v1/public/pages/home")
    assert home.status_code == 200, home.text
    assert home.json()["title"] == "Accueil"
    universes = client.get("/api/v1/public/universes").json()
    assert {u["key"] for u in (universes["items"] if isinstance(universes, dict) else universes)} == {
        "HOME",
        "BUSINESS",
        "PREMIUM",
        "DIASPORA",
        "ENGINEERING",
    }


def test_demo_dataset_loads(client: Any, db: Any) -> None:
    from app.modules.billing.models import SupplierInvoice
    from app.modules.projects.models import Project
    from app.modules.subcontracting.models import Situation
    from app.seeds.demo import seed_all

    result = seed_all(db)
    assert len(result["projects"]) == 3
    assert db.execute(select(func.count()).select_from(Project)).scalar_one() >= 3
    assert db.execute(select(SupplierInvoice.status)).scalars().first() == "approved_for_payment"
    assert db.execute(select(Situation.status)).scalars().first() == "submitted"
    login = client.post("/api/v1/auth/login", json={"email": "client@globus.demo", "password": "Globus!Demo2026"})
    assert login.status_code == 200, login.text
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    projects = client.get("/api/v1/client/projects", headers=headers).json()
    assert any("Villa Nguema" in p["name"] for p in projects)
    villa = next(p for p in projects if "Villa Nguema" in p["name"])
    building = client.get(f"/api/v1/client/projects/{villa['id']}/building", headers=headers).json()
    assert len(building["equipment"]) == 4 and building["tasks"]
    escrow = client.get(f"/api/v1/client/projects/{villa['id']}/escrow", headers=headers).json()
    assert escrow["account"]["status"] == "pending_partner"
    assert len(client.get("/api/v1/public/financing/partners").json()) == 3
