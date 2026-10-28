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


PREVIEW_IMAGE_MIMES = ("image/jpeg", "image/png", "image/webp")


def watermark_image(data: bytes, text: str, *, max_side: int = 1600) -> bytes:
    """Aperçu d'image : réduit (au plus `max_side` px) et couvert d'un filigrane diagonal répété (JPEG)."""
    import io

    from PIL import Image, ImageDraw, ImageFont

    image = Image.open(io.BytesIO(data)).convert("RGB")
    image.thumbnail((max_side, max_side))
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    size = max(14, image.width // 40)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", size)
    except OSError:
        font = ImageFont.load_default()
    step_y = size * 5
    for row, y in enumerate(range(-image.height, image.height * 2, step_y)):
        draw.text((-(row % 2) * size * 6, y), ("   " + text) * 4, fill=(255, 255, 255, 110), font=font)
        draw.text((-(row % 2) * size * 6 + 1, y + 1), ("   " + text) * 4, fill=(0, 0, 0, 70), font=font)
    overlay = overlay.rotate(30, expand=False)
    marked = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    out = io.BytesIO()
    marked.save(out, "JPEG", quality=70)
    return out.getvalue()


def file_response(
    stored: StoredFile, *, inline: bool = True, watermark_text: str | None = None, preview: bool = False
) -> Response:
    if stored.deleted_at is not None:
        raise NotFound("Fichier supprimé")
    if preview:  # aperçu d'un livrable non remis : filigrane obligatoire, aucun autre format diffusé
        if not watermark_text or stored.mime_type not in ("application/pdf", *PREVIEW_IMAGE_MIMES):
            raise Forbidden(
                "Aperçu indisponible pour ce format : fichier remis après règlement de la facture d'études",
                code="DELIVERABLE_LOCKED",
            )
        if stored.mime_type in PREVIEW_IMAGE_MIMES:
            try:
                marked = watermark_image(read_private(stored), watermark_text)
            except Exception as exc:
                raise AppError("Image illisible : aperçu filigrané impossible", code="IMAGE_UNREADABLE") from exc
            return Response(
                marked,
                media_type="image/jpeg",
                headers={
                    "Content-Disposition": "inline",
                    "Cache-Control": "private, no-store",
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "SAMEORIGIN",
                    "Content-Security-Policy": "frame-ancestors 'self'",
                },
            )
    disposition = "inline" if inline else "attachment"
    headers = {
        "Content-Disposition": f'{disposition}; filename="{stored.original_name}"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        # Aperçu intégré (GED, messagerie, espace client) : affichable dans un cadre de la plateforme (même origine),
        # jamais sur un site tiers. Sans cela le PDF reste une page grise « document bloqué ».
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
    }
    if stored.mime_type == "image/svg+xml":
        headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"
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
    file_id: uuid.UUID,
    *,
    user_id: uuid.UUID | None,
    ttl: int | None = None,
    watermark_text: str | None = None,
    preview: bool = False,
) -> str:
    token = sign_payload(
        {
            "f": str(file_id),
            "u": str(user_id) if user_id else None,
            "w": watermark_text,
            **({"p": 1} if preview else {}),
        },
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
    return file_response(stored, watermark_text=data.get("w"), preview=bool(data.get("p")))


@router.post("/preview", dependencies=[Depends(rate_limit("file_preview", "240/hour"))])
def preview_file(file: UploadFile = File(...), principal: Principal = Depends(get_principal)) -> dict[str, Any]:
    """Aperçu d'un document bureautique déjà obtenu par l'utilisateur via son lien d'accès contrôlé (conversion
    sans stockage : tableurs, Word, PowerPoint, OpenDocument, CSV, texte)."""
    return preview(file.filename or "", file.file.read(MAX_PREVIEW_BYTES + 1))


def watermark_label(user: Any) -> str:
    return f"{user.full_name} — {utcnow():%d/%m/%Y %H:%M} UTC — GLOBUS ENGINEERING — Confidentiel"
