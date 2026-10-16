"""WeatherProvider : prévisions de pluie à 14 jours pour le planning intelligent (innovation A4).

« open-meteo » : API publique Open-Meteo (sans clé), seules les coordonnées du chantier sont transmises.
« none » (défaut) : aucune requête externe — le planning s'appuie alors sur la climatologie des saisons des pluies.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

import httpx

from app.core.config import settings
from app.providers.base import ProviderError

log = logging.getLogger("globus.weather")


def weather_available() -> bool:
    return settings.WEATHER_PROVIDER == "open-meteo"


def daily_forecast(latitude: float, longitude: float, days: int = 14) -> list[dict[str, Any]]:
    """[{day, precipitation_mm, probability}] — lève ProviderError si le service ne répond pas."""
    if not weather_available():
        return []
    try:
        resp = httpx.get(
            settings.WEATHER_API_URL,
            params={
                "latitude": round(latitude, 3),
                "longitude": round(longitude, 3),
                "daily": "precipitation_sum,precipitation_probability_max",
                "timezone": settings.TIMEZONE,
                "forecast_days": min(16, max(1, days)),
            },
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise ProviderError(f"Météo : {exc}", provider="open-meteo") from exc
    if resp.status_code >= 300:
        raise ProviderError(f"Météo {resp.status_code}", provider="open-meteo", retryable=resp.status_code >= 500)
    daily = (resp.json() or {}).get("daily") or {}
    out = []
    for index, day in enumerate(daily.get("time") or []):
        precip = (daily.get("precipitation_sum") or [None] * (index + 1))[index]
        prob = (daily.get("precipitation_probability_max") or [None] * (index + 1))[index]
        out.append(
            {
                "day": date.fromisoformat(day),
                "precipitation_mm": float(precip or 0),
                "probability": int(prob) if prob is not None else None,
            }
        )
    return out


__all__ = ["daily_forecast", "weather_available"]
