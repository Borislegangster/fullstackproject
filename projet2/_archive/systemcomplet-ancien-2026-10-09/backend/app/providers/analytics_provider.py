"""Analytics provider abstraction.

Internal event pipeline + optional integration with GA4/Meta/etc.
"""
from datetime import datetime
from typing import Optional
from app.config import get_settings

settings = get_settings()


class AnalyticsProvider:
    async def track_event(self, event_data: dict) -> dict:
        raise NotImplementedError

    async def track_pageview(self, page_data: dict) -> dict:
        raise NotImplementedError

    async def get_overview(self, start_date: str, end_date: str) -> dict:
        raise NotImplementedError


class InternalAnalyticsProvider(AnalyticsProvider):
    async def track_event(self, event_data: dict) -> dict:
        return {"tracked": True, "provider": "internal"}

    async def track_pageview(self, page_data: dict) -> dict:
        return {"tracked": True, "provider": "internal"}

    async def get_overview(self, start_date: str, end_date: str) -> dict:
        return {"provider": "internal", "note": "Query PostgreSQL analytics tables directly"}


class GA4Provider(AnalyticsProvider):
    def __init__(self):
        self.measurement_id = getattr(settings, "GA4_MEASUREMENT_ID", "")
        self.api_secret = getattr(settings, "GA4_API_SECRET", "")

    async def track_event(self, event_data: dict) -> dict:
        if not self.measurement_id:
            return {"tracked": False, "reason": "GA4 not configured"}
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://www.google-analytics.com/mp/collect?measurement_id={self.measurement_id}&api_secret={self.api_secret}",
                json={
                    "client_id": event_data.get("client_id", "server"),
                    "events": [{"name": event_data.get("event_type", "custom"), "params": event_data}],
                },
                timeout=5.0,
            )
            return {"tracked": resp.status_code == 204}

    async def track_pageview(self, page_data: dict) -> dict:
        return await self.track_event({**page_data, "event_type": "page_view"})

    async def get_overview(self, start_date: str, end_date: str) -> dict:
        return {"provider": "ga4", "note": "Use GA4 Data API for reporting"}


def get_analytics_provider() -> AnalyticsProvider:
    provider = getattr(settings, "ANALYTICS_PROVIDER", "internal")
    if provider == "ga4":
        return GA4Provider()
    return InternalAnalyticsProvider()
