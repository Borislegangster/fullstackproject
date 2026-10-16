"""AnchoringProvider — ancrage d'empreinte de document via OpenTimestamps (EXTENSION P2, pilote juridique).

Seule l'empreinte SHA-256 est transmise (jamais le document). Le reçu « pending » renvoyé par les
calendriers peut ensuite être complété (`ots upgrade`) et vérifié indépendamment (`ots verify`).
Activé uniquement si ANCHORING_ENABLED=true.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.utils import utcnow
from app.providers.base import ProviderError

log = logging.getLogger("globus.anchoring")


def anchor_digest(sha256_hex: str) -> dict[str, Any]:
    if not settings.ANCHORING_ENABLED:
        raise ProviderError("Ancrage désactivé (ANCHORING_ENABLED=false)", provider="opentimestamps", retryable=False)
    digest = bytes.fromhex(sha256_hex)
    receipts: list[dict[str, Any]] = []
    for calendar in settings.OTS_CALENDARS:
        try:
            resp = httpx.post(
                f"{calendar.rstrip('/')}/digest",
                content=digest,
                timeout=20,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/vnd.opentimestamps.v1",
                    "User-Agent": "globus-engineering-anchoring/1.0",
                },
            )
            if resp.status_code < 300 and resp.content:
                receipts.append({"calendar": calendar, "receipt_b64": base64.b64encode(resp.content).decode()})
        except httpx.HTTPError as exc:
            log.warning("ots_calendar_failed", extra={"calendar": calendar, "error": str(exc)})
    if not receipts:
        raise ProviderError("Aucun calendrier OpenTimestamps n'a répondu", provider="opentimestamps")
    return {
        "method": "opentimestamps",
        "digest_sha256": sha256_hex,
        "status": "pending",
        "submitted_at": utcnow().isoformat(),
        "receipts": receipts,
    }
