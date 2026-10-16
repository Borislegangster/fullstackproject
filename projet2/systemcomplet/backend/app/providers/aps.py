"""BimProvider — Autodesk Platform Services (OSS + Model Derivative + Viewer) (§10.1, §10.5).

Chaîne : upload RVT/DWG/IFC/SKP/PDF → OSS → job Model Derivative (SVF2 2D/3D) → manifeste →
viewer APS (jeton `viewables:read`). Les formats ouverts GLB/glTF/OBJ/STL sont rendus par Three.js
sans traduction.
"""

from __future__ import annotations

import base64
import math
import threading
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.secrets import get_secret
from app.providers.base import ProviderError, ProviderNotConfigured

BASE = "https://developer.api.autodesk.com"
APS_FORMATS = {"rvt", "rfa", "dwg", "dxf", "ifc", "skp", "nwd", "nwc", "pdf", "fbx", "3ds", "zip"}
THREE_FORMATS = {"glb", "gltf", "obj", "stl"}
_CHUNK = 64 * 1024 * 1024


class _TokenCache:
    def __init__(self) -> None:
        self._tokens: dict[str, tuple[str, float]] = {}
        self._lock = threading.Lock()

    def get(self, scope: str) -> tuple[str, int]:
        client_id = settings.APS_CLIENT_ID
        secret = get_secret("APS_CLIENT_SECRET")
        if not client_id or not secret:
            raise ProviderNotConfigured("aps", "APS_CLIENT_ID/APS_CLIENT_SECRET")
        with self._lock:
            cached = self._tokens.get(scope)
            if cached and cached[1] - 60 > time.time():
                return cached[0], int(cached[1] - time.time())
            try:
                resp = httpx.post(
                    f"{BASE}/authentication/v2/token",
                    auth=(client_id, secret),
                    timeout=30,
                    data={"grant_type": "client_credentials", "scope": scope},
                )
            except httpx.HTTPError as exc:
                raise ProviderError(f"APS auth : {exc}", provider="aps") from exc
            if resp.status_code >= 300:
                raise ProviderError(
                    f"APS auth {resp.status_code}", provider="aps", retryable=False, details=resp.text[:200]
                )
            data = resp.json()
            expires = time.time() + int(data.get("expires_in", 3599))
            self._tokens[scope] = (data["access_token"], expires)
            return data["access_token"], int(data.get("expires_in", 3599))


_tokens = _TokenCache()


def aps_configured() -> bool:
    return bool(settings.APS_CLIENT_ID and get_secret("APS_CLIENT_SECRET"))


def viewer_token() -> dict[str, Any]:
    token, expires_in = _tokens.get("viewables:read")
    return {"access_token": token, "expires_in": expires_in}


def _headers(scope: str = "data:read data:write data:create bucket:create bucket:read") -> dict[str, str]:
    token, _ = _tokens.get(scope)
    return {"Authorization": f"Bearer {token}"}


def bucket_key() -> str:
    if settings.APS_BUCKET_KEY:
        return settings.APS_BUCKET_KEY.lower()
    return f"globus-{(settings.APS_CLIENT_ID or 'dev').lower()[:20]}-bim".replace("_", "-")


def ensure_bucket() -> str:
    key = bucket_key()
    headers = {**_headers(), "x-ads-region": settings.APS_REGION}
    resp = httpx.post(
        f"{BASE}/oss/v2/buckets", headers=headers, timeout=30, json={"bucketKey": key, "policyKey": "persistent"}
    )
    if resp.status_code not in (200, 409):
        raise ProviderError(f"APS bucket {resp.status_code}", provider="aps", details=resp.text[:200])
    return key


def upload(object_key: str, data: bytes) -> str:
    """Upload direct S3 signé (multipart) ; renvoie l'objectId OSS."""
    key = ensure_bucket()
    headers = _headers()
    parts = max(1, math.ceil(len(data) / _CHUNK))
    if parts > 25:
        raise ProviderError("Fichier trop volumineux pour l'upload APS", provider="aps", retryable=False)
    resp = httpx.get(
        f"{BASE}/oss/v2/buckets/{key}/objects/{object_key}/signeds3upload",
        headers=headers,
        params={"parts": parts, "minutesExpiration": 60},
        timeout=30,
    )
    if resp.status_code >= 300:
        raise ProviderError(f"APS signeds3upload {resp.status_code}", provider="aps", details=resp.text[:200])
    info = resp.json()
    for index, url in enumerate(info["urls"]):
        chunk = data[index * _CHUNK : (index + 1) * _CHUNK]
        put = httpx.put(url, content=chunk, timeout=600)
        if put.status_code >= 300:
            raise ProviderError(f"APS upload S3 {put.status_code}", provider="aps")
    done = httpx.post(
        f"{BASE}/oss/v2/buckets/{key}/objects/{object_key}/signeds3upload",
        headers=headers,
        json={"uploadKey": info["uploadKey"]},
        timeout=60,
    )
    if done.status_code >= 300:
        raise ProviderError(f"APS finalisation upload {done.status_code}", provider="aps", details=done.text[:200])
    return str(done.json()["objectId"])


def to_urn(object_id: str) -> str:
    return base64.urlsafe_b64encode(object_id.encode()).decode().rstrip("=")


def _md_base() -> str:
    return (
        f"{BASE}/modelderivative/v2/regions/eu"
        if settings.APS_REGION.upper() == "EMEA"
        else f"{BASE}/modelderivative/v2"
    )


def translate(urn: str, *, root_filename: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "input": {"urn": urn},
        "output": {"formats": [{"type": "svf2", "views": ["2d", "3d"]}]},
    }
    if root_filename:
        payload["input"].update({"compressedUrn": True, "rootFilename": root_filename})
    resp = httpx.post(
        f"{_md_base()}/designdata/job", headers={**_headers(), "x-ads-force": "true"}, json=payload, timeout=60
    )
    if resp.status_code >= 300:
        raise ProviderError(f"APS translate {resp.status_code}", provider="aps", details=resp.text[:300])
    return resp.json()


def manifest(urn: str) -> dict[str, Any]:
    resp = httpx.get(f"{_md_base()}/designdata/{urn}/manifest", headers=_headers(), timeout=30)
    if resp.status_code == 404:
        return {"status": "pending", "progress": "0% complete", "derivatives": []}
    if resp.status_code >= 300:
        raise ProviderError(f"APS manifest {resp.status_code}", provider="aps", details=resp.text[:200])
    return resp.json()


def derivatives_from_manifest(data: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []

    def walk(nodes: list[dict[str, Any]]) -> None:
        for node in nodes:
            if node.get("type") == "geometry" and node.get("role") in ("2d", "3d"):
                out.append(
                    {
                        "kind": node["role"],
                        "guid": node.get("guid"),
                        "name": node.get("name") or node["role"],
                        "role": node.get("role"),
                        "status": node.get("status", "success"),
                    }
                )
            walk(node.get("children") or [])

    walk(data.get("derivatives") or [])
    return out
