"""Phase 19 — de-mock completion endpoints.

Covers the new wiring added so the ERP/client pages render 100% real data:
  • SAV warranties (CRUD) + ticket rating *comment*
  • Subcontractor "situations de travaux" (create / list / validate / refuse)
  • Company settings RC number + tax id (NIU) round-trip (admin + public)
  • Client material choices (admin proposes → client selects via JSON body)
"""
import asyncio

import pytest

API = "/api/v1"


# ── settings singleton seed (PUT requires an existing row) ───────
@pytest.fixture(scope="module", autouse=True)
def ensure_settings(app_fixture):
    from app.database import AsyncSessionLocal
    from app.models.cms import CMSSiteSettings
    from sqlalchemy import select

    async def _seed():
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(CMSSiteSettings).limit(1))
            if not r.scalars().first():
                db.add(CMSSiteSettings(id="settings-phase19", company_name="Globus"))
                await db.commit()

    asyncio.run(_seed())


# ════════════════════════════════════════════════════════════════
# SAV — Warranties
# ════════════════════════════════════════════════════════════════
@pytest.fixture(scope="module")
def warranty_id(client, admin_auth, sample_project):
    r = client.post(f"{API}/sav/warranties", headers=admin_auth, json={
        "project_id": sample_project["id"],
        "name": "Garantie décennale",
        "duration": "10 ans",
        "description": "Gros œuvre et structure",
        "status": "ACTIVE",
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_create_and_list_warranty(client, admin_headers, warranty_id, sample_project):
    rows = client.get(f"{API}/sav/warranties", headers=admin_headers).json()
    assert any(w["id"] == warranty_id and w["name"] == "Garantie décennale" for w in rows)
    # project filter narrows to that project only
    r2 = client.get(f"{API}/sav/warranties", headers=admin_headers,
                    params={"project_id": sample_project["id"]})
    assert r2.status_code == 200
    assert all(w["project_id"] == sample_project["id"] for w in r2.json())


def test_warranty_requires_auth(client):
    assert client.get(f"{API}/sav/warranties").status_code in (401, 403)
    assert client.post(f"{API}/sav/warranties", json={"name": "x"}).status_code in (401, 403)


def test_delete_warranty(client, admin_headers, sample_project):
    wid = client.post(f"{API}/sav/warranties", headers=admin_headers, json={
        "project_id": sample_project["id"], "name": "Garantie temporaire",
    }).json()["id"]
    assert client.delete(f"{API}/sav/warranties/{wid}", headers=admin_headers).status_code == 200
    rows = client.get(f"{API}/sav/warranties", headers=admin_headers).json()
    assert all(w["id"] != wid for w in rows)  # soft-deleted, no longer listed
    assert client.delete(f"{API}/sav/warranties/does-not-exist",
                         headers=admin_headers).status_code == 404


# ── SAV ticket rating + comment ─────────────────────────────────
def test_rate_ticket_with_comment(client, admin_headers, sample_project):
    tid = client.post(f"{API}/sav/tickets", headers=admin_headers, json={
        "project_id": sample_project["id"], "subject": "Volet bloqué",
        "description": "Volet roulant HS", "priority": "NORMALE",
    }).json()["id"]
    r = client.patch(f"{API}/sav/tickets/{tid}/rate", headers=admin_headers,
                     json={"rating": 5, "comment": "Intervention rapide et soignée"})
    assert r.status_code == 200, r.text
    row = next(x for x in client.get(f"{API}/sav/tickets", headers=admin_headers).json()
               if x["id"] == tid)
    assert row["rating"] == 5
    assert row["rating_comment"] == "Intervention rapide et soignée"


# ════════════════════════════════════════════════════════════════
# Subcontractor situations de travaux
# ════════════════════════════════════════════════════════════════
@pytest.fixture(scope="module")
def subcontractor_id(client, admin_auth):
    r = client.post(f"{API}/subcontractors", headers=admin_auth, json={
        "company_name": "BTP Sous-Traitance SARL", "contact_name": "Paul Mbarga",
        "speciality": "Plomberie",
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_situation_create_list_validate(client, admin_headers, subcontractor_id, sample_project):
    sid = client.post(f"{API}/subcontractors/situations", headers=admin_headers, json={
        "subcontractor_id": subcontractor_id, "project_id": sample_project["id"],
        "description": "Situation n°1 - plomberie RDC", "progress_pct": 40,
        "amount": 1_200_000,
    }).json()["id"]
    row = next(x for x in client.get(f"{API}/subcontractors/situations",
                                     headers=admin_headers).json() if x["id"] == sid)
    assert row["subcontractor_name"] == "BTP Sous-Traitance SARL"
    assert row["project_name"] == "Projet Test Pyramide"
    assert row["status"] == "SOUMISE"
    assert row["progress_pct"] == 40
    assert row["amount"] == 1_200_000
    # validate → status flips
    assert client.patch(f"{API}/subcontractors/situations/{sid}/validate",
                        headers=admin_headers).status_code == 200
    row2 = next(x for x in client.get(f"{API}/subcontractors/situations",
                                      headers=admin_headers).json() if x["id"] == sid)
    assert row2["status"] == "VALIDEE"


def test_situation_refuse_and_404(client, admin_headers, subcontractor_id, sample_project):
    sid = client.post(f"{API}/subcontractors/situations", headers=admin_headers, json={
        "subcontractor_id": subcontractor_id, "project_id": sample_project["id"],
        "description": "Situation n°2", "progress_pct": 10, "amount": 500_000,
    }).json()["id"]
    assert client.patch(f"{API}/subcontractors/situations/{sid}/refuse",
                        headers=admin_headers).status_code == 200
    row = next(x for x in client.get(f"{API}/subcontractors/situations",
                                     headers=admin_headers).json() if x["id"] == sid)
    assert row["status"] == "REFUSEE"
    assert client.patch(f"{API}/subcontractors/situations/nope/validate",
                        headers=admin_headers).status_code == 404


def test_situations_require_auth(client):
    assert client.get(f"{API}/subcontractors/situations").status_code in (401, 403)


# ════════════════════════════════════════════════════════════════
# Company settings — RC number + tax id (NIU)
# ════════════════════════════════════════════════════════════════
def test_settings_rc_tax_roundtrip(client, admin_headers):
    payload = {"rc_number": "RC/DLA/2024/B/1234", "tax_id": "M091700000000P", "vat_rate": 18.5}
    r = client.put(f"{API}/admin/cms/settings", headers=admin_headers, json=payload)
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    g = client.get(f"{API}/admin/cms/settings", headers=admin_headers).json()
    assert g["rc_number"] == "RC/DLA/2024/B/1234"
    assert g["tax_id"] == "M091700000000P"
    assert g["vat_rate"] == 18.5
    # exposed publicly in camelCase
    pub = client.get(f"{API}/cms/settings").json()
    assert pub["rcNumber"] == "RC/DLA/2024/B/1234"
    assert pub["taxId"] == "M091700000000P"
    assert pub["vatRate"] == 18.5


# ════════════════════════════════════════════════════════════════
# Client material choices (admin proposes → client selects)
# ════════════════════════════════════════════════════════════════
def test_material_choice_flow(client, admin_headers, client_headers, client_user_id):
    # Dedicated newest project so _get_client_project resolves deterministically
    pid = client.post(f"{API}/projects", headers=admin_headers, json={
        "name": "Projet Choix Matériaux", "project_type": "construction",
        "location": "Yaoundé", "client_id": client_user_id, "budget_initial": 1_000_000,
    }).json()["id"]
    cid = client.post(f"{API}/ged/material-choices", headers=admin_headers, json={
        "project_id": pid, "category": "Carrelage salon",
        "options": [{"label": "Grès cérame 60x60"}, {"label": "Marbre poli"}],
    }).json()["id"]
    # client sees the pending choice
    row = next(x for x in client.get(f"{API}/client/material-choices",
                                     headers=client_headers).json() if x["id"] == cid)
    assert row["category"] == "Carrelage salon"
    assert not row["selected"]  # not chosen yet
    # client selects via JSON body
    sel = client.patch(f"{API}/client/material-choices/{cid}", headers=client_headers,
                       json={"selection": "Marbre poli"})
    assert sel.status_code == 200, sel.text
    row2 = next(x for x in client.get(f"{API}/client/material-choices",
                                      headers=client_headers).json() if x["id"] == cid)
    assert row2["selected"] == "Marbre poli"


def test_material_choice_requires_auth(client):
    assert client.get(f"{API}/client/material-choices").status_code in (401, 403)


# ════════════════════════════════════════════════════════════════
# GED — real binary upload / new version / delete (no placeholder URLs)
# ════════════════════════════════════════════════════════════════
PDF_BYTES = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


def test_ged_upload_list_version_delete(client, admin_headers, sample_project):
    # 1) real binary upload
    r = client.post(
        f"{API}/ged/documents/upload", headers=admin_headers,
        files={"file": ("plan-rdc.pdf", PDF_BYTES, "application/pdf")},
        data={"project_id": sample_project["id"], "name": "Plan RDC",
              "category": "Plans", "note": "Version initiale"},
    )
    assert r.status_code == 200, r.text
    doc = r.json()
    # Downloads served through the secure presigned endpoint (S3/R2 or local).
    assert doc["file_url"] == f"/api/v1/ged/documents/{doc['id']}/download"
    doc_id = doc["id"]
    # The secure download resolves (redirects to the stored object / local file).
    dl = client.get(f"{API}/ged/documents/{doc_id}/download", headers=admin_headers,
                    follow_redirects=False)
    assert dl.status_code in (302, 307)
    # 2) appears in the project's document list with its real version note
    rows = client.get(f"{API}/ged/documents/{sample_project['id']}", headers=admin_headers).json()
    row = next((d for d in rows if d["id"] == doc_id), None)
    assert row is not None and row["name"] == "Plan RDC"
    assert row["version_note"] == "Version initiale"
    # 3) new binary version (with its own note) → version 2
    v = client.post(
        f"{API}/ged/documents/{doc_id}/version-upload", headers=admin_headers,
        files={"file": ("plan-rdc-v2.pdf", PDF_BYTES, "application/pdf")},
        data={"note": "Révision plomberie"},
    )
    assert v.status_code == 200, v.text
    assert v.json()["version"] == 2
    # 4) soft delete → no longer listed
    assert client.delete(f"{API}/ged/documents/{doc_id}", headers=admin_headers).status_code == 200
    rows2 = client.get(f"{API}/ged/documents/{sample_project['id']}", headers=admin_headers).json()
    assert all(x["id"] != doc_id for x in rows2)
    # 5) delete unknown → 404
    assert client.delete(f"{API}/ged/documents/does-not-exist",
                         headers=admin_headers).status_code == 404


def test_ged_upload_requires_staff(client, client_headers, sample_project):
    r = client.post(
        f"{API}/ged/documents/upload", headers=client_headers,
        files={"file": ("x.pdf", PDF_BYTES, "application/pdf")},
        data={"project_id": sample_project["id"]},
    )
    assert r.status_code in (401, 403)


def test_client_document_binary_upload(client, admin_headers, client_headers, client_user_id):
    # Dedicated newest project so _get_client_project resolves to it
    client.post(f"{API}/projects", headers=admin_headers, json={
        "name": "Projet Upload Client", "project_type": "construction",
        "location": "Douala", "client_id": client_user_id, "budget_initial": 1_000_000,
    })
    r = client.post(
        f"{API}/client/documents/upload", headers=client_headers,
        files={"file": ("photo-chantier.pdf", PDF_BYTES, "application/pdf")},
        data={"name": "Photo chantier", "category": "envoi_client"},
    )
    assert r.status_code == 200, r.text
    # Downloads are served through the secure presigned endpoint (S3/R2 or local).
    doc_id = r.json()["id"]
    assert r.json()["file_url"] == f"/api/v1/ged/documents/{doc_id}/download"
    docs = client.get(f"{API}/client/documents", headers=client_headers).json()
    assert any(d["name"] == "Photo chantier" for d in docs)
    # The client can fetch their own uploaded document via that secure route.
    dl = client.get(f"{API}/ged/documents/{doc_id}/download", headers=client_headers,
                    follow_redirects=False)
    assert dl.status_code in (302, 307)


# ════════════════════════════════════════════════════════════════
# Client family / guest access (real /client/guests)
# ════════════════════════════════════════════════════════════════
def test_client_guest_flow(client, admin_headers, client_headers, client_user_id):
    # Ensure the client has a project (newest)
    client.post(f"{API}/projects", headers=admin_headers, json={
        "name": "Projet Invités", "project_type": "construction",
        "location": "Douala", "client_id": client_user_id, "budget_initial": 1_000_000,
    })
    before = len(client.get(f"{API}/client/guests", headers=client_headers).json())
    # invite (email normalized, role honoured)
    inv = client.post(f"{API}/client/guests", headers=client_headers, json={
        "email": "Conjoint@Example.com", "name": "Conjoint", "role": "EDIT",
    })
    assert inv.status_code == 200, inv.text
    body = inv.json()
    gid = body["id"]
    assert body["email"] == "conjoint@example.com"
    assert body["role"] == "EDIT"
    assert body["status"] == "PENDING"
    # listed
    rows = client.get(f"{API}/client/guests", headers=client_headers).json()
    assert any(g["id"] == gid for g in rows)
    assert len(rows) == before + 1
    # duplicate email → 409
    assert client.post(f"{API}/client/guests", headers=client_headers,
                       json={"email": "conjoint@example.com"}).status_code == 409
    # empty email → 400
    assert client.post(f"{API}/client/guests", headers=client_headers,
                       json={"email": "  "}).status_code == 400
    # remove → gone
    assert client.delete(f"{API}/client/guests/{gid}", headers=client_headers).status_code == 200
    rows2 = client.get(f"{API}/client/guests", headers=client_headers).json()
    assert all(g["id"] != gid for g in rows2)
    # remove unknown → 404
    assert client.delete(f"{API}/client/guests/does-not-exist",
                         headers=client_headers).status_code == 404


def test_client_guests_reserved_to_client(client, admin_headers):
    # A non-CLIENT (admin) cannot access the client guest list
    assert client.get(f"{API}/client/guests", headers=admin_headers).status_code in (401, 403)


def test_client_guests_require_auth(client):
    assert client.get(f"{API}/client/guests").status_code in (401, 403)


# ════════════════════════════════════════════════════════════════
# Client notification delete (real DELETE /client/notifications/{id})
# ════════════════════════════════════════════════════════════════
def test_client_notification_delete(client, client_headers, client_user_id):
    from app.database import AsyncSessionLocal
    from app.models.erp import Notification

    async def _seed():
        async with AsyncSessionLocal() as db:
            n = Notification(user_id=client_user_id, type="info",
                             title="Notif de test", message="contenu")
            db.add(n)
            await db.commit()
            await db.refresh(n)
            return n.id

    nid = asyncio.run(_seed())
    # listed for the client
    rows = client.get(f"{API}/client/notifications", headers=client_headers).json()
    assert any(n["id"] == nid for n in rows)
    # delete → gone
    assert client.delete(f"{API}/client/notifications/{nid}",
                         headers=client_headers).status_code == 200
    rows2 = client.get(f"{API}/client/notifications", headers=client_headers).json()
    assert all(n["id"] != nid for n in rows2)
    # delete unknown → 404
    assert client.delete(f"{API}/client/notifications/does-not-exist",
                         headers=client_headers).status_code == 404


def test_client_notification_delete_requires_auth(client):
    assert client.delete(f"{API}/client/notifications/x").status_code in (401, 403)


# ════════════════════════════════════════════════════════════════
# Finances profitability — enriched with real status / client / dates
# ════════════════════════════════════════════════════════════════
def test_finances_profitability_enriched(client, admin_headers, sample_project):
    r = client.get(f"{API}/finances/profitability", headers=admin_headers)
    assert r.status_code == 200, r.text
    row = next((x for x in r.json() if x["project_id"] == sample_project["id"]), None)
    assert row is not None
    # Enriched fields are present (no hardcoded UI fallback needed)
    for k in ("status", "client", "start_date", "end_date"):
        assert k in row
    assert row["status"]  # real project status (e.g. EN_COURS)
    assert "Jean" in (row["client"] or "")  # seeded client name resolved
    assert "breakdown" in row  # real expense breakdown present


def test_finances_breakdown_from_expenses(client, admin_headers, sample_project):
    pid = sample_project["id"]
    # Book a real categorised expense
    r = client.post(f"{API}/projects/{pid}/expenses", headers=admin_headers, json={
        "category": "materials", "description": "Ciment & agrégats", "amount": 500_000,
    })
    assert r.status_code == 200, r.text
    # It shows up in the profitability breakdown under "materiaux"
    rows = client.get(f"{API}/finances/profitability", headers=admin_headers).json()
    row = next((x for x in rows if x["project_id"] == pid), None)
    assert row is not None
    assert row["breakdown"]["materiaux"] >= 500_000
    # And in the project's expense list
    exp = client.get(f"{API}/projects/{pid}/expenses", headers=admin_headers).json()
    assert any(e["category"] == "materials" and e["amount"] == 500_000 for e in exp)


# ════════════════════════════════════════════════════════════════
# Settings — role permission matrix round-trip
# ════════════════════════════════════════════════════════════════
def test_settings_role_permissions_roundtrip(client, admin_headers):
    matrix = {
        "Comptable": {"Dashboard": True, "Finances & Compta": True, "Chantiers": False},
        "RH": {"Dashboard": True, "Ressources Humaines": True},
    }
    r = client.put(f"{API}/admin/cms/settings", headers=admin_headers,
                   json={"role_permissions": matrix})
    assert r.status_code == 200, r.text
    g = client.get(f"{API}/admin/cms/settings", headers=admin_headers).json()
    assert g["role_permissions"]["Comptable"]["Finances & Compta"] is True
    assert g["role_permissions"]["Comptable"]["Chantiers"] is False
    assert g["role_permissions"]["RH"]["Ressources Humaines"] is True


_SETTINGS_DEFAULTS = {
    "default_currency": "FCFA (XAF)",
    "fiscal_year": "1er Janvier - 31 Décembre",
    "system_language": "Français",
    "timezone": "Africa/Douala (WAT)",
    "date_format": "JJ/MM/AAAA",
    "session_timeout": "30 minutes",
    "email_notifications": True,
    "enforce_2fa": False,
}


def _restore_settings(client, admin_headers):
    """Reset the singleton settings to defaults so the global state never leaks
    into other test files (enforce_2fa / session_timeout are session-wide)."""
    client.put(f"{API}/admin/cms/settings", headers=admin_headers, json=_SETTINGS_DEFAULTS)


def test_settings_system_prefs_roundtrip(client, admin_headers):
    payload = {
        "default_currency": "EUR (€)",
        "fiscal_year": "1er Juillet - 30 Juin",
        "system_language": "English",
        "timezone": "Europe/Paris (CET)",
        "date_format": "MM/JJ/AAAA",
        "session_timeout": "1 heure",
        "email_notifications": False,
        "enforce_2fa": True,
    }
    try:
        r = client.put(f"{API}/admin/cms/settings", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        g = client.get(f"{API}/admin/cms/settings", headers=admin_headers).json()
        assert g["default_currency"] == "EUR (€)"
        assert g["fiscal_year"] == "1er Juillet - 30 Juin"
        assert g["system_language"] == "English"
        assert g["timezone"] == "Europe/Paris (CET)"
        assert g["date_format"] == "MM/JJ/AAAA"
        assert g["session_timeout"] == "1 heure"
        assert g["email_notifications"] is False
        assert g["enforce_2fa"] is True
    finally:
        _restore_settings(client, admin_headers)


def test_public_settings_expose_formatting_prefs(client, admin_headers):
    """timezone / date_format / system_language are exposed on the PUBLIC
    /cms/settings so the client portal can honour org formatting."""
    try:
        client.put(f"{API}/admin/cms/settings", headers=admin_headers, json={
            "timezone": "Europe/Paris (CET)",
            "date_format": "MM/JJ/AAAA",
            "system_language": "English",
        })
        pub = client.get(f"{API}/cms/settings").json()
        assert pub["timezone"] == "Europe/Paris (CET)"
        assert pub["dateFormat"] == "MM/JJ/AAAA"
        assert pub["systemLanguage"] == "English"
    finally:
        _restore_settings(client, admin_headers)


def test_session_timeout_drives_token_ttl(client, admin_headers):
    """The persisted session_timeout setting controls the access-token TTL."""
    import time
    from jose import jwt as jose_jwt
    try:
        client.put(f"{API}/admin/cms/settings", headers=admin_headers,
                   json={"session_timeout": "4 heures"})
        tok = client.post(f"{API}/auth/login", json={
            "email": "admin@test.com", "password": "Admin123!"}).json()["access_token"]
        claims = jose_jwt.get_unverified_claims(tok)
        ttl = claims["exp"] - time.time()
        assert 4 * 3600 - 300 < ttl <= 4 * 3600 + 60, ttl

        client.put(f"{API}/admin/cms/settings", headers=admin_headers,
                   json={"session_timeout": "Jamais"})
        tok2 = client.post(f"{API}/auth/login", json={
            "email": "admin@test.com", "password": "Admin123!"}).json()["access_token"]
        ttl2 = jose_jwt.get_unverified_claims(tok2)["exp"] - time.time()
        assert ttl2 > 300 * 24 * 3600, ttl2  # « Jamais » ≈ 1 an
    finally:
        _restore_settings(client, admin_headers)


def test_enforce_2fa_blocks_disable(client, admin_headers):
    """When 2FA is mandatory, staff cannot disable it (403 before any toggle)."""
    try:
        client.put(f"{API}/admin/cms/settings", headers=admin_headers,
                   json={"enforce_2fa": True})
        r = client.post(f"{API}/auth/2fa/disable", headers=admin_headers,
                        json={"password": "Admin123!"})
        assert r.status_code == 403, r.text
    finally:
        _restore_settings(client, admin_headers)


def test_enforce_2fa_login_and_me_flag(client, admin_headers, client_headers):
    """enforce_2fa surfaces must_setup_2fa for staff without 2FA, never for clients."""
    try:
        client.put(f"{API}/admin/cms/settings", headers=admin_headers,
                   json={"enforce_2fa": True})
        # Staff (admin) with no 2FA enrolled → must_setup_2fa True on login + /me
        body = client.post(f"{API}/auth/login", json={
            "email": "admin@test.com", "password": "Admin123!"}).json()
        assert body.get("must_setup_2fa") is True, body
        me = client.get(f"{API}/auth/me", headers=admin_headers).json()
        assert me["must_setup_2fa"] is True
        # Client role is exempt from the staff 2FA policy
        cbody = client.post(f"{API}/auth/login", json={
            "email": "client@test.com", "password": "Client123!"}).json()
        assert not cbody.get("must_setup_2fa")
    finally:
        _restore_settings(client, admin_headers)
        me = client.get(f"{API}/auth/me", headers=admin_headers).json()
        assert me["must_setup_2fa"] is False


def test_export_data_zip(client, admin_headers):
    import io
    import zipfile
    r = client.get(f"{API}/admin/cms/export", headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/zip")
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = zf.namelist()
    assert "utilisateurs.csv" in names
    assert "projets.csv" in names
    # Aucune colonne sensible (mot de passe / hash) ne doit fuiter dans l'export
    header = zf.read("utilisateurs.csv").decode("utf-8").splitlines()[0].lower()
    assert "password" not in header
    assert "hashed" not in header


def test_export_data_requires_admin(client, client_headers):
    r = client.get(f"{API}/admin/cms/export", headers=client_headers)
    assert r.status_code in (401, 403)


def test_storage_service_local_mode():
    """The shared S3/R2 helper falls back to local /uploads when cloud is off
    (the test/dev default), returning a real url + a storage_key for parity."""
    from app.services.storage_service import store_upload, get_storage_service

    assert get_storage_service().use_cloud is False  # cloud disabled in tests

    async def _run():
        a = await store_upload(b"hello", "doc.pdf", "application/pdf",
                               prefix="client", public=False)
        b = await store_upload(b"img-bytes", "logo.png", "image/png",
                               prefix="branding", public=True)
        return a, b

    (url_priv, _s1, key_priv), (url_pub, _s2, key_pub) = asyncio.run(_run())
    # Local fallback → directly-servable /uploads URL, storage_key kept for parity
    assert url_priv.startswith("/uploads/") and key_priv.startswith("client/")
    assert url_pub.startswith("/uploads/") and key_pub.startswith("branding/")
