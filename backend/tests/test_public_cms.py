"""Phase 9 — Public CMS endpoints.

Validates that every public `/cms/*` GET serves real DB content (no more
frontend mock fallback) and that the public form POSTs work. A module-scoped
fixture seeds a minimal-but-representative CMS dataset honouring the service
filters (is_active / is_published / is_ongoing / status == "published").
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module", autouse=True)
def seed_cms(app_fixture):
    """Insert one representative row per CMS content type."""
    from app.database import AsyncSessionLocal
    from app.models.cms import (
        CMSSiteSettings, CMSHeroSlide, CMSEngagement, CMSMethodologyStep,
        CMSStat, CMSGuarantee, CMSService, CMSProject, CMSBlogPost,
        CMSTeamMember, CMSPartner, CMSTestimonial, CMSFaqCategory, CMSFaqItem,
        CMSLegalPage, CMSAboutContent,
    )
    from sqlalchemy import select

    async def _seed():
        async with AsyncSessionLocal() as db:
            # Idempotency guard keyed on THIS module's own marker (the
            # "construction" service) so it always seeds regardless of other
            # modules that may have created a CMSSiteSettings row first.
            existing = await db.execute(select(CMSService).where(CMSService.slug == "construction"))
            if existing.scalars().first():
                return

            # Settings is a singleton — upsert so there's exactly one row with
            # the values this module asserts on (another module may have created
            # a bare settings row already).
            sr = await db.execute(select(CMSSiteSettings).limit(1))
            settings = sr.scalars().first()
            settings_values = dict(
                company_name="Globus Test",
                hero_video_src="https://v/x.mp4", hero_video_poster="https://i/x.jpg",
                cta_title="CTA Titre", cta_subtitle="CTA Sous-titre",
                cta_text="Contactez", cta_href="#contact",
                video_section_title="Vidéo", video_section_subtitle="Notre promesse",
                video_section_youtube_url="https://youtube/x",
                video_section_bg_video_src="https://v/bg.mp4",
                video_section_bg_video_poster="https://i/bg.jpg",
                contact_address="Douala", contact_phone="+237600", contact_email="c@g.cm",
                contact_whatsapp="+237600", contact_map_embed_url="https://maps", contact_hours="Lun-Ven",
            )
            if settings:
                for k, v in settings_values.items():
                    setattr(settings, k, v)
            else:
                db.add(CMSSiteSettings(id="settings-test", **settings_values))
            db.add(CMSAboutContent(
                id="about-test", section_tag="Tag", title="À propos",
                paragraphs=["p1"], highlights=["h1"], cta_text="Plus", cta_href="#s",
                images=["https://i/a.jpg"], badge_value="15+", badge_label="ans",
                hero_image="https://i/hero.jpg", hero_title="Qui sommes-nous",
                mission="m", vision="v", values=[{"title": "V", "desc": "d", "iconKey": "X"}],
                certifications=["ISO"], timeline=[],
            ))
            db.add(CMSHeroSlide(
                id="slide-test", tag="Tag", title="Titre", subtitle="Sub",
                image="https://i/s.jpg", cta1_text="A", cta1_href="#a",
                cta2_text="B", cta2_href="#b", is_active=True, sort_order=0,
            ))
            db.add(CMSEngagement(id="eng-test", icon_key="HardHatIcon", title="Eng",
                                 desc="d", bg_color="bg", text_color="tc", sort_order=0))
            db.add(CMSMethodologyStep(id="m-test", icon_key="KeyIcon", title="Step",
                                      desc="d", image="https://i/m.jpg", sort_order=0))
            db.add(CMSStat(id="stat-test", value=50, suffix="+", label="Projets", sort_order=0))
            db.add(CMSGuarantee(id="g-test", icon_key="AwardIcon", title="Garantie", desc="d", sort_order=0))
            db.add(CMSService(
                id="svc-test", slug="construction", title="Construction", subtitle="Sub",
                desc="d", icon_key="BuildingIcon", image="https://i/svc.jpg",
                images=["https://i/svc.jpg"], details="det", benefits=["b1"],
                related_category="Résidentiel", process_steps=[{"title": "T", "desc": "d", "iconKey": "X"}],
                faq=[{"q": "q", "a": "a"}], is_published=True, sort_order=0,
            ))
            db.add(CMSProject(
                id="prj-test", slug="villa-test", title="Villa Test", category="Résidentiel",
                status="En Cours", location="Douala", client_name="Privé", area="450 m2",
                duration="14 mois", architect="Cabinet", description="desc",
                images=["https://i/p.jpg"], challenge="ch", solution="sol",
                video_url="https://youtube/p", progression=[{"step": "S", "status": "validé", "date": "2024"}],
                progress=65, is_published=True, is_ongoing=True,
                ongoing_description="En cours desc", sort_order=0,
            ))
            db.add(CMSBlogPost(
                id="blog-test", slug="article-test", title="Article Test", category="Conseils",
                excerpt="ex", image="https://i/b.jpg", author="Auteur", read_time="5 min",
                html_content="<p>contenu</p>", status="published", featured=True,
            ))
            db.add(CMSTeamMember(id="t-test", name="Jean", role="DG", quote="q",
                                 image_class="from-x", photo="https://i/t.jpg", sort_order=0))
            db.add(CMSPartner(id="p-test", name="CIMENCAM", sort_order=0))
            db.add(CMSTestimonial(id="tm-test", name="Client", project="Villa", text="Super",
                                  rating=5, photo="https://i/c.jpg", is_published=True, sort_order=0))
            cat = CMSFaqCategory(id="cat-test", name="Général", sort_order=0)
            db.add(cat)
            db.add(CMSFaqItem(id="fi-test", category_id="cat-test", question="Q?", answer="A.", sort_order=0))
            db.add(CMSLegalPage(id="legal-test", slug="mentions-legales", title="Mentions légales",
                                last_updated="2026-01-01",
                                sections=[{"title": "Éditeur", "content": "contenu légal"}]))
            await db.commit()

    asyncio.run(_seed())


# ── List endpoints ───────────────────────────────────────────

LIST_ENDPOINTS = [
    "/api/v1/cms/hero-slides",
    "/api/v1/cms/engagements",
    "/api/v1/cms/methodology",
    "/api/v1/cms/stats",
    "/api/v1/cms/services",
    "/api/v1/cms/projects",
    "/api/v1/cms/guarantees",
    "/api/v1/cms/team",
    "/api/v1/cms/partners",
    "/api/v1/cms/testimonials",
    "/api/v1/cms/faq-home",
    "/api/v1/cms/blog/latest",
    "/api/v1/cms/services-page",
    "/api/v1/cms/projects-page",
    "/api/v1/cms/blog",
    "/api/v1/cms/faq",
]


@pytest.mark.parametrize("endpoint", LIST_ENDPOINTS)
def test_list_endpoints_return_seeded_content(client: TestClient, endpoint):
    r = client.get(endpoint)
    assert r.status_code == 200, f"{endpoint} → {r.status_code}: {r.text}"
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1, f"{endpoint} returned an empty list — seed missing"


# ── Singleton endpoints ──────────────────────────────────────

def test_hero_video(client: TestClient):
    r = client.get("/api/v1/cms/hero-video")
    assert r.status_code == 200
    assert r.json()["src"].endswith(".mp4")


def test_cta_banner(client: TestClient):
    r = client.get("/api/v1/cms/cta-banner")
    assert r.status_code == 200
    assert r.json()["title"] == "CTA Titre"


def test_video_section(client: TestClient):
    r = client.get("/api/v1/cms/video-section")
    assert r.status_code == 200
    assert r.json()["subtitle"] == "Notre promesse"


def test_ongoing_project(client: TestClient):
    r = client.get("/api/v1/cms/ongoing-project")
    assert r.status_code == 200
    body = r.json()
    # Shared session DB may hold several is_ongoing projects (other modules
    # seed their own) — assert the structure, not a specific slug.
    assert body["slug"]
    assert isinstance(body["progress"], int)
    assert isinstance(body["images"], list)


def test_settings_and_about(client: TestClient):
    assert client.get("/api/v1/cms/settings").status_code == 200
    assert client.get("/api/v1/cms/about").status_code == 200
    assert client.get("/api/v1/cms/about-page").status_code == 200
    assert client.get("/api/v1/cms/contact").status_code == 200


# ── Slug detail endpoints ────────────────────────────────────

def test_service_by_slug(client: TestClient):
    r = client.get("/api/v1/cms/services/construction")
    assert r.status_code == 200
    assert r.json()["slug"] == "construction"


def test_project_by_slug(client: TestClient):
    r = client.get("/api/v1/cms/projects/villa-test")
    assert r.status_code == 200
    assert r.json()["title"] == "Villa Test"


def test_blog_by_slug(client: TestClient):
    r = client.get("/api/v1/cms/blog/article-test")
    assert r.status_code == 200
    body = r.json()
    # The public blog item exposes the slug as `id` (used by the front router).
    assert body["id"] == "article-test"
    assert body["title"] == "Article Test"


def test_legal_by_slug(client: TestClient):
    r = client.get("/api/v1/cms/legal/mentions-legales")
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "mentions-legales"
    assert body["sections"][0]["content"] == "contenu légal"


def test_unknown_slug_returns_404(client: TestClient):
    """No silent mock fallback — an unknown slug must 404."""
    assert client.get("/api/v1/cms/services/does-not-exist").status_code == 404
    assert client.get("/api/v1/cms/projects/does-not-exist").status_code == 404
    assert client.get("/api/v1/cms/blog/does-not-exist").status_code == 404


# ── Public form submissions ──────────────────────────────────

def test_contact_form_submit(client: TestClient):
    r = client.post("/api/v1/cms/contact/submit", json={
        "name": "Jean Test", "email": "jean.test@example.com",
        "phone": "+237600000000", "subject": "Devis",
        "message": "Je souhaite un devis pour une villa.",
    })
    assert r.status_code == 200, r.text
    assert r.json().get("success") is True


def test_newsletter_subscribe(client: TestClient):
    r = client.post("/api/v1/cms/newsletter/subscribe", json={"email": "news@example.com"})
    assert r.status_code == 200, r.text
    assert r.json().get("success") is True
