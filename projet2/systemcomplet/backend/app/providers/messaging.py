"""WhatsAppProvider (WhatsApp Business Platform — Meta Cloud API) et SmsProvider (Twilio).

Règle §8 : l'intégration utilise un canal professionnel traçable ; un téléphone personnel d'employé ne
constitue jamais l'intégration système. Les fournisseurs « console » ne servent qu'en développement.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from app.core.config import settings
from app.core.secrets import get_secret
from app.core.utils import clean_phone, utcnow
from app.providers.base import ProviderError, ProviderNotConfigured, SendResult

log = logging.getLogger("globus.messaging")

DEV_WHATSAPP_OUTBOX: list[dict[str, Any]] = []
DEV_SMS_OUTBOX: list[dict[str, Any]] = []


@dataclass
class WhatsAppTemplate:
    name: str
    language: str = "fr"
    body_params: list[str] = field(default_factory=list)
    header_document: dict[str, str] | None = None  # {"link": ..., "filename": ...}
    header_video: dict[str, str] | None = None  # {"link": ...} — vidéo en en-tête (time-lapse)
    button_payloads: list[str] = field(default_factory=list)  # réponses rapides (quick reply)
    url_button_suffix: str | None = None


class WhatsAppProvider(Protocol):
    name: str

    def send_template(self, to: str, template: WhatsAppTemplate) -> SendResult: ...
    def send_text(self, to: str, body: str) -> SendResult: ...
    def send_document(self, to: str, link: str, filename: str, caption: str | None = None) -> SendResult: ...
    def send_video(self, to: str, link: str, caption: str | None = None) -> SendResult: ...


def _wa_number(to: str) -> str:
    phone = clean_phone(to) or to
    return phone.lstrip("+")


class ConsoleWhatsAppProvider:
    name = "console"

    def _record(self, kind: str, to: str, content: dict[str, Any]) -> SendResult:
        if settings.is_production:
            # V4-DEPLOY-42 : jamais de faux « envoyé » en production.
            raise ProviderNotConfigured(self.name, "WHATSAPP_PROVIDER=meta")
        msg_id = "wamid.dev." + uuid.uuid4().hex
        DEV_WHATSAPP_OUTBOX.append(
            {"id": msg_id, "kind": kind, "to": to, "content": content, "at": utcnow().isoformat()}
        )
        del DEV_WHATSAPP_OUTBOX[:-200]
        log.info("whatsapp_console", extra={"to": to, "kind": kind})
        return SendResult(provider=self.name, message_id=msg_id, status="sent")

    def send_template(self, to: str, template: WhatsAppTemplate) -> SendResult:
        return self._record(
            "template",
            to,
            {
                "name": template.name,
                "params": template.body_params,
                "buttons": template.button_payloads,
                "document": template.header_document,
                "video": template.header_video,
                "url_suffix": template.url_button_suffix,
            },
        )

    def send_text(self, to: str, body: str) -> SendResult:
        return self._record("text", to, {"body": body})

    def send_document(self, to: str, link: str, filename: str, caption: str | None = None) -> SendResult:
        return self._record("document", to, {"link": link, "filename": filename, "caption": caption})

    def send_video(self, to: str, link: str, caption: str | None = None) -> SendResult:
        return self._record("video", to, {"link": link, "caption": caption})


class MetaWhatsAppProvider:
    """WhatsApp Business Platform (Cloud API)."""

    name = "meta"

    def _post(self, payload: dict[str, Any]) -> SendResult:
        token = get_secret("META_WA_TOKEN")
        if not token or not settings.META_WA_PHONE_NUMBER_ID:
            raise ProviderNotConfigured(self.name, "META_WA_TOKEN/META_WA_PHONE_NUMBER_ID")
        url = f"https://graph.facebook.com/{settings.META_WA_API_VERSION}/{settings.META_WA_PHONE_NUMBER_ID}/messages"
        try:
            resp = httpx.post(url, json=payload, timeout=30, headers={"Authorization": f"Bearer {token}"})
        except httpx.HTTPError as exc:
            raise ProviderError(f"WhatsApp : {exc}", provider=self.name) from exc
        data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        if resp.status_code >= 300:
            err = (data.get("error") or {}) if isinstance(data, dict) else {}
            raise ProviderError(
                f"WhatsApp {resp.status_code} : {err.get('message', resp.text[:200])}",
                provider=self.name,
                retryable=resp.status_code >= 500 or resp.status_code == 429,
                details=err,
            )
        message_id = ((data.get("messages") or [{}])[0]).get("id")
        return SendResult(provider=self.name, message_id=message_id, status="sent", raw=data)

    def send_template(self, to: str, template: WhatsAppTemplate) -> SendResult:
        components: list[dict[str, Any]] = []
        if template.header_document:
            components.append(
                {"type": "header", "parameters": [{"type": "document", "document": template.header_document}]}
            )
        elif template.header_video:
            components.append({"type": "header", "parameters": [{"type": "video", "video": template.header_video}]})
        if template.body_params:
            components.append(
                {"type": "body", "parameters": [{"type": "text", "text": p[:1000]} for p in template.body_params]}
            )
        for index, payload in enumerate(template.button_payloads):
            components.append(
                {
                    "type": "button",
                    "sub_type": "quick_reply",
                    "index": str(index),
                    "parameters": [{"type": "payload", "payload": payload}],
                }
            )
        if template.url_button_suffix:
            components.append(
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": str(len(template.button_payloads)),
                    "parameters": [{"type": "text", "text": template.url_button_suffix}],
                }
            )
        return self._post(
            {
                "messaging_product": "whatsapp",
                "to": _wa_number(to),
                "type": "template",
                "template": {"name": template.name, "language": {"code": template.language}, "components": components},
            }
        )

    def send_text(self, to: str, body: str) -> SendResult:
        return self._post(
            {
                "messaging_product": "whatsapp",
                "to": _wa_number(to),
                "type": "text",
                "text": {"preview_url": True, "body": body[:4096]},
            }
        )

    def send_document(self, to: str, link: str, filename: str, caption: str | None = None) -> SendResult:
        doc: dict[str, Any] = {"link": link, "filename": filename}
        if caption:
            doc["caption"] = caption[:1024]
        return self._post({"messaging_product": "whatsapp", "to": _wa_number(to), "type": "document", "document": doc})

    def send_video(self, to: str, link: str, caption: str | None = None) -> SendResult:
        video: dict[str, Any] = {"link": link}
        if caption:
            video["caption"] = caption[:1024]
        return self._post({"messaging_product": "whatsapp", "to": _wa_number(to), "type": "video", "video": video})


def get_whatsapp_provider() -> WhatsAppProvider:
    return MetaWhatsAppProvider() if settings.WHATSAPP_PROVIDER == "meta" else ConsoleWhatsAppProvider()


def whatsapp_available() -> bool:
    if settings.WHATSAPP_PROVIDER == "meta":
        return bool(get_secret("META_WA_TOKEN") and settings.META_WA_PHONE_NUMBER_ID)
    return settings.is_dev


def verify_meta_signature(body: bytes, header: str | None) -> bool:
    """Vérifie X-Hub-Signature-256 = sha256=HMAC(app_secret, corps)."""
    secret = get_secret("META_WA_APP_SECRET")
    if not secret or not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:])


def parse_meta_webhook(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalise les notifications (statuts + messages entrants)."""
    events: list[dict[str, Any]] = []
    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value") or {}
            names = {
                c.get("wa_id"): ((c.get("profile") or {}).get("name") or "").strip()[:150]
                for c in value.get("contacts", []) or []
            }
            for status in value.get("statuses", []) or []:
                events.append(
                    {
                        "kind": "status",
                        "message_id": status.get("id"),
                        "status": status.get("status"),  # sent / delivered / read / failed
                        "recipient": status.get("recipient_id"),
                        "timestamp": status.get("timestamp"),
                        "errors": status.get("errors"),
                    }
                )
            for message in value.get("messages", []) or []:
                body = None
                payload_value = None
                mtype = message.get("type")
                if mtype == "text":
                    body = (message.get("text") or {}).get("body")
                elif mtype == "button":
                    body = (message.get("button") or {}).get("text")
                    payload_value = (message.get("button") or {}).get("payload")
                elif mtype == "interactive":
                    inter = message.get("interactive") or {}
                    reply = inter.get("button_reply") or inter.get("list_reply") or {}
                    body = reply.get("title")
                    payload_value = reply.get("id")
                events.append(
                    {
                        "kind": "message",
                        "message_id": message.get("id"),
                        "from": message.get("from"),
                        "name": names.get(message.get("from")) or None,
                        "type": mtype,
                        "body": body,
                        "payload": payload_value,
                        "context_id": (message.get("context") or {}).get("id"),
                        "timestamp": message.get("timestamp"),
                    }
                )
    return events


