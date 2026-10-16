"""Types communs des providers."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class ProviderError(Exception):
    """Erreur d'un fournisseur externe (réseau, refus, configuration)."""

    def __init__(self, message: str, *, provider: str, retryable: bool = True, details: Any = None) -> None:
        super().__init__(message)
        self.provider = provider
        self.retryable = retryable
        self.details = details


class ProviderNotConfigured(ProviderError):
    def __init__(self, provider: str, missing: str) -> None:
        super().__init__(f"{provider} non configuré ({missing})", provider=provider, retryable=False)


@dataclass
class SendResult:
    provider: str
    message_id: str | None = None
    status: str = "sent"
    raw: dict[str, Any] = field(default_factory=dict)
