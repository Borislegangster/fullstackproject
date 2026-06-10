"""Phase 7 — PDF generation, Excel exports, signature OTP, QR codes."""
from __future__ import annotations

import re
from fastapi.testclient import TestClient


# ── PDF service primitives ───────────────────────────────────

def test_render_invoice_pdf_smoke():
    """The PDF helper must turn the template into a non-empty PDF blob."""
    from app.services.pdf_service import render_pdf
    from datetime import datetime

    pdf = render_pdf(
        "invoice.html",
        {
            "invoice": {
                "code": "FAC-2026-001", "invoice_type": "FACTURE", "status": "BROUILLON",
                "issue_date": datetime(2026, 5, 30), "due_date": datetime(2026, 6, 30),
                "subtotal": 100_000, "tax_rate": 19.25, "tax_amount": 19_250,
                "total": 119_250, "amount_paid": 0,
                "lines": [{"designation": "Test", "qty": 1, "unit_price": 100_000, "total": 100_000}],
                "notes": "",
            },
            "client": {"full_name": "Jean Talla", "email": "jean@example.com"},
            "project": {"code": "PRJ-001", "name": "Villa", "location": "Douala"},
            "generated_at": datetime(2026, 5, 30),
        },
    )
    assert isinstance(pdf, bytes) and len(pdf) > 1500
    assert pdf[:4] == b"%PDF"


def test_render_payslip_pdf_smoke():
    from app.services.pdf_service import render_pdf
    from datetime import datetime

    pdf = render_pdf(
        "payslip.html",
        {
            "payroll": {
                "id": "abc", "period": "2026-05", "worker_type": "employee",
                "days_worked": 22, "base_amount": 200_000, "bonuses": 10_000,
                "deductions": 0, "advances": 0, "net_amount": 210_000,
                "status": "VALIDE", "paid_at": None,
            },
            "worker": {
                "full_name": "Marie Ngo", "first_name": "Marie", "last_name": "Ngo",
                "employee_code": "EMP-001", "position": "Comptable",
                "department": "Finance", "contract_type": "CDI",
            },
            "generated_at": datetime(2026, 5, 30),
        },
    )
    assert pdf.startswith(b"%PDF")


# ── Excel service primitives ─────────────────────────────────

def test_export_rows_returns_xlsx_blob():
    from app.services.excel_service import export_rows
    blob = export_rows(
        "Test", ["Col A", "Col B"], [["x", 1], ["y", 2]],
    )
    # XLSX is a zip — PK header marker
    assert blob[:2] == b"PK"
    assert len(blob) > 500


# ── Excel endpoints (Phase 7) ────────────────────────────────

