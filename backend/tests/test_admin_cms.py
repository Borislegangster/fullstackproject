"""Phase 10 — Admin CMS editors round-trip + RBAC.

Proves that the existing admin CRUD fully covers the content types whose
editors were wired in Phase 10:
  - Site settings → hero-video / cta-banner / video-section (singleton).
  - Projects → is_ongoing + ongoing_description + progression (detail page).
  - Services → process_steps + faq + benefits (detail page).
And that these admin endpoints are admin-only (RBAC).
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module", autouse=True)
def ensure_singletons(app_fixture):
    """Guarantee a CMSSiteSettings + CMSAboutContent row exists (PUT needs them)."""
    from app.database import AsyncSessionLocal
    from app.models.cms import CMSSiteSettings, CMSAboutContent
    from sqlalchemy import select

    async def _seed():
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(CMSSiteSettings).limit(1))
            if not r.scalars().first():
                db.add(CMSSiteSettings(id="settings-admin-test", company_name="Globus"))
            r2 = await db.execute(select(CMSAboutContent).limit(1))
            if not r2.scalars().first():
                db.add(CMSAboutContent(id="about-admin-test", title="À propos"))
            await db.commit()

    asyncio.run(_seed())


# ── Settings → hero-video / cta-banner / video-section ───────

def test_settings_video_cta_roundtrip(client: TestClient, admin_headers):
    payload = {
        "hero_video_src": "https://cdn/hero.mp4",
        "hero_video_poster": "https://cdn/hero.jpg",
        "cta_title": "Prêt à construire ?",
        "cta_subtitle": "Parlons de votre projet",
        "cta_text": "Devis gratuit",
        "cta_href": "#contact",
        "video_section_title": "Notre savoir-faire",
        "video_section_subtitle": "En coulisses",
        "video_section_youtube_url": "https://youtube/embed/abc",
        "video_section_bg_video_src": "https://cdn/bg.mp4",
        "video_section_bg_video_poster": "https://cdn/bg.jpg",
    }
    r = client.put("/api/v1/admin/cms/settings", headers=admin_headers, json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True

    # Public endpoints must now reflect the admin edit (no separate model).
    hv = client.get("/api/v1/cms/hero-video").json()
    assert hv["src"] == "https://cdn/hero.mp4"
    assert hv["poster"] == "https://cdn/hero.jpg"

    cta = client.get("/api/v1/cms/cta-banner").json()
    assert cta["title"] == "Prêt à construire ?"
    assert cta["ctaText"] == "Devis gratuit"
    assert cta["ctaHref"] == "#contact"

    vs = client.get("/api/v1/cms/video-section").json()
    assert vs["title"] == "Notre savoir-faire"
    assert vs["youtubeUrl"] == "https://youtube/embed/abc"
    assert vs["backgroundVideoSrc"] == "https://cdn/bg.mp4"


# ── Project → ongoing + progression detail ───────────────────

def test_project_ongoing_and_progression_roundtrip(client: TestClient, admin_headers):
    create = client.post(
        "/api/v1/admin/cms/projects",
        headers=admin_headers,
        json={
            "title": "Tour Admin Test", "slug": "tour-admin-test",
            "category": "Commercial", "status": "En Cours",
            "location": "Douala", "client_name": "ACME", "area": "5000 m2",
            "duration": "20 mois", "architect": "Cabinet Z",
            "description": "desc", "images": ["https://i/1.jpg"],
            "challenge": "ch", "solution": "sol", "video_url": "https://youtube/p",
            "progress": 40, "is_published": True,
            "is_ongoing": True, "ongoing_description": "Chantier phare en cours",
            "progression": [
                {"step": "Fondations", "status": "validé", "date": "Jan 2024"},
                {"step": "Élévation", "status": "en-cours", "date": "Mars 2024"},
                {"step": "Finitions", "status": "à-venir"},
            ],
        },
    )
    assert create.status_code == 200, create.text

    # Ongoing project endpoint picks the latest is_ongoing project.
    ongoing = client.get("/api/v1/cms/ongoing-project").json()
    assert ongoing["slug"] == "tour-admin-test"
    assert ongoing["description"] == "Chantier phare en cours"
    assert ongoing["progress"] == 40

    # Detail page exposes the full progression timeline.
    detail = client.get("/api/v1/cms/projects/tour-admin-test").json()
    assert len(detail["progression"]) == 3
    assert detail["progression"][0]["step"] == "Fondations"
    assert detail["progression"][1]["status"] == "en-cours"

    # Update the progression via PUT and re-read.
    pid = create.json()["id"]
    upd = client.put(
        f"/api/v1/admin/cms/projects/{pid}",
        headers=admin_headers,
        json={"progression": [{"step": "Livraison", "status": "validé", "date": "Mai 2024"}]},
    )
    assert upd.status_code == 200, upd.text
    detail2 = client.get("/api/v1/cms/projects/tour-admin-test").json()
    assert len(detail2["progression"]) == 1
    assert detail2["progression"][0]["step"] == "Livraison"


# ── Service → process_steps + faq + benefits detail ──────────

def test_service_detail_roundtrip(client: TestClient, admin_headers):
    create = client.post(
        "/api/v1/admin/cms/services",
        headers=admin_headers,
        json={
            "title": "Service Admin Test", "slug": "service-admin-test",
            "subtitle": "Sub", "desc": "court", "icon_key": "BuildingIcon",
            "image": "https://i/s.jpg", "images": ["https://i/s.jpg"],
            "details": "détails complets", "related_category": "Commercial",
            "benefits": ["Avantage 1", "Avantage 2"],
            "process_steps": [
                {"title": "Étude", "desc": "analyse", "iconKey": "ClipboardListIcon"},
                {"title": "Exécution", "desc": "chantier", "iconKey": "HardHatIcon"},
            ],
            "faq": [
                {"q": "Combien de temps ?", "a": "10 à 18 mois."},
                {"q": "Garanties ?", "a": "Décennale incluse."},
            ],
            "is_published": True,
        },
    )
    assert create.status_code == 200, create.text

    detail = client.get("/api/v1/cms/services/service-admin-test").json()
    assert detail["relatedCategory"] == "Commercial"
    assert detail["benefits"] == ["Avantage 1", "Avantage 2"]
    assert len(detail["processSteps"]) == 2
    assert detail["processSteps"][0]["title"] == "Étude"
    assert detail["processSteps"][1]["iconKey"] == "HardHatIcon"
    assert len(detail["faq"]) == 2
    assert detail["faq"][0]["q"] == "Combien de temps ?"

    # PUT update of process_steps + faq.
    sid = create.json()["id"]
    upd = client.put(
        f"/api/v1/admin/cms/services/{sid}",
        headers=admin_headers,
        json={
            "process_steps": [{"title": "Unique", "desc": "d", "iconKey": "KeyIcon"}],
            "faq": [{"q": "Q1", "a": "A1"}],
        },
    )
    assert upd.status_code == 200, upd.text
    detail2 = client.get("/api/v1/cms/services/service-admin-test").json()
    assert len(detail2["processSteps"]) == 1
    assert detail2["processSteps"][0]["title"] == "Unique"
    assert len(detail2["faq"]) == 1


# ── Unknown slug → 404 (no silent fallback) ──────────────────

def test_detail_unknown_slug_404(client: TestClient):
    assert client.get("/api/v1/cms/services/ghost-service").status_code == 404
    assert client.get("/api/v1/cms/projects/ghost-project").status_code == 404


# ── RBAC ─────────────────────────────────────────────────────

def test_admin_cms_requires_admin(client: TestClient, client_headers):
    """A CLIENT token must not be able to mutate CMS content."""
    assert client.put("/api/v1/admin/cms/settings", headers=client_headers,
                      json={"cta_title": "hack"}).status_code == 403
    assert client.post("/api/v1/admin/cms/projects", headers=client_headers,
                       json={"title": "Hack"}).status_code == 403
    assert client.post("/api/v1/admin/cms/services", headers=client_headers,
                       json={"title": "Hack"}).status_code == 403


def test_admin_cms_requires_auth(client: TestClient):
    assert client.get("/api/v1/admin/cms/settings").status_code in (401, 403)
    assert client.put("/api/v1/admin/cms/settings", json={"cta_title": "x"}).status_code in (401, 403)
