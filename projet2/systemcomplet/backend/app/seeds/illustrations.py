"""Illustrations générées pour le jeu de démonstration (aucun téléchargement) : scènes d'architecture stylisées
— villa au crépuscule, tour de bureaux de nuit, villa face à l'océan, diaspora connectée, plan d'ingénieur,
chantier en cours — rendues en 2x puis réduites (anticrénelage), avec halos et reflets.

Elles donnent à la vitrine de démonstration un rendu proche de la production ; en production, les visuels sont
ceux de la médiathèque (photos réelles des chantiers)."""

from __future__ import annotations

import io
import itertools
import math
import random
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont

Color = tuple[int, int, int]
NIGHT: Color = (5, 11, 26)
NAVY: Color = (10, 21, 48)
BRAND: Color = (56, 90, 166)
BLUE_LIGHT: Color = (143, 176, 255)
ORANGE: Color = (251, 140, 67)
WARM: Color = (255, 208, 138)
SCALE = 2
FONTS = Path(__file__).resolve().parents[1] / "assets" / "fonts"


@lru_cache(maxsize=8)
def _font_bytes(name: str) -> bytes | None:
    try:
        from fontTools.ttLib import TTFont

        font = TTFont(str(FONTS / name))
        font.flavor = None
        buf = io.BytesIO()
        font.save(buf)
        return buf.getvalue()
    except Exception:  # noqa: BLE001 — police facultative : repli sur la police par défaut
        return None


def _font(size: int, name: str = "Gilroy-Bold.woff2") -> Any:
    data = _font_bytes(name)
    if data:
        return ImageFont.truetype(io.BytesIO(data), size)
    return ImageFont.load_default()


def _mix(a: Color, b: Color, t: float) -> Color:
    return (int(a[0] + (b[0] - a[0]) * t), int(a[1] + (b[1] - a[1]) * t), int(a[2] + (b[2] - a[2]) * t))


def _gradient(size: tuple[int, int], stops: list[tuple[float, Color]]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        for (p0, c0), (p1, c1) in itertools.pairwise(stops):
            if p0 <= t <= p1:
                draw.line([(0, y), (w, y)], fill=_mix(c0, c1, (t - p0) / max(1e-6, p1 - p0)))
                break
    return img


def _glow(img: Image.Image, box: tuple[float, float, float, float], color: Color, alpha: int, blur: float) -> None:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box, fill=(*color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.paste(layer, (0, 0), layer)


def _overlay(img: Image.Image) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    return layer, ImageDraw.Draw(layer)


def _stars(draw: ImageDraw.ImageDraw, rng: random.Random, w: int, h: int, n: int) -> None:
    for _ in range(n):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.choice((1, 1, 1.5, 2)) * SCALE / 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, rng.randint(90, 230)))


def _windows(
    draw: Any,
    rng: random.Random,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    cols: int,
    rows: int,
    lit: float,
    cool: bool = False,
) -> None:
    gw, gh = (x1 - x0) / cols, (y1 - y0) / rows
    for c in range(cols):
        for r in range(rows):
            if rng.random() > lit:
                color: tuple[int, ...] = (40, 58, 96, 255)
            elif cool and rng.random() < 0.35:
                color = (170, 205, 255, 255)
            else:
                color = (*_mix(WARM, ORANGE, rng.random() * 0.5), 255)
            draw.rectangle(
                [
                    x0 + c * gw + gw * 0.18,
                    y0 + r * gh + gh * 0.22,
                    x0 + (c + 1) * gw - gw * 0.18,
                    y0 + (r + 1) * gh - gh * 0.12,
                ],
                fill=color,
            )


def _palm(draw: ImageDraw.ImageDraw, x: float, ground: float, height: float, color: tuple[int, ...]) -> None:
    top = (x + height * 0.12, ground - height)
    for i in range(14):
        t0, t1 = i / 14, (i + 1) / 14
        p0 = (x + math.sin(t0 * 1.4) * height * 0.12, ground - t0 * height)
        p1 = (x + math.sin(t1 * 1.4) * height * 0.12, ground - t1 * height)
        draw.line([p0, p1], fill=color, width=int(max(3, height * 0.035 * (1.2 - t0))))
    for k in range(9):
        ang = math.pi * (0.95 + k * 0.14)
        length = height * (0.42 + 0.08 * math.sin(k * 1.7))
        pts = []
        for s in range(10):
            t = s / 9
            pts.append(
                (
                    top[0] + math.cos(ang) * length * t,
                    top[1] + math.sin(ang) * length * t * 0.55 + (length * 0.35) * t * t,
                )
            )
        draw.line(pts, fill=color, width=int(max(2, height * 0.02)))


