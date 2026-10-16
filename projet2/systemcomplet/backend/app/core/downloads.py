"""Téléchargements contrôlés : flux de fichiers privés, liens signés à durée courte, filigrane dynamique."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import Principal, get_principal
from app.core.errors import AppError, Forbidden, NotFound
from app.core.files import read_private
from app.core.preview import MAX_PREVIEW_BYTES, preview
from app.core.ratelimit import rate_limit
from app.core.security import sign_payload, verify_signed_payload
from app.core.storage import private_storage
from app.core.utils import utcnow
from app.modules.system.models import StoredFile

router = APIRouter(prefix="/files", tags=["Fichiers"])


def file_response(stored: StoredFile, *, inline: bool = True, watermark_text: str | None = None) -> Response:
    if stored.deleted_at is not None:
        raise NotFound("Fichier supprimé")
    disposition = "inline" if inline else "attachment"
    headers = {
        "Content-Disposition": f'{disposition}; filename="{stored.original_name}"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if stored.mime_type == "image/svg+xml":
        headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'"
    if watermark_text and stored.mime_type == "application/pdf":
        from app.core.pdf import watermark

        try:
            marked = watermark(read_private(stored), watermark_text)
        except Exception as exc:
            raise AppError("Document PDF illisible : diffusion filigranée impossible", code="PDF_UNREADABLE") from exc
        return Response(marked, media_type="application/pdf", headers=headers)
    if stored.encrypted:
        return Response(read_private(stored), media_type=stored.mime_type, headers=headers)
    headers["Content-Length"] = str(stored.size_bytes)
    return StreamingResponse(private_storage().stream(stored.storage_key), media_type=stored.mime_type, headers=headers)


def signed_url(
    file_id: uuid.UUID, *, user_id: uuid.UUID | None, ttl: int | None = None, watermark_text: str | None = None
) -> str:
    token = sign_payload(
        {"f": str(file_id), "u": str(user_id) if user_id else None, "w": watermark_text},
        ttl or settings.SIGNED_URL_TTL_SECONDS,
    )
    return f"{settings.API_PREFIX}/files/signed/{token}"


@router.get("/signed/{token}")
def signed_download(token: str, db: Session = Depends(get_db)) -> Response:
    """Lien temporaire (lecture vidéo/plan sans en-tête d'authentification) — délivré après contrôle d'accès."""
    data: dict[str, Any] | None = verify_signed_payload(token)
    if not data:
        raise Forbidden("Lien expiré ou invalide", code="LINK_EXPIRED")
    stored = db.get(StoredFile, uuid.UUID(data["f"]))
    if stored is None:
        raise NotFound("Fichier introuvable")
    return file_response(stored, watermark_text=data.get("w"))


@router.post("/preview", dependencies=[Depends(rate_limit("file_preview", "240/hour"))])
def preview_file(file: UploadFile = File(...), principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    """Aperçu d'un document bureautique déjà obtenu par l'utilisateur via son lien d'accès contrôlé (conversion
    sans stockage : tableurs, Word, PowerPoint, OpenDocument, CSV, texte)."""
    return preview(file.filename or "", file.file.read(MAX_PREVIEW_BYTES + 1))


def watermark_label(user: Any) -> str:
    return f"{user.full_name} — {utcnow():%d/%m/%Y %H:%M} UTC — GLOBUS ENGINEERING — Confidentiel"
