"""V4-DEPLOY-42 : aucun simulateur en production (environnements de test MTN MoMo / Orange Money, e-mail / SMS /
WhatsApp « console »)."""

from __future__ import annotations

import base64
from typing import Any

import pytest

from tests.conftest import make_user

PROD: dict[str, Any] = {
    "ENV": "production",
    "SECRET_KEY": "k" * 64,
    "MASTER_ENCRYPTION_KEY": base64.b64encode(b"m" * 32).decode(),
    "PUBLIC_BASE_URL": "https://globus.example",
    "API_PUBLIC_URL": "https://api.globus.example",
    "COOKIE_SECURE": True,
    "PAYMENT_PROVIDERS": ["mtn_momo", "orange_money", "cinetpay"],
    "MTN_MOMO_BASE_URL": "https://proxy.momoapi.mtn.com",
    "MTN_MOMO_TARGET_ENVIRONMENT": "mtncameroon",
    "ORANGE_OM_COUNTRY": "cm",
    "EMAIL_PROVIDER": "smtp",
}


def test_production_configuration_accepted_without_simulators() -> None:
    from app.core.config import Settings

    prod = Settings(**PROD)
    assert prod.is_production
    assert prod.DEMO_SEED_ALLOWED is False


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"MTN_MOMO_TARGET_ENVIRONMENT": "sandbox"}, "MTN MoMo"),
        ({"MTN_MOMO_BASE_URL": "https://sandbox.momodeveloper.mtn.com"}, "MTN MoMo"),
        ({"ORANGE_OM_COUNTRY": "dev"}, "Orange Money"),
        ({"EMAIL_PROVIDER": "console"}, "EMAIL_PROVIDER=console"),
        ({"PUBLIC_BASE_URL": "http://globus.example"}, "HTTPS"),
        ({"EMAIL_PROVIDER": "ses"}, "SES_REGION"),
    ],
)
def test_production_rejects_simulators(override: dict[str, Any], message: str) -> None:
    from app.core.config import Settings

    with pytest.raises(ValueError, match=message):
        Settings(**{**PROD, **override})


def test_console_channels_never_fake_a_delivery_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings
    from app.providers.base import ProviderNotConfigured
    from app.providers.messaging import ConsoleSmsProvider, ConsoleWhatsAppProvider, sms_available, whatsapp_available

    assert ConsoleSmsProvider().send("+237690000000", "dev").status == "sent"
    monkeypatch.setattr(settings, "ENV", "production")
    with pytest.raises(ProviderNotConfigured):
        ConsoleSmsProvider().send("+237690000000", "code")
    with pytest.raises(ProviderNotConfigured):
        ConsoleWhatsAppProvider().send_text("+237690000000", "code")
    assert sms_available() is False
    assert whatsapp_available() is False


def test_otp_falls_back_to_email_when_channel_unavailable(db: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.identity.service import issue_otp
    from app.providers import messaging

    user = make_user(db, roles=["CLIENT"], org_kind="client")
    assert issue_otp(db, user, purpose="decision", payload={}, channel="sms")["channel"] == "sms"
    monkeypatch.setattr(messaging, "sms_available", lambda: False)
    monkeypatch.setattr(messaging, "whatsapp_available", lambda: False)
    for channel in ("sms", "whatsapp"):
        result = issue_otp(db, user, purpose="decision", payload={}, channel=channel)
        assert result["channel"] == "email"
        assert result["sent_to"].endswith(user.email[-3:])


def test_ses_provider_sends_raw_mime_with_instance_role_and_maps_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    """Amazon SES : message MIME brut (pièce jointe conservée), aucun secret ; erreurs typées (réessai si quota)."""
    import boto3
    from botocore.stub import ANY, Stubber

    from app.core.config import Settings, settings
    from app.providers.base import ProviderError
    from app.providers.email import EmailMessage, SesEmailProvider, get_email_provider

    assert Settings(**{**PROD, "EMAIL_PROVIDER": "ses", "SES_REGION": "eu-west-3"}).EMAIL_PROVIDER == "ses"
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "ses")
    monkeypatch.setattr(settings, "SES_REGION", "eu-west-3")
    monkeypatch.setattr(settings, "SES_CONFIGURATION_SET", "globus-test")
    assert isinstance(get_email_provider(), SesEmailProvider)

    client = boto3.client(
        "sesv2", region_name="eu-west-3", aws_access_key_id="testing", aws_secret_access_key="testing"
    )
    message = EmailMessage(
        to=["client@example.org"],
        subject="Votre code",
        html="<p>Code 123456</p>",
        text="Code 123456",
        attachments=[("recu.pdf", b"%PDF-1.4", "application/pdf")],
    )
    with Stubber(client) as stub:
        stub.add_response(
            "send_email",
            {"MessageId": "ses-0001"},
            {
                "FromEmailAddress": ANY,
                "Destination": {"ToAddresses": ["client@example.org"]},
                "Content": ANY,
                "ConfigurationSetName": "globus-test",
            },
        )
        result = SesEmailProvider(client).send(message)
        assert result.message_id == "ses-0001" and result.status == "sent"
        stub.add_client_error("send_email", service_error_code="TooManyRequestsException", http_status_code=429)
        with pytest.raises(ProviderError) as excinfo:
            SesEmailProvider(client).send(message)
        assert excinfo.value.retryable is True
        stub.add_client_error("send_email", service_error_code="MessageRejected", http_status_code=400)
        with pytest.raises(ProviderError) as rejected:
            SesEmailProvider(client).send(message)
        assert rejected.value.retryable is False
