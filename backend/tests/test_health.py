"""Health & readiness endpoints — Phase 4."""


def test_health_root(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_db(client):
    r = client.get("/health/db")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_health_smtp(client):
    r = client.get("/health/smtp")
    assert r.status_code == 200
    # SMTP not configured in tests → should report not configured
    body = r.json()
    assert "ok" in body


def test_health_aps(client):
    r = client.get("/health/aps")
    assert r.status_code == 200
    assert "ok" in r.json()


def test_health_uploads(client):
    r = client.get("/health/uploads")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_health_ready(client):
    r = client.get("/health/ready")
    assert r.status_code == 200
    body = r.json()
    assert "checks" in body
    assert body["checks"]["db"]["ok"] is True
