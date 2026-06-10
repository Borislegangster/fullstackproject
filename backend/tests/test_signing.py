"""Phase 17 — Electronic-signature router guards.

The full OTP happy-path requires an emailed code (never returned by the API), so
these tests assert the security guards: unknown documents 404, bad/empty codes are
rejected, and the endpoints require authentication.
"""
API = "/api/v1"


def test_request_otp_unknown_document_404(client, client_headers):
    r = client.post(f"{API}/signing/documents/nope-xxxx/request-otp", headers=client_headers)
    assert r.status_code == 404


def test_verify_otp_unknown_document_404(client, client_headers):
    r = client.post(f"{API}/signing/documents/nope-xxxx/verify-otp",
                    headers=client_headers, json={"code": "123456"})
    assert r.status_code == 404


def test_verify_otp_rejects_malformed_code(client, client_headers):
    # 3-digit code violates the 6-digit pattern → 422 validation error.
    r = client.post(f"{API}/signing/documents/nope-xxxx/verify-otp",
                    headers=client_headers, json={"code": "123"})
    assert r.status_code == 422


def test_audit_unknown_document_404(client, admin_headers):
    r = client.get(f"{API}/signing/documents/nope-xxxx/audit", headers=admin_headers)
    assert r.status_code == 404


def test_signing_requires_auth(client):
    r = client.post(f"{API}/signing/documents/x/request-otp")
    assert r.status_code in (401, 403)
