"""AIProvider — Claude via le SDK officiel Anthropic (sorties JSON structurées, repli serveur sur refus).

Sans clé configurée, `get_ai_provider()` renvoie None et les fonctions IA basculent sur des règles
déterministes (module `app.modules.ai.service`). Aucune IA ne valide seule une action critique.
"""

from __future__ import annotations

import base64
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from app.core.config import settings
from app.core.secrets import get_secret
from app.providers.base import ProviderError

log = logging.getLogger("globus.ai")

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class AIRefused(ProviderError):
    """Le modèle (et ses replis) a décliné la requête (`stop_reason == "refusal"`)."""


@dataclass
class AIResult:
    data: dict[str, Any] = field(default_factory=dict)
    text: str | None = None
    model: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    duration_ms: int = 0
    stop_reason: str | None = None


@dataclass
class Attachment:
    """Pièce jointe envoyée au modèle (image ou PDF)."""

    data: bytes
    media_type: str  # image/jpeg, image/png, image/webp, image/gif, application/pdf


class ClaudeProvider:
    name = "anthropic"

    def __init__(self, api_key: str) -> None:
        import anthropic

        self._anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=api_key, timeout=settings.AI_TIMEOUT_SECONDS, max_retries=2)
        self.model = settings.ANTHROPIC_MODEL

    def _content(self, prompt: str, attachments: list[Attachment] | None) -> list[dict[str, Any]]:
        blocks: list[dict[str, Any]] = []
        for att in attachments or []:
            b64 = base64.standard_b64encode(att.data).decode("ascii")
            if att.media_type == "application/pdf":
                blocks.append(
                    {"type": "document", "source": {"type": "base64", "media_type": att.media_type, "data": b64}}
                )
            else:
                blocks.append(
                    {"type": "image", "source": {"type": "base64", "media_type": att.media_type, "data": b64}}
                )
        blocks.append({"type": "text", "text": prompt})
        return blocks

    def _call(
        self,
        *,
        system: str,
        prompt: str,
        effort: str,
        max_tokens: int,
        output_format: dict[str, Any] | None,
        attachments: list[Attachment] | None,
        history: list[dict[str, str]] | None = None,
    ) -> Any:
        anthropic = self._anthropic
        output_config: dict[str, Any] = {"effort": effort}
        if output_format is not None:
            output_config["format"] = output_format
        messages: list[dict[str, Any]] = [{"role": m["role"], "content": m["content"]} for m in history or []]
        messages.append({"role": "user", "content": self._content(prompt, attachments)})
        try:
            return self.client.beta.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
                output_config=output_config,
                betas=[FALLBACK_BETA],
                fallbacks="default",
            )
        except anthropic.RateLimitError as exc:
            raise ProviderError("Limite de débit IA atteinte", provider=self.name, retryable=True) from exc
        except anthropic.BadRequestError as exc:
            raise ProviderError(f"Requête IA invalide : {exc.message}", provider=self.name, retryable=False) from exc
        except anthropic.AuthenticationError as exc:
            raise ProviderError("Clé API IA invalide", provider=self.name, retryable=False) from exc
        except anthropic.APIStatusError as exc:
            raise ProviderError(
                f"Erreur IA {exc.status_code}", provider=self.name, retryable=exc.status_code >= 500
            ) from exc
        except anthropic.APIConnectionError as exc:
            raise ProviderError("Service IA injoignable", provider=self.name, retryable=True) from exc

    @staticmethod
    def _text_of(response: Any) -> str:
        return "".join(block.text for block in response.content if getattr(block, "type", None) == "text")

    def _check(self, response: Any) -> None:
        if response.stop_reason == "refusal":
            details = getattr(response, "stop_details", None)
            raise AIRefused(
                "Requête déclinée par le modèle",
                provider=self.name,
                retryable=False,
                details={"category": getattr(details, "category", None)},
            )
        if response.stop_reason == "max_tokens":
            raise ProviderError("Réponse IA tronquée (max_tokens)", provider=self.name, retryable=False)

    def complete_json(
        self,
        *,
        system: str,
        prompt: str,
        schema: dict[str, Any],
        effort: str = "low",
        max_tokens: int = 16000,
        attachments: list[Attachment] | None = None,
        history: list[dict[str, str]] | None = None,
    ) -> AIResult:
        """Réponse structurée (JSON conforme au schéma) ; `history` = tours précédents d'une conversation."""
        start = time.perf_counter()
        response = self._call(
            system=system,
            prompt=prompt,
            effort=effort,
            max_tokens=max_tokens,
            output_format={"type": "json_schema", "schema": schema},
            attachments=attachments,
            history=history,
        )
        self._check(response)
        text = self._text_of(response)
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ProviderError("Réponse IA non JSON", provider=self.name, retryable=False) from exc
        usage = getattr(response, "usage", None)
        return AIResult(
            data=data,
            text=None,
            model=getattr(response, "model", self.model),
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
            duration_ms=int((time.perf_counter() - start) * 1000),
            stop_reason=response.stop_reason,
        )

    def complete_text(
        self,
        *,
        system: str,
        prompt: str,
        effort: str = "medium",
        max_tokens: int = 16000,
        attachments: list[Attachment] | None = None,
    ) -> AIResult:
        start = time.perf_counter()
        response = self._call(
            system=system,
            prompt=prompt,
            effort=effort,
            max_tokens=max_tokens,
            output_format=None,
            attachments=attachments,
        )
        self._check(response)
        usage = getattr(response, "usage", None)
        return AIResult(
            text=self._text_of(response).strip(),
            model=getattr(response, "model", self.model),
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
            duration_ms=int((time.perf_counter() - start) * 1000),
            stop_reason=response.stop_reason,
        )


_provider: ClaudeProvider | None = None
_provider_key: str | None = None


def get_ai_provider() -> ClaudeProvider | None:
    """Provider IA actif, ou None (mode règles déterministes)."""
    global _provider, _provider_key
    if settings.AI_PROVIDER != "anthropic":
        return None
    key = get_secret("ANTHROPIC_API_KEY")
    if not key:
        return None
    if _provider is None or _provider_key != key:
        _provider = ClaudeProvider(key)
        _provider_key = key
    return _provider


def strict_schema(properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    """Schéma JSON objet strict (additionalProperties: false, champs requis)."""
    return {
        "type": "object",
        "properties": properties,
        "required": required if required is not None else list(properties),
        "additionalProperties": False,
    }
