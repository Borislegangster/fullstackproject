"""Activation des prestataires depuis l'ERP (sans toucher au fichier du serveur) et besoin de chaque clé."""

from __future__ import annotations

import uuid
from typing import Any

from tests.conftest import login, make_user

API = "/api/v1/admin"


def _admin(client: Any, db: Any) -> dict[str, str]:
    admin = make_user(db, email=f"admin-integ-{uuid.uuid4().hex[:6]}@example.com", roles=["ADMIN"])
    return login(client, admin.email)


def _secret(client: Any, h: dict[str, str], name: str) -> dict[str, Any]:
    return next(s for s in client.get(f"{API}/secrets", headers=h).json() if s["name"] == name)


def test_sms_is_activated_from_the_erp_then_back_to_server_value(client: Any, db: Any) -> None:
    from app.core.config import settings

    h = _admin(client, db)
    assert _secret(client, h, "TWILIO_AUTH_TOKEN")["need"] == "unused"
    saved = client.put(
        f"{API}/integrations/config",
        headers=h,
        json={"values": {"SMS_PROVIDER": "twilio", "TWILIO_ACCOUNT_SID": "AC123", "TWILIO_FROM": "+15550001111"}},
    )
    assert saved.status_code == 200, saved.text
    fields = {f["name"]: f for f in saved.json()["fields"]}
    assert fields["SMS_PROVIDER"]["value"] == "twilio" and fields["SMS_PROVIDER"]["server_value"] == "console"
    assert settings.SMS_PROVIDER == "twilio" and settings.TWILIO_FROM == "+15550001111"
    # Clé désormais requise, et le service reste « non configuré » tant qu'elle manque.
    assert _secret(client, h, "TWILIO_AUTH_TOKEN")["need"] == "required"
    assert client.get(f"{API}/integrations", headers=h).json()["sms"]["configured"] is False

    back = client.put(f"{API}/integrations/config", headers=h, json={"values": {"SMS_PROVIDER": None}})
    assert back.status_code == 200, back.text
    assert settings.SMS_PROVIDER == "console"


def test_payment_providers_and_unknown_values_are_checked(client: Any, db: Any) -> None:
    from app.core.config import settings

    h = _admin(client, db)
    bad = client.put(f"{API}/integrations/config", headers=h, json={"values": {"PAYMENT_PROVIDERS": ["paypal"]}})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "INVALID_INTEGRATION_CONFIG"
    unknown = client.put(f"{API}/integrations/config", headers=h, json={"values": {"EMAIL_PROVIDER": "console"}})
    assert unknown.status_code == 422
    ok = client.put(
        f"{API}/integrations/config",
        headers=h,
        json={"values": {"PAYMENT_PROVIDERS": ["orange_money"], "ORANGE_OM_COUNTRY": "dev"}},
    )
    assert ok.status_code == 200, ok.text
    assert settings.PAYMENT_PROVIDERS == ["orange_money"]
    assert _secret(client, h, "ORANGE_OM_MERCHANT_KEY")["need"] == "required"
    assert _secret(client, h, "STRIPE_SECRET_KEY")["need"] == "unused"
    # Réglage protégé : la route générique des paramètres ne peut pas le contourner.
    sneaky = client.put(f"{API}/settings/integrations.config", headers=h, json={"value": {"SMS_PROVIDER": "twilio"}})
    assert sneaky.status_code in (400, 403, 404, 422)


def test_internal_transcription_needs_no_token(monkeypatch: Any, client: Any, db: Any) -> None:
    from app.core.config import settings

    h = _admin(client, db)
    monkeypatch.setattr(settings, "STT_PROVIDER", "http")
    monkeypatch.setattr(settings, "STT_HTTP_URL", "http://stt:9000/v1/audio/transcriptions")
    stt = _secret(client, h, "STT_HTTP_TOKEN")
    assert stt["need"] == "unused" and "serveur" in stt["need_reason"]
    monkeypatch.setattr(settings, "STT_HTTP_URL", "https://api.transcription.example.com/v1/audio/transcriptions")
    assert _secret(client, h, "STT_HTTP_TOKEN")["need"] == "optional"


def test_production_rules_refuse_test_environments(monkeypatch: Any) -> None:
    import base64
    import os

    from app.core import runtime_settings
    from app.core.config import settings

    for name, value in {
        "ENV": "production",
        "SECRET_KEY": "x" * 64,
        "MASTER_ENCRYPTION_KEY": base64.b64encode(os.urandom(32)).decode(),
        "PUBLIC_BASE_URL": "https://www.example.com",
        "API_PUBLIC_URL": "https://www.example.com",
        "EMAIL_PROVIDER": "smtp",
        "COOKIE_SECURE": True,
    }.items():
        monkeypatch.setattr(settings, name, value)
    errors = runtime_settings.validate({"PAYMENT_PROVIDERS": ["orange_money"], "ORANGE_OM_COUNTRY": "dev"})
    assert errors and "Orange Money" in errors[0] and "dev" in errors[0]
    assert runtime_settings.validate({"PAYMENT_PROVIDERS": ["orange_money"], "ORANGE_OM_COUNTRY": "cm"}) == []
