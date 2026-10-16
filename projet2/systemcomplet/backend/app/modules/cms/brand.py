"""Icône unique de la plateforme (réglage CMS « Icône de la plateforme ») et ses déclinaisons.

Une seule image source sert partout : onglet du navigateur (favicon), application installée (PWA), raccourci iOS,
assistant du site, notifications et futures applications mobile / bureau (pack d'icônes). Le logo reste réservé aux
en-têtes, pieds de page et documents : les deux ne se mélangent plus.

Déclinaisons générées à la demande à partir de l'image de la médiathèque (recadrage sur le contenu, carré centré),
mises en cache sur le volume public par version (empreinte de la source) : changer l'icône change la version, donc
toutes les URL versionnées (`?v=`) et les caches des navigateurs.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import zipfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageOps
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.core.storage import public_storage
from app.modules.cms import models as m

log = logging.getLogger("globus.cms.brand")

DEFAULT_ICON = Path(__file__).resolve().parents[2] / "assets" / "brand" / "icon-globus.png"
# Tailles utiles : onglets (16-48), raccourcis et tuiles (64-384), PWA (192/512), magasins d'applications (1024).
ICON_SIZES = (16, 32, 48, 64, 96, 128, 152, 167, 180, 192, 256, 384, 512, 1024)
MASKABLE_SIZES = (192, 512)
THEME_COLOR = "#385AA6"
BACKGROUND_COLOR = "#FFFFFF"
MIN_SOURCE_SIDE = 64
_WHITE = (255, 255, 255, 255)


def _api(path: str) -> str:
    return f"{settings.API_PREFIX}/public/brand/{path}"


def icon_source(db: Session) -> tuple[bytes, str, str]:
    """(octets de l'image source, version, origine « custom » / « default »)."""
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    if site is not None and site.favicon_media_id:
        asset = db.get(m.MediaAsset, site.favicon_media_id)
        if asset is not None and asset.deleted_at is None and asset.kind == "image" and asset.storage_key:
            try:
                data = public_storage().get(asset.storage_key)
                return data, hashlib.sha256(data).hexdigest()[:12], "custom"
            except OSError:
                log.warning("icône de la plateforme introuvable sur le volume public (%s)", asset.storage_key)
    data = DEFAULT_ICON.read_bytes()
    return data, "d" + hashlib.sha256(data).hexdigest()[:11], "default"


def _open(data: bytes) -> Image.Image:
    with Image.open(io.BytesIO(data)) as src:
        return ImageOps.exif_transpose(src).convert("RGBA")


def _trim(img: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int] | None]:
    """Recadre sur le contenu ; renvoie aussi la couleur de fond (None si fond transparent)."""
    corner = img.getpixel((0, 0))
    if corner[3] < 16:  # fond transparent : contenu = pixels visibles
        bbox = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        background = None
    else:  # fond opaque uni : contenu = pixels qui s'écartent de la couleur du coin
        rgb = img.convert("RGB")
        diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, corner[:3])).convert("L")
        bbox = diff.point(lambda p: 255 if p > 24 else 0).getbbox()
        background = corner
    return (img.crop(bbox) if bbox else img), background


