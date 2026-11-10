"""Géolocalisation des visiteurs et des prospects : base MMDB (DB-IP) lue sur le serveur, sessions de la vitrine
localisées (continent, pays, région, ville) sans conserver l'IP, rapports Cameroun / diaspora, prospects et abonnés
localisés (IP puis indicatif téléphonique), mise à jour mensuelle de la base, carte Google des visiteurs, GA4 et
conversions Google Ads réglables depuis l'ERP."""

from __future__ import annotations

import gzip
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import select

from tests.mmdb_fixture import SAMPLE, build

API = "/api/v1"
PARIS, DOUALA, MONTREAL = "81.2.3.4", "41.202.7.8", "24.48.9.10"


@pytest.fixture
def geodb(tmp_path: Path, monkeypatch: Any) -> Path:
    from app.core import geoip
    from app.core.config import settings

    monkeypatch.setattr(settings, "GEOIP_DIR", str(tmp_path))
    (tmp_path / geoip.DB_FILENAME).write_bytes(build(SAMPLE))
    geoip.reset()
    yield tmp_path
    geoip.reset()


def _collect(client: Any, session_id: str, ip: str, events: list[dict[str, Any]] | None = None) -> None:
    resp = client.post(
        f"{API}/public/analytics/collect",
        json={"session_id": session_id, "events": events or [{"type": "page_view", "path": "/"}]},
        headers={"x-real-ip": ip, "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130"},
    )
    assert resp.status_code == 202, resp.text


def test_lookup_reads_the_database_and_ignores_private_addresses(geodb: Path) -> None:
    from app.core import geoip

    paris = geoip.lookup(PARIS)
    assert paris is not None
    assert (paris.continent, paris.country, paris.country_name, paris.region, paris.city) == (
        "EU",
        "FR",
        "France",
        "Île-de-France",
        "Paris",
    )
    assert paris.is_abroad is True and geoip.lookup(DOUALA).is_abroad is False
    assert geoip.lookup("192.168.1.10") is None and geoip.lookup("not-an-ip") is None
    assert geoip.lookup("9.9.9.9") is None, "adresse absente de la base"
    status = geoip.status()
    assert status["available"] and status["edition"] and status["attribution"]["url"] == "https://db-ip.com"


def test_country_from_phone_prefix() -> None:
    from app.core import geoip

    assert geoip.from_phone("+33 6 12 34 56 78").country == "FR"
    assert geoip.from_phone("0032470123456").country_name == "Belgique"
    cm = geoip.from_phone("+237690112233")
    assert cm.country == "CM" and cm.is_abroad is False and cm.source == "phone"
    assert geoip.from_phone("690112233") is None, "numéro local : indicatif inconnu"


def test_visits_are_located_and_reported_by_zone(client: Any, db: Any, geodb: Path, admin_headers: dict) -> None:
    from app.modules.analytics.models import AnalyticsSession

    _collect(client, "sessionparis0001", PARIS)
    _collect(client, "sessionparis0002", PARIS, [{"type": "page_view", "path": "/"}, {"type": "form_submit"}])
    _collect(client, "sessiondouala001", DOUALA)
    _collect(client, "sessionmontreal1", MONTREAL)
    db.expire_all()
    paris = db.get(AnalyticsSession, "sessionparis0001")
    assert (paris.continent, paris.country, paris.region, paris.city) == ("EU", "FR", "Île-de-France", "Paris")
    assert "81.2.3.4" not in str(paris.__dict__), "l'adresse IP n'est jamais conservée"

    overview = client.get(f"{API}/analytics/overview", params={"period": "7d"}, headers=admin_headers).json()
    zones = {z["value"]: z["sessions"] for z in overview["zones"]}
    assert zones == {"hors_cameroun": 3, "cameroun": 1}
    assert {c["value"]: c["sessions"] for c in overview["continents"]} == {"EU": 2, "AF": 1, "NA": 1}
    countries = {c["value"]: (c["sessions"], c["conversions"]) for c in overview["countries"]}
    assert countries["FR"] == (2, 1) and countries["CM"] == (1, 0)
    assert {c["value"] for c in overview["cities"]} == {"FR|Paris", "CM|Douala", "CA|Montréal"}
    assert "CA|Québec" in {r["value"] for r in overview["regions"]}
    assert overview["geoip"]["available"] is True


