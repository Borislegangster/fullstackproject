"""Génération PDF (reportlab) : en-tête de marque, tableaux de lignes, totaux, QR d'authenticité,
filigrane dynamique (§12.2), pages numérotées. Polices de la charte (§3) : Gilroy (titres) et Poppins (corps)."""

from __future__ import annotations

import io
import logging
import threading
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import qrcode
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings

log = logging.getLogger("globus.pdf")

PRIMARY = colors.HexColor("#385AA6")
ACCENT = colors.HexColor("#FB8C43")
LIGHT = colors.HexColor("#F4F4F4")

FONT_DIR = Path(__file__).resolve().parents[1] / "assets" / "fonts"
_BRAND_FILES = {
    "Gilroy-Bold": "Gilroy-Bold.woff2",
    "Gilroy-SemiBold": "Gilroy-SemiBold.woff2",
    "Poppins": "Poppins-Regular.woff2",
    "Poppins-SemiBold": "Poppins-SemiBold.woff2",
}
_SUBSTITUTES = {
    "\u2192": "->",
    "\u2190": "<-",
    "\u2713": "v",
    "\u2265": ">=",
    "\u2264": "<=",
    "\u00b2": "2",
    "\u00b3": "3",
}


@dataclass(frozen=True)
class Fonts:
    body: str
    body_bold: str
    title: str
    subtitle: str
    glyphs: dict[str, frozenset[int]]  # police → points de code disponibles (vide = police standard)

    def safe(self, text: Any, font: str | None = None) -> str:
        """Remplace les caractères absents de la police (sinon carré vide dans le PDF) par un équivalent lisible."""
        value = str(text)
        cmap = self.glyphs.get(font or self.body)
        if not cmap:
            return value
        out = []
        for ch in value:
            if ord(ch) in cmap or ch in "\n\t":
                out.append(ch)
                continue
            plain = "".join(c for c in unicodedata.normalize("NFKD", ch) if ord(c) in cmap)
            out.append(plain or _SUBSTITUTES.get(ch, "?"))
        return "".join(out)


_fonts: Fonts | None = None
_fonts_lock = threading.Lock()


def brand_fonts() -> Fonts:
    """Enregistre une seule fois les polices de la charte (WOFF2 → TrueType en mémoire) ; repli Helvetica."""
    global _fonts
    if _fonts is not None:
        return _fonts
    with _fonts_lock:
        if _fonts is not None:
            return _fonts
        try:
            from fontTools.ttLib import TTFont as FontFile
            from reportlab.lib.fonts import addMapping
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont

            glyphs: dict[str, frozenset[int]] = {}
            for name, filename in _BRAND_FILES.items():
                font = FontFile(str(FONT_DIR / filename))
                glyphs[name] = frozenset(font.getBestCmap())
                font.flavor = None
                buffer = io.BytesIO()
                font.save(buffer)
                buffer.seek(0)
                pdfmetrics.registerFont(TTFont(name, buffer))
            for bold, italic in ((0, 0), (1, 0), (0, 1), (1, 1)):
                addMapping("Poppins", bold, italic, "Poppins-SemiBold" if bold else "Poppins")
            _fonts = Fonts("Poppins", "Poppins-SemiBold", "Gilroy-Bold", "Gilroy-SemiBold", glyphs)
        except Exception:  # police indisponible : document généré avec les polices standard
            log.warning("pdf_brand_fonts_unavailable", exc_info=True)
            _fonts = Fonts("Helvetica", "Helvetica-Bold", "Helvetica-Bold", "Helvetica-Bold", {})
        return _fonts


def fmt_money(value: Any, currency: str = "XAF") -> str:
    amount = Decimal(str(value or 0))
    if currency in ("XAF", "XOF"):
        return f"{amount:,.0f}".replace(",", " ") + " FCFA"
    return f"{amount:,.2f}".replace(",", " ") + f" {currency}"


def fmt_qty(value: Any) -> str:
    q = Decimal(str(value or 0)).normalize()
    return f"{q:f}".replace(".", ",")


