"""QR code generation — used for temp-worker badges, document signing tokens.

We rely on qrcode[pil] (already pinned by Phase 4 requirements). The output is a
PNG ready to embed in a badge / PDF / `<img src>`.
"""
from __future__ import annotations

import io

import qrcode
from PIL import Image, ImageDraw, ImageFont


def qr_png(payload: str, *, box_size: int = 8, border: int = 2) -> bytes:
    """Return a raw PNG image carrying the payload, no decoration."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def temp_worker_badge_png(token: str, *, worker_name: str, speciality: str = "") -> bytes:
    """Return a polished badge PNG: brand strip + QR + name + speciality.

    Falls back to a plain QR if Pillow can't compose text (e.g. missing fonts
    in a stripped container) — we never want to break the request.
    """
    qr_raw = qr_png(token, box_size=10, border=1)
    try:
        qr_img = Image.open(io.BytesIO(qr_raw)).convert("RGB")
        w = max(qr_img.width + 40, 400)
        h = qr_img.height + 140
        badge = Image.new("RGB", (w, h), "white")
        # Header strip
        draw = ImageDraw.Draw(badge)
        draw.rectangle([(0, 0), (w, 50)], fill=(26, 54, 93))  # globus blue
        try:
            font_title = ImageFont.truetype("arial.ttf", 22)
            font_body = ImageFont.truetype("arial.ttf", 14)
            font_small = ImageFont.truetype("arial.ttf", 11)
        except Exception:
            font_title = ImageFont.load_default()
            font_body = ImageFont.load_default()
            font_small = ImageFont.load_default()
        draw.text((20, 14), "GLOBUS BTP", fill="white", font=font_title)
        # QR
        qr_x = (w - qr_img.width) // 2
        badge.paste(qr_img, (qr_x, 60))
        # Footer
        name_y = 60 + qr_img.height + 6
        draw.text((20, name_y), worker_name[:38], fill=(31, 41, 55), font=font_body)
        if speciality:
            draw.text((20, name_y + 22), speciality[:50], fill=(107, 114, 128), font=font_small)
        out = io.BytesIO()
        badge.save(out, format="PNG")
        return out.getvalue()
    except Exception:
        return qr_raw
