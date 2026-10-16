"""Lot 1 — CMS sans données fictives, médiathèque obligatoire, publication, SEO, CRM, newsletter, analytics.

Critères : V4-CMS-05/06, V4-MEDIA-07, V4-SEO-08/09, V4-CRM-38, V4-MAIL-37, V4-ANALYTICS-35/36.
"""

from __future__ import annotations

import io
import time
import uuid

from PIL import Image
from sqlalchemy import select

from tests.conftest import as_role, drain_outbox, make_user


def _png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (1200, 800), (56, 90, 166)).save(buf, format="PNG")
    return buf.getvalue()


def _upload(client, headers, name="hero.png") -> str:
    resp = client.post(
        "/api/v1/cms/media",
        headers=headers,
        files={"file": (name, _png(), "image/png")},
        data={"title": "Visuel", "alt_text": "Façade d'une villa", "folder": "hero"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _page_payload(media_id: str, path: str = "/", route_key: str = "home") -> dict:
    return {
        "route_key": route_key,
        "path": path,
        "title": "Accueil",
        "sections": [
            {
                "key": "hero",
                "blocks": [
                    {
                        "data": {
                            "kind": "hero",
                            "layout": "image",
                            "title": "Vous avez un projet. Nous maîtrisons sa réalisation.",
                            "subtitle": "Concevoir. Calculer. Construire. Contrôler.",
                            "media_id": media_id,
                            "ctas": [{"label": "Décrire mon projet", "href": "/decrire-mon-projet", "style": "accent"}],
                        }
                    }
                ],
            }
        ],
        "seo": {
            "title": "GLOBUS ENGINEERING — Concevoir. Calculer. Construire. Contrôler.",
            "description": "Bureau d'études et construction au Cameroun : de l'idée à l'ouvrage conçu, calculé, construit et contrôlé.",
            "og_image_media_id": media_id,
        },
    }


def test_empty_cms_returns_explicit_empty_state(client):
    assert client.get("/api/v1/public/pages/home").status_code == 404
    assert client.get("/api/v1/public/universes").json() == []
    assert client.get("/api/v1/public/projects").json()["items"] == []
    assert client.get("/api/v1/public/blog/posts").json()["items"] == []
    site = client.get("/api/v1/public/site").json()
    assert site["menus"] == {} and site["socials"] == [] and site["banners"] == []
    assert client.get("/api/v1/public/sitemap").json() == []


def test_media_library_is_mandatory(client, db):
    _, headers = as_role(client, db, "MARKETING")
    bad = _page_payload(str(uuid.uuid4()))
    resp = client.post("/api/v1/cms/pages", headers=headers, json=bad)
    assert resp.status_code == 400 and resp.json()["error"]["code"] == "MEDIA_NOT_FOUND"
    free_path = {
        "route_key": "about",
        "path": "/a-propos",
        "title": "À propos",
        "sections": [
            {"key": "txt", "blocks": [{"data": {"kind": "rich_text", "html": '<p><img src="/uploads/x.jpg"></p>'}}]}
        ],
    }
    resp = client.post("/api/v1/cms/pages", headers=headers, json=free_path)
    assert resp.status_code == 422
    media_id = _upload(client, headers)
    media = client.get(f"/api/v1/cms/media/{media_id}", headers=headers).json()
    assert media["checksum_sha256"] and media["width"] == 1200 and "thumb" in media["preview"]["variants"]
    img = client.get(f"/api/v1/public/media/{media_id}/thumb")
    assert img.status_code == 200 and img.headers["content-type"] == "image/webp"
    dup = client.post("/api/v1/cms/media", headers=headers, files={"file": ("copie.png", _png(), "image/png")})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "MEDIA_DUPLICATE"


def test_publication_workflow_and_seo(client, db):
    writer = make_user(db, roles=["MARKETING"])
    from tests.conftest import login

    headers = login(client, writer.email)
    media_id = _upload(client, headers)
    page = client.post("/api/v1/cms/pages", headers=headers, json=_page_payload(media_id)).json()
    assert page["status"] == "draft"
    assert client.get("/api/v1/public/pages/home").status_code == 404
    for target in ("in_review", "validated", "published"):
        r = client.post(f"/api/v1/cms/pages/{page['id']}/transition", headers=headers, json={"target": target})
        assert r.status_code == 200, r.text
    public = client.get("/api/v1/public/pages/home").json()
    hero = public["sections"][0]["blocks"][0]
    assert hero["media"]["variants"]["md"]["url"].startswith("/api/v1/public/media/")
    assert public["seo"]["og_image"]["id"] == media_id
    sitemap = client.get("/api/v1/public/sitemap").json()
    assert any(e["path"] == "/" for e in sitemap)
    robots = client.get("/api/v1/public/robots").json()
    assert "/erp" in robots["disallow"]
    # Un éditeur sans droit de publication ne peut pas modifier un contenu publié.
    _, editor = as_role(client, db, "CHEF_PROJET")
    resp = client.put(f"/api/v1/cms/pages/{page['id']}", headers=editor, json=_page_payload(media_id))
    assert resp.status_code == 403
    # Changement d'URL d'une page publiée → redirection 301 automatique.
    moved = _page_payload(media_id, path="/accueil")
    resp = client.put(f"/api/v1/cms/pages/{page['id']}", headers=headers, json=moved)
    assert resp.status_code == 200
    redirects = client.get("/api/v1/public/redirects").json()
    assert {"source": "/", "target": "/accueil", "status": 301} in redirects
    revisions = client.get(f"/api/v1/cms/revisions/page/{page['id']}", headers=headers).json()
    assert len(revisions) >= 4


def test_collections_offers_and_universe(client, db):
    _, headers = as_role(client, db, "MARKETING")
    universe = client.post(
        "/api/v1/cms/universes",
        headers=headers,
        json={
            "key": "DIASPORA",
            "slug": "diaspora",
            "name": "GLOBUS DIASPORA",
            "tagline": "Construire au Cameroun à distance avec confiance",
            "mechanism": "Confiance + Transparence + Contrôle",
        },
    )
    assert universe.status_code == 201, universe.text
    uid = universe.json()["id"]
    offer = client.post(
        "/api/v1/cms/offers",
        headers=headers,
        json={
            "universe_id": uid,
            "slug": "diaspora-control",
            "name": "Diaspora Control",
            "summary": "Suivez votre chantier depuis l'étranger.",
            "deliverables": ["Rapports hebdomadaires", "Photos géolocalisées"],
        },
    )
    assert offer.status_code == 201, offer.text
    for key, item_id in (("universes", uid), ("offers", offer.json()["id"])):
        r = client.post(
            f"/api/v1/cms/collections/{key}/{item_id}/transition", headers=headers, json={"target": "published"}
        )
        assert r.status_code == 200, r.text
    detail = client.get("/api/v1/public/universes/diaspora").json()
    assert detail["offers"][0]["path"] == "/offres/diaspora/diaspora-control"
    assert client.get("/api/v1/public/offers/diaspora-control").status_code == 200


def test_contact_form_creates_lead_with_consent_and_autoreply(client, db):
    from app.modules.crm.models import Lead
    from app.modules.notifications.models import NotificationDelivery

    commercial = make_user(db, roles=["COMMERCIAL"])
    form = client.get("/api/v1/public/forms/contact").json()
    payload = {
        "data": {
            "first_name": "Awa",
            "last_name": "Ngono",
            "email": "awa@example.com",
            "phone": "690112233",
            "subject": "Construction villa",
            "message": "Je souhaite construire une villa R+1 à Douala.",
        },
        "consents": {"contact": True, "marketing": False, "whatsapp": True},
        "utm": {"source": "facebook", "medium": "cpc"},
        "rendered_at": form["rendered_at"] - 10,
    }
    resp = client.post("/api/v1/public/forms/contact/submit", json=payload)
    assert resp.status_code == 201, resp.text
    lead = db.execute(select(Lead).where(Lead.email == "awa@example.com")).scalar_one()
    assert lead.consent_record_id and lead.assigned_to_id == commercial.id
    assert lead.response_due_at is not None and lead.phone == "+237690112233"
    assert lead.utm_source == "facebook"
    drain_outbox()
    deliveries = (
        db.execute(select(NotificationDelivery).where(NotificationDelivery.recipient == "awa@example.com"))
        .scalars()
        .all()
    )
    assert deliveries and deliveries[0].status == "sent"
    missing_consent = {**payload, "consents": {"contact": False}}
    assert client.post("/api/v1/public/forms/contact/submit", json=missing_consent).status_code == 400


def test_describe_project_brief_score_and_conversion_chain(client, db, admin_headers):
    resp = client.post(
        "/api/v1/public/describe-project",
        json={
            "universe": "HOME",
            "project_type": "construction_neuve",
            "project_location": "Yaoundé, Odza",
            "has_land": True,
            "land_status": "titre_foncier",
            "surface_m2": 220,
            "levels": 2,
            "rooms": 5,
            "budget_max": 85000000,
            "timeline": "3_months",
            "description": "Villa familiale avec piscine.",
            "first_name": "Paul",
            "last_name": "Mbarga",
            "email": "paul@example.com",
            "phone": "+237677000000",
            "country": "France",
            "consents": {"contact": True, "marketing": True},
            "rendered_at": int(time.time()) - 60,
        },
    )
    assert resp.status_code == 201, resp.text
    leads = client.get("/api/v1/crm/leads?q=paul@example.com", headers=admin_headers).json()["items"]
    lead = leads[0]
    assert lead["score"] >= 70 and lead["temperature"] == "hot" and lead["is_diaspora"] is True
    conv = client.post(f"/api/v1/crm/leads/{lead['id']}/convert", headers=admin_headers, json={}).json()
    quote = client.post(
        "/api/v1/crm/quotes",
        headers=admin_headers,
        json={
            "title": "Villa R+1 Odza",
            "opportunity_id": conv["opportunity_id"],
            "payment_schedule": [
                {"label": "Acompte", "pct": 30},
                {"label": "Gros œuvre", "pct": 40},
                {"label": "Livraison", "pct": 30},
            ],
            "lines": [
                {
                    "lot_code": "LOT-01",
                    "section": "Gros œuvre",
                    "designation": "Fondations",
                    "unit": "forfait",
                    "quantity": 1,
                    "unit_price": 12000000,
                },
                {
                    "lot_code": "LOT-02",
                    "section": "Second œuvre",
                    "designation": "Menuiseries",
                    "unit": "u",
                    "quantity": 10,
                    "unit_price": 350000,
                },
            ],
        },
    ).json()
    assert float(quote["subtotal"]) == 15500000.0
    sent = client.post(f"/api/v1/crm/quotes/{quote['id']}/send", headers=admin_headers).json()
    token = sent["public_url"].rsplit("/", 1)[-1]
    assert client.get(f"/api/v1/public/quotes/{token}").json()["status"] in ("viewed", "sent")
    otp = client.post(f"/api/v1/public/quotes/{token}/otp").json()
    accepted = client.post(
        f"/api/v1/public/quotes/{token}/accept",
        json={
            "full_name": "Paul Mbarga",
            "otp_token": otp["otp_token"],
            "code": otp["test_code"],
            "accept_terms": True,
        },
    )
    assert accepted.status_code == 200, accepted.text
    contract = client.post(f"/api/v1/crm/quotes/{quote['id']}/contract", headers=admin_headers).json()
    no_scan = client.post(
        f"/api/v1/crm/contracts/{contract['id']}/sign",
        headers=admin_headers,
        json={"signed_by_name": "Paul Mbarga", "method": "manuscrite_scannee"},
    )
    assert no_scan.status_code == 422 and no_scan.json()["error"]["code"] == "EVIDENCE_REQUIRED"
    scan = client.post(
        "/api/v1/crm/files",
        headers=admin_headers,
        files={"file": ("contrat-signe.pdf", b"%PDF-1.4 contrat signe %%EOF", "application/pdf")},
    )
    assert scan.status_code == 201, scan.text
    sign = client.post(
        f"/api/v1/crm/contracts/{contract['id']}/sign",
        headers=admin_headers,
        json={
            "signed_by_name": "Paul Mbarga",
            "method": "manuscrite_scannee",
            "evidence_file_id": scan.json()["file_id"],
        },
    )
    assert sign.status_code == 200, sign.text
    detail = client.get(f"/api/v1/crm/contracts/{contract['id']}", headers=admin_headers).json()
    assert detail["status"] == "signed" and detail["quote"]["number"] == quote["number"]
    evidence = client.get(f"/api/v1/crm/contracts/{contract['id']}/evidence", headers=admin_headers)
    assert evidence.status_code == 200 and evidence.content.startswith(b"%PDF")
    project = client.post(
        f"/api/v1/crm/contracts/{contract['id']}/project",
        headers=admin_headers,
        json={"invite_client_email": "paul@example.com"},
    )
    assert project.status_code == 201, project.text
    funnel = client.get("/api/v1/crm/funnel", headers=admin_headers).json()
    assert funnel["contracts_signed"] == 1 and funnel["quote_acceptance_rate"] == 100.0


def test_newsletter_excludes_unsubscribed(client, db):
    from app.modules.newsletter.models import CampaignRecipient, NewsletterSubscriber

    _, headers = as_role(client, db, "MARKETING")
    for email in ("a@example.com", "b@example.com"):
        r = client.post("/api/v1/public/newsletter/subscribe", json={"email": email, "consent": True})
        assert r.status_code == 202
    subs = db.execute(select(NewsletterSubscriber)).scalars().all()
    for sub in subs:
        assert client.get(f"/api/v1/public/newsletter/confirm?token={sub.token}").status_code == 200
    b = next(s for s in subs if s.email == "b@example.com")
    assert client.get(f"/api/v1/public/newsletter/unsubscribe?token={b.token}").status_code == 200
    template = client.post(
        "/api/v1/newsletter/templates",
        headers=headers,
        json={
            "name": "Mensuel",
            "subject": "Actualités GLOBUS",
            "html": '<p>Bonjour {{ first_name }} <a href="https://example.com">Lire</a></p>',
        },
    ).json()
    campaign = client.post(
        "/api/v1/newsletter/campaigns",
        headers=headers,
        json={"name": "Octobre", "subject": "Actualités", "template_id": template["id"], "utm_campaign": "octobre"},
    ).json()
    result = client.post(f"/api/v1/newsletter/campaigns/{campaign['id']}/send", headers=headers).json()
    assert result["sent"] == 1
    recipients = db.execute(select(CampaignRecipient)).scalars().all()
    assert len(recipients) == 1
    opened = client.get(f"/api/v1/public/newsletter/open?t={recipients[0].tracking_token}")
    assert opened.status_code == 200
    stats = client.get(f"/api/v1/newsletter/campaigns/{campaign['id']}", headers=headers).json()["stats"]
    assert stats["unique_opens"] == 1


def test_analytics_segmented_by_period_and_blog_stats(client, db):
    _, headers = as_role(client, db, "MARKETING")
    for i, ua in enumerate(
        [
            "Mozilla/5.0 (Linux; Android 13; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64)",
        ]
    ):
        resp = client.post(
            "/api/v1/public/analytics/collect",
            headers={"User-Agent": ua},
            json={
                "session_id": f"session-test-{i:04d}",
                "consent": True,
                "referrer": "https://www.google.com/",
                "landing": "/",
                "utm": {"source": "google", "medium": "cpc", "campaign": "villa"},
                "events": [
                    {"type": "page_view", "path": "/"},
                    {"type": "cta_click", "path": "/", "target": "decrire_mon_projet"},
                    {"type": "conversion", "path": "/decrire-mon-projet", "target": "describe_project"},
                    {"type": "web_vital", "target": "LCP", "value": 1800.0},
                ],
            },
        )
        assert resp.status_code == 202, resp.text
    overview = client.get("/api/v1/analytics/overview?period=7d&granularity=week", headers=headers).json()
    assert overview["totals"]["sessions"] == 2 and overview["totals"]["conversions"] == 2
    assert {d["value"] for d in overview["devices"]} == {"mobile", "desktop"}
    assert overview["channels"][0]["value"] == "paid"
    assert any(t["kind"] == "vital_LCP" for t in overview["technical"])


def test_blog_interactions_and_moderation(client, db):
    _, headers = as_role(client, db, "MARKETING")
    media_id = _upload(client, headers)
    post = client.post(
        "/api/v1/cms/blog-posts",
        headers=headers,
        json={
            "slug": "dimensionner-une-dalle",
            "title": "Comment dimensionner une dalle de 6 m de portée ?",
            "excerpt": "Hypothèses, calcul, modélisation, résultat.",
            "cover_media_id": media_id,
            "content_family": "EXPERTISE",
            "body_blocks": [{"kind": "rich_text", "html": "<p>Problème → hypothèses → calcul → solution.</p>"}],
        },
    )
    assert post.status_code == 201, post.text
    client.post(
        f"/api/v1/cms/collections/blog_posts/{post.json()['id']}/transition",
        headers=headers,
        json={"target": "published"},
    )
    slug = "dimensionner-une-dalle"
    assert client.post(f"/api/v1/public/blog/posts/{slug}/view").status_code == 200
    assert client.post(f"/api/v1/public/blog/posts/{slug}/like").json()["liked"] is True
    assert (
        client.post(f"/api/v1/public/blog/posts/{slug}/share", json={"network": "whatsapp"}).json()["share_count"] == 1
    )
    c = client.post(
        f"/api/v1/public/blog/posts/{slug}/comments",
        json={"author_name": "Jean", "content": "Article très clair, merci !", "rendered_at": int(time.time()) - 30},
    )
    assert c.status_code == 201
    pending = client.get("/api/v1/cms/blog-comments", headers=headers).json()["items"]
    assert len(pending) == 1
    client.post(f"/api/v1/cms/blog-comments/{pending[0]['id']}/moderate", headers=headers, json={"status": "approved"})
    reply = client.post(
        f"/api/v1/cms/blog-comments/{pending[0]['id']}/reply",
        headers=headers,
        json={"author_name": "GLOBUS", "content": "Merci Jean !"},
    )
    assert reply.status_code == 201
    detail = client.get(f"/api/v1/public/blog/posts/{slug}").json()
    assert detail["comments"][0]["replies"][0]["is_staff"] is True
    stats = client.get("/api/v1/analytics/blog?period=7d", headers=headers).json()
    entry = next(s for s in stats if s["slug"] == slug)
    assert entry["likes"] == 1 and entry["shares"] == 1 and entry["comments"] == 1
