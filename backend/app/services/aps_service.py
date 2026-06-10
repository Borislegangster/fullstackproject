"""Autodesk Platform Services (APS) — Model Derivative + OSS bucket integration.

Used by the Bureau d'Études Virtuel to upload BIM/CAD files (RVT, DWG, IFC, NWD)
and translate them into a viewable format streamed to the frontend Forge viewer.

This module never crashes when APS credentials are missing — it raises a
descriptive HTTPException so the route can return a clean error.
"""
from __future__ import annotations

import base64
import time
from typing import Any, Optional

import httpx
from fastapi import HTTPException

from app.config import get_settings

APS_BASE = "https://developer.api.autodesk.com"
APS_AUTH_URL = f"{APS_BASE}/authentication/v2/token"
APS_OSS_BUCKETS = f"{APS_BASE}/oss/v2/buckets"
APS_OSS_OBJECTS = f"{APS_BASE}/oss/v2/buckets/{{bucket}}/objects/{{object}}"
APS_MODEL_DERIVATIVE_JOB = f"{APS_BASE}/modelderivative/v2/designdata/job"
APS_MODEL_DERIVATIVE_STATUS = f"{APS_BASE}/modelderivative/v2/designdata/{{urn}}/manifest"

# Default OSS bucket for Globus uploads (auto-created on first upload).
DEFAULT_BUCKET_KEY = "globus-bim-uploads"


def _require_credentials() -> tuple[str, str]:
    settings = get_settings()
    if not settings.APS_CLIENT_ID or not settings.APS_CLIENT_SECRET:
        raise HTTPException(
            503,
            "Autodesk Platform Services non configuré. Ajouter APS_CLIENT_ID et "
            "APS_CLIENT_SECRET dans .env",
        )
    return settings.APS_CLIENT_ID, settings.APS_CLIENT_SECRET


# ── Authentication (server-to-server) ────────────────────────

# Small in-process cache to avoid hammering the auth endpoint
_TOKEN_CACHE: dict[str, Any] = {"token": None, "expires_at": 0.0, "scopes": ""}


async def get_internal_token(scopes: str = "data:read data:write data:create bucket:read bucket:create") -> str:
    """Server-side token for OSS + Model Derivative API calls."""
    if (
        _TOKEN_CACHE["token"]
        and _TOKEN_CACHE["scopes"] == scopes
        and _TOKEN_CACHE["expires_at"] > time.time() + 60
    ):
        return _TOKEN_CACHE["token"]

    cid, secret = _require_credentials()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            APS_AUTH_URL,
            data={"grant_type": "client_credentials", "scope": scopes},
            auth=(cid, secret),
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"Erreur APS auth: {resp.text}")
        data = resp.json()
        _TOKEN_CACHE.update({
            "token": data["access_token"],
            "scopes": scopes,
            "expires_at": time.time() + data.get("expires_in", 3600),
        })
        return data["access_token"]


async def get_viewer_token() -> dict:
    """Short-lived viewer-only token exposed to the frontend Forge viewer."""
    cid, secret = _require_credentials()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            APS_AUTH_URL,
            data={"grant_type": "client_credentials", "scope": "viewables:read"},
            auth=(cid, secret),
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"Erreur APS viewer auth: {resp.text}")
        return resp.json()


# ── OSS bucket helpers ───────────────────────────────────────

async def ensure_bucket(bucket_key: str = DEFAULT_BUCKET_KEY) -> str:
    """Create the bucket if it doesn't exist. Returns the bucket key."""
    token = await get_internal_token()
    async with httpx.AsyncClient(timeout=30.0) as client:
        # POST is idempotent in the sense that 409 means "already exists" — fine.
        resp = await client.post(
            APS_OSS_BUCKETS,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"bucketKey": bucket_key, "policyKey": "persistent"},
        )
        if resp.status_code in (200, 409):
            return bucket_key
        raise HTTPException(502, f"Impossible de créer le bucket OSS: {resp.text}")


async def upload_object(filename: str, data: bytes, bucket_key: str = DEFAULT_BUCKET_KEY) -> str:
    """Upload a file to OSS, returning its base64-url-encoded URN."""
    await ensure_bucket(bucket_key)
    token = await get_internal_token()
    url = APS_OSS_OBJECTS.format(bucket=bucket_key, object=filename)

    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.put(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/octet-stream",
            },
            content=data,
        )
        if resp.status_code not in (200, 201):
            raise HTTPException(502, f"Échec upload OSS: {resp.text}")
        object_id = resp.json().get("objectId", "")
        if not object_id:
            raise HTTPException(502, "OSS n'a pas retourné d'objectId")
        # Base64url(urn:adsk.objects:os.object:bucket/object) — strip padding
        urn = base64.urlsafe_b64encode(object_id.encode()).decode().rstrip("=")
        return urn


# ── Model Derivative (translation) ───────────────────────────

async def start_translation(urn: str, output_formats: Optional[list[dict]] = None) -> dict:
    """Trigger an SVF2 translation job for the given URN."""
    if output_formats is None:
        output_formats = [{"type": "svf2", "views": ["2d", "3d"]}]
    token = await get_internal_token()
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            APS_MODEL_DERIVATIVE_JOB,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "x-ads-force": "true",
            },
            json={
                "input": {"urn": urn},
                "output": {"formats": output_formats},
            },
        )
        if resp.status_code not in (200, 201):
            raise HTTPException(502, f"Échec lancement traduction: {resp.text}")
        return resp.json()


async def get_translation_status(urn: str) -> dict:
    """Return the current manifest (status + progress) for a translated URN."""
    token = await get_internal_token()
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            APS_MODEL_DERIVATIVE_STATUS.format(urn=urn),
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 404:
            return {"status": "not_started", "progress": "0%"}
        if resp.status_code != 200:
            raise HTTPException(502, f"Erreur statut traduction: {resp.text}")
        manifest = resp.json()
        return {
            "status": manifest.get("status", "unknown"),
            "progress": manifest.get("progress", "0%"),
            "derivatives": manifest.get("derivatives", []),
        }