def render_icon(data: bytes, size: int, *, padding: float = 0.04, opaque: bool = False) -> bytes:
    """Icône carrée PNG `size`×`size` : contenu recadré, centré, marge relative `padding` ; `opaque` impose un fond
    (iOS et icônes « maskable » n'acceptent pas la transparence)."""
    img, background = _trim(_open(data))
    side = max(img.width, img.height)
    margin = round(side * padding)
    fill = background or (_WHITE if opaque else (0, 0, 0, 0))
    canvas = Image.new("RGBA", (side + 2 * margin, side + 2 * margin), fill)
    canvas.paste(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2), img)
    canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_ico(data: bytes) -> bytes:
    base = Image.open(io.BytesIO(render_icon(data, 256)))
    buf = io.BytesIO()
    base.save(buf, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    return buf.getvalue()


def _maskable(data: bytes, size: int) -> bytes:
    """Android : contenu dans la zone de sécurité (cercle de 80 %), fond plein."""
    return render_icon(data, size, padding=0.17, opaque=True)


VARIANTS: dict[str, tuple[str, Any]] = {
    **{f"icon-{s}.png": ("image/png", lambda d, s=s: render_icon(d, s)) for s in ICON_SIZES},
    **{f"icon-maskable-{s}.png": ("image/png", lambda d, s=s: _maskable(d, s)) for s in MASKABLE_SIZES},
    "apple-touch-icon.png": ("image/png", lambda d: render_icon(d, 180, padding=0.1, opaque=True)),
    "favicon.ico": ("image/x-icon", render_ico),
}


def variant_file(db: Session, name: str) -> tuple[Path, str, str]:
    """Chemin du fichier (généré au besoin), type MIME, version."""
    if name not in VARIANTS:
        raise AppError("Déclinaison d'icône inconnue", code="UNKNOWN_ICON", status_code=404)
    data, version, _origin = icon_source(db)
    mime, render = VARIANTS[name]
    storage = public_storage()
    key = f"_brand/{version}/{name}"
    path = storage.local_path(key)
    if not path.exists():
        storage.put(key, render(data), mime)
    return path, mime, version


def ensure_icon_media(db: Session, media_id: Any) -> None:
    """Contrôle à l'enregistrement : une image matricielle lisible, assez grande pour toutes les déclinaisons."""
    if not media_id:
        return
    asset = db.get(m.MediaAsset, media_id)
    if asset is None or asset.kind != "image":
        raise AppError(
            "L'icône de la plateforme doit être une image PNG, JPG ou WebP de la médiathèque "
            "(pas de SVG, vidéo ou document).",
            code="INVALID_PLATFORM_ICON",
        )
    try:
        img = _open(public_storage().get(asset.storage_key or ""))
    except (OSError, ValueError) as exc:
        raise AppError("Image illisible : choisissez une autre image.", code="INVALID_PLATFORM_ICON") from exc
    if min(img.size) < MIN_SOURCE_SIDE:
        raise AppError(
            f"Image trop petite ({img.width}×{img.height} px) : au moins {MIN_SOURCE_SIDE} px, "
            "idéalement 512 px ou plus.",
            code="INVALID_PLATFORM_ICON",
        )


def brand_payload(db: Session) -> dict[str, Any]:
    """Identité visuelle pour le web (favicon, manifeste PWA), l'assistant et les applications mobile / bureau."""
    _data, version, origin = icon_source(db)
    site = db.execute(select(m.SiteSettings).limit(1)).scalar_one_or_none()
    name = (site.company_name if site else None) or "GLOBUS ENGINEERING"
    url = lambda variant: f"{_api(variant)}?v={version}"  # noqa: E731
    icons = [
        {"src": url(f"icon-{s}.png"), "sizes": f"{s}x{s}", "type": "image/png", "purpose": "any"} for s in (192, 512)
    ] + [
        {"src": url(f"icon-maskable-{s}.png"), "sizes": f"{s}x{s}", "type": "image/png", "purpose": "maskable"}
        for s in MASKABLE_SIZES
    ]
    return {
        "name": name,
        "short_name": name.split()[0][:12],
        "theme_color": THEME_COLOR,
        "background_color": BACKGROUND_COLOR,
        "version": version,
        "origin": origin,
        "icon": url("icon-512.png"),
        "favicon": url("favicon.ico"),
        "favicon_png": url("icon-32.png"),
        "apple_touch_icon": url("apple-touch-icon.png"),
        "sizes": {str(s): url(f"icon-{s}.png") for s in ICON_SIZES},
        "icons": icons,
    }


def icon_pack(db: Session) -> bytes:
    """Archive ZIP de toutes les déclinaisons + brand.json (intégration des applications mobile et bureau)."""
    data, _version, _origin = icon_source(db)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, (_mime, render) in VARIANTS.items():
            archive.writestr(name, render(data))
        payload = brand_payload(db)
        payload["files"] = sorted(VARIANTS)
        archive.writestr("brand.json", json.dumps(payload, ensure_ascii=False, indent=2))
    return buf.getvalue()
