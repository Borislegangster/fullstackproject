"""Time helpers — single source of truth for timestamp generation.

The Globus DB stores naive UTC datetimes (DateTime without timezone). Every
router used to declare its own `_now()`; this module centralises it.
"""
from datetime import datetime, timezone


def utcnow_naive() -> datetime:
    """Return the current UTC time as a naive datetime (DB compatible)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
