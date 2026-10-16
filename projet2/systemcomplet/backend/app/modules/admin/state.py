"""État global léger (mode maintenance, drapeaux) mis en cache quelques secondes."""

from __future__ import annotations

import threading
import time
from typing import Any

_cache: dict[str, tuple[float, Any]] = {}
_lock = threading.Lock()
_TTL = 5.0


def _load_setting(key: str) -> Any:
    from app.core.database import SessionLocal
    from app.modules.system.models import Setting

    try:
        db = SessionLocal()
        try:
            row = db.get(Setting, key)
            return row.value if row else None
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        return None


def cached_setting(key: str, default: Any = None) -> Any:
    now = time.monotonic()
    with _lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < _TTL:
            return hit[1]
    value = _load_setting(key)
    if value is None:
        value = default
    with _lock:
        _cache[key] = (now, value)
    return value


def invalidate(key: str | None = None) -> None:
    with _lock:
        if key:
            _cache.pop(key, None)
        else:
            _cache.clear()


def maintenance_state() -> dict[str, Any]:
    value = cached_setting("maintenance", {"enabled": False})
    return value if isinstance(value, dict) else {"enabled": False}


def feature_enabled(key: str, roles: set[str] | None = None) -> bool:
    flags = cached_setting("__feature_flags__", None)
    if flags is None:
        from app.core.database import SessionLocal
        from app.modules.system.models import FeatureFlag

        try:
            db = SessionLocal()
            try:
                flags = {f.key: {"enabled": f.enabled, "roles": f.roles} for f in db.query(FeatureFlag).all()}
            finally:
                db.close()
        except Exception:  # noqa: BLE001
            flags = {}
        with _lock:
            _cache["__feature_flags__"] = (time.monotonic(), flags)
    flag = flags.get(key)
    if not flag or not flag.get("enabled"):
        return False
    allowed = set(flag.get("roles") or [])
    return not allowed or bool(roles and roles & allowed)
