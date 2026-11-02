"""Maps provider abstraction (Google Maps / alternatives)."""
from typing import Optional
from app.config import get_settings

settings = get_settings()


class MapsProvider:
    async def geocode(self, address: str) -> dict:
        raise NotImplementedError

    async def reverse_geocode(self, lat: float, lng: float) -> dict:
        raise NotImplementedError

    async def directions(self, origin: str, destination: str) -> dict:
        raise NotImplementedError


class GoogleMapsProvider(MapsProvider):
    def __init__(self):
        self.api_key = getattr(settings, "GOOGLE_MAPS_API_KEY", "")
        self.base_url = "https://maps.googleapis.com/maps/api"

    async def geocode(self, address: str) -> dict:
        if not self.api_key:
            return {"status": "skipped", "lat": 0, "lng": 0}
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/geocode/json",
                params={"address": address, "key": self.api_key},
                timeout=10.0,
            )
            data = resp.json()
            if data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return {
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "formatted": data["results"][0].get("formatted_address", ""),
                }
            return {"status": "not_found", "lat": 0, "lng": 0}

    async def reverse_geocode(self, lat: float, lng: float) -> dict:
        if not self.api_key:
            return {"status": "skipped"}
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/geocode/json",
                params={"latlng": f"{lat},{lng}", "key": self.api_key},
                timeout=10.0,
            )
            data = resp.json()
            if data.get("results"):
                return {"address": data["results"][0].get("formatted_address", "")}
            return {"status": "not_found"}

    async def directions(self, origin: str, destination: str) -> dict:
        if not self.api_key:
            return {"status": "skipped"}
        # pyrefly: ignore [missing-import]
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/directions/json",
                params={"origin": origin, "destination": destination, "key": self.api_key},
                timeout=10.0,
            )
            return resp.json()


def get_maps_provider() -> MapsProvider:
    return GoogleMapsProvider()