def _crane(
    draw: Any,
    x: float,
    ground: float,
    top: float,
    jib_left: float,
    jib_right: float,
    color: tuple[int, ...],
    width: float,
) -> None:
    m = width * 3.2
    draw.line([(x - m, ground), (x - m, top)], fill=color, width=int(width))
    draw.line([(x + m, ground), (x + m, top)], fill=color, width=int(width))
    step = m * 2.2
    y, left = ground, True
    while y - step > top:
        draw.line(
            [(x - m if left else x + m, y), (x + m if left else x - m, y - step)], fill=color, width=int(width * 0.6)
        )
        y -= step
        left = not left
    draw.line([(jib_left, top), (jib_right, top)], fill=color, width=int(width * 1.4))
    draw.line([(jib_left, top + m * 1.6), (jib_right, top + m * 1.6)], fill=color, width=int(width * 0.7))
    apex = (x, top - m * 6)
    draw.line([(x, top), apex], fill=color, width=int(width))
    draw.line([apex, (jib_left + (x - jib_left) * 0.25, top)], fill=color, width=int(width * 0.5))
    draw.line([apex, (jib_right, top)], fill=color, width=int(width * 0.5))
    draw.rectangle([jib_right - m * 5, top + m * 1.6, jib_right - m * 1, top + m * 5], fill=color)


def _finish(img: Image.Image, size: tuple[int, int]) -> bytes:
    out = img.convert("RGB").resize(size, Image.LANCZOS)
    vignette = Image.new("L", size, 0)
    ImageDraw.Draw(vignette).ellipse([-size[0] * 0.25, -size[1] * 0.35, size[0] * 1.25, size[1] * 1.35], fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(size[0] * 0.08))
    dark = Image.new("RGB", size, NIGHT)
    out = Image.composite(out, dark, vignette.point(lambda v: int(150 + v * 105 / 255)))
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=88, optimize=True, progressive=True)
    return buf.getvalue()


# ============================================================================ scènes


