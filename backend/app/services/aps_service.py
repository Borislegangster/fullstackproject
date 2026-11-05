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

# pyrefly: ignore [missing-import]
import httpx
# pyrefly: ignore [missing-import]
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
        try:
            resp = await client.post(
                APS_AUTH_URL,
                data={"grant_type": "client_credentials", "scope": scopes},
                auth=(cid, secret),
            )
        except httpx.HTTPError as exc:
            raise HTTPException(503, f"Autodesk APS injoignable: {exc}") from exc
        if resp.status_code != 200:
            # Auth rejected (bad/expired credentials) → APS unusable, not a
            # transient gateway error: 503 "service non configuré/indisponible".
            raise HTTPException(503, f"APS auth échouée (vérifier les identifiants): {resp.text}")
        data = resp.json()
        _TOKEN_CACHE.update({
            "token": data["access_token"],
            "scopes": scopes,
            "expires_at": time.time() + data.get("expires_in", 3600),
        })
        return data["access_token"]


# Viewer token cache — un seul appel Autodesk par heure quel que soit le
# nombre de clients : sans lui, chaque montage du viewer frappe l'endpoint
# d'auth Autodesk et fait exploser le quota ("Quota limit exceeded").
_VIEWER_TOKEN_CACHE: dict[str, Any] = {"data": None, "expires_at": 0.0}


async def get_viewer_token() -> dict:
    """Short-lived viewer-only token exposed to the frontend Forge viewer."""
    now = time.time()
    if _VIEWER_TOKEN_CACHE["data"] and _VIEWER_TOKEN_CACHE["expires_at"] > now + 120:
        cached = dict(_VIEWER_TOKEN_CACHE["data"])
        # expires_in réel restant, pour que le viewer sache quand renouveler
        cached["expires_in"] = int(_VIEWER_TOKEN_CACHE["expires_at"] - now)
        return cached

    cid, secret = _require_credentials()
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                APS_AUTH_URL,
                data={"grant_type": "client_credentials", "scope": "viewables:read"},
                auth=(cid, secret),
            )
        except httpx.HTTPError as exc:
            raise HTTPException(503, f"Autodesk APS injoignable: {exc}") from exc
        if resp.status_code != 200:
            raise HTTPException(503, f"APS viewer auth échouée (vérifier les identifiants): {resp.text}")
        data = resp.json()
        _VIEWER_TOKEN_CACHE.update({
            "data": data,
            "expires_at": now + data.get("expires_in", 3600),
        })
        return data


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


# S3 multipart: chaque part (sauf la dernière) doit faire ≥ 5 MB. 50 MB de
# marge confortable pour des maquettes jusqu'à 500 MB (10 parts max).
_UPLOAD_PART_SIZE = 50 * 1024 * 1024


async def upload_object(filename: str, data: bytes, bucket_key: str = DEFAULT_BUCKET_KEY) -> str:
    """Upload a file to OSS via the *signed S3 upload* flow, returning its URN.

    Autodesk a déprécié le PUT direct sur /oss/v2/.../objects/{name}
    (403 "Legacy endpoint is deprecated"). Le flux officiel est désormais :
      1. GET  .../objects/{name}/signeds3upload?parts=N  → uploadKey + urls S3
      2. PUT  chaque morceau vers l'URL S3 signée (sans header Authorization)
      3. POST .../objects/{name}/signeds3upload {uploadKey} → objectId
    """
    await ensure_bucket(bucket_key)
    token = await get_internal_token()
    base_url = APS_OSS_OBJECTS.format(bucket=bucket_key, object=filename)
    n_parts = max(1, (len(data) + _UPLOAD_PART_SIZE - 1) // _UPLOAD_PART_SIZE)

    async with httpx.AsyncClient(timeout=300.0) as client:
        # 1. Obtenir les URLs S3 signées
        resp = await client.get(
            f"{base_url}/signeds3upload",
            params={"parts": n_parts, "minutesExpiration": 30},
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"Échec init upload OSS (signeds3upload): {resp.text}")
        payload = resp.json()
        upload_key = payload.get("uploadKey", "")
        urls = payload.get("urls") or ([payload["url"]] if payload.get("url") else [])
        if not upload_key or len(urls) < n_parts:
            raise HTTPException(502, "signeds3upload n'a pas retourné les URLs attendues")

        # 2. Envoyer chaque part vers S3 (URLs pré-signées — PAS de header auth)
        for i in range(n_parts):
            chunk = data[i * _UPLOAD_PART_SIZE:(i + 1) * _UPLOAD_PART_SIZE]
            put = await client.put(urls[i], content=chunk)
            if put.status_code not in (200, 201):
                raise HTTPException(502, f"Échec upload S3 (part {i + 1}/{n_parts}): {put.status_code}")

        # 3. Finaliser l'upload → objectId
        done = await client.post(
            f"{base_url}/signeds3upload",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"uploadKey": upload_key},
        )
        if done.status_code not in (200, 201):
            raise HTTPException(502, f"Échec finalisation upload OSS: {done.text}")
        object_id = done.json().get("objectId", "")
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
        if resp.status_code == 409:
            # Translation already in progress for this URN, which is fine
            return {"result": "inprogress"}
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
        # 404 = not translated yet ; 400 = malformed/unknown URN → both mean
        # "rien à afficher", not a gateway error.
        if resp.status_code in (400, 404):
            return {"status": "not_started", "progress": "0%"}
        if resp.status_code != 200:
            raise HTTPException(502, f"Erreur statut traduction: {resp.text}")
        manifest = resp.json()
        return {
            "status": manifest.get("status", "unknown"),
            "progress": manifest.get("progress", "0%"),
            "derivatives": manifest.get("derivatives", []),
        }
