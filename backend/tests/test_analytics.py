"""Phase 11 — Analytics / chart endpoints.

Seeds (via the API, as admin) a project owned by the seeded CLIENT, plus
expenses, an overdue partially-paid invoice, a payment and attendance rows,
then exercises the 9 new analytics endpoints + RBAC.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient


def _past(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).replace(tzinfo=None).isoformat()


@pytest.fixture(scope="module")
def seeded(client: TestClient, admin_token):
    """Create the analytics dataset once; return key ids + a dedicated client token.

    Uses a DEDICATED client user (not the shared client@test.com) so this module
    never leaves a project attached to the shared fixtures — that would break
    other tests asserting the shared client has no project.
    """
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Dedicated client user, inserted directly (active, no forced password change).
    from app.database import AsyncSessionLocal
    from app.auth.models import User
    from app.auth.service import hash_password
    from sqlalchemy import select

    async def _ensure_user():
        async with AsyncSessionLocal() as db:
            r = await db.execute(select(User).where(User.email == "analytics-client@test.com"))
            u = r.scalars().first()
            if not u:
                u = User(
                    email="analytics-client@test.com", password_hash=hash_password("Client123!"),
                    first_name="Ana", last_name="Lytics", role="CLIENT",
                    is_active=True, must_change_password=False,
                )
                db.add(u)
                await db.commit()
                await db.refresh(u)
            return u.id

    client_id = asyncio.run(_ensure_user())

    # Token for the dedicated client.
    login = client.post("/api/v1/auth/login",
                        json={"email": "analytics-client@test.com", "password": "Client123!"})
    assert login.status_code == 200, login.text
    client_token = login.json()["access_token"]

    # Project owned by the client, with a budget.
    proj = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={"name": "Analytics Project", "project_type": "Villa R+1",
              "location": "Douala", "client_id": client_id, "budget_initial": 2_000_000},
    )
    assert proj.status_code == 200, proj.text
    project_id = proj.json()["id"]

    # Expenses across two categories (feeds expense-breakdown + cashflow outflow).
    for cat, amount, desc in [
        ("materials", 300_000, "Ciment"),
        ("labor", 200_000, "Main d'œuvre"),
        ("materials", 100_000, "Acier"),
    ]:
        r = client.post(
            f"/api/v1/projects/{project_id}/expenses",
            headers=admin_headers,
            json={"category": cat, "description": desc, "amount": amount},
        )
        assert r.status_code == 200, r.text

    # Overdue, partially paid invoice (feeds aging + client evolution/receipts).
    inv = client.post(
        "/api/v1/invoices",
        headers=admin_headers,
        json={"project_id": project_id, "client_id": client_id, "invoice_type": "FACTURE",
              "lines": [{"designation": "Travaux", "qty": 1, "unit_price": 1_000_000, "total": 1_000_000}],
              "subtotal": 1_000_000, "tax_rate": 0, "tax_amount": 0, "total": 1_000_000,
              "due_date": _past(45)},
    )
    assert inv.status_code == 200, inv.text
    invoice_id = inv.json()["id"]
    # Send it → status ENVOYEE so it counts toward aging.
    assert client.patch(f"/api/v1/invoices/{invoice_id}/send", headers=admin_headers).status_code == 200
    # Partial payment (400k of 1M) → still ENVOYEE, 600k outstanding.
    pay = client.post(
        "/api/v1/invoices/payments",
        headers=admin_headers,
        json={"invoice_id": invoice_id, "amount": 400_000, "method": "virement", "reference": "PAY-1"},
    )
    assert pay.status_code == 200, pay.text

    # Attendance rows (feeds attendance summary + resource-allocation workers).
    for wid, status in [("w-1", "PRESENT"), ("w-2", "PRESENT"), ("w-3", "RETARD")]:
        r = client.post(
            "/api/v1/hr/attendance/scan",
            headers=admin_headers,
            json={"worker_type": "temp_worker", "worker_id": wid,
                  "project_id": project_id, "status": status},
        )
        assert r.status_code == 200, r.text

    return {"project_id": project_id, "client_id": client_id, "invoice_id": invoice_id,
            "client_headers": {"Authorization": f"Bearer {client_token}"}}


# ── Reports ──────────────────────────────────────────────────

def test_expense_breakdown(client: TestClient, admin_headers, seeded):
    r = client.get("/api/v1/reports/expense-breakdown", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    cats = {row["category"]: row for row in data}
    assert "materials" in cats and "labor" in cats
    # materials = 300k + 100k = 400k ; labor = 200k
    assert cats["materials"]["amount"] == 400_000
    assert cats["materials"]["label"] == "Matériaux"
    assert cats["labor"]["amount"] == 200_000
    # Percentages sum to ~100.
    assert abs(sum(row["percentage"] for row in data) - 100) < 1.0


def test_project_performance(client: TestClient, admin_headers, seeded):
    r = client.get("/api/v1/reports/project-performance", headers=admin_headers)
    assert r.status_code == 200
    rows = r.json()
    mine = next(p for p in rows if p["project_id"] == seeded["project_id"])
    assert mine["budget_initial"] == 2_000_000
    assert "budget_used_pct" in mine and "progress" in mine


def test_projects_by_type(client: TestClient, admin_headers, seeded):
    r = client.get("/api/v1/reports/projects-by-type", headers=admin_headers)
    assert r.status_code == 200
    types = {row["type"]: row["count"] for row in r.json()}
    assert types.get("Villa R+1", 0) >= 1


def test_cashflow(client: TestClient, admin_headers, seeded):
    r = client.get("/api/v1/finances/cashflow?months=6", headers=admin_headers)
    assert r.status_code == 200
    series = r.json()
    assert len(series) == 6
    assert all({"month", "inflow", "outflow", "net"} <= set(pt) for pt in series)
    # Current month: inflow >= 400k (payment), outflow >= 600k (expenses).
    current = series[-1]
    assert current["inflow"] >= 400_000
    assert current["outflow"] >= 600_000


def test_invoice_aging(client: TestClient, admin_headers, seeded):
    r = client.get("/api/v1/invoices/stats/aging", headers=admin_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_outstanding"] >= 600_000
    buckets = {b["bucket"]: b for b in body["buckets"]}
    # 45 days overdue → 31-60 bucket holds at least the 600k outstanding.
    assert buckets["31_60"]["amount"] >= 600_000
    assert buckets["31_60"]["count"] >= 1


def test_resource_allocation(client: TestClient, admin_headers, seeded):
    r = client.get("/api/v1/projects/resource-allocation", headers=admin_headers)
    assert r.status_code == 200
    rows = r.json()
    mine = next(p for p in rows if p["project_id"] == seeded["project_id"])
    # 3 distinct workers pointed.
    assert mine["workers"] == 3
    assert "equipment" in mine and "budget_used_pct" in mine


def test_attendance_summary(client: TestClient, admin_headers, seeded):
    r = client.get("/api/v1/hr/attendance/summary?days=7", headers=admin_headers)
    assert r.status_code == 200
    series = r.json()
    assert len(series) == 7
    today = series[-1]
    assert today["present"] >= 2
    assert today["late"] >= 1


# ── Client analytics ─────────────────────────────────────────

def test_client_finances_evolution(client: TestClient, seeded):
    r = client.get("/api/v1/client/finances/evolution", headers=seeded["client_headers"])
    assert r.status_code == 200
    series = r.json()
    assert len(series) >= 1
    last = series[-1]
    assert last["invoiced"] >= 1_000_000   # cumulative invoiced
    assert last["paid"] >= 400_000          # cumulative paid
    assert last["budget"] == 2_000_000


def test_client_finances_receipts(client: TestClient, seeded):
    r = client.get("/api/v1/client/finances/receipts", headers=seeded["client_headers"])
    assert r.status_code == 200
    receipts = r.json()
    assert len(receipts) >= 1
    assert receipts[0]["amount"] == 400_000
    assert receipts[0]["reference"] == "PAY-1"
    assert receipts[0]["invoice_code"]


# ── RBAC ─────────────────────────────────────────────────────

def test_staff_analytics_forbidden_for_client(client: TestClient, client_headers, seeded):
    for ep in [
        "/api/v1/reports/expense-breakdown",
        "/api/v1/reports/project-performance",
        "/api/v1/reports/projects-by-type",
        "/api/v1/finances/cashflow",
        "/api/v1/invoices/stats/aging",
        "/api/v1/projects/resource-allocation",
        "/api/v1/hr/attendance/summary",
    ]:
        assert client.get(ep, headers=client_headers).status_code == 403, ep


def test_client_analytics_forbidden_for_staff(client: TestClient, admin_headers, seeded):
    # /client/* is CLIENT-only.
    assert client.get("/api/v1/client/finances/evolution", headers=admin_headers).status_code == 403
    assert client.get("/api/v1/client/finances/receipts", headers=admin_headers).status_code == 403