def villa(size: tuple[int, int] = (1600, 1000), seed: int = 1) -> bytes:
    """Villa contemporaine au crépuscule, piscine et palmiers."""
    rng = random.Random(seed)
    w, h = size[0] * SCALE, size[1] * SCALE
    horizon = h * 0.62
    skies: list[list[tuple[float, Color]]] = [
        [(0, (9, 18, 44)), (0.32, (46, 62, 128)), (0.55, (238, 141, 92)), (0.62, (255, 196, 128))],
        [(0, (8, 8, 30)), (0.35, (52, 34, 102)), (0.55, (176, 82, 142)), (0.62, (255, 160, 120))],
        [(0, (24, 52, 112)), (0.38, (96, 138, 206)), (0.56, (255, 178, 150)), (0.62, (255, 222, 180))],
    ]
    sky = skies[seed % 3]
    img = _gradient((w, h), [*sky, (0.63, (28, 30, 48)), (1, (10, 14, 28))]).convert("RGBA")
    sun_x = 0.55 + 0.25 * ((seed * 37) % 10) / 10
    _glow(
        img,
        (w * (sun_x - 0.15), horizon - h * 0.2, w * (sun_x + 0.15), horizon + h * 0.12),
        sky[-1][1],
        170,
        90 * SCALE,
    )
    layer, d = _overlay(img)
    _stars(d, rng, w, int(h * 0.3), 90)
    hill = (
        [(0, horizon)]
        + [(x, horizon - h * (0.05 + 0.04 * math.sin(x / w * 5 + seed))) for x in range(0, w + 40, 40)]
        + [(w, horizon)]
    )
    d.polygon(hill, fill=(22, 30, 58, 255))
    img.alpha_composite(layer)
    layer, d = _overlay(img)
    base_y = horizon + h * 0.1
    x0, x1 = w * (0.18 + rng.uniform(-0.03, 0.03)), w * 0.78
    d.rectangle([x0, base_y - h * 0.2, x1, base_y], fill=(24, 29, 44, 255))
    ux0, ux1 = x0 + (x1 - x0) * 0.28, x1 + w * 0.06
    d.rectangle([ux0, base_y - h * 0.38, ux1, base_y - h * 0.2], fill=(32, 38, 58, 255))
    d.rectangle([x0 - w * 0.02, base_y - h * 0.205, x1 + w * 0.02, base_y - h * 0.195], fill=(222, 226, 236, 255))
    d.rectangle([ux0 - w * 0.015, base_y - h * 0.385, ux1 + w * 0.015, base_y - h * 0.375], fill=(236, 239, 245, 255))
    low, high = 3 + seed % 3, 2 + seed % 2
    for i in range(low):
        gx = x0 + (x1 - x0) * (0.05 + i * 0.92 / low)
        d.rectangle(
            [gx, base_y - h * 0.17, gx + (x1 - x0) * (0.92 / low - 0.05), base_y - h * 0.015],
            fill=(*_mix(WARM, ORANGE, 0.2 + 0.08 * i), 255),
        )
    for i in range(high):
        gx = ux0 + (ux1 - ux0) * (0.06 + i * 0.9 / high)
        d.rectangle(
            [gx, base_y - h * 0.35, gx + (ux1 - ux0) * (0.9 / high - 0.07), base_y - h * 0.225],
            fill=(*_mix(WARM, (255, 236, 200), 0.3), 255),
        )
    img.alpha_composite(layer)
    _glow(img, (x0, base_y - h * 0.3, x1, base_y + h * 0.05), (255, 190, 120), 70, 40 * SCALE)
    layer, d = _overlay(img)
    pool_top = base_y + h * 0.04
    d.polygon(
        [(w * 0.12, pool_top), (w * 0.9, pool_top), (w * 0.98, h * 0.96), (w * 0.02, h * 0.96)],
        fill=(18, 112, 150, 255),
    )
    img.alpha_composite(layer)
    # reflets (calque séparé : ImageDraw remplace les pixels au lieu de les mélanger)
    layer, d = _overlay(img)
    for i in range(18):
        y = pool_top + (h * 0.96 - pool_top) * i / 18
        d.line([(w * 0.1, y), (w * 0.92, y)], fill=(160, 230, 255, 26 + (i % 3) * 14), width=2 * SCALE)
    for i in range(low):
        gx = x0 + (x1 - x0) * (0.05 + i * 0.92 / low)
        d.rectangle(
            [gx + (x1 - x0) * 0.02, pool_top + h * 0.015, gx + (x1 - x0) * (0.92 / low - 0.07), pool_top + h * 0.09],
            fill=(255, 214, 160, 60),
        )
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(3 * SCALE)))
    layer, d = _overlay(img)
    for px, ph in ((w * 0.08, h * 0.5), (w * 0.9, h * 0.44), (w * 0.95, h * 0.36)):
        _palm(d, px, base_y + h * 0.02, ph, (8, 12, 24, 255))
    img.alpha_composite(layer)
    return _finish(img, size)