# ---------------------------------------------------------------------------- SMS
class SmsProvider(Protocol):
    name: str

    def send(self, to: str, body: str) -> SendResult: ...


class ConsoleSmsProvider:
    name = "console"

    def send(self, to: str, body: str) -> SendResult:
        if settings.is_production:
            raise ProviderNotConfigured(self.name, "SMS_PROVIDER=twilio")
        msg_id = "sms.dev." + uuid.uuid4().hex
        DEV_SMS_OUTBOX.append({"id": msg_id, "to": to, "body": body, "at": utcnow().isoformat()})
        del DEV_SMS_OUTBOX[:-200]
        log.info("sms_console", extra={"to": to})
        return SendResult(provider=self.name, message_id=msg_id, status="sent")


class TwilioSmsProvider:
    name = "twilio"

    def send(self, to: str, body: str) -> SendResult:
        token = get_secret("TWILIO_AUTH_TOKEN")
        if not (settings.TWILIO_ACCOUNT_SID and token and settings.TWILIO_FROM):
            raise ProviderNotConfigured(self.name, "TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM")
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
        try:
            resp = httpx.post(
                url,
                data={"To": clean_phone(to) or to, "From": settings.TWILIO_FROM, "Body": body[:1500]},
                auth=(settings.TWILIO_ACCOUNT_SID, token),
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Twilio : {exc}", provider=self.name) from exc
        if resp.status_code >= 300:
            raise ProviderError(
                f"Twilio {resp.status_code}",
                provider=self.name,
                retryable=resp.status_code >= 500,
                details=resp.text[:300],
            )
        return SendResult(provider=self.name, message_id=resp.json().get("sid"), status="sent")


def get_sms_provider() -> SmsProvider:
    return TwilioSmsProvider() if settings.SMS_PROVIDER == "twilio" else ConsoleSmsProvider()


def sms_available() -> bool:
    if settings.SMS_PROVIDER == "twilio":
        return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_FROM and get_secret("TWILIO_AUTH_TOKEN"))
    return settings.is_dev
