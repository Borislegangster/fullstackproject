"""Contexte de requête (corrélation, application cliente, utilisateur) via contextvars."""

from __future__ import annotations

import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field


@dataclass
class RequestContext:
    request_id: str = field(default_factory=lambda: uuid.uuid4().hex)
    ip: str | None = None
    user_agent: str | None = None
    application: str = "backend"  # web / desktop / mobile-client / mobile-field / mobile-direction / backend
    app_version: str | None = None
    device_id: str | None = None
    user_id: str | None = None
    path: str | None = None
    method: str | None = None


_ctx: ContextVar[RequestContext | None] = ContextVar("globus_request_ctx", default=None)


def get_context() -> RequestContext:
    ctx = _ctx.get()
    if ctx is None:
        ctx = RequestContext()
        _ctx.set(ctx)
    return ctx


def set_context(ctx: RequestContext) -> object:
    return _ctx.set(ctx)


def reset_context(token: object) -> None:
    _ctx.reset(token)  # type: ignore[arg-type]


def correlation_id() -> str:
    return get_context().request_id