def tower(size: tuple[int, int] = (1600, 1000), seed: int = 2) -> bytes:
    """Tour de bureaux de nuit, skyline et grue."""
    rng = random.Random(seed)
    w, h = size[0] * SCALE, size[1] * SCALE
    ground = h * 0.86
    tower_skies: list[list[tuple[float, Color]]] = [
        [(0, (4, 8, 22)), (0.6, (22, 44, 98)), (0.86, (56, 72, 130))],
        [(0, (14, 10, 40)), (0.6, (70, 50, 120)), (0.86, (230, 130, 110))],
        [(0, (6, 18, 40)), (0.6, (30, 90, 120)), (0.86, (120, 190, 200))],
    ]
    img = _gradient((w, h), [*tower_skies[seed % 3], (0.87, (8, 12, 26)), (1, (5, 9, 20))]).convert("RGBA")
    _glow(img, (w * 0.7, h * 0.08, w * 0.82, h * 0.2), (220, 230, 255), 160, 30 * SCALE)
    layer, d = _overlay(img)
    _stars(d, rng, w, int(h * 0.5), 160)
    d.ellipse([w * 0.735, h * 0.115, w * 0.785, h * 0.175], fill=(240, 244, 255, 255))
    x = 0.0
    while x < w:
        bw = rng.uniform(w * 0.04, w * 0.09)
        bh = rng.uniform(h * 0.12, h * 0.34)
        d.rectangle([x, ground - bh, x + bw, ground], fill=(16, 26, 54, 255))
        _windows(
            d,
            rng,
            x + bw * 0.08,
            ground - bh + h * 0.02,
            x + bw * 0.92,
            ground - h * 0.01,
            max(2, int(bw / (w * 0.012))),
            max(3, int(bh / (h * 0.03))),
            0.28,
            cool=True,
        )
        x += bw + rng.uniform(w * 0.005, w * 0.02)
    img.alpha_composite(layer)
    layer, d = _overlay(img)
    tx0, tx1, ttop = w * 0.38, w * 0.58, h * 0.12
    d.polygon(
        [(tx0, ground), (tx0, ttop + h * 0.06), (tx0 + (tx1 - tx0) * 0.5, ttop), (tx1, ttop + h * 0.06), (tx1, ground)],
        fill=(20, 34, 72, 255),
    )
    _windows(d, rng, tx0 + w * 0.006, ttop + h * 0.08, tx1 - w * 0.006, ground - h * 0.01, 12, 36, 0.62, cool=True)
    d.line(
        [(tx0 + (tx1 - tx0) * 0.5, ttop), (tx0 + (tx1 - tx0) * 0.5, ttop - h * 0.06)],
        fill=(200, 210, 240, 255),
        width=3 * SCALE,
    )
    img.alpha_composite(layer)
    _glow(
        img,
        (tx0 + (tx1 - tx0) * 0.5 - 30, ttop - h * 0.075, tx0 + (tx1 - tx0) * 0.5 + 30, ttop - h * 0.045),
        (255, 90, 60),
        220,
        8 * SCALE,
    )
    _glow(img, (tx0 - w * 0.05, ttop, tx1 + w * 0.05, ground), (90, 130, 240), 45, 70 * SCALE)
    layer, d = _overlay(img)
    _crane(d, w * 0.7, ground, h * 0.2, w * 0.5, w * 0.84, (251, 140, 67, 255), 3 * SCALE)
    d.line([(w * 0.6, h * 0.2 + 10), (w * 0.6, h * 0.45)], fill=(251, 170, 110, 255), width=2 * SCALE)
    d.rectangle([w * 0.585, h * 0.45, w * 0.615, h * 0.46], fill=(251, 140, 67, 255))
    for i in range(10):
        y = ground + (h - ground) * i / 10
        d.line([(0, y), (w, y)], fill=(90, 130, 240, 18), width=SCALE)
    img.alpha_composite(layer)
    return _finish(img, size)


