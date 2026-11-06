"""Images apposées sur les documents : cachet de l'entreprise (fond retiré) et signatures manuscrites dessinées.

- `transparent_stamp` : photo ou scan d'un cachet → PNG transparent. Le fond (papier blanc ou gris, éclairage
  inégal) est estimé localement puis retiré ; l'encre est ramenée à une teinte unique pour un rendu net, sans halo
  blanc sur le document.
- `normalize_signature` : tracé dessiné à la souris ou au doigt (PNG du navigateur ou de l'application) → PNG
  transparent recadré, à l'encre bleu nuit ; un tracé vide ou quasi vide est refusé.
"""

from __future__ import annotations

import base64
import binascii
import io

from app.core.errors import AppError

MAX_STAMP_BYTES = 12 * 1024 * 1024
MAX_SIGNATURE_BYTES = 1024 * 1024
SIGNATURE_INK = (16, 32, 96)  # bleu nuit (stylo)


def _open(data: bytes, *, limit: int, label: str) -> object:
    from PIL import Image, ImageOps, UnidentifiedImageError

    if not data:
        raise AppError(f"{label} : image vide", code="IMAGE_EMPTY")
    if len(data) > limit:
        raise AppError(f"{label} : image trop lourde (max {limit // (1024 * 1024)} Mo)", code="IMAGE_TOO_LARGE")
    try:
        image = Image.open(io.BytesIO(data))
        if image.width * image.height > 40_000_000:
            raise AppError(f"{label} : image trop grande", code="IMAGE_TOO_LARGE")
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise AppError(f"{label} : image illisible (PNG ou JPEG attendu)", code="IMAGE_INVALID") from exc
    return ImageOps.exif_transpose(image)  # photo prise au téléphone : orientation réelle


def _png(image: object) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)  # type: ignore[attr-defined]
    return buf.getvalue()


def transparent_stamp(data: bytes) -> bytes:
    """Cachet photographié ou scanné → PNG transparent recadré (encre d'une seule teinte, fond retiré)."""
    from PIL import Image, ImageChops, ImageFilter, ImageStat

    image = _open(data, limit=MAX_STAMP_BYTES, label="Cachet").convert("RGB")  # type: ignore[attr-defined]
    if max(image.size) > 1400:
        image.thumbnail((1400, 1400), Image.LANCZOS)
    w, h = image.size
    # Fond local : l'encre est plus sombre que le papier → maximum sur une fenêtre plus large que les traits.
    small = image.resize((max(1, w // 8), max(1, h // 8)), Image.BILINEAR)
    paper = small.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3)).resize((w, h), Image.BILINEAR)
    r, g, b = ImageChops.difference(image, paper).split()
    distance = ImageChops.lighter(r, ImageChops.lighter(g, b))
    low, high = 25.0, 80.0

    def ramp(v: int) -> int:
        x = min(max((v - low) / (high - low), 0.0), 1.0)
        return round(255 * x * x * (3 - 2 * x))

    alpha = distance.point(ramp)
    box = alpha.point(lambda v: 255 if v > 89 else 0).getbbox()
    strong = alpha.point(lambda v: 255 if v > 204 else 0)
    if box is None or strong.getbbox() is None:
        raise AppError("Cachet illisible : aucune encre détectée sur l'image", code="STAMP_UNREADABLE")
    ink = tuple(int(c) for c in ImageStat.Stat(image, mask=strong).median)
    out = Image.new("RGBA", (w, h), (*ink, 0))
    out.putalpha(alpha)
    x0, y0, x1, y1 = box
    return _png(out.crop((max(0, x0 - 4), max(0, y0 - 4), min(w, x1 + 4), min(h, y1 + 4))))


def decode_data_url(value: str, *, label: str = "Signature") -> bytes:
    """`data:image/png;base64,…` (canvas du navigateur) ou base64 brut → octets."""
    raw = value.split(",", 1)[1] if value.startswith("data:") else value
    try:
        return base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise AppError(f"{label} : image invalide", code="IMAGE_INVALID") from exc


def normalize_signature(data: bytes) -> bytes:
    """Tracé de signature → PNG transparent recadré, encre bleu nuit ; refuse un tracé vide."""
    from PIL import Image, ImageChops

    image = _open(data, limit=MAX_SIGNATURE_BYTES, label="Signature")
    rgba = image.convert("RGBA")  # type: ignore[attr-defined]
    if max(rgba.size) > 2400:
        rgba.thumbnail((2400, 2400), Image.LANCZOS)
    alpha = rgba.getchannel("A")
    if alpha.getextrema() == (255, 255):
        # image opaque (fond blanc) : l'encre est ce qui est plus sombre que le blanc
        gray = rgba.convert("L")
        alpha = ImageChops.invert(gray).point(lambda v: 0 if v < 40 else min(255, v * 2))
    ink_pixels = sum(alpha.point(lambda v: 1 if v > 96 else 0).histogram()[1:])
    box = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    if box is None or ink_pixels < 120:
        raise AppError("Signature vide : dessinez votre signature avant de valider", code="SIGNATURE_EMPTY")
    x0, y0, x1, y1 = box
    if (x1 - x0) < 30 and (y1 - y0) < 30:
        raise AppError("Signature trop petite : dessinez-la en grand dans le cadre", code="SIGNATURE_TOO_SMALL")
    out = Image.new("RGBA", rgba.size, (*SIGNATURE_INK, 0))
    out.putalpha(alpha)
    out = out.crop((max(0, x0 - 6), max(0, y0 - 6), min(rgba.width, x1 + 6), min(rgba.height, y1 + 6)))
    out.thumbnail((1200, 400), Image.LANCZOS)
    return _png(out)


__all__ = ["decode_data_url", "normalize_signature", "transparent_stamp"]
