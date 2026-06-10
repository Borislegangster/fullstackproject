"""Admin Media routes — Upload, YouTube import, CRUD."""
import os
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.rate_limit import limiter

from app.database import get_db
from app.auth.service import require_admin
from app.auth.models import User
from app.models.media import CMSMedia

router = APIRouter(prefix="/admin/media", tags=["Admin - Media Library"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Upload security constants ────────────────────────────────
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
DOC_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}
BIM_EXTENSIONS = {".rvt", ".dwg", ".ifc", ".nwd"}
ARCHIVE_EXTENSIONS = {".zip"}

# Whitelist enforced at upload time — built once at module load
ALLOWED_EXTENSIONS = (
    IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | DOC_EXTENSIONS | BIM_EXTENSIONS | ARCHIVE_EXTENSIONS
)
ALLOWED_MIME_PREFIXES = (
    "image/", "video/", "application/pdf",
    "application/msword", "application/vnd.",
    "application/octet-stream",
)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def _detect_real_mime(content: bytes) -> str:
    """Detect the real MIME type from the magic bytes (libmagic)."""
    try:
        import magic  # python-magic / python-magic-bin
        return magic.from_buffer(content, mime=True) or ""
    except Exception:
        return ""


def _sanitize_svg_or_reject(content: bytes) -> bytes:
    """Either sanitize SVG (best-effort) or raise if dangerous."""
    try:
        import bleach
        text = content.decode("utf-8", errors="ignore")
        # If the SVG embeds scripts, event handlers or external refs, reject it.
        lowered = text.lower()
        if "<script" in lowered or "javascript:" in lowered or "onload=" in lowered:
            raise HTTPException(
                status_code=400,
                detail="SVG contenant du JavaScript ou des handlers d'événements refusé.",
            )
        cleaned = bleach.clean(
            text,
            tags={"svg", "path", "circle", "rect", "g", "line", "polyline", "polygon",
                  "ellipse", "text", "tspan", "defs", "linearGradient", "stop", "filter",
                  "title", "desc", "use", "mask", "clipPath"},
            attributes=lambda tag, name, value: not (
                name.startswith("on") or name in {"href", "xlink:href"}
            ),
            strip=True,
        )
        return cleaned.encode("utf-8")
    except HTTPException:
        raise
    except Exception:
        # If bleach is unavailable, reject SVG outright in production-safety mode
        raise HTTPException(
            status_code=400, detail="Validation SVG impossible — fichier refusé."
        )


def _validate_upload(file: UploadFile, content: bytes) -> bytes:
    """Validate the uploaded file. Returns the (possibly sanitized) content."""
    # 1. Extension check
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Type de fichier non autorisé : {ext}. Extensions acceptées : {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # 2. MIME type check (declared)
    mime = file.content_type or ""
    if mime and not any(mime.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
        raise HTTPException(
            status_code=400,
            detail=f"Type MIME non autorisé : {mime}",
        )

    # 3. Size check
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Fichier trop volumineux. Taille maximale : {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB",
        )

    # 4. Magic bytes check — refuse files that LIE about their extension
    real_mime = _detect_real_mime(content)
    if real_mime:
        # If both declared & real exist and they're in different families, reject.
        # Common families: image/*, video/*, application/*
        if mime and "/" in mime and "/" in real_mime:
            declared_family = mime.split("/")[0]
            real_family = real_mime.split("/")[0]
            # Documents are reported as application/* — accept divergence within app/*
            if declared_family != real_family and declared_family != "application":
                raise HTTPException(
                    status_code=400,
                    detail=f"Contenu réel ({real_mime}) ne correspond pas au type déclaré ({mime}).",
                )

    # 5. SVG-specific sanitization (XSS prevention)
    if ext == ".svg":
        return _sanitize_svg_or_reject(content)

    return content


# ── Schemas ──────────────────────────────────────────────────
class MediaOut(BaseModel):
    id: str
    name: str
    type: str
    url: str
    thumbnail: str
    alt: str
    folder: str
    size: str
    youtube_id: str
    usage_count: int
    uploaded_at: str


class YouTubeImportIn(BaseModel):
    url: str
    name: Optional[str] = ""
    folder: Optional[str] = "general"


class MediaUpdateIn(BaseModel):
    name: Optional[str] = None
    alt: Optional[str] = None
    folder: Optional[str] = None


class FormResponse(BaseModel):
    success: bool
    message: str


def _extract_youtube_id(url: str) -> str:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/v\/([a-zA-Z0-9_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return ""


def _media_to_out(m: CMSMedia) -> MediaOut:
    return MediaOut(
        id=m.id, name=m.name, type=m.type, url=m.url,
        thumbnail=m.thumbnail, alt=m.alt, folder=m.folder,
        size=m.size, youtube_id=m.youtube_id,
        usage_count=m.usage_count,
        uploaded_at=m.uploaded_at.isoformat() if m.uploaded_at else "",
    )


# ── GET all media ────────────────────────────────────────────
@router.get("", response_model=list)
async def list_media(
    type: Optional[str] = None,
    folder: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    q = select(CMSMedia).order_by(CMSMedia.uploaded_at.desc())
    if type:
        q = q.where(CMSMedia.type == type)
    if folder:
        q = q.where(CMSMedia.folder == folder)
    result = await db.execute(q)
    return [_media_to_out(m) for m in result.scalars().all()]


# ── Upload file (image/video/document) ──────────────────────
@router.post("/upload", response_model=MediaOut)
@limiter.limit("30/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(""),
    folder: str = Form("general"),
    alt: str = Form(""),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.services.storage_service import store_upload

    ext = os.path.splitext(file.filename or "file")[1].lower()

    # Read content first (needed for validation + saving)
    content = await file.read()

    # Security validation before saving — may return sanitized bytes (e.g. SVG)
    content = _validate_upload(file, content)

    # Store on S3/R2 (public assets) when configured, else local /uploads.
    url, size_str, storage_key = await store_upload(
        content, file.filename or "file",
        file.content_type or "application/octet-stream",
        prefix=folder or "media", public=True,
    )

    # Determine type from the (single-source-of-truth) extension sets
    if ext in IMAGE_EXTENSIONS:
        media_type = "image"
    elif ext in VIDEO_EXTENSIONS:
        media_type = "video"
    else:
        media_type = "document"

    media = CMSMedia(
        id=str(uuid.uuid4()),
        name=name or file.filename or "Fichier",
        type=media_type,
        url=url,
        storage_key=storage_key,
        thumbnail=url if media_type == "image" else "",
        alt=alt,
        folder=folder,
        size=size_str,
        mime_type=file.content_type or "",
        uploaded_by=admin.id,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return _media_to_out(media)


# ── Import YouTube video ────────────────────────────────────
@router.post("/youtube", response_model=MediaOut)
async def import_youtube(
    data: YouTubeImportIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    yt_id = _extract_youtube_id(data.url)
    if not yt_id:
        raise HTTPException(400, "URL YouTube invalide. Formats acceptes: youtube.com/watch?v=xxx, youtu.be/xxx")

    embed_url = f"https://www.youtube.com/embed/{yt_id}"
    thumbnail = f"https://img.youtube.com/vi/{yt_id}/hqdefault.jpg"

    media = CMSMedia(
        id=str(uuid.uuid4()),
        name=data.name or f"YouTube - {yt_id}",
        type="youtube",
        url=embed_url,
        thumbnail=thumbnail,
        folder=data.folder or "general",
        size="YouTube",
        youtube_id=yt_id,
        uploaded_by=admin.id,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return _media_to_out(media)


# ── Update media metadata ───────────────────────────────────
@router.put("/{media_id}", response_model=MediaOut)
async def update_media(
    media_id: str,
    data: MediaUpdateIn,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(CMSMedia).where(CMSMedia.id == media_id))
    media = result.scalars().first()
    if not media:
        raise HTTPException(404, "Media non trouve")
    if data.name is not None:
        media.name = data.name
    if data.alt is not None:
        media.alt = data.alt
    if data.folder is not None:
        media.folder = data.folder
    await db.commit()
    await db.refresh(media)
    return _media_to_out(media)


# ── Delete media ─────────────────────────────────────────────
@router.delete("/{media_id}", response_model=FormResponse)
async def delete_media(
    media_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(CMSMedia).where(CMSMedia.id == media_id))
    media = result.scalars().first()
    if not media:
        raise HTTPException(404, "Media non trouve")

    # Remove the underlying object: local file or S3/R2 key.
    if media.url.startswith("/uploads/"):
        filepath = os.path.join(UPLOAD_DIR, os.path.basename(media.url))
        if os.path.exists(filepath):
            os.remove(filepath)
    elif getattr(media, "storage_key", ""):
        from app.services.storage_service import get_storage_service
        await get_storage_service().delete_file(media.storage_key)

    await db.execute(delete(CMSMedia).where(CMSMedia.id == media_id))
    await db.commit()
    return FormResponse(success=True, message="Media supprime avec succes")