def test_leads_are_located_and_flagged_diaspora(client: Any, db: Any, geodb: Path, admin_headers: dict) -> None:
    from app.modules.crm import service
    from app.modules.crm.models import AssignmentRule, Lead

    def lead(email: str, *, ip: str | None = None, phone: str | None = None, **data: Any) -> Lead:
        return service.create_lead(
            db,
            data={"first_name": "Test", "email": email, "phone": phone, **data},
            source="website_form",
            form_key="contact",
            consents={"contact": True},
            ip=ip,
            user_agent="test",
        )

    from_paris = lead("paris@example.com", ip=PARIS)
    assert (from_paris.geo_country, from_paris.geo_city, from_paris.geo_continent) == ("FR", "Paris", "EU")
    assert from_paris.country == "France" and from_paris.is_diaspora and from_paris.geo_source == "ip"
    declared = lead("declared@example.com", ip=PARIS, country="Cameroun")
    assert declared.country == "Cameroun" and declared.is_diaspora is False, "le pays déclaré prime"
    whatsapp = lead("wa@example.com", phone="+33612345678")
    assert whatsapp.geo_country == "FR" and whatsapp.geo_source == "phone" and whatsapp.is_diaspora
    local = lead("douala@example.com", ip=DOUALA)
    assert local.is_diaspora is False and local.geo_city == "Douala"
    db.commit()

    listed = client.get(f"{API}/crm/leads", params={"is_diaspora": "true"}, headers=admin_headers).json()
    assert {r["email"] for r in listed["items"]} >= {"paris@example.com", "wa@example.com"}
    assert "douala@example.com" not in {r["email"] for r in listed["items"]}
    french = client.get(f"{API}/crm/leads", params={"geo_country": "fr"}, headers=admin_headers).json()
    assert {r["email"] for r in french["items"]} == {"paris@example.com", "declared@example.com", "wa@example.com"}

    # Règles d'affectation : pays et villes sans casse ni accents, code ISO = pays détecté.
    assert service._rule_matches(AssignmentRule(criteria={"countries": ["france"]}), from_paris)
    assert service._rule_matches(AssignmentRule(criteria={"countries": ["FR"]}), whatsapp)
    assert service._rule_matches(AssignmentRule(criteria={"cities": ["paris"]}), from_paris)
    assert not service._rule_matches(AssignmentRule(criteria={"countries": ["Cameroun"]}), from_paris)

    overview = client.get(f"{API}/analytics/overview", params={"period": "7d"}, headers=admin_headers).json()
    prospects = overview["prospects"]
    assert prospects["total"] >= 4 and prospects["diaspora"] >= 2
    assert {c["value"]: c["leads"] for c in prospects["countries"]}["FR"] == 3


def test_subscriber_country_from_connection(client: Any, db: Any, geodb: Path) -> None:
    from app.modules.newsletter.models import NewsletterSubscriber, Segment
    from app.modules.newsletter.service import segment_query

    resp = client.post(
        f"{API}/public/newsletter/subscribe",
        json={"email": "abonne@example.com", "consent": True},
        headers={"x-real-ip": MONTREAL},
    )
    assert resp.status_code == 202, resp.text
    sub = db.execute(
        select(NewsletterSubscriber).where(NewsletterSubscriber.email == "abonne@example.com")
    ).scalar_one()
    assert sub.country == "Canada" and sub.is_diaspora is True
    sub.status = "subscribed"
    db.commit()
    found = db.execute(segment_query(Segment(name="Canada", rules={"countries": ["canada"]}))).scalars().all()
    assert sub in found, "pays comparé sans tenir compte des majuscules"


