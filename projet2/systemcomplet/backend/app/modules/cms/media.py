"""Médiathèque locale obligatoire (§5.1) : images (JPG/PNG/WebP/AVIF/SVG contrôlé), vidéos locales MP4/WebM,
vidéos YouTube/Vimeo par référence, documents ; media_id, checksum, taille, MIME, dimensions, auteur,
statut, historique, miniatures, détection des médias orphelins."""

from __future__ import annotations

import io
import re
import uuid
from pathlib import PurePath
from typing import Any

from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import AppError, Conflict, NotFound
from app.core.files import image_variants, validate_upload
from app.core.storage import public_storage
from app.core.utils import utcnow
from app.modules.cms.models import MediaAsset, MediaRevision
from app.modules.cms.schemas import html_media_ids

_YT = re.compile(r"(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([A-Za-z0-9_-]{6,20})")
_VIMEO = re.compile(r"vimeo\.com/(?:video/)?(\d{5,12})")


def media_url(media_id: uuid.UUID | str, variant: str = "original") -> str:
    return f"{settings.API_PREFIX}/public/media/{media_id}/{variant}"


def _kind_for(mime: str) -> str:
    if mime == "image/svg+xml":
        return "svg"
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    return "document"


def upload_media(
    db: Session,
    *,
    filename: str,
    data: bytes,
    title: str | None,
    alt_text: str | None,
    folder: str,
    tags: list[str],
    author_id: uuid.UUID | None,
) -> MediaAsset:
    upload = validate_upload(filename, data, category="media", max_mb=settings.MAX_UPLOAD_MB * 4)
    existing = db.execute(
        select(MediaAsset).where(MediaAsset.checksum_sha256 == upload.sha256, MediaAsset.deleted_at.is_(None))
    ).scalar_one_or_none()
    if existing is not None:
        raise Conflict(
            "Ce fichier existe déjà dans la médiathèque", code="MEDIA_DUPLICATE", details={"media_id": str(existing.id)}
        )
    media_id = uuid.uuid4()
    kind = _kind_for(upload.mime)
    ext = PurePath(upload.filename).suffix.lower() or ""
    key = f"{media_id.hex[:2]}/{media_id}/original{ext}"
    public_storage().put(key, upload.data, upload.mime)
    asset = MediaAsset(
        id=media_id,
        kind=kind,
        title=title or PurePath(upload.filename).stem[:250],
        alt_text=alt_text,
        original_name=upload.filename,
        storage_key=key,
        mime_type=upload.mime,
        size_bytes=upload.size,
        checksum_sha256=upload.sha256,
        folder=folder or "general",
        tags=tags,
        author_id=author_id,
        status="active",
    )
    if kind == "image":
        _generate_variants(asset, upload.data)
    db.add(asset)
    db.flush()
    db.add(
        MediaRevision(
            media_id=asset.id,
            action="upload",
            user_id=author_id,
            changes={"name": upload.filename, "size": upload.size, "mime": upload.mime},
        )
    )
    audit.record(
        db,
        family="business",
        module="media",
        action="CREATE",
        resource_type="media",
        resource_id=asset.id,
        diff={"name": upload.filename, "kind": kind, "size": upload.size},
    )
    return asset


def _generate_variants(asset: MediaAsset, data: bytes) -> None:
    try:
        with Image.open(io.BytesIO(data)) as img:
            asset.width, asset.height = img.size
        variants: dict[str, Any] = {}
        for name, (content, width, height, mime) in image_variants(data).items():
            ext = ".avif" if mime == "image/avif" else ".webp"
            key = f"{asset.id.hex[:2]}/{asset.id}/{name}{ext}"
            public_storage().put(key, content, mime)
            variants[name] = {"key": key, "width": width, "height": height, "mime": mime, "size": len(content)}
        asset.variants = variants
    except Exception as exc:
        raise AppError("Image illisible ou corrompue", code="INVALID_IMAGE") from exc