def ocean(size: tuple[int, int] = (1600, 1000), seed: int = 3) -> bytes:
    """Villa d'architecte face à l'océan au coucher du soleil."""
    rng = random.Random(seed)
    w, h = size[0] * SCALE, size[1] * SCALE
    horizon = h * 0.55
    img = _gradient(
        (w, h),
        [
            (0, (20, 24, 70)),
            (0.3, (118, 66, 120)),
            (0.5, (246, 142, 86)),
            (0.55, (255, 205, 140)),
            (0.551, (40, 58, 110)),
            (1, (8, 18, 44)),
        ],
    ).convert("RGBA")
    _glow(img, (w * 0.42, horizon - h * 0.18, w * 0.7, horizon + h * 0.1), (255, 190, 120), 200, 70 * SCALE)
    layer, d = _overlay(img)
    d.ellipse([w * 0.51, horizon - h * 0.08, w * 0.61, horizon + h * 0.08], fill=(255, 226, 170, 255))
    d.rectangle([0, horizon, w, h], fill=(26, 44, 92, 255))
    for i in range(70):
        y = horizon + (h - horizon) * (i / 70) ** 1.6
        spread = w * (0.03 + 0.25 * (i / 70))
        cx = w * 0.56 + rng.uniform(-w * 0.01, w * 0.01)
        d.line(
            [(cx - spread * rng.uniform(0.3, 1), y), (cx + spread * rng.uniform(0.3, 1), y)],
            fill=(255, 196, 130, rng.randint(60, 170)),
            width=max(1, int(SCALE * (1 + i / 30))),
        )
    img.alpha_composite(layer)
    layer, d = _overlay(img)
    cliff = [(0, h), (0, h * 0.58), (w * 0.16, h * 0.6), (w * 0.3, h * 0.66), (w * 0.4, h * 0.78), (w * 0.46, h)]
    d.polygon(cliff, fill=(14, 18, 32, 255))
    vx0, vy = w * 0.03, h * 0.6
    d.rectangle([vx0, vy - h * 0.13, vx0 + w * 0.3, vy], fill=(236, 232, 226, 255))
    d.rectangle([vx0 + w * 0.06, vy - h * 0.24, vx0 + w * 0.36, vy - h * 0.13], fill=(246, 244, 240, 255))
    d.rectangle([vx0 + w * 0.02, vy - h * 0.11, vx0 + w * 0.28, vy - h * 0.015], fill=(*WARM, 255))
    d.rectangle([vx0 + w * 0.08, vy - h * 0.22, vx0 + w * 0.34, vy - h * 0.145], fill=(255, 220, 160, 255))
    for i in range(6):
        gx = vx0 + w * 0.02 + i * w * 0.045
        d.line([(gx, vy - h * 0.11), (gx, vy - h * 0.015)], fill=(40, 40, 50, 180), width=SCALE)
    d.rectangle([vx0 - w * 0.01, vy, vx0 + w * 0.34, vy + h * 0.025], fill=(30, 160, 200, 255))
    img.alpha_composite(layer)
    _glow(img, (vx0, vy - h * 0.26, vx0 + w * 0.36, vy + h * 0.02), (255, 200, 140), 70, 40 * SCALE)
    layer, d = _overlay(img)
    _palm(d, w * 0.36, h * 0.66, h * 0.42, (10, 12, 22, 255))
    img.alpha_composite(layer)
    return _finish(img, size)