def fmt_date(value: date | datetime | None) -> str:
    return value.strftime("%d/%m/%Y") if value else "—"


@dataclass
class PdfDocument:
    title: str
    number: str
    issued_on: date | None = None
    parties: list[tuple[str, list[str]]] = field(default_factory=list)  # (titre, lignes)
    meta: list[tuple[str, str]] = field(default_factory=list)
    columns: list[str] = field(default_factory=list)
    rows: list[list[str]] = field(default_factory=list)
    col_widths: list[float] | None = None
    totals: list[tuple[str, str]] = field(default_factory=list)
    paragraphs: list[tuple[str, str]] = field(default_factory=list)  # (titre, texte)
    signature_blocks: list[str] = field(default_factory=list)
    verify_token: str | None = None
    footer_note: str | None = None


def _qr_image(data: str) -> ImageReader:
    img = qrcode.make(data, box_size=4, border=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def render(doc: PdfDocument) -> bytes:
    buffer = io.BytesIO()
    fonts = brand_fonts()
    t = fonts.safe  # texte → glyphes disponibles dans la police du corps
    styles = getSampleStyleSheet()
    base = ParagraphStyle("base", parent=styles["Normal"], fontName=fonts.body, fontSize=9, leading=12)
    small = ParagraphStyle("small", parent=base, fontSize=8, textColor=colors.HexColor("#4B5563"))
    h1 = ParagraphStyle("h1", parent=base, fontName=fonts.title, fontSize=16, textColor=PRIMARY, leading=20)
    h2 = ParagraphStyle("h2", parent=base, fontName=fonts.subtitle, fontSize=10, textColor=PRIMARY, spaceBefore=6)
    right = ParagraphStyle("right", parent=base, alignment=TA_RIGHT)
    head = ParagraphStyle("head", parent=small, textColor=colors.white)  # en-tête de tableau sur fond primaire
    verify_url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/verification/{doc.verify_token}" if doc.verify_token else None

    def on_page(canvas: rl_canvas.Canvas, document: Any) -> None:
        canvas.saveState()
        width, height = A4
        canvas.setFillColor(PRIMARY)
        canvas.rect(0, height - 22 * mm, width, 22 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont(fonts.title, 14)
        canvas.drawString(15 * mm, height - 12 * mm, "GLOBUS ENGINEERING")
        canvas.setFont(fonts.body, 8)
        canvas.drawString(15 * mm, height - 17 * mm, "Concevoir. Calculer. Construire. Contrôler.")
        canvas.setFillColor(ACCENT)
        canvas.rect(0, height - 23 * mm, width, 1 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#6B7280"))
        canvas.setFont(fonts.body, 7)
        footer = doc.footer_note or "Document généré par la plateforme GLOBUS ENGINEERING."
        canvas.drawString(15 * mm, 10 * mm, t(footer[:150]))
        canvas.drawRightString(width - 15 * mm, 10 * mm, t(f"{doc.number} — page {document.page}"))
        if verify_url:
            canvas.drawImage(_qr_image(verify_url), width - 33 * mm, 14 * mm, 18 * mm, 18 * mm)
            canvas.drawRightString(width - 35 * mm, 20 * mm, "Authenticité : scannez le QR")
        canvas.restoreState()

    story: list[Any] = [
        Spacer(1, 6 * mm),
        Paragraph(t(doc.title, fonts.title), h1),
        Paragraph(t(f"N° <b>{doc.number}</b> — émis le {fmt_date(doc.issued_on or date.today())}"), base),
        Spacer(1, 4 * mm),
    ]
    if doc.parties:
        cells = []
        for title, lines in doc.parties:
            heading = Paragraph(f"<b>{t(title, fonts.subtitle)}</b>", h2)
            cells.append([heading] + [Paragraph(t(line), base) for line in lines if line])
        table = Table([[c for c in cells]], colWidths=[180 * mm / len(cells)] * len(cells))
        table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                    ("BOX", (0, 0), (-1, -1), 0.25, colors.HexColor("#D1D5DB")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story += [table, Spacer(1, 4 * mm)]
    if doc.meta:
        meta = Table(
            [[Paragraph(f"<b>{t(k)}</b>", small), Paragraph(t(v or "—"), base)] for k, v in doc.meta],
            colWidths=[45 * mm, 135 * mm],
        )
        meta.setStyle(TableStyle([("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
        story += [meta, Spacer(1, 4 * mm)]
    if doc.columns:
        data = [[Paragraph(f"<b>{t(c)}</b>", head) for c in doc.columns]]
        for row in doc.rows:
            data.append(
                [
                    Paragraph(t(v), base) if i == 0 else Paragraph(t(v), right if i > 1 else base)
                    for i, v in enumerate(row)
                ]
            )
        table = Table(data, colWidths=doc.col_widths, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E5E7EB")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story += [table, Spacer(1, 3 * mm)]
    if doc.totals:
        totals = Table(
            [[Paragraph(t(k), right), Paragraph(f"<b>{t(v)}</b>", right)] for k, v in doc.totals],
            colWidths=[140 * mm, 40 * mm],
        )
        totals.setStyle(TableStyle([("LINEABOVE", (0, -1), (-1, -1), 1, ACCENT)]))
        story += [totals, Spacer(1, 4 * mm)]
    for title, text in doc.paragraphs:
        story.append(Paragraph(t(title, fonts.subtitle), h2))
        for chunk in (text or "").split("\n"):
            story.append(Paragraph(t(chunk.replace("&", "&amp;").replace("<", "&lt;")), base))
    if doc.signature_blocks:
        sig = Table(
            [[Paragraph(f"<b>{t(s)}</b><br/><br/><br/>Date et signature", small) for s in doc.signature_blocks]],
            colWidths=[180 * mm / len(doc.signature_blocks)] * len(doc.signature_blocks),
            rowHeights=[28 * mm],
        )
        sig.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.25, colors.HexColor("#9CA3AF")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9CA3AF")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story += [Spacer(1, 6 * mm), sig]
    template = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=28 * mm,
        bottomMargin=36 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        title=f"{doc.title} {doc.number}",
        author="GLOBUS ENGINEERING",
    )
    template.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()


def watermark(pdf_bytes: bytes, text: str) -> bytes:
    """Filigrane dynamique diagonal (identité du lecteur + date) sur chaque page."""
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    cache: dict[tuple[float, float], Any] = {}
    for page in reader.pages:
        w, h = float(page.mediabox.width), float(page.mediabox.height)
        if (w, h) not in cache:
            buf = io.BytesIO()
            c = rl_canvas.Canvas(buf, pagesize=(w, h))
            c.saveState()
            fonts = brand_fonts()
            c.setFillColor(colors.Color(0.22, 0.35, 0.65, alpha=0.12))
            c.setFont(fonts.title, max(14, min(w, h) / 22))
            c.translate(w / 2, h / 2)
            c.rotate(35)
            for offset in (-h / 3, 0, h / 3):
                c.drawCentredString(0, offset, fonts.safe(text[:90], fonts.title))
            c.restoreState()
            c.save()
            buf.seek(0)
            cache[(w, h)] = PdfReader(buf).pages[0]
        page.merge_page(cache[(w, h)])
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def extract_text(pdf_bytes: bytes, max_chars: int = 500_000) -> tuple[str, int]:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        parts: list[str] = []
        total = 0
        for page in reader.pages:
            text = page.extract_text() or ""
            parts.append(text)
            total += len(text)
            if total > max_chars:
                break
        return "\n".join(parts)[:max_chars], len(reader.pages)
    except Exception:  # noqa: BLE001
        return "", 0


def image_to_pdf(data: bytes) -> bytes:
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    img = ImageReader(io.BytesIO(data))
    iw, ih = img.getSize()
    w, h = A4
    scale = min((w - 20 * mm) / iw, (h - 20 * mm) / ih)
    c.drawImage(img, (w - iw * scale) / 2, (h - ih * scale) / 2, iw * scale, ih * scale)
    c.save()
    return buf.getvalue()


_ = Image