def replace_media(
    db: Session, asset: MediaAsset, *, filename: str, data: bytes, user_id: uuid.UUID | None
) -> MediaAsset:
    """Remplace le fichier en conservant le media_id (les pages qui le référencent suivent)."""
    if asset.kind == "external_video":
        raise AppError("Une vidéo externe ne se remplace pas par un fichier")
    upload = validate_upload(filename, data, category="media", max_mb=settings.MAX_UPLOAD_MB * 4)
    if _kind_for(upload.mime) != asset.kind:
        raise AppError("Le nouveau fichier doit être du même type", code="MEDIA_KIND_MISMATCH")
    previous = asset.checksum_sha256
    ext = PurePath(upload.filename).suffix.lower()
    key = f"{asset.id.hex[:2]}/{asset.id}/original-{utcnow():%Y%m%d%H%M%S}{ext}"
    public_storage().put(key, upload.data, upload.mime)
    asset.storage_key = key
    asset.mime_type = upload.mime
    asset.size_bytes = upload.size
    asset.checksum_sha256 = upload.sha256
    asset.original_name = upload.filename
    if asset.kind == "image":
        _generate_variants(asset, upload.data)
    db.add(
        MediaRevision(
            media_id=asset.id,
            action="replace",
            user_id=user_id,
            previous_checksum=previous,
            changes={"name": upload.filename, "size": upload.size},
        )
    )
    audit.record(
        db,
        family="business",
        module="media",
        action="UPDATE",
        resource_type="media",
        resource_id=asset.id,
        diff={"checksum": [previous, upload.sha256]},
    )
    return asset


def register_external_video(
    db: Session,
    *,
    url: str,
    title: str,
    alt_text: str | None,
    caption: str | None,
    folder: str,
    tags: list[str],
    poster_media_id: uuid.UUID | None,
    author_id: uuid.UUID | None,
) -> MediaAsset:
    """Vidéo YouTube/Vimeo : référence d'URL/ID + métadonnées, sans téléchargement du média tiers."""
    provider, external_id = None, None
    if m := _YT.search(url):
        provider, external_id = "youtube", m.group(1)
    elif m := _VIMEO.search(url):
        provider, external_id = "vimeo", m.group(1)
    if not provider:
        raise AppError("URL YouTube ou Vimeo attendue", code="INVALID_VIDEO_URL")
    asset = MediaAsset(
        kind="external_video",
        title=title,
        alt_text=alt_text,
        caption=caption,
        external_provider=provider,
        external_id=external_id,
        external_url=url,
        folder=folder,
        tags=tags,
        poster_media_id=poster_media_id,
        author_id=author_id,
        status="active",
    )
    db.add(asset)
    db.flush()
    db.add(
        MediaRevision(
            media_id=asset.id,
            action="upload",
            user_id=author_id,
            changes={"provider": provider, "external_id": external_id},
        )
    )
    audit.record(
        db,
        family="business",
        module="media",
        action="CREATE",
        resource_type="media",
        resource_id=asset.id,
        diff={"provider": provider, "external_id": external_id},
    )
    return asset


def media_payload(asset: MediaAsset | None) -> dict[str, Any] | None:
    """Représentation publique d'un média (URLs des variantes, dimensions, texte alternatif)."""
    if asset is None or asset.deleted_at is not None or asset.status != "active":
        return None
    data: dict[str, Any] = {
        "id": str(asset.id),
        "kind": asset.kind,
        "title": asset.title,
        "alt": asset.alt_text or asset.title,
        "caption": asset.caption,
        "credits": asset.credits,
        "width": asset.width,
        "height": asset.height,
        "mime": asset.mime_type,
        "focal": {"x": asset.focal_x, "y": asset.focal_y} if asset.focal_x is not None else None,
    }
    if asset.kind == "external_video":
        data.update(
            provider=asset.external_provider,
            external_id=asset.external_id,
            url=asset.external_url,
            embed_url=(
                f"https://www.youtube-nocookie.com/embed/{asset.external_id}"
                if asset.external_provider == "youtube"
                else f"https://player.vimeo.com/video/{asset.external_id}"
            ),
        )
        if asset.poster_media_id:
            data["poster_url"] = media_url(asset.poster_media_id, "lg")
        return data
    data["url"] = media_url(asset.id, "original")
    if asset.variants:
        data["variants"] = {
            name: {
                "url": media_url(asset.id, name),
                "width": v.get("width"),
                "height": v.get("height"),
                "mime": v.get("mime"),
            }
            for name, v in asset.variants.items()
        }
    if asset.poster_media_id:
        data["poster_url"] = media_url(asset.poster_media_id, "lg")
    return data


def load_media_map(db: Session, ids: set[uuid.UUID]) -> dict[str, dict[str, Any]]:
    if not ids:
        return {}
    rows = db.execute(select(MediaAsset).where(MediaAsset.id.in_(ids))).scalars().all()
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        payload = media_payload(row)
        if payload:
            out[str(row.id)] = payload
    return out


def collect_media_ids(value: Any) -> set[uuid.UUID]:
    """Parcourt une structure JSON et collecte les identifiants de médias (clés *media_id / *media_ids, et images ou
    vidéos de la médiathèque insérées dans les textes riches)."""
    found: set[uuid.UUID] = set()

    def walk(node: Any, key: str | None = None) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, k)
        elif isinstance(node, list):
            for item in node:
                walk(item, key)
        elif isinstance(node, str) and "/public/media/" in node:
            found.update(html_media_ids(node))
        elif key and (key.endswith("media_id") or key.endswith("media_ids")) and node:
            try:
                found.add(uuid.UUID(str(node)))
            except ValueError as exc:
                raise AppError(f"Référence média invalide ({key})", code="INVALID_MEDIA_REF") from exc

    walk(value)
    return found


