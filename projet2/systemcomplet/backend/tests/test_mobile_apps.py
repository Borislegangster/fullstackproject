"""Applications mobiles : jetons bearer (X-Client-App), passerelle web à usage unique vers les visionneuses 3D
(/auth/web-session), enregistrement push FCM."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import PASSWORD, make_user


def _mobile(app_name: str = "mobile-client") -> TestClient:
    return TestClient(app, headers={"X-Client-App": app_name})


def _login(c: TestClient, email: str) -> dict[str, str]:
    resp = c.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": PASSWORD,
            "device_key": "appareil-test-0001",
            "device_name": "Pixel · Android 15",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    # Applications mobiles : jetons dans la réponse, aucun cookie de session.
    assert body["access_token"] and body["refresh_token"]
    assert "globus_access" not in resp.cookies
    return {"Authorization": f"Bearer {body['access_token']}", "refresh": body["refresh_token"]}


def test_mobile_login_refresh_rotation(db):
    user = make_user(db, email="client.mobile@example.com", roles=["CLIENT"], org_kind="client")
    with _mobile() as c:
        tokens = _login(c, user.email)
        me = c.get("/api/v1/auth/me", headers={"Authorization": tokens["Authorization"]})
        assert me.status_code == 200
        assert "client" in me.json()["spaces"]
        rotated = c.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh"]})
        assert rotated.status_code == 200, rotated.text
        assert rotated.json()["refresh_token"] != tokens["refresh"]
        # Un refresh token déjà utilisé est refusé (rotation).
        reused = c.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh"]})
        assert reused.status_code == 401


def test_web_session_handoff_is_single_use_and_scoped(db):
    user = make_user(db, email="client.viewer@example.com", roles=["CLIENT"], org_kind="client")
    with _mobile() as c:
        tokens = _login(c, user.email)
        auth = {"Authorization": tokens["Authorization"]}
        bad = c.post("/api/v1/auth/web-session", headers=auth, json={"next": "/erp/finances"})
        assert bad.status_code == 400
        assert bad.json()["error"]["code"] == "INVALID_NEXT"
        traversal = c.post("/api/v1/auth/web-session", headers=auth, json={"next": "/embarque/../erp"})
        assert traversal.status_code == 400
        res = c.post("/api/v1/auth/web-session", headers=auth, json={"next": "/embarque/maquette/abc"})
        assert res.status_code == 200, res.text
        url = res.json()["url"]
        token = url.rsplit("/", 1)[1]
        assert res.json()["expires_in"] == 60

    with TestClient(app) as browser:
        opened = browser.get(f"/api/v1/auth/web-session/{token}", follow_redirects=False)
        assert opened.status_code == 303, opened.text
        assert opened.headers["location"] == "/embarque/maquette/abc"
        assert "globus_access" in opened.cookies
        assert opened.headers["cache-control"] == "no-store"
        # La session web ouverte permet d'appeler l'API avec les cookies (comme la vue web embarquée).
        me = browser.get("/api/v1/auth/me", headers={"X-Client-App": "web"})
        assert me.status_code == 200
        assert me.json()["email"] == user.email
        # Lien à usage unique.
        again = TestClient(app).get(f"/api/v1/auth/web-session/{token}", follow_redirects=False)
        assert again.status_code == 400
        assert again.json()["error"]["code"] == "INVALID_TOKEN"


def test_web_session_refused_from_web_and_after_logout(db, web_client):
    user = make_user(db, email="client.web@example.com", roles=["CLIENT"], org_kind="client")
    login = web_client.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
    assert login.status_code == 200
    csrf = web_client.cookies.get("globus_csrf")
    refused = web_client.post(
        "/api/v1/auth/web-session", json={"next": "/embarque/maquette/abc"}, headers={"X-CSRF-Token": csrf or ""}
    )
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "WEB_HANDOFF_FORBIDDEN"

    with _mobile() as c:
        tokens = _login(c, user.email)
        auth = {"Authorization": tokens["Authorization"]}
        token = (
            c.post("/api/v1/auth/web-session", headers=auth, json={"next": "/embarque/360/p/c"})
            .json()["url"]
            .rsplit("/", 1)[1]
        )
        assert c.post("/api/v1/auth/logout", headers=auth).status_code == 200
    # Session de l'application révoquée : le lien n'ouvre plus rien.
    expired = TestClient(app).get(f"/api/v1/auth/web-session/{token}", follow_redirects=False)
    assert expired.status_code == 401
    assert expired.json()["error"]["code"] == "WEB_HANDOFF_EXPIRED"


def test_mobile_push_subscription_fcm(db):
    user = make_user(db, email="terrain.push@example.com", roles=["TECHNICIEN"])
    with _mobile("mobile-field") as c:
        tokens = _login(c, user.email)
        auth = {"Authorization": tokens["Authorization"]}
        sub = c.post(
            "/api/v1/push/subscriptions",
            headers=auth,
            json={
                "kind": "fcm",
                "endpoint": "fcm-token-" + "x" * 40,
                "application": "mobile-field",
                "device_name": "Pixel",
            },
        )
        assert sub.status_code == 201, sub.text
        assert sub.json()["kind"] == "fcm"
        off = c.post("/api/v1/push/unsubscribe", headers=auth, json={"endpoint": "fcm-token-" + "x" * 40})
        assert off.status_code == 200


def test_offline_incident_links_photos_sent_before_mutation(db):
    """Application terrain : photos d'incident envoyées hors ligne (/qhse/files) avant la mutation, rattachées
    par empreinte SHA-256 et auteur ; rejeu sans doublon ; la photo d'un autre utilisateur n'est jamais liée."""
    import hashlib
    import io
    import uuid

    from PIL import Image

    from tests.conftest import as_role, login

    def png(color: tuple[int, int, int]) -> bytes:
        buf = io.BytesIO()
        Image.new("RGB", (8, 8), color).save(buf, format="PNG")
        return buf.getvalue()

    with _mobile("mobile-field") as c:
        admin = make_user(db, email=f"admin-m-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
        ah = login(c, admin.email)
        project = c.post("/api/v1/projects", headers=ah, json={"name": "Villa Kribi", "status": "execution"}).json()
        chef, ch = as_role(c, db, "CHEF_CHANTIER")
        other, oh = as_role(c, db, "CHEF_CHANTIER")
        for u in (chef, other):
            c.post(
                f"/api/v1/projects/{project['id']}/members",
                headers=ah,
                json={"user_id": str(u.id), "project_role": "chef_chantier"},
            )
        mine, foreign = png((200, 40, 40)), png((40, 200, 40))
        up = c.post(
            "/api/v1/qhse/files",
            headers=ch,
            files={"file": ("garde-corps.png", mine, "image/png")},
            data={"latitude": "4.05", "longitude": "9.70", "client_mutation_id": "up-0001"},
        )
        assert up.status_code == 201, up.text
        assert (
            c.post("/api/v1/qhse/files", headers=oh, files={"file": ("x.png", foreign, "image/png")}).status_code == 201
        )

        mutation = {
            "client_mutation_id": "m-incident-0001",
            "entity": "incident",
            "operation": "create",
            "payload": {
                "project_id": project["id"],
                "kind": "securite",
                "severity": "high",
                "occurred_at": "2026-10-16T08:30:00+00:00",
                "title": "Garde-corps manquant au R+1",
                "photo_checksums": [hashlib.sha256(mine).hexdigest(), hashlib.sha256(foreign).hexdigest()],
                "source": "offline",
            },
        }
        res = c.post("/api/v1/sync/push", headers=ch, json={"device_id": "terrain-01", "mutations": [mutation]})
        assert res.status_code == 200, res.text
        result = res.json()["results"][0]
        assert result["status"] == "applied", result
        incident_id = result["result"]["incident_id"]
        replay = c.post("/api/v1/sync/push", headers=ch, json={"mutations": [mutation]}).json()["results"][0]
        assert replay["status"] == "applied" and replay["result"]["incident_id"] == incident_id

        detail = c.get(f"/api/v1/qhse/incidents/{incident_id}", headers=ah).json()
        assert detail["photo_file_ids"] == [up.json()["file_id"]], "seule ma photo est liée"
        assert detail["source"] == "offline"
        listed = c.get("/api/v1/qhse/incidents", headers=ah, params={"project_id": project["id"]}).json()
        assert sum(1 for i in listed["items"] if i["title"] == "Garde-corps manquant au R+1") == 1, "aucun doublon"
