"""Admin Media routes — Upload, YouTube import, CRUD."""
import os
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.auth.service import require_admin
from app.auth.models import User
from app.models.media import CMSMedia

router = APIRouter(prefix="/admin/media", tags=["Admin - Media Library"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


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
async def upload_file(
    file: UploadFile = File(...),
    name: str = Form(""),
    folder: str = Form("general"),
    alt: str = Form(""),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    ext = os.path.splitext(file.filename or "file")[1].lower()
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Save file
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Determine type
    image_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"}
    video_exts = {".mp4", ".webm", ".mov", ".avi", ".mkv"}
    if ext in image_exts:
        media_type = "image"
    elif ext in video_exts:
        media_type = "video"
    else:
        media_type = "document"

    # Human-readable size
    size_bytes = len(content)
    if size_bytes > 1_048_576:
        size_str = f"{size_bytes / 1_048_576:.1f} MB"
    else:
        size_str = f"{size_bytes / 1024:.0f} KB"

    media = CMSMedia(
        id=file_id,
        name=name or file.filename or "Fichier",
        type=media_type,
        url=f"/uploads/{filename}",
        thumbnail=f"/uploads/{filename}" if media_type == "image" else "",
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

    # Delete physical file if local
    if media.url.startswith("/uploads/"):
        filepath = os.path.join(UPLOAD_DIR, os.path.basename(media.url))
        if os.path.exists(filepath):
            os.remove(filepath)

    await db.execute(delete(CMSMedia).where(CMSMedia.id == media_id))
    await db.commit()
    return FormResponse(success=True, message="Media supprime avec succes")
