"""Génération d'images pour l'assistant du site : illustrations réalistes déposées dans la médiathèque.

Deux prestataires au choix (Paramètres › Intégrations › Génération d'images), clé gardée dans le coffre :
  • OpenAI — API Images (`POST /v1/images/generations`, modèles GPT Image) ;
  • Google — API Gemini (`POST /v1beta/interactions`, modèles d'image Gemini).
Le modèle est réglable sans changer le code (les prestataires renouvellent souvent leurs modèles d'images).
Sans prestataire ou sans clé, `get_image_provider()` renvoie None : l'assistant se sert alors de la médiathèque.
"""

from __future__ import annotations

import base64
import binascii
import io
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.config import settings
from app.core.secrets import get_secret
from app.providers.base import ProviderError

log = logging.getLogger("globus.imagegen")

ASPECTS = ("16:9", "3:2", "4:3", "1:1", "3:4", "2:3", "9:16")
OPENAI_DEFAULT_MODEL = "gpt-image-2.5-sunburst"
GOOGLE_DEFAULT_MODEL = "gemini-3.1-flash-image"
OPENAI_URL = "https://api.openai.com/v1/images/generations"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_API_REVISION = "2026-05-20"
TIMEOUT = httpx.Timeout(240.0, connect=15.0)
MAX_BYTES = 20 * 1024 * 1024

# Formats libres (côtés multiples de 16, rapport entre 1:3 et 3:1, ≤ 2560 × 1440 hors expérimental) pour les
# modèles GPT Image 2 et suivants ; formats fixes pour les modèles plus anciens.
_OPENAI_FREE_SIZES = {
    "16:9": "2048x1152",
    "3:2": "1536x1024",
    "4:3": "1600x1200",
    "1:1": "1280x1280",
    "3:4": "1200x1600",
    "2:3": "1024x1536",
    "9:16": "1152x2048",
}
_OPENAI_FIXED_SIZES = {
    "16:9": "1536x1024",
    "3:2": "1536x1024",
    "4:3": "1536x1024",
    "1:1": "1024x1024",
    "3:4": "1024x1536",
    "2:3": "1024x1536",
    "9:16": "1024x1536",
}


class ImageGenError(ProviderError):
    """Échec de génération, avec un message lisible renvoyé à Claude (qui peut reformuler ou s'en passer)."""


@dataclass
class GeneratedImage:
    data: bytes
    mime: str
    provider: str
    model: str
    width: int
    height: int
    usage: dict[str, Any] = field(default_factory=dict)

    @property
    def extension(self) -> str:
        return {"image/png": ".png", "image/webp": ".webp"}.get(self.mime, ".jpg")


def _checked(raw: str, provider: str, model: str, usage: dict[str, Any] | None = None) -> GeneratedImage:
    """Image décodée et vérifiée (format réel, dimensions) avant tout dépôt dans la médiathèque."""
    from PIL import Image, UnidentifiedImageError

    try:
        data = base64.b64decode(raw, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise ImageGenError("Image illisible renvoyée par le service", provider=provider) from exc
    if not data or len(data) > MAX_BYTES:
        raise ImageGenError("Image vide ou trop lourde renvoyée par le service", provider=provider)
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = (img.format or "").upper()
            width, height = img.size
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageGenError("Le service n'a pas renvoyé une image valide", provider=provider) from exc
    mime = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}.get(fmt)
    if mime is None:
        raise ImageGenError(f"Format d'image inattendu ({fmt or 'inconnu'})", provider=provider)
    return GeneratedImage(
        data=data, mime=mime, provider=provider, model=model, width=width, height=height, usage=usage or {}
    )


