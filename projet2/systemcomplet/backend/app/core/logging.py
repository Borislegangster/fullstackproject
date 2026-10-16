"""Journalisation structurée JSON avec identifiant de corrélation (observabilité §23.1)."""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from app.core.config import settings
from app.core.context import get_context

_RESERVED = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "taskName",
}
_SENSITIVE = ("password", "secret", "token", "authorization", "cookie", "api_key", "otp", "code")


def _scrub(key: str, value: Any) -> Any:
    lowered = key.lower()
    if any(s in lowered for s in _SENSITIVE) and lowered not in ("status_code", "error_code"):
        return "***"
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        ctx = get_context()
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": ctx.request_id,
            "app": ctx.application,
        }
        if ctx.user_id:
            payload["user_id"] = ctx.user_id
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = _scrub(key, value)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        ctx = get_context()
        stamp = datetime.now().strftime("%H:%M:%S")
        base = f"{stamp} {record.levelname:<7} [{ctx.request_id[:8]}] {record.name}: {record.getMessage()}"
        extras = {k: _scrub(k, v) for k, v in record.__dict__.items() if k not in _RESERVED and not k.startswith("_")}
        if extras:
            base += " " + json.dumps(extras, default=str, ensure_ascii=False)
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def setup_logging() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        except Exception:  # noqa: BLE001
            pass
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if settings.LOG_JSON else TextFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.LOG_LEVEL.upper())
    for noisy in ("uvicorn.access", "httpx", "httpcore", "multipart", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
