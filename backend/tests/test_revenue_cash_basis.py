"""Cash-basis revenue recognition (reconnaissance à l'encaissement).

Verifies that the stats recognise revenue from real `Payment` rows (partials
included) IN ADDITION to fully-paid invoices, without double-counting.
"""
import datetime

API = "/api/v1"


def _this_month() -> str:
    return datetime.datetime.utcnow().strftime("%Y-%m")


def _month_row(client, admin_headers):
    rows = client.get(f"{API}/reports/revenue-by-month?months=3", headers=admin_headers).json()
    m = _this_month()
    return next((r for r in rows if r["month"] == m), {"revenue": 0.0, "invoiced": 0.0})


def test_cash_basis_partial_then_full_no_double_count(
    client, admin_headers, client_user_id, sample_project
):
    # A 100k invoice, sent (ENVOYEE)
    inv = client.post(f"{API}/invoices", headers=admin_headers, json={
        "project_id": sample_project["id"], "client_id": client_user_id,
        "invoice_type": "FACTURE", "total": 100_000, "subtotal": 100_000,
    }).json()["id"]
    client.patch(f"{API}/invoices/{inv}/send", headers=admin_headers)

    base = _month_row(client, admin_headers)

    # 1) Partial payment 30k → recognised in cash, NOT in the accrual/invoiced figure
    r = client.post(f"{API}/invoices/payments", headers=admin_headers, json={
        "invoice_id": inv, "amount": 30_000, "method": "mobile_money",
    })
    assert r.status_code == 200, r.text
    after_partial = _month_row(client, admin_headers)
    assert round(after_partial["revenue"] - base["revenue"]) == 30_000   # cash sees it
    assert round(after_partial["invoiced"] - base["invoiced"]) == 0      # accrual does not

    # 2) Mark fully paid → records a Payment for the 70k balance + invoice PAYEE
    client.patch(f"{API}/invoices/{inv}/mark-paid", headers=admin_headers)
    after_paid = _month_row(client, admin_headers)
    # Cash total = 30k + 70k = 100k (NOT 130k — no double counting with invoiced)
    assert round(after_paid["revenue"] - base["revenue"]) == 100_000
    assert round(after_paid["invoiced"] - base["invoiced"]) == 100_000


def test_dashboard_monthly_revenue_is_cash_basis(
    client, admin_headers, client_user_id, sample_project
):
    before = client.get(f"{API}/reports/dashboard", headers=admin_headers).json()
    assert "monthly_revenue" in before and "monthly_revenue_invoiced" in before

    inv = client.post(f"{API}/invoices", headers=admin_headers, json={
        "project_id": sample_project["id"], "client_id": client_user_id,
        "invoice_type": "FACTURE", "total": 40_000, "subtotal": 40_000,
    }).json()["id"]
    client.patch(f"{API}/invoices/{inv}/send", headers=admin_headers)
    # Partial 25k → cash-basis monthly_revenue rises, invoiced (accrual) does not
    client.post(f"{API}/invoices/payments", headers=admin_headers, json={
        "invoice_id": inv, "amount": 25_000, "method": "cash",
    })
    after = client.get(f"{API}/reports/dashboard", headers=admin_headers).json()
    assert round(after["monthly_revenue"] - before["monthly_revenue"]) == 25_000
    assert round(after["monthly_revenue_invoiced"] - before["monthly_revenue_invoiced"]) == 0
