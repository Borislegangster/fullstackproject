"""WhatsApp via Kapso : messages envoyés à la passerelle compatible Meta avec la clé Kapso, webhook relayé par Kapso
(contenu Meta, signature X-Webhook-Signature) accepté, signature fausse refusée."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

from app.core.config import settings
from app.providers import messaging

API = "/api/v1"


class _Resp:
    status_code = 200
    headers = {"content-type": "application/json"}

    def json(self) -> Any:
        return {"messages": [{"id": "wamid.kapso.1"}]}


def test_kapso_sends_meta_payload_with_api_key(monkeypatch: Any) -> None:
    sent: list[dict[str, Any]] = []
    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "kapso")
    monkeypatch.setattr(settings, "META_WA_PHONE_NUMBER_ID", "597907523413541")
    monkeypatch.setattr(messaging, "get_secret", lambda name: {"KAPSO_API_KEY": "kapso-test"}.get(name))
    monkeypatch.setattr(
        messaging.httpx,
        "post",
        lambda url, json, timeout, headers: sent.append({"url": url, "json": json, "headers": headers}) or _Resp(),
    )
    assert messaging.whatsapp_available() is True
    provider = messaging.get_whatsapp_provider()
    assert isinstance(provider, messaging.KapsoWhatsAppProvider)
    result = provider.send_template(
        "+237 678 26 13 82", messaging.WhatsAppTemplate(name="globus_bon_de_commande", body_params=["BC-1"])
    )
    assert result.message_id == "wamid.kapso.1" and result.provider == "kapso"
    assert sent[0]["url"] == "https://api.kapso.ai/meta/whatsapp/v24.0/597907523413541/messages"
    assert sent[0]["headers"] == {"X-API-Key": "kapso-test"}
    assert sent[0]["json"]["to"] == "237678261382" and sent[0]["json"]["template"]["name"] == "globus_bon_de_commande"


def test_kapso_webhook_signature(client: Any, monkeypatch: Any) -> None:
    from app.core import secrets

    monkeypatch.setattr(settings, "WHATSAPP_PROVIDER", "kapso")
    real = secrets.get_secret
    monkeypatch.setattr(
        messaging, "get_secret", lambda name: "whsec-test" if name == "KAPSO_WEBHOOK_SECRET" else real(name)
    )
    body = json.dumps({"object": "whatsapp_business_account", "entry": []}).encode()
    good = hmac.new(b"whsec-test", body, hashlib.sha256).hexdigest()
    ok = client.post(
        f"{API}/webhooks/whatsapp",
        content=body,
        headers={"content-type": "application/json", "X-Webhook-Signature": good},
    )
    assert ok.status_code == 200, ok.text
    bad = client.post(
        f"{API}/webhooks/whatsapp",
        content=body,
        headers={"content-type": "application/json", "X-Webhook-Signature": "0" * 64},
    )
    assert bad.status_code == 401
