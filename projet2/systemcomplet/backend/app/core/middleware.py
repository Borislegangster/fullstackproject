"""Middlewares ASGI : corrélation, en-têtes de sécurité, métriques, mode maintenance."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core import metrics
from app.core.config import settings
from app.core.context import RequestContext, reset_context, set_context

log = logging.getLogger("globus.http")

_UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_NUM_RE = re.compile(r"/\d+(?=/|$)")
_ALLOWED_CLIENT_APPS = {"web", "desktop", "mobile-client", "mobile-field", "mobile-direction", "backend", "worker"}


def _route_template(path: str) -> str:
    path = _UUID_RE.sub("{id}", path)
    return _NUM_RE.sub("/{n}", path)


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key == name:
            return value.decode("latin-1")
    return None


def client_ip(scope: Scope) -> str | None:
    forwarded = _header(scope, b"x-forwarded-for")
    if forwarded and settings.TRUSTED_PROXIES > 0:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            idx = max(0, len(parts) - settings.TRUSTED_PROXIES)
            return parts[idx]
    real = _header(scope, b"x-real-ip")
    if real:
        return real
    client = scope.get("client")
    return client[0] if client else None


class RequestContextMiddleware:
    """Positionne le contexte de requête, l'en-tête X-Request-ID, journalise et mesure."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        incoming = _header(scope, b"x-request-id") or _header(scope, b"x-correlation-id")
        request_id = incoming if incoming and re.fullmatch(r"[A-Za-z0-9\-_.]{8,64}", incoming) else uuid.uuid4().hex
        application = (_header(scope, b"x-client-app") or "web").lower()
        ctx = RequestContext(
            request_id=request_id,
            ip=client_ip(scope),
            user_agent=(_header(scope, b"user-agent") or "")[:400] or None,
            application=application if application in _ALLOWED_CLIENT_APPS else "web",
            app_version=(_header(scope, b"x-app-version") or None),
            device_id=(_header(scope, b"x-device-id") or None),
            path=scope.get("path"),
            method=scope.get("method", "WS"),
        )
        token = set_context(ctx)
        start = time.perf_counter()
        status_holder = {"status": 500}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            if scope["type"] == "http":
                duration = time.perf_counter() - start
                route = _route_template(scope.get("path", ""))
                method = scope.get("method", "GET")
                status = status_holder["status"]
                metrics.http_requests.labels(method, route, str(status)).inc()
                metrics.http_latency.labels(method, route).observe(duration)
                if not route.startswith(("/health", "/metrics")):
                    log.info(
                        "http_request",
                        extra={
                            "method": method,
                            "path": scope.get("path"),
                            "status_code": status,
                            "duration_ms": round(duration * 1000, 1),
                            "client_app": ctx.application,
                        },
                    )
            reset_context(token)


class SecurityHeadersMiddleware:
    """En-têtes de sécurité (§20.1 : CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path", "")
        is_docs = path.startswith(f"{settings.API_PREFIX}/docs") or path.startswith(f"{settings.API_PREFIX}/redoc")

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                existing = {k.lower() for k, _ in headers}

                def add(name: str, value: str) -> None:
                    if name.encode() not in existing:
                        headers.append((name.encode(), value.encode()))

                add("x-content-type-options", "nosniff")
                add("referrer-policy", "strict-origin-when-cross-origin")
                add(
                    "permissions-policy",
                    "camera=(self), microphone=(self), geolocation=(self), display-capture=(self), payment=(self)",
                )
                add("cross-origin-opener-policy", "same-origin")
                if is_docs:
                    add(
                        "content-security-policy",
                        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://fastapi.tiangolo.com",
                    )
                else:
                    add("content-security-policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
                    add("x-frame-options", "DENY")
                if settings.is_production:
                    add("strict-transport-security", "max-age=63072000; includeSubDomains; preload")
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


class MaintenanceMiddleware:
    """Mode maintenance : 503 pour les requêtes non administratives (fenêtres de maintenance §27.2)."""

    _ALLOWED_PREFIXES = ("/health", "/metrics")

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        from app.modules.admin.state import maintenance_state  # import tardif (évite les cycles)

        state = maintenance_state()
        path: str = scope.get("path", "")
        if (
            state.get("enabled")
            and not path.startswith(self._ALLOWED_PREFIXES)
            and not path.startswith(f"{settings.API_PREFIX}/auth")
            and not path.startswith(f"{settings.API_PREFIX}/admin")
            and not _is_admin_request(scope)
        ):
            body = json.dumps(
                {
                    "error": {
                        "code": "MAINTENANCE",
                        "message": state.get("message") or "Maintenance en cours",
                        "details": {"until": state.get("until")},
                        "correlation_id": None,
                    }
                }
            ).encode()
            await send(
                {
                    "type": "http.response.start",
                    "status": 503,
                    "headers": [(b"content-type", b"application/json"), (b"retry-after", b"300")],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return
        await self.app(scope, receive, send)


def _is_admin_request(scope: Scope) -> bool:
    from app.core.security import decode_token

    token: str | None = None
    auth = _header(scope, b"authorization")
    if auth and auth.lower().startswith("bearer "):
        token = auth[7:]
    else:
        cookie = _header(scope, b"cookie") or ""
        for part in cookie.split(";"):
            name, _, value = part.strip().partition("=")
            if name == "globus_access":
                token = value
    if not token:
        return False
    try:
        payload: dict[str, Any] = decode_token(token)
    except Exception:  # noqa: BLE001
        return False
    return "ADMIN" in (payload.get("roles") or [])
