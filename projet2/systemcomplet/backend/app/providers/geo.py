"""MapsProvider (géocodage Google Maps / repli OpenStreetMap Nominatim) et AnalyticsProvider (GA4 Data API)."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx
import jwt

from app.core.config import settings
from app.core.secrets import get_secret
from app.providers.base import ProviderError, ProviderNotConfigured

log = logging.getLogger("globus.geo")


@dataclass
class GeoPoint:
    latitude: float
    longitude: float
    formatted_address: str | None = None
    provider: str = "google"


def geocode(address: str) -> GeoPoint | None:
    key = get_secret("GOOGLE_MAPS_API_KEY")
    try:
        if key:
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                timeout=15,
                params={"address": address, "key": key, "language": "fr", "region": "cm"},
            )
            data = resp.json()
            results = data.get("results") or []
            if results:
                loc = results[0]["geometry"]["location"]
                return GeoPoint(loc["lat"], loc["lng"], results[0].get("formatted_address"), "google")
            return None
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            timeout=15,
            params={"q": address, "format": "json", "limit": 1, "accept-language": "fr"},
            headers={"User-Agent": "GLOBUS-ENGINEERING-ERP/4.0 (contact@globus-engineering.cm)"},
        )
        rows = resp.json()
        if rows:
            return GeoPoint(float(rows[0]["lat"]), float(rows[0]["lon"]), rows[0].get("display_name"), "osm")
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        log.warning("geocode_failed", extra={"error": str(exc)})
    return None


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import asin, cos, radians, sin, sqrt

    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * 6371000 * asin(sqrt(a))


# ---------------------------------------------------------------------------- GA4 Data API
_ga_token: dict[str, Any] = {}


def _ga_access_token() -> str:
    raw = get_secret("GA4_CREDENTIALS_JSON")
    if not raw or not settings.GA4_PROPERTY_ID:
        raise ProviderNotConfigured("ga4", "GA4_PROPERTY_ID/GA4_CREDENTIALS_JSON")
    if _ga_token.get("exp", 0) > time.time() + 60:
        return str(_ga_token["token"])
    account = json.loads(raw)
    now = int(time.time())
    assertion = jwt.encode(
        {
            "iss": account["client_email"],
            "scope": "https://www.googleapis.com/auth/analytics.readonly",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
        },
        account["private_key"],
        algorithm="RS256",
    )
    resp = httpx.post(
        "https://oauth2.googleapis.com/token",
        timeout=20,
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
    )
    if resp.status_code >= 300:
        raise ProviderError("GA4 OAuth refusé", provider="ga4")
    data = resp.json()
    _ga_token.update(token=data["access_token"], exp=time.time() + int(data.get("expires_in", 3600)))
    return str(_ga_token["token"])


def ga4_report(*, start: str, end: str, dimensions: list[str], metrics: list[str], limit: int = 100) -> dict[str, Any]:
    """runReport GA4 (complète l'analytics propriétaire : sources, campagnes Ads)."""
    token = _ga_access_token()
    resp = httpx.post(
        f"https://analyticsdata.googleapis.com/v1beta/properties/{settings.GA4_PROPERTY_ID}:runReport",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
        json={
            "dateRanges": [{"startDate": start, "endDate": end}],
            "dimensions": [{"name": d} for d in dimensions],
            "metrics": [{"name": m} for m in metrics],
            "limit": limit,
        },
    )
    if resp.status_code >= 300:
        raise ProviderError(f"GA4 {resp.status_code}", provider="ga4", details=resp.text[:300])
    return resp.json()
