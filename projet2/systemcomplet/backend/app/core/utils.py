"""Utilitaires communs (dates, sérialisation JSON, slug, montants)."""

from __future__ import annotations

import enum
import re
import unicodedata
import uuid
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any


def utcnow() -> datetime:
    return datetime.now(UTC)


def jsonable(value: Any) -> Any:
    """Convertit récursivement en types JSON (UUID, Decimal, dates, enums, ensembles)."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(v) for v in value]
    if hasattr(value, "model_dump"):
        return jsonable(value.model_dump())
    return str(value)


def slugify(value: str, *, max_length: int = 120) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", normalized).strip("-").lower()
    return slug[:max_length].strip("-") or uuid.uuid4().hex[:8]


def money(value: Any) -> Decimal:
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def qty(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def pct(part: Decimal | float | int, whole: Decimal | float | int) -> float:
    whole_d = Decimal(str(whole or 0))
    if whole_d == 0:
        return 0.0
    return float((Decimal(str(part or 0)) / whole_d * 100).quantize(Decimal("0.01")))


def mask_ip(ip: str | None) -> str | None:
    """Minimisation : IPv4 /24, IPv6 /48 (§28.1)."""
    if not ip:
        return ip
    if ":" in ip:
        parts = ip.split(":")
        return ":".join(parts[:3]) + "::/48"
    parts = ip.split(".")
    if len(parts) == 4:
        return ".".join(parts[:3]) + ".0/24"
    return None


def clean_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"[^\d+]", "", value)
    if digits.startswith("00"):
        digits = "+" + digits[2:]
    if not digits.startswith("+") and len(digits) == 9 and digits[0] in "62":
        digits = "+237" + digits  # numéros camerounais sans indicatif
    return digits or None


def truncate(value: Any, length: int = 500) -> Any:
    if isinstance(value, str) and len(value) > length:
        return value[:length] + "…"
    return value