def globe(size: tuple[int, int] = (1600, 1000), seed: int = 4) -> bytes:
    """Diaspora : globe nocturne, liaisons depuis l'Europe et l'Amérique vers le chantier, tableau de bord mobile."""
    rng = random.Random(seed)
    w, h = size[0] * SCALE, size[1] * SCALE
    img = _gradient((w, h), [(0, (6, 12, 30)), (1, (16, 32, 76))]).convert("RGBA")
    layer, d = _overlay(img)
    _stars(d, rng, w, h, 220)
    img.alpha_composite(layer)
    cx, cy, r = w * 0.38, h * 0.56, h * 0.42
    _glow(img, (cx - r * 1.15, cy - r * 1.15, cx + r * 1.15, cy + r * 1.15), (70, 120, 255), 120, 50 * SCALE)
    layer, d = _overlay(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(18, 40, 96, 255))
    for k in range(1, 6):
        ry = r * k / 6
        d.ellipse([cx - r, cy - ry, cx + r, cy + ry], outline=(120, 160, 255, 70), width=SCALE)
        rx = r * k / 6
        d.ellipse([cx - rx, cy - r, cx + rx, cy + r], outline=(120, 160, 255, 70), width=SCALE)
    for _ in range(900):
        a, b = rng.uniform(0, 2 * math.pi), rng.uniform(-1, 1)
        x = cx + r * math.sqrt(1 - b * b) * math.cos(a) * 0.98
        y = cy + r * b * 0.98
        if math.cos(a) > -0.2:
            d.ellipse([x - SCALE, y - SCALE, x + SCALE, y + SCALE], fill=(160, 195, 255, 90))
    target = (cx + r * 0.12, cy + r * 0.18)
    for src in (
        (cx - r * 0.05, cy - r * 0.55),
        (cx - r * 0.72, cy - r * 0.45),
        (cx - r * 0.86, cy - r * 0.2),
        (cx + r * 0.5, cy - r * 0.62),
    ):
        mid = ((src[0] + target[0]) / 2, min(src[1], target[1]) - r * 0.45)
        pts = [
            (
                (1 - t) ** 2 * src[0] + 2 * (1 - t) * t * mid[0] + t * t * target[0],
                (1 - t) ** 2 * src[1] + 2 * (1 - t) * t * mid[1] + t * t * target[1],
            )
            for t in [i / 60 for i in range(61)]
        ]
        d.line(pts, fill=(251, 140, 67, 230), width=3 * SCALE)
        d.ellipse(
            [src[0] - 6 * SCALE, src[1] - 6 * SCALE, src[0] + 6 * SCALE, src[1] + 6 * SCALE], fill=(255, 255, 255, 255)
        )
    d.ellipse(
        [target[0] - 10 * SCALE, target[1] - 10 * SCALE, target[0] + 10 * SCALE, target[1] + 10 * SCALE],
        fill=(251, 140, 67, 255),
    )
    img.alpha_composite(layer)
    _glow(
        img,
        (target[0] - 40 * SCALE, target[1] - 40 * SCALE, target[0] + 40 * SCALE, target[1] + 40 * SCALE),
        (251, 140, 67),
        200,
        18 * SCALE,
    )
    layer, d = _overlay(img)
    px0, py0, pw, ph = w * 0.7, h * 0.14, w * 0.2, h * 0.74
    d.rounded_rectangle(
        [px0, py0, px0 + pw, py0 + ph],
        radius=40 * SCALE,
        fill=(12, 18, 36, 255),
        outline=(90, 110, 160, 255),
        width=3 * SCALE,
    )
    d.rounded_rectangle(
        [px0 + 14 * SCALE, py0 + 14 * SCALE, px0 + pw - 14 * SCALE, py0 + ph - 14 * SCALE],
        radius=30 * SCALE,
        fill=(244, 246, 250, 255),
    )
    d.rounded_rectangle(
        [px0 + 28 * SCALE, py0 + 40 * SCALE, px0 + pw - 28 * SCALE, py0 + ph * 0.36],
        radius=18 * SCALE,
        fill=(28, 46, 98, 255),
    )
    _windows(d, rng, px0 + 50 * SCALE, py0 + 70 * SCALE, px0 + pw - 50 * SCALE, py0 + ph * 0.34, 5, 4, 0.7)
    for i, value in enumerate((0.82, 0.64, 0.45)):
        y = py0 + ph * (0.43 + i * 0.13)
        d.rounded_rectangle(
            [px0 + 28 * SCALE, y, px0 + pw - 28 * SCALE, y + ph * 0.1],
            radius=14 * SCALE,
            fill=(255, 255, 255, 255),
            outline=(220, 226, 236, 255),
            width=SCALE,
        )
        d.rounded_rectangle(
            [px0 + 44 * SCALE, y + ph * 0.06, px0 + pw - 44 * SCALE, y + ph * 0.075],
            radius=6 * SCALE,
            fill=(226, 230, 238, 255),
        )
        d.rounded_rectangle(
            [px0 + 44 * SCALE, y + ph * 0.06, px0 + 44 * SCALE + (pw - 88 * SCALE) * value, y + ph * 0.075],
            radius=6 * SCALE,
            fill=(*(ORANGE if i == 0 else BRAND), 255),
        )
        d.rounded_rectangle(
            [px0 + 44 * SCALE, y + ph * 0.02, px0 + pw * 0.6, y + ph * 0.04], radius=5 * SCALE, fill=(30, 46, 87, 255)
        )
    img.alpha_composite(layer)
    return _finish(img, size)


