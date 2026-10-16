"""Limitation de débit (Redis si disponible, mémoire sinon) — §20.1 Rate limiting / anti-bot."""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable
from typing import Any

from fastapi import Request

from app.core.config import settings
from app.core.errors import RateLimited
from app.core.middleware import client_ip

log = logging.getLogger("globus.ratelimit")

_PERIODS = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}


def parse_limit(spec: str) -> tuple[int, int]:
    count, _, period = spec.partition("/")
    return int(count), _PERIODS[period.strip().rstrip("s")]


class _MemoryStore:
    def __init__(self) -> None:
        self._data: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str, window: int) -> tuple[int, int]:
        now = time.time()
        with self._lock:
            count, start = self._data.get(key, (0, now))
            if now - start >= window:
                count, start = 0, now
            count += 1
            self._data[key] = (count, start)
            if len(self._data) > 50_000:
                cutoff = now - 86400
                self._data = {k: v for k, v in self._data.items() if v[1] > cutoff}
            return count, int(window - (now - start))


class _RedisStore:
    def __init__(self, url: str) -> None:
        import redis

        self._r = redis.Redis.from_url(url, socket_timeout=0.5, socket_connect_timeout=0.5)

    def hit(self, key: str, window: int) -> tuple[int, int]:
        bucket = f"rl:{key}:{int(time.time() // window)}"
        pipe = self._r.pipeline()
        pipe.incr(bucket)
        pipe.expire(bucket, window)
        count, _ = pipe.execute()
        return int(count), window - int(time.time() % window)


_memory = _MemoryStore()
_redis: _RedisStore | None = None


def _store() -> Any:
    global _redis
    if settings.REDIS_URL:
        if _redis is None:
            try:
                _redis = _RedisStore(settings.REDIS_URL)
            except Exception:  # noqa: BLE001
                log.warning("redis_unavailable_for_rate_limit")
                return _memory
        return _redis
    return _memory


def check(key: str, spec: str) -> None:
    limit, window = parse_limit(spec)
    try:
        count, retry = _store().hit(key, window)
    except Exception:  # noqa: BLE001 — Redis indisponible : repli mémoire
        count, retry = _memory.hit(key, window)
    if count > limit:
        raise RateLimited("Trop de requêtes, réessayez plus tard.", details={"retry_after": max(retry, 1)})


def rate_limit(bucket: str, spec: str | None = None, *, by: str = "ip") -> Callable[..., Any]:
    """Dépendance FastAPI : `Depends(rate_limit("login", settings.RATE_LIMIT_LOGIN))`."""

    def dependency(request: Request) -> None:
        if settings.ENV == "test" and not request.headers.get("x-test-rate-limit"):
            return
        ident = client_ip(request.scope) or "unknown"
        if by == "ip+path":
            ident = f"{ident}:{request.url.path}"
        check(f"{bucket}:{ident}", spec or settings.RATE_LIMIT_DEFAULT)

    return dependency
