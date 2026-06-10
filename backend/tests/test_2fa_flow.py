"""End-to-end 2FA flow — enroll → verify → login flow with 2FA."""
import pyotp


def test_full_2fa_enrollment_and_login(client):
    """A user enrolls 2FA, then logs out and logs back in, completing 2FA challenge."""

    # 1. Login normally as admin
    r = client.post("/api/v1/auth/login", json={
        "email": "admin@test.com", "password": "Admin123!"
    })
    assert r.status_code == 200
    token = r.json()["access_token"]
    H = {"Authorization": f"Bearer {token}"}

    # 2. Enroll
    r = client.post("/api/v1/auth/2fa/enroll", headers=H)
    assert r.status_code == 200
    secret = r.json()["secret"]
    assert secret

    # 3. Submit a valid TOTP to verify enrollment
    code = pyotp.TOTP(secret).now()
    r = client.post("/api/v1/auth/2fa/verify", headers=H, json={"code": code})
    assert r.status_code == 200, r.text
    backup_codes = r.json()["backup_codes"]
    assert len(backup_codes) >= 1

    # 4. Check status is now enabled
    r = client.get("/api/v1/auth/2fa/status", headers=H)
    assert r.json()["enabled"] is True

    # 5. Login again — should now return challenge_token instead of tokens
    r = client.post("/api/v1/auth/login", json={
        "email": "admin@test.com", "password": "Admin123!"
    })
    assert r.status_code == 200
    body = r.json()
    assert body.get("two_factor_required") is True
    challenge_token = body["challenge_token"]

    # 6. Complete login with the TOTP
    new_code = pyotp.TOTP(secret).now()
    r = client.post("/api/v1/auth/2fa/login-verify", json={
        "challenge_token": challenge_token,
        "code": new_code,
    })
    assert r.status_code == 200, r.text
    assert "access_token" in r.json()

    # 7. Disable 2FA via password
    new_token = r.json()["access_token"]
    H = {"Authorization": f"Bearer {new_token}"}
    r = client.post("/api/v1/auth/2fa/disable", headers=H, json={"password": "Admin123!"})
    assert r.status_code == 200

    # 8. Status should be disabled
    r = client.get("/api/v1/auth/2fa/status", headers=H)
    assert r.json()["enabled"] is False


def test_2fa_backup_code(client):
    """A backup code should also complete the 2FA challenge."""
    # Login + enroll
    token = client.post("/api/v1/auth/login", json={
        "email": "admin@test.com", "password": "Admin123!"
    }).json()["access_token"]
    H = {"Authorization": f"Bearer {token}"}

    secret = client.post("/api/v1/auth/2fa/enroll", headers=H).json()["secret"]
    code = pyotp.TOTP(secret).now()
    backup_codes = client.post("/api/v1/auth/2fa/verify", headers=H,
                                json={"code": code}).json()["backup_codes"]

    # Begin a fresh login
    r = client.post("/api/v1/auth/login", json={
        "email": "admin@test.com", "password": "Admin123!"
    })
    challenge = r.json()["challenge_token"]

    # Use a backup code
    r = client.post("/api/v1/auth/2fa/login-verify", json={
        "challenge_token": challenge,
        "code": backup_codes[0],
    })
    assert r.status_code == 200

    # Cleanup
    new_token = r.json()["access_token"]
    H = {"Authorization": f"Bearer {new_token}"}
    client.post("/api/v1/auth/2fa/disable", headers=H, json={"password": "Admin123!"})
