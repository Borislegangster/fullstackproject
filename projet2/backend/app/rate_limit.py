"""Shared rate limiter — one instance for the whole backend.

Routers should import this module instead of creating their own Limiter so the
`RATE_LIMITS_DISABLED=1` env var can disable ALL limits at once for testing.
"""
import os

from slowapi import Limiter
from slowapi.util import get_remote_address


_DISABLED = os.getenv("RATE_LIMITS_DISABLED", "").lower() in ("1", "true", "yes")

limiter = Limiter(key_func=get_remote_address, enabled=not _DISABLED)
