"""PushProvider : Web Push (VAPID) pour le web/desktop, FCM HTTP v1 pour les applications mobiles."""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt

from app.core.config import settings
from app.core.secrets import get_secret
from app.providers.base import ProviderError, ProviderNotConfigured, SendResult

log = logging.getLogger("globus.push")


@dataclass
class PushPayload:
    title: str
    body: str
    url: str | None = None
    tag: str | None = None
    data: dict[str, Any] | None = None
    priority: str = "normal"  # normal / high (appels entrants)
    require_interaction: bool = False


class SubscriptionGone(ProviderError):
    """Abonnement expiré (HTTP 404/410) : à supprimer."""


def send_webpush(endpoint: str, p256dh: str, auth: str, payload: PushPayload) -> SendResult:
    private_key = get_secret("VAPID_PRIVATE_KEY")
    if not private_key or not settings.VAPID_PUBLIC_KEY:
        raise ProviderNotConfigured("webpush", "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY")
    from pywebpush import WebPushException, webpush

    body = json.dumps(
        {
            "title": payload.title,
            "body": payload.body,
            "url": payload.url,
            "tag": payload.tag,
            "data": payload.data or {},
            "requireInteraction": payload.require_interaction,
        }
    )
    try:
        resp = webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=body,
            vapid_private_key=private_key,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=60 if payload.priority == "high" else 3600,
            headers={"Urgency": "high" if payload.priority == "high" else "normal"},
            timeout=15,
        )
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            raise SubscriptionGone("Abonnement push expiré", provider="webpush", retryable=False) from exc
        raise ProviderError(f"Web Push : {exc}", provider="webpush", retryable=True) from exc
    return SendResult(
        provider="webpush", message_id=None, status="sent", raw={"status": getattr(resp, "status_code", None)}
    )


class _FcmToken:
    def __init__(self) -> None:
        self._token: str | None = None
        self._exp = 0.0
        self._lock = threading.Lock()

    def get(self) -> tuple[str, str]:
        raw = get_secret("FCM_SERVICE_ACCOUNT_JSON")
        if not raw:
            raise ProviderNotConfigured("fcm", "FCM_SERVICE_ACCOUNT_JSON")
        account = json.loads(raw)
        with self._lock:
            if self._token and time.time() < self._exp - 60:
                return self._token, account["project_id"]
            now = int(time.time())
            assertion = jwt.encode(
                {
                    "iss": account["client_email"],
                    "scope": "https://www.googleapis.com/auth/firebase.messaging",
                    "aud": account.get("token_uri", "https://oauth2.googleapis.com/token"),
                    "iat": now,
                    "exp": now + 3600,
                },
                account["private_key"],
                algorithm="RS256",
            )
            resp = httpx.post(
                account.get("token_uri", "https://oauth2.googleapis.com/token"),
                timeout=20,
                data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
            )
            if resp.status_code >= 300:
                raise ProviderError(f"FCM OAuth {resp.status_code}", provider="fcm")
            data = resp.json()
            self._token = data["access_token"]
            self._exp = time.time() + int(data.get("expires_in", 3600))
            return self._token, account["project_id"]


_fcm = _FcmToken()


def send_fcm(token: str, payload: PushPayload) -> SendResult:
    access, project = _fcm.get()
    message: dict[str, Any] = {
        "token": token,
        "notification": {"title": payload.title, "body": payload.body},
        "data": {k: str(v) for k, v in {**(payload.data or {}), "url": payload.url or ""}.items()},
        "android": {
            "priority": "HIGH" if payload.priority == "high" else "NORMAL",
            "notification": {"tag": payload.tag} if payload.tag else {},
        },
        "apns": {"headers": {"apns-priority": "10" if payload.priority == "high" else "5"}},
    }
    try:
        resp = httpx.post(
            f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
            timeout=20,
            json={"message": message},
            headers={"Authorization": f"Bearer {access}"},
        )
    except httpx.HTTPError as exc:
        raise ProviderError(f"FCM : {exc}", provider="fcm") from exc
    if resp.status_code == 404 or (resp.status_code == 400 and "UNREGISTERED" in resp.text):
        raise SubscriptionGone("Jeton FCM invalide", provider="fcm", retryable=False)
    if resp.status_code >= 300:
        raise ProviderError(
            f"FCM {resp.status_code}", provider="fcm", retryable=resp.status_code >= 500, details=resp.text[:300]
        )
    return SendResult(provider="fcm", message_id=resp.json().get("name"), status="sent")


def push_configured() -> dict[str, bool]:
    return {
        "webpush": bool(settings.VAPID_PUBLIC_KEY and get_secret("VAPID_PRIVATE_KEY")),
        "fcm": bool(get_secret("FCM_SERVICE_ACCOUNT_JSON")),
    }
