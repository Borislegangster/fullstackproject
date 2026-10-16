"""Erreurs normalisées : {"error": {"code", "message", "details", "correlation_id"}}."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm.exc import StaleDataError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.context import correlation_id
from app.providers.base import ProviderError

log = logging.getLogger("globus.errors")


class AppError(Exception):
    status_code = 400
    code = "BAD_REQUEST"

    def __init__(
        self, message: str, *, code: str | None = None, details: Any = None, status_code: int | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.details = details


class Unauthorized(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class MFARequired(AppError):
    status_code = 401
    code = "MFA_REQUIRED"


class Forbidden(AppError):
    status_code = 403
    code = "FORBIDDEN"


class NotFound(AppError):
    status_code = 404
    code = "NOT_FOUND"


class Conflict(AppError):
    status_code = 409
    code = "CONFLICT"


class Gone(AppError):
    status_code = 410
    code = "GONE"


class BusinessRuleError(AppError):
    status_code = 422
    code = "BUSINESS_RULE"


class RateLimited(AppError):
    status_code = 429
    code = "RATE_LIMITED"


class ServiceUnavailable(AppError):
    status_code = 503
    code = "SERVICE_UNAVAILABLE"


def error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details, "correlation_id": correlation_id()}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"X-Request-ID": correlation_id()}
        if isinstance(exc, RateLimited) and isinstance(exc.details, dict) and "retry_after" in exc.details:
            headers["Retry-After"] = str(exc.details["retry_after"])
        return JSONResponse(
            error_body(exc.code, exc.message, exc.details), status_code=exc.status_code, headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {
                "field": ".".join(str(p) for p in err.get("loc", []) if p != "body"),
                "message": err.get("msg"),
                "type": err.get("type"),
            }
            for err in exc.errors()
        ]
        return JSONResponse(error_body("VALIDATION_ERROR", "Données invalides", details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = {
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            409: "CONFLICT",
            413: "PAYLOAD_TOO_LARGE",
            429: "RATE_LIMITED",
        }.get(exc.status_code, "HTTP_ERROR")
        message = exc.detail if isinstance(exc.detail, str) else "Erreur"
        return JSONResponse(
            error_body(code, message), status_code=exc.status_code, headers=getattr(exc, "headers", None)
        )

    @app.exception_handler(ProviderError)
    async def _provider(_: Request, exc: ProviderError) -> JSONResponse:
        """Prestataire externe (paiement, messagerie…) : refus métier 422, non configuré 503, indisponible 502."""
        from app.providers.base import ProviderNotConfigured

        if isinstance(exc, ProviderNotConfigured):
            code, status = "PROVIDER_NOT_CONFIGURED", 503
        elif not exc.retryable:
            code, status = "PROVIDER_REJECTED", 422
        else:
            code, status = "PROVIDER_UNAVAILABLE", 502
        log.warning("provider_error", extra={"provider": exc.provider, "error": str(exc)[:300]})
        return JSONResponse(error_body(code, str(exc), {"provider": exc.provider}), status_code=status)

    @app.exception_handler(StaleDataError)
    async def _stale(_: Request, exc: StaleDataError) -> JSONResponse:
        return JSONResponse(
            error_body("VERSION_CONFLICT", "La ressource a été modifiée entre-temps ; rechargez-la."),
            status_code=409,
        )

    @app.exception_handler(IntegrityError)
    async def _integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        log.warning("integrity_error", extra={"error": str(exc.orig)[:500]})
        return JSONResponse(
            error_body("INTEGRITY_ERROR", "Contrainte d'intégrité violée (doublon ou référence invalide)."),
            status_code=409,
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error")
        return JSONResponse(
            error_body("INTERNAL_ERROR", "Erreur interne. Référence : " + correlation_id()), status_code=500
        )