def test_database_update_downloads_the_edition_of_the_month(tmp_path: Path, monkeypatch: Any) -> None:
    import httpx

    from app.core import geoip
    from app.core.config import settings

    monkeypatch.setattr(settings, "GEOIP_DIR", str(tmp_path))
    assert geoip.update_database()["skipped"], "hors production : aucun téléchargement"
    payload = gzip.compress(build(SAMPLE))
    requested: list[str] = []

    class Stream:
        def __init__(self, url: str) -> None:
            self.status_code = 404 if "2026-12" in url else 200
            requested.append(url)

        def __enter__(self) -> Stream:
            return self

        def __exit__(self, *exc: Any) -> None:
            return None

        def raise_for_status(self) -> None:
            return None

        def iter_bytes(self, size: int) -> list[bytes]:
            return [payload]

    monkeypatch.setattr(httpx, "stream", lambda method, url, **kw: Stream(url))
    result = geoip.update_database(force=True, now=datetime(2026, 12, 2, tzinfo=UTC))
    assert result["updated"] == "2026-11", "édition du mois pas encore publiée : celle du mois précédent"
    assert requested[0].endswith("dbip-city-lite-2026-12.mmdb.gz") and (tmp_path / geoip.DB_FILENAME).exists()
    assert geoip.lookup(PARIS).city == "Paris"
    geoip.reset()


def test_visitor_map_uses_google_static_maps(
    client: Any, db: Any, geodb: Path, admin_headers: dict, monkeypatch
) -> None:
    import httpx

    from app.core import secrets
    from app.modules.analytics import router

    router._MAP_CACHE.clear()
    assert client.get(f"{API}/analytics/visitor-map", headers=admin_headers).status_code == 404, "sans clé Google"
    monkeypatch.setattr(secrets, "get_secret", lambda name: "maps-key" if name == "GOOGLE_MAPS_API_KEY" else None)
    _collect(client, "sessionmapparis1", PARIS)
    _collect(client, "sessionmapdouala", DOUALA)
    calls: list[Any] = []

    class Resp:
        status_code = 200
        headers = {"content-type": "image/png"}
        content = b"\x89PNG-carte"

    def fake_get(url: str, params: Any = None, timeout: Any = None) -> Resp:
        calls.append(params)
        return Resp()

    monkeypatch.setattr(httpx, "get", fake_get)
    resp = client.get(f"{API}/analytics/visitor-map", params={"period": "7d"}, headers=admin_headers)
    assert resp.status_code == 200 and resp.content == b"\x89PNG-carte"
    markers = [v for k, v in calls[0] if k == "markers"]
    assert any("color:0x16A34A" in m and "Douala, CM" in m for m in markers), "Cameroun en vert"
    assert any("color:0xFB8C43" in m and "Paris, FR" in m for m in markers), "étranger en orange"
    assert ("key", "maps-key") in calls[0]


def test_ga4_property_and_ads_conversions_from_the_erp(client: Any, db: Any, admin_headers: dict) -> None:
    from app.core import runtime_settings

    assert runtime_settings._coerce("GA4_PROPERTY_ID", "properties/412345678") == "412345678"
    report = client.get(f"{API}/analytics/ga4", headers=admin_headers).json()
    assert report == {"configured": False, "missing": ["GA4_PROPERTY_ID", "GA4_CREDENTIALS_JSON"]}

    current = client.get(f"{API}/cms/site-settings", headers=admin_headers).json()
    bad = client.put(
        f"{API}/cms/site-settings",
        json={**current, "tracking": {"gads_id": "AW-123456789", "gads_labels": {"inconnu": "AbCdEf"}}},
        headers=admin_headers,
    )
    assert bad.status_code == 400 and bad.json()["error"]["code"] == "INVALID_TRACKING"
    good = client.put(
        f"{API}/cms/site-settings",
        json={
            **current,
            "tracking": {"gads_id": "AW-123456789", "gads_labels": {"lead": "AbC-D_efG", "whatsapp": "Xy1"}},
        },
        headers=admin_headers,
    )
    assert good.status_code == 200, good.text
    public = client.get(f"{API}/public/site").json()["tracking"]
    assert public["gads_labels"] == {"lead": "AbC-D_efG", "whatsapp": "Xy1"} and public["gads_id"] == "AW-123456789"