def validate_media_refs(db: Session, value: Any) -> set[uuid.UUID]:
    """Règle §5.1 / V4-MEDIA-07 : toute référence doit pointer vers un média actif de la médiathèque."""
    ids = collect_media_ids(value)
    if not ids:
        return ids
    rows = (
        db.execute(
            select(MediaAsset.id).where(
                MediaAsset.id.in_(ids), MediaAsset.deleted_at.is_(None), MediaAsset.status == "active"
            )
        )
        .scalars()
        .all()
    )
    missing = ids - set(rows)
    if missing:
        raise AppError(
            "Média introuvable ou archivé dans la médiathèque",
            code="MEDIA_NOT_FOUND",
            details={"media_ids": sorted(str(m) for m in missing)},
        )
    return ids


def media_usage(db: Session) -> dict[uuid.UUID, list[dict[str, str]]]:
    """Index des usages de chaque média (pages, collections, réglages) — détection des orphelins."""
    from app.modules.cms import models as m

    usage: dict[uuid.UUID, list[dict[str, str]]] = {}

    def add(ids: set[uuid.UUID], kind: str, ref: str) -> None:
        for mid in ids:
            usage.setdefault(mid, []).append({"type": kind, "ref": ref})

    for page in db.execute(select(m.CmsPage)).scalars():
        add(collect_media_ids({"body": page.body}), "page", page.route_key)
        for section in page.sections:
            add(collect_media_ids(section.settings), "page", page.route_key)
            for block in section.blocks:
                add(collect_media_ids(block.data), "page", page.route_key)
    collections = [
        (m.Universe, "universe", "slug"),
        (m.Offer, "offer", "slug"),
        (m.Expertise, "expertise", "slug"),
        (m.Service, "service", "slug"),
        (m.PortfolioProject, "project", "slug"),
        (m.BlogPost, "blog_post", "slug"),
        (m.HelpArticle, "help_article", "slug"),
        (m.FaqItem, "faq", "question"),
        (m.Testimonial, "testimonial", "author_name"),
        (m.TeamMember, "team", "name"),
        (m.Partner, "partner", "name"),
        (m.Certification, "certification", "name"),
        (m.Video, "video", "title"),
        (m.Banner, "banner", "key"),
        (m.BlogAuthor, "blog_author", "slug"),
        (m.SiteSettings, "site_settings", "company_name"),
        (m.SeoMetadata, "seo", "target_key"),
    ]
    for model, kind, label_attr in collections:
        for row in db.execute(select(model)).scalars():
            data = {c.key: getattr(row, c.key) for c in model.__table__.columns}
            add(collect_media_ids(data), kind, str(getattr(row, label_attr)))
    for row in db.execute(select(m.MediaAsset).where(m.MediaAsset.poster_media_id.is_not(None))).scalars():
        add({row.poster_media_id}, "media_poster", str(row.id))
    return usage


def scan_usage(db: Session) -> dict[str, Any]:
    """Compteurs d'utilisation (badge « libre », filtre des orphelins) recalculés depuis les contenus."""
    usage = media_usage(db)
    now = utcnow()
    orphans = total = 0
    for asset in db.execute(select(MediaAsset).where(MediaAsset.deleted_at.is_(None))).scalars():
        total += 1
        asset.usage_count = len(usage.get(asset.id, []))
        asset.last_usage_scan_at = now
        if asset.usage_count == 0:
            orphans += 1
    db.flush()
    return {"orphans": orphans, "used": total - orphans, "total": total}


def archive_media(db: Session, asset: MediaAsset, *, user_id: uuid.UUID | None, force: bool = False) -> None:
    usage = media_usage(db).get(asset.id, [])
    if usage and not force:
        raise Conflict(
            "Média utilisé par des contenus : retirez-le d'abord", code="MEDIA_IN_USE", details={"usages": usage[:20]}
        )
    asset.status = "archived"
    db.add(MediaRevision(media_id=asset.id, action="archive", user_id=user_id))
    audit.record(db, family="business", module="media", action="ARCHIVE", resource_type="media", resource_id=asset.id)


def get_media(db: Session, media_id: uuid.UUID) -> MediaAsset:
    asset = db.get(MediaAsset, media_id)
    if asset is None or asset.deleted_at is not None:
        raise NotFound("Média introuvable")
    return asset