def blueprint(size: tuple[int, int] = (1600, 1000), seed: int = 5, label: str = "R+3") -> bytes:
    """Plan d'ingénieur : ossature isométrique, cotes et repères."""
    rng = random.Random(seed)
    w, h = size[0] * SCALE, size[1] * SCALE
    papers: list[tuple[Color, Color]] = [
        ((12, 38, 88), (8, 24, 60)),
        ((8, 58, 72), (4, 34, 44)),
        ((26, 30, 46), (12, 14, 24)),
    ]
    top_color, bottom_color = papers[seed % 3]
    img = _gradient((w, h), [(0, top_color), (1, bottom_color)]).convert("RGBA")
    layer, d = _overlay(img)
    for x in range(0, w, 20 * SCALE):
        d.line(
            [(x, 0), (x, h)],
            fill=(140, 180, 255, 40 if x % (100 * SCALE) else 80),
            width=1 if x % (100 * SCALE) else SCALE,
        )
    for y in range(0, h, 20 * SCALE):
        d.line(
            [(0, y), (w, y)],
            fill=(140, 180, 255, 40 if y % (100 * SCALE) else 80),
            width=1 if y % (100 * SCALE) else SCALE,
        )
    img.alpha_composite(layer)
    layer, d = _overlay(img)
    ox, oy = w * 0.42, h * 0.88
    ux, uy, vx, vy = w * 0.07, h * 0.04, -w * 0.05, h * 0.035
    levels, bays_u, bays_v = 3 + seed % 3, 3 + seed % 2, 3
    lvl = h * 0.12

    def p(i: float, j: float, k: float) -> tuple[float, float]:
        return (ox + i * ux + j * vx, oy - i * uy - j * vy - k * lvl)

    white = (235, 242, 255, 230)
    for k in range(levels + 1):
        for i in range(bays_u + 1):
            d.line([p(i, 0, k), p(i, bays_v, k)], fill=white, width=2 * SCALE)
        for j in range(bays_v + 1):
            d.line([p(0, j, k), p(bays_u, j, k)], fill=white, width=2 * SCALE)
    for i in range(bays_u + 1):
        for j in range(bays_v + 1):
            d.line(
                [p(i, j, 0), p(i, j, levels)],
                fill=(251, 140, 67, 255) if (i in (0, bays_u) and j in (0, bays_v)) else white,
                width=3 * SCALE if (i in (0, bays_u) and j in (0, bays_v)) else 2 * SCALE,
            )
    for k in range(levels):
        d.line([p(0, 0, k), p(1, 0, k + 1)], fill=(251, 140, 67, 200), width=2 * SCALE)
        d.line([p(bays_u, bays_v, k), p(bays_u - 1, bays_v, k + 1)], fill=(251, 140, 67, 200), width=2 * SCALE)
    a, b = p(0, 0, 0), p(bays_u, 0, 0)
    off = 40 * SCALE
    d.line([(a[0], a[1] + off), (b[0], b[1] + off)], fill=(190, 215, 255, 255), width=SCALE)
    for q in (a, b):
        d.line(
            [(q[0], q[1] + off - 12 * SCALE), (q[0], q[1] + off + 12 * SCALE)], fill=(190, 215, 255, 255), width=SCALE
        )
    font = _font(26 * SCALE)
    small = _font(18 * SCALE, "Gilroy-SemiBold.woff2")
    d.text(
        ((a[0] + b[0]) / 2 - 40 * SCALE, (a[1] + b[1]) / 2 + off + 8 * SCALE),
        "14,00 m",
        font=small,
        fill=(220, 232, 255, 255),
    )
    top = p(bays_u, 0, levels)
    d.line([(top[0] + 60 * SCALE, top[1]), (top[0] + 60 * SCALE, b[1])], fill=(190, 215, 255, 255), width=SCALE)
    d.text((top[0] + 72 * SCALE, (top[1] + b[1]) / 2), f"{levels * 3},20 m", font=small, fill=(220, 232, 255, 255))
    cx, cy, cr = w * 0.84, h * 0.2, h * 0.09
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], outline=(220, 232, 255, 255), width=2 * SCALE)
    d.line([(cx - cr, cy), (cx + cr, cy)], fill=(220, 232, 255, 255), width=SCALE)
    d.text((cx - 30 * SCALE, cy - 52 * SCALE), label, font=font, fill=(255, 255, 255, 255))
    d.text((cx - 22 * SCALE, cy + 10 * SCALE), "A-A", font=small, fill=(251, 140, 67, 255))
    for _ in range(3):
        x = rng.uniform(w * 0.06, w * 0.22)
        y = rng.uniform(h * 0.3, h * 0.7)
        d.rectangle([x, y, x + 90 * SCALE, y + 3 * SCALE], fill=(140, 180, 255, 120))
        d.rectangle([x, y + 12 * SCALE, x + 60 * SCALE, y + 15 * SCALE], fill=(140, 180, 255, 80))
    d.text((w * 0.05, h * 0.06), "GLOBUS ENGINEERING · ÉTUDE STRUCTURE", font=small, fill=(220, 232, 255, 200))
    img.alpha_composite(layer)
    return _finish(img, size)