def _error_text(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        return resp.text[:300]
    err = body.get("error") if isinstance(body, dict) else None
    if isinstance(err, dict):
        return str(err.get("message") or err.get("status") or err)[:300]
    return str(err or body)[:300]


def _raise_for(resp: httpx.Response, provider: str, label: str) -> None:
    if resp.status_code < 400:
        return
    detail = _error_text(resp)
    lowered = detail.lower()
    if resp.status_code in (401, 403):
        message = f"Clé {label} refusée ou sans accès au modèle d'images : vérifiez-la dans Paramètres › Intégrations."
        if "verif" in lowered:
            message = f"{label} demande de vérifier l'organisation avant d'utiliser ce modèle d'images ({detail})."
        raise ImageGenError(message, provider=provider, retryable=False, details=detail)
    if resp.status_code == 429:
        raise ImageGenError(
            f"Limite ou crédit {label} atteint pour la génération d'images : réessayez plus tard.",
            provider=provider,
            details=detail,
        )
    if resp.status_code == 400 and any(w in lowered for w in ("safety", "moderation", "policy", "blocked")):
        raise ImageGenError(
            "Image refusée par le filtre de sécurité du service : reformulez la description (scène, sans "
            "personne identifiable ni marque).",
            provider=provider,
            retryable=False,
            details=detail,
        )
    if resp.status_code == 404 or (resp.status_code == 400 and "model" in lowered):
        raise ImageGenError(
            f"Modèle d'images inconnu ou retiré chez {label} : changez-le dans Paramètres › Intégrations ({detail}).",
            provider=provider,
            retryable=False,
            details=detail,
        )
    raise ImageGenError(f"{label} : génération impossible ({resp.status_code}) — {detail}", provider=provider)


def _post(url: str, *, headers: dict[str, str], body: dict[str, Any], provider: str, label: str) -> dict[str, Any]:
    try:
        resp = httpx.post(url, headers=headers, json=body, timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        raise ImageGenError(f"{label} injoignable : réessayez plus tard.", provider=provider) from exc
    _raise_for(resp, provider, label)
    try:
        return resp.json()
    except ValueError as exc:
        raise ImageGenError(f"Réponse illisible de {label}", provider=provider) from exc


class OpenAIImages:
    name = "openai"
    label = "OpenAI"

    def __init__(self, api_key: str, model: str | None = None) -> None:
        self._key = api_key
        self.model = model or OPENAI_DEFAULT_MODEL

    def size_for(self, aspect: str) -> str:
        sizes = _OPENAI_FREE_SIZES if self.model.startswith("gpt-image-2") else _OPENAI_FIXED_SIZES
        return sizes.get(aspect, sizes["3:2"])

    def generate(self, prompt: str, aspect: str) -> GeneratedImage:
        body = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": self.size_for(aspect),
            "quality": "high",
            "output_format": "jpeg",
            "output_compression": 90,
            "moderation": "auto",
        }
        data = _post(
            OPENAI_URL,
            headers={"Authorization": f"Bearer {self._key}"},
            body=body,
            provider=self.name,
            label=self.label,
        )
        items = data.get("data") or []
        raw = items[0].get("b64_json") if items and isinstance(items[0], dict) else None
        if not raw:
            raise ImageGenError("OpenAI n'a renvoyé aucune image", provider=self.name)
        return _checked(raw, self.name, self.model, data.get("usage"))


def _find_image(node: Any) -> tuple[str, str] | None:
    """Première image (base64, type MIME) d'une réponse Gemini, quelle que soit sa forme (étapes de l'API
    Interactions, `output_image`, ou parties `inlineData` de generateContent)."""
    if isinstance(node, dict):
        inline = node.get("inlineData") or node.get("inline_data")
        if isinstance(inline, dict) and isinstance(inline.get("data"), str):
            return inline["data"], str(inline.get("mimeType") or inline.get("mime_type") or "image/jpeg")
        if node.get("type") == "image" and isinstance(node.get("data"), str):
            return node["data"], str(node.get("mime_type") or node.get("mimeType") or "image/jpeg")
        image = node.get("output_image")
        if isinstance(image, dict) and isinstance(image.get("data"), str):
            return image["data"], str(image.get("mime_type") or "image/jpeg")
        for value in node.values():
            found = _find_image(value)
            if found:
                return found
    elif isinstance(node, list):
        for value in node:
            found = _find_image(value)
            if found:
                return found
    return None


class GeminiImages:
    name = "google"
    label = "Google Gemini"

    def __init__(self, api_key: str, model: str | None = None) -> None:
        self._key = api_key
        self.model = model or GOOGLE_DEFAULT_MODEL

    def generate(self, prompt: str, aspect: str) -> GeneratedImage:
        body = {
            "model": self.model,
            "input": [{"type": "text", "text": prompt}],
            "response_format": {
                "type": "image",
                "mime_type": "image/jpeg",
                "aspect_ratio": aspect if aspect in ASPECTS else "3:2",
                "image_size": "2K",
            },
        }
        data = _post(
            GEMINI_URL,
            headers={"x-goog-api-key": self._key, "Api-Revision": GEMINI_API_REVISION},
            body=body,
            provider=self.name,
            label=self.label,
        )
        found = _find_image(data)
        if found is None:
            raise ImageGenError(
                "Google Gemini n'a renvoyé aucune image (description refusée ou trop vague) : reformulez.",
                provider=self.name,
            )
        return _checked(found[0], self.name, self.model, data.get("usage") if isinstance(data, dict) else None)


def get_image_provider() -> OpenAIImages | GeminiImages | None:
    provider = settings.IMAGE_GEN_PROVIDER
    model = (settings.IMAGE_GEN_MODEL or "").strip() or None
    if provider == "openai":
        key = get_secret("OPENAI_API_KEY")
        return OpenAIImages(key, model) if key else None
    if provider == "google":
        key = get_secret("GEMINI_API_KEY")
        return GeminiImages(key, model) if key else None
    return None


def availability() -> dict[str, Any]:
    provider = settings.IMAGE_GEN_PROVIDER
    if provider == "none":
        return {"available": False, "reason": "Génération d'images désactivée (Paramètres › Intégrations)."}
    instance = get_image_provider()
    if instance is None:
        secret = "OPENAI_API_KEY" if provider == "openai" else "GEMINI_API_KEY"
        return {"available": False, "reason": f"Clé manquante pour la génération d'images ({secret})."}
    limit = settings.IMAGE_GEN_DAILY_LIMIT
    return {
        "available": True,
        "provider": instance.name,
        "label": instance.label,
        "model": instance.model,
        "daily_limit": 40 if limit is None else limit,
    }
