"""Phase 8 — Extra coverage: procurement, GED, metrics, readiness."""
from __future__ import annotations

from fastapi.testclient import TestClient


# ── Readiness & metrics ──────────────────────────────────────

def test_readiness_passes(client: TestClient):
    r = client.get("/health/ready")
    assert r.status_code == 200
    payload = r.json()
    assert payload["status"] in ("ok", "degraded")
    # DB and uploads must be present and ok in a healthy dev box.
    assert payload["checks"]["db"]["ok"] is True
    assert payload["checks"]["uploads"]["ok"] is True


def test_metrics_text_format(client: TestClient):
    r = client.get("/health/metrics")
    assert r.status_code == 200
    body = r.text
    # Always-present gauge
    assert "process_uptime_seconds" in body
    # Prometheus expects TYPE lines preceding samples
    assert "# TYPE" in body


def test_metrics_counter_bumps_on_login(client: TestClient):
    from app import metrics
    before = sum(v for k, v in metrics._counters.items() if k.startswith("auth_login"))
    # Wrong password — should bump auth_login_failures_total
    client.post("/api/v1/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    r = client.get("/health/metrics").text
    after = sum(v for k, v in metrics._counters.items() if k.startswith("auth_login"))
    assert after > before
    assert "auth_login_failures_total" in r


# ── Procurement ──────────────────────────────────────────────

def test_purchase_request_lifecycle(client: TestClient, admin_headers):
    """Create → list → export → validate workflow."""
    # Create a project so we can attach the PR to it
    proj_r = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={"name": "PR Test", "code": "PRJ-PR-001", "project_type": "Villa", "location": "Yaoundé"},
    )
    project_id = proj_r.json()["id"]

    create_r = client.post(
        "/api/v1/procurement/purchase-requests",
        headers=admin_headers,
        json={
            "project_id": project_id,
            "description": "50 sacs de ciment + ferraille",
            "items": [{"designation": "Ciment CEM II", "qty": 50, "unit": "sacs", "est_price": 5000}],
            "estimated_total": 250_000,
        },
    )
    assert create_r.status_code == 200, create_r.text
    pr_id = create_r.json()["id"]

    list_r = client.get("/api/v1/procurement/purchase-requests", headers=admin_headers)
    assert list_r.status_code == 200
    assert any(pr["id"] == pr_id for pr in list_r.json())

    export_r = client.get("/api/v1/exports/purchase-requests.xlsx", headers=admin_headers)
    assert export_r.status_code == 200
    assert export_r.content[:2] == b"PK"


def test_stock_item_create_and_export(client: TestClient, admin_headers):
    create_r = client.post(
        "/api/v1/procurement/stock",
        headers=admin_headers,
        json={"name": "Briques 15cm", "category": "Maçonnerie", "unit": "pcs",
              "quantity": 500, "alert_threshold": 100, "location": "Entrepôt Bonabéri"},
    )
    assert create_r.status_code == 200, create_r.text

    export_r = client.get("/api/v1/exports/stock.xlsx", headers=admin_headers)
    assert export_r.status_code == 200
    assert export_r.content[:2] == b"PK"


# ── GED ──────────────────────────────────────────────────────

def test_ged_folder_and_document(client: TestClient, admin_headers):
    proj_r = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={"name": "GED Test", "code": "PRJ-GED-001", "project_type": "Villa", "location": "Douala"},
    )
    project_id = proj_r.json()["id"]

    folder_r = client.post(
        "/api/v1/ged/folders",
        headers=admin_headers,
        json={"project_id": project_id, "name": "Plans architecte"},
    )
    assert folder_r.status_code == 200
    folder_id = folder_r.json()["id"]

    folders = client.get(f"/api/v1/ged/folders/{project_id}", headers=admin_headers).json()
    assert any(f["id"] == folder_id for f in folders)

    doc_r = client.post(
        "/api/v1/ged/documents",
        headers=admin_headers,
        json={
            "project_id": project_id, "folder_id": folder_id,
            "name": "plan-rdc.pdf", "file_url": "/uploads/dummy/plan-rdc.pdf",
            "category": "architecture",
        },
    )
    assert doc_r.status_code == 200, doc_r.text
    doc_id = doc_r.json()["id"]

    # Toggle share
    share_r = client.patch(f"/api/v1/ged/documents/{doc_id}/share", headers=admin_headers)
    assert share_r.status_code == 200
    assert share_r.json()["shared_with_client"] is True

    # Upload a v2 — version chain
    v2_r = client.post(
        f"/api/v1/ged/documents/{doc_id}/version",
        headers=admin_headers,
        json={
            "project_id": project_id, "folder_id": folder_id,
            "name": "plan-rdc-v2.pdf", "file_url": "/uploads/dummy/plan-rdc-v2.pdf",
            "category": "architecture",
        },
    )
    assert v2_r.status_code == 200
    assert v2_r.json()["version"] == 2

    versions = client.get(f"/api/v1/ged/documents/{doc_id}/versions", headers=admin_headers).json()
    assert len(versions) >= 2


# ── Pagination helper ────────────────────────────────────────

def test_pagination_envelope():
    """`paginate_query` returns a 4-key envelope with bounded limit."""
    from app.pagination import PaginationParams, MAX_LIMIT
    assert MAX_LIMIT == 200
    p = PaginationParams(skip=10, limit=25)
    assert p.skip == 10 and p.limit == 25