def site(size: tuple[int, int] = (1600, 1000), seed: int = 6) -> bytes:
    """Chantier en cours au lever du jour : ossature béton, échafaudages, grue."""
    rng = random.Random(seed)
    w, h = size[0] * SCALE, size[1] * SCALE
    ground = h * 0.8
    img = _gradient(
        (w, h),
        [(0, (32, 52, 110)), (0.45, (122, 150, 210)), (0.78, (253, 196, 140)), (0.8, (70, 58, 54)), (1, (40, 34, 36))],
    ).convert("RGBA")
    _glow(img, (w * 0.05, ground - h * 0.25, w * 0.4, ground + h * 0.1), (255, 200, 140), 160, 70 * SCALE)
    layer, d = _overlay(img)
    bx0, bx1, floors = w * 0.3, w * 0.72, 5
    fh = h * 0.11
    for f in range(floors + 1):
        y = ground - f * fh
        d.rectangle([bx0 - w * 0.01, y - h * 0.012, bx1 + w * 0.01, y], fill=(150, 150, 160, 255))
        if f < floors:
            for c in range(7):
                cx = bx0 + (bx1 - bx0) * c / 6
                d.rectangle([cx - w * 0.006, y - fh, cx + w * 0.006, y - h * 0.012], fill=(170, 170, 178, 255))
    for f in range(2):
        y = ground - f * fh
        d.rectangle([bx0, y - fh + h * 0.012, bx1, y - h * 0.012], fill=(120, 112, 112, 255))
        _windows(d, rng, bx0 + w * 0.01, y - fh + h * 0.02, bx1 - w * 0.01, y - h * 0.02, 6, 1, 0.0)
    for k in range(18):
        x = bx1 + w * 0.02 + (k % 3) * w * 0.012
        d.line([(x, ground), (x, ground - (floors - 1) * fh)], fill=(251, 160, 80, 255), width=SCALE * 2)
    for f in range(1, floors):
        d.line(
            [(bx1 + w * 0.015, ground - f * fh), (bx1 + w * 0.05, ground - f * fh)],
            fill=(251, 160, 80, 255),
            width=SCALE * 2,
        )
    img.alpha_composite(layer)
    layer, d = _overlay(img)
    _crane(d, w * 0.2, ground, h * 0.12, w * 0.12, w * 0.62, (30, 34, 52, 255), 3 * SCALE)
    load_y = ground - (floors + 0.45) * fh
    d.line([(w * 0.5, h * 0.135), (w * 0.5, load_y)], fill=(30, 34, 52, 255), width=2 * SCALE)
    d.rectangle([w * 0.45, load_y, w * 0.55, load_y + h * 0.014], fill=(251, 140, 67, 255))
    d.rectangle([0, ground, w, h], fill=(58, 48, 46, 255))
    for _ in range(40):
        x, y = rng.uniform(0, w), rng.uniform(ground, h)
        d.ellipse([x, y, x + rng.uniform(10, 40) * SCALE, y + rng.uniform(3, 8) * SCALE], fill=(80, 68, 62, 255))
    img.alpha_composite(layer)
    return _finish(img, size)


SCENES = {"villa": villa, "tower": tower, "ocean": ocean, "globe": globe, "blueprint": blueprint, "site": site}
UNIVERSE_SCENES = {
    "HOME": "villa",
    "BUSINESS": "tower",
    "PREMIUM": "ocean",
    "DIASPORA": "globe",
    "ENGINEERING": "blueprint",
}


def render(scene: str, seed: int = 1, size: tuple[int, int] = (1600, 1000)) -> bytes:
    return SCENES.get(scene, site)(size=size, seed=seed)


__all__ = ["SCENES", "UNIVERSE_SCENES", "render"]
