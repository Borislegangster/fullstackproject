"""Phase 17 — Procurement integration tests (stock, movements, purchase requests)."""
import uuid

import pytest

API = "/api/v1"


@pytest.fixture(scope="module")
def stock_item_id(client, admin_auth):
    r = client.post(f"{API}/procurement/stock", headers=admin_auth, json={
        "name": f"Ciment-{uuid.uuid4().hex[:6]}", "unit": "sac",
        "quantity": 100, "alert_threshold": 20,
    })
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_list_stock(client, admin_headers):
    r = client.get(f"{API}/procurement/stock", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_stock_item_appears(client, admin_headers, stock_item_id):
    items = client.get(f"{API}/procurement/stock", headers=admin_headers).json()
    assert any(i["id"] == stock_item_id for i in items)


def test_stock_movement_increases_quantity(client, admin_headers, stock_item_id):
    r = client.post(f"{API}/procurement/stock/movements", headers=admin_headers, json={
        "stock_item_id": stock_item_id, "movement_type": "IN", "quantity": 50,
    })
    assert r.status_code == 200, r.text
    items = client.get(f"{API}/procurement/stock", headers=admin_headers).json()
    item = [i for i in items if i["id"] == stock_item_id][0]
    assert item["quantity"] >= 150


def test_stock_movements_list(client, admin_headers):
    r = client.get(f"{API}/procurement/stock/movements", headers=admin_headers)
    assert r.status_code == 200


def test_create_and_validate_purchase_request(client, admin_headers, sample_project):
    r = client.post(f"{API}/procurement/purchase-requests", headers=admin_headers, json={
        "project_id": sample_project["id"], "description": "Achat ciment",
        "estimated_total": 500000, "items": [{"name": "Ciment", "qty": 50}],
    })
    assert r.status_code == 200, r.text
    pr_id = r.json()["id"]

    v = client.post(f"{API}/procurement/purchase-requests/{pr_id}/validate", headers=admin_headers)
    assert v.status_code == 200, v.text


def test_list_purchase_requests(client, admin_headers):
    r = client.get(f"{API}/procurement/purchase-requests", headers=admin_headers)
    assert r.status_code == 200


def test_list_purchase_orders(client, admin_headers):
    r = client.get(f"{API}/procurement/purchase-orders", headers=admin_headers)
    assert r.status_code == 200


def test_delete_stock_item(client, admin_headers, stock_item_id):
    r = client.delete(f"{API}/procurement/stock/{stock_item_id}", headers=admin_headers)
    assert r.status_code == 200


def test_procurement_requires_auth(client):
    assert client.get(f"{API}/procurement/stock").status_code in (401, 403)