def test_exports_invoices_xlsx_admin(client: TestClient, admin_headers):
    r = client.get("/api/v1/exports/invoices.xlsx", headers=admin_headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert "attachment" in r.headers.get("content-disposition", "")
    assert r.content[:2] == b"PK"


def test_exports_projects_xlsx_admin(client: TestClient, admin_headers):
    r = client.get("/api/v1/exports/projects.xlsx", headers=admin_headers)
    assert r.status_code == 200
    assert r.content[:2] == b"PK"


def test_exports_leads_xlsx_admin(client: TestClient, admin_headers):
    r = client.get("/api/v1/exports/leads.xlsx", headers=admin_headers)
    assert r.status_code == 200


def test_exports_employees_xlsx_admin(client: TestClient, admin_headers):
    r = client.get("/api/v1/exports/employees.xlsx", headers=admin_headers)
    assert r.status_code == 200


def test_exports_xlsx_requires_auth(client: TestClient):
    r = client.get("/api/v1/exports/invoices.xlsx")
    assert r.status_code in (401, 403)


def test_exports_csv_format(client: TestClient, admin_headers):
    r = client.get("/api/v1/exports/invoices.xlsx?fmt=csv", headers=admin_headers)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert ".csv" in r.headers.get("content-disposition", "")
    # UTF-8 BOM + header row
    assert r.content[:3] == b"\xef\xbb\xbf"
    assert b"Code" in r.content


def test_exports_pdf_format(client: TestClient, admin_headers):
    r = client.get("/api/v1/exports/projects.xlsx?fmt=pdf", headers=admin_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert ".pdf" in r.headers.get("content-disposition", "")
    assert r.content[:5] == b"%PDF-"


def test_exports_excel_alias_and_default(client: TestClient, admin_headers):
    # explicit excel → xlsx, and no fmt → xlsx default
    for url in ("/api/v1/exports/projects.xlsx?fmt=excel", "/api/v1/exports/projects.xlsx"):
        r = client.get(url, headers=admin_headers)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"


def test_exports_date_range_accepted(client: TestClient, admin_headers):
    r = client.get(
        "/api/v1/exports/invoices.xlsx?fmt=csv&date_from=2020-01-01&date_to=2020-12-31",
        headers=admin_headers,
    )
    assert r.status_code == 200
    # Far-past window → only the header line remains (no data rows)
    body = r.content.decode("utf-8")
    assert body.count("\r\n") <= 1


# ── PDF endpoints ────────────────────────────────────────────

def test_invoice_pdf_endpoint(client: TestClient, admin_headers):
    """Create an invoice, then download its PDF."""
    # Need a project + client first — reuse the seeded client.
    # Smallest path: create a project, then an invoice, then GET the PDF.
    me = client.get("/api/v1/auth/me", headers=admin_headers).json()
    client_user = client.get("/api/v1/admin/users", headers=admin_headers).json()
    client_id = next((u["id"] for u in client_user if u["role"] == "CLIENT"), None)
    assert client_id, "Seeded CLIENT user should be visible to ADMIN"

    proj_r = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={
            "name": "Villa Test", "code": "PRJ-TEST-001",
            "client_id": client_id, "project_type": "Villa R+1",
            "location": "Douala",
        },
    )
    assert proj_r.status_code in (200, 201), proj_r.text
    project_id = proj_r.json()["id"]

    inv_r = client.post(
        "/api/v1/invoices",
        headers=admin_headers,
        json={
            "project_id": project_id, "client_id": client_id,
            "invoice_type": "FACTURE",
            "lines": [{"designation": "Études", "qty": 1, "unit_price": 500_000, "total": 500_000}],
            "subtotal": 500_000, "tax_rate": 19.25, "tax_amount": 96_250,
            "total": 596_250,
        },
    )
    assert inv_r.status_code == 200, inv_r.text
    invoice_id = inv_r.json()["id"]

    pdf_r = client.get(f"/api/v1/invoices/{invoice_id}/pdf", headers=admin_headers)
    assert pdf_r.status_code == 200
    assert pdf_r.content.startswith(b"%PDF")
    assert "application/pdf" in pdf_r.headers["content-type"]


# ── QR code endpoint ─────────────────────────────────────────

def test_temp_worker_qr_png(client: TestClient, admin_headers):
    """Create a temp worker then fetch their QR badge."""
    create_r = client.post(
        "/api/v1/hr/temp-workers",
        headers=admin_headers,
        json={"first_name": "Pierre", "last_name": "Mballa",
              "phone": "699111222", "speciality": "Maçon", "daily_rate": 8000},
    )
    assert create_r.status_code == 200, create_r.text
    worker_id = create_r.json()["id"]

    qr_r = client.get(f"/api/v1/hr/temp-workers/{worker_id}/qr.png", headers=admin_headers)
    assert qr_r.status_code == 200
    assert qr_r.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert "image/png" in qr_r.headers["content-type"]


# ── Signing OTP flow ─────────────────────────────────────────

def _seed_signable_document(client: TestClient, admin_headers, client_user_id: str) -> str:
    # Create a project shared with the client, then a document
    proj_r = client.post(
        "/api/v1/projects",
        headers=admin_headers,
        json={"name": "Test Sign", "code": "PRJ-SIGN-001", "client_id": client_user_id,
              "project_type": "Villa", "location": "Yaoundé"},
    )
    assert proj_r.status_code == 200, proj_r.text
    project_id = proj_r.json()["id"]
    doc_r = client.post(
        "/api/v1/ged/documents",
        headers=admin_headers,
        json={"project_id": project_id, "name": "contrat-test.pdf",
              "file_url": "/uploads/dummy.pdf", "category": "contrat"},
    )
    assert doc_r.status_code == 200, doc_r.text
    doc_id = doc_r.json()["id"]
    # Share with the client
    share_r = client.patch(f"/api/v1/ged/documents/{doc_id}/share", headers=admin_headers)
    assert share_r.status_code == 200
    return doc_id


def test_signing_otp_request_and_verify(client: TestClient, admin_headers, client_headers):
    """The full OTP signing flow: request → verify → audit."""
    # Resolve the client user id
    users = client.get("/api/v1/admin/users", headers=admin_headers).json()
    client_id = next(u["id"] for u in users if u["role"] == "CLIENT")

    doc_id = _seed_signable_document(client, admin_headers, client_id)

    # Step 1 — request OTP (returns 200, never reveals the code)
    req_r = client.post(
        f"/api/v1/signing/documents/{doc_id}/request-otp",
        headers=client_headers,
    )
    assert req_r.status_code == 200
    body = req_r.json()
    assert "expires_at" in body
    assert body["ttl_minutes"] >= 1
    assert "code" not in body  # security: code never leaks

    # Bad code → 400
    bad_r = client.post(
        f"/api/v1/signing/documents/{doc_id}/verify-otp",
        headers=client_headers,
        json={"code": "000000"},
    )
    assert bad_r.status_code == 400

    # Pull the real code from the DB to simulate the user reading their email.
    import asyncio
    from app.database import AsyncSessionLocal
    from app.models.erp import DocumentSignatureOTP
    from sqlalchemy import select

    async def latest_unconsumed():
        async with AsyncSessionLocal() as db:
            r = await db.execute(
                select(DocumentSignatureOTP).where(
                    DocumentSignatureOTP.document_id == doc_id,
                    DocumentSignatureOTP.consumed_at.is_(None),
                ).order_by(DocumentSignatureOTP.created_at.desc())
            )
            return r.scalars().first()

    otp_row = asyncio.run(latest_unconsumed())
    assert otp_row is not None
    # We cannot recover the plaintext code from the hash → re-request and patch.
    # Patch the hash with a known-code SHA256 to validate the flow end-to-end.
    import hashlib
    KNOWN = "654321"
    target_hash = hashlib.sha256(KNOWN.encode()).hexdigest()

    async def force_hash():
        async with AsyncSessionLocal() as db:
            r = await db.execute(
                select(DocumentSignatureOTP).where(DocumentSignatureOTP.id == otp_row.id)
            )
            row = r.scalars().first()
            row.code_hash = target_hash
            row.attempts = 0  # reset after the bad attempt above
            await db.commit()

    asyncio.run(force_hash())

    ok_r = client.post(
        f"/api/v1/signing/documents/{doc_id}/verify-otp",
        headers=client_headers,
        json={"code": KNOWN},
    )
    assert ok_r.status_code == 200, ok_r.text
    sig = ok_r.json()
    assert re.fullmatch(r"[0-9a-f]{64}", sig["document_hash"])
    assert sig["method"] == "OTP_EMAIL"

    # Audit trail visible to client
    audit_r = client.get(f"/api/v1/signing/documents/{doc_id}/audit", headers=client_headers)
    assert audit_r.status_code == 200
    rows = audit_r.json()
    assert len(rows) >= 1
    assert rows[0]["document_hash"] == sig["document_hash"]

    # Re-signing the same doc → 400 (already signed)
    again_r = client.post(
        f"/api/v1/signing/documents/{doc_id}/request-otp",
        headers=client_headers,
    )
    assert again_r.status_code == 400
