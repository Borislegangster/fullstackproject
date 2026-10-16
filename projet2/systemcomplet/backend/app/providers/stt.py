"""SpeechToTextProvider : transcription des rapports vocaux.

- « device » (défaut) : la transcription est réalisée sur l'appareil (Web Speech API, reconnaissance
  vocale Android/iOS) et transmise avec l'audio ; le serveur conserve l'audio comme preuve.
- « http » : endpoint de transcription compatible Whisper (multipart `file`, `model`, `language`),
  auto-hébergé (faster-whisper, whisper.cpp server…) ou service tiers.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.secrets import get_secret
from app.providers.base import ProviderError, ProviderNotConfigured


@dataclass
class Transcript:
    text: str
    language: str | None = None
    duration_seconds: float | None = None
    provider: str = "device"


def transcription_available() -> bool:
    return settings.STT_PROVIDER == "http" and bool(settings.STT_HTTP_URL)


def transcribe(audio: bytes, filename: str, mime: str) -> Transcript:
    if settings.STT_PROVIDER != "http":
        raise ProviderNotConfigured("stt", "STT_PROVIDER=http")
    if not settings.STT_HTTP_URL:
        raise ProviderNotConfigured("stt", "STT_HTTP_URL")
    headers = {}
    token = get_secret("STT_HTTP_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = httpx.post(
            settings.STT_HTTP_URL,
            files={"file": (filename, audio, mime)},
            data={"model": settings.STT_MODEL, "language": settings.STT_LANGUAGE, "response_format": "json"},
            headers=headers,
            timeout=300,
        )
    except httpx.HTTPError as exc:
        raise ProviderError(f"Transcription : {exc}", provider="stt") from exc
    if resp.status_code >= 300:
        raise ProviderError(
            f"Transcription {resp.status_code}",
            provider="stt",
            retryable=resp.status_code >= 500,
            details=resp.text[:300],
        )
    data = resp.json()
    return Transcript(
        text=str(data.get("text", "")).strip(),
        language=data.get("language"),
        duration_seconds=data.get("duration"),
        provider="http",
    )
