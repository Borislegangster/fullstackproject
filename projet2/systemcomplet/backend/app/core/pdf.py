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


BRAND_DIR = Path(__file__).resolve().parents[1] / "assets" / "brand"
LOGO_FILE = BRAND_DIR / "logo-globus-engineering.png"
_brand_cache: dict[str, Any] = {}
_brand_lock = threading.Lock()


def brand_logo(faded: bool = False) -> ImageReader | None:
    """Logo officiel (en-tête) ; version estompée pour le grand filigrane centré de chaque page."""
    key = "faded" if faded else "logo"
    if key in _brand_cache:
        return _brand_cache[key]
    with _brand_lock:
        if key not in _brand_cache:
            try:
                from PIL import Image as PILImage

                image = PILImage.open(LOGO_FILE).convert("RGBA")
                if faded:
                    alpha = image.getchannel("A").point(lambda a: int(a * 0.09))
                    image.putalpha(alpha)
                buf = io.BytesIO()
                image.save(buf, format="PNG")
                buf.seek(0)
                _brand_cache[key] = ImageReader(buf)
            except Exception:  # logo absent : en-tête textuel
                log.warning("pdf_logo_unavailable", exc_info=True)
                _brand_cache[key] = None
    return _brand_cache[key]


@dataclass(frozen=True)
class Company:
    name: str = "GLOBUS ENGINEERING SARL"
    slogan: str = "Ensemble vers la perfection !"
    address: str = ""
    city: str = "Douala"
    country: str = "Cameroun"
    phone: str = ""
    whatsapp: str = ""
    email: str = ""
    website: str = ""
    legal: tuple[str, ...] = ()  # « RCCM : … », « NIU : … », « Capital : … »


def company_identity() -> Company:
    """Identité de l'entreprise pour les en-têtes et pieds de page : paramètres du site (Site web › Contenus), relus
    au plus toutes les 5 minutes ; valeurs par défaut si la base est indisponible."""
    import time

    cached = _brand_cache.get("company")
    if cached and time.monotonic() - cached[0] < 300:
        return cached[1]
    company = Company(website=settings.PUBLIC_BASE_URL.replace("https://", "").replace("http://", "").rstrip("/"))
    try:
        from sqlalchemy import select

        from app.core.database import SessionLocal
        from app.modules.cms.models import SiteSettings

        with SessionLocal() as db:
            row = db.execute(select(SiteSettings).limit(1)).scalar_one_or_none()
            if row is not None:
                info = row.legal_info or {}
                labels = (("legal_form", "Forme"), ("capital", "Capital"), ("rccm", "RCCM"), ("niu", "NIU"))
                legal = tuple(f"{label} : {info[key]}" for key, label in labels if info.get(key))
                name = row.company_name or company.name
                company = Company(
                    name=name if "SARL" in name.upper() or info.get("legal_form") else f"{name} SARL",
                    slogan=row.slogan or company.slogan,
                    address=" ".join((row.address or "").split()),
                    city=row.city or company.city,
                    country=row.country or company.country,
                    phone=row.phone or "",
                    whatsapp=row.whatsapp or "",
                    email=row.email or "",
                    website=company.website,
                    legal=legal,
                )
    except Exception:  # base indisponible (scripts, tests isolés) : identité par défaut
        log.debug("pdf_company_identity_default", exc_info=True)
    _brand_cache["company"] = (time.monotonic(), company)
    return company


def company_party(title: str = "Émetteur") -> tuple[str, list[str]]:
    """Bloc « Émetteur » complet des documents : raison sociale, adresse, contacts, immatriculations."""
    c = company_identity()
    return (
        title,
        [
            f"<b>{c.name}</b>",
            "Bureau d'études et entreprise générale de construction",
            ", ".join(v for v in (c.address, c.city, c.country) if v),
            " · ".join(v for v in (f"Tél. {c.phone}" if c.phone else "", c.email) if v),
            *c.legal,
        ],
    )


def organization_lines(
    org: Any, *, person: str | None = None, email: str | None = None, phone: str | None = None
) -> list[str]:
    """Coordonnées d'un client, fournisseur ou sous-traitant (organisation et/ou personne) pour un bloc de document."""
    if org is None:
        return [v for v in (f"<b>{person}</b>" if person else "", email or "", phone or "") if v]

    def attr(name: str) -> str:
        return " ".join(str(getattr(org, name, None) or "").split())

    location = ", ".join(v for v in (attr("address"), attr("city"), attr("country")) if v)
    tel = phone or attr("phone")
    return [
        v
        for v in (
            f"<b>{attr('legal_name') or attr('name')}</b>",
            f"À l'attention de {person}" if person else "",
            location,
            " · ".join(x for x in (f"Tél. {tel}" if tel else "", email or attr("email")) if x),
            f"NIU : {attr('tax_id')}" if attr("tax_id") else "",
            f"RCCM : {attr('trade_register')}" if attr("trade_register") else "",
        )
        if v
    ]


def project_label(project: Any) -> str:
    """« CODE — Nom (ville) » d'un projet pour les rubriques des documents."""
    if project is None:
        return "—"
    city = getattr(project, "city", None)
    return f"{project.code} — {project.name}" + (f" ({city})" if city else "")


_UNITS = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize",
]  # fmt: skip
_TENS = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}


def _below_100(n: int, final: bool = True) -> str:
    if n <= 16:
        return _UNITS[n]
    if n < 20:
        return f"dix-{_UNITS[n - 10]}"
    if n < 70:
        tens, unit = divmod(n, 10)
        if unit == 0:
            return _TENS[tens]
        return f"{_TENS[tens]} et un" if unit == 1 else f"{_TENS[tens]}-{_UNITS[unit]}"
    if n < 80:
        return "soixante et onze" if n == 71 else f"soixante-{_below_100(n - 60)}"
    if n == 80:
        return "quatre-vingts" if final else "quatre-vingt"
    return f"quatre-vingt-{_below_100(n - 80)}"


def _below_1000(n: int, final: bool = True) -> str:
    """`final` : le nombre termine l'expression (« deux cents ») ; sinon accord suspendu (« deux cent mille »)."""
    hundreds, rest = divmod(n, 100)
    parts = []
    if hundreds == 1:
        parts.append("cent")
    elif hundreds:
        parts.append(f"{_UNITS[hundreds]} cent" + ("s" if rest == 0 and final else ""))
    if rest:
        parts.append(_below_100(rest, final))
    return " ".join(parts)


def number_in_words(n: int) -> str:
    """Nombre entier en toutes lettres (orthographe traditionnelle), jusqu'aux milliers de milliards."""
    if n == 0:
        return "zéro"
    out: list[str] = []
    for scale, word in ((10**9, "milliard"), (10**6, "million")):
        count, n = divmod(n, scale)
        if count:
            out.append(f"{number_in_words(count)} {word}{'s' if count > 1 else ''}")
    thousands, n = divmod(n, 1000)
    if thousands:
        out.append("mille" if thousands == 1 else f"{_below_1000(thousands, final=False)} mille")
    if n:
        out.append(_below_1000(n))
    return " ".join(out)


def amount_in_words(value: Any, currency: str = "XAF") -> str:
    """Montant en toutes lettres (« Deux millions cinq cent mille francs CFA ») pour l'arrêté des documents."""
    amount = Decimal(str(value or 0)).quantize(Decimal("1") if currency in ("XAF", "XOF") else Decimal("0.01"))
    whole = int(amount)  # FCFA sans décimales : même arrondi que l'affichage du montant
    cents = int((amount - whole) * 100)
    words = number_in_words(whole)
    if currency in ("XAF", "XOF"):
        unit = "franc CFA" if whole <= 1 else "francs CFA"
        of = "de " if words.endswith(("million", "millions", "milliard", "milliards")) else ""
        text = f"{words} {of}{unit}"
    else:
        text = f"{words} {currency}"
        if cents:
            text += f" et {number_in_words(cents)} centime{'s' if cents > 1 else ''}"
    return text[:1].upper() + text[1:]


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
    amount_words: str | None = None  # montant en toutes lettres (arrêté du document)
    amount_words_label: str = "Arrêté le présent document à la somme de"
    stamp: str | None = None  # tampon diagonal sur chaque page : PROFORMA, BROUILLON, ANNULÉ…


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

    company = company_identity()
    logo = brand_logo()
    faded = brand_logo(faded=True)

    def on_page(canvas: rl_canvas.Canvas, document: Any) -> None:
        """Fond de page : grand logo estompé centré, en-tête (logo + identité), pied de page légal."""
        canvas.saveState()
        width, height = A4
        # En-tête : logo à gauche, identité de l'entreprise à droite, double filet aux couleurs de la charte
        if logo is not None:
            iw, ih = logo.getSize()
            lh = 21 * mm
            canvas.drawImage(logo, 14 * mm, height - 28 * mm, lh * iw / ih, lh, mask="auto")
        else:
            canvas.setFillColor(PRIMARY)
            canvas.setFont(fonts.title, 15)
            canvas.drawString(15 * mm, height - 17 * mm, t(company.name, fonts.title))
        x = width - 15 * mm
        canvas.setFillColor(PRIMARY)
        canvas.setFont(fonts.title, 11)
        canvas.drawRightString(x, height - 11 * mm, t(company.name, fonts.title))
        canvas.setFillColor(ACCENT)
        canvas.setFont(fonts.body, 7.5)
        canvas.drawRightString(x, height - 15 * mm, t(company.slogan))
        canvas.setFillColor(colors.HexColor("#374151"))
        canvas.setFont(fonts.body, 7)
        lines = [
            ", ".join(v for v in (company.address, company.city, company.country) if v),
            " · ".join(
                v
                for v in (
                    f"Tél. {company.phone}" if company.phone else "",
                    f"WhatsApp {company.whatsapp}" if company.whatsapp and company.whatsapp != company.phone else "",
                    company.email,
                )
                if v
            ),
            company.website,
        ]
        y = height - 19 * mm
        for line in [ln for ln in lines if ln][:3]:
            canvas.drawRightString(x, y, t(line[:120]))
            y -= 3.4 * mm
        canvas.setFillColor(PRIMARY)
        canvas.rect(0, height - 32 * mm, width, 1.1 * mm, fill=1, stroke=0)
        canvas.setFillColor(ACCENT)
        canvas.rect(0, height - 33 * mm, width, 0.6 * mm, fill=1, stroke=0)
        # Pied de page : note du document, mentions légales, QR d'authenticité
        canvas.setStrokeColor(colors.HexColor("#D1D5DB"))
        canvas.setLineWidth(0.4)
        canvas.line(15 * mm, 16 * mm, width - 15 * mm, 16 * mm)
        canvas.setFillColor(colors.HexColor("#6B7280"))
        canvas.setFont(fonts.body, 6.8)
        footer = doc.footer_note or "Document généré par la plateforme GLOBUS ENGINEERING."
        canvas.drawString(15 * mm, 12 * mm, t(footer[:160]))
        legal = " · ".join([company.name, *company.legal])
        canvas.drawString(15 * mm, 8.5 * mm, t(legal[:170]))
        if verify_url:
            canvas.drawImage(_qr_image(verify_url), width - 33 * mm, 18 * mm, 18 * mm, 18 * mm)
            canvas.drawRightString(width - 35 * mm, 24 * mm, "Authenticité : scannez le QR")
        canvas.restoreState()

    number = doc.number
    stamp = doc.stamp

    class _NumberedCanvas(rl_canvas.Canvas):
        """Deux passes : « page x / y » sur chaque page une fois le nombre total connu."""

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, **kwargs)
            self._pages: list[dict[str, Any]] = []

        def showPage(self) -> None:  # noqa: N802 (API reportlab)
            self._pages.append(dict(self.__dict__))
            self._startPage()

        def save(self) -> None:
            total = len(self._pages)
            for state in self._pages:
                self.__dict__.update(state)
                if faded is not None:  # filigrane : grand logo estompé au centre, par-dessus le contenu
                    wm_w = 150 * mm
                    iw, ih = faded.getSize()
                    wm_h = wm_w * ih / iw
                    self.drawImage(faded, (A4[0] - wm_w) / 2, (A4[1] - wm_h) / 2, wm_w, wm_h, mask="auto")
                if stamp:  # nature provisoire ou annulée du document, impossible à confondre avec l'original
                    self.saveState()
                    self.setFillColor(colors.HexColor("#DC2626"))
                    self.setFillAlpha(0.14)
                    self.setFont(fonts.title, 58 if len(stamp) <= 12 else 40)
                    self.translate(A4[0] / 2, A4[1] / 2)
                    self.rotate(35)
                    self.drawCentredString(0, -20, t(stamp, fonts.title))
                    self.restoreState()
                self.setFillColor(colors.HexColor("#6B7280"))
                self.setFont(fonts.body, 7)
                self.drawRightString(A4[0] - 15 * mm, 10 * mm, t(f"{number} — page {self._pageNumber} / {total}"))
                super().showPage()
            super().save()

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
        widths = doc.col_widths
        if widths is None and len(doc.columns) >= 3:  # désignation lisible : première colonne plus large
            first = 180 * mm * 0.36
            widths = [first] + [(180 * mm - first) / (len(doc.columns) - 1)] * (len(doc.columns) - 1)
        table = Table(data, colWidths=widths, repeatRows=1)
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
    if doc.amount_words:
        story += [Paragraph(t(f"{doc.amount_words_label} : <b>{doc.amount_words}</b>."), base), Spacer(1, 4 * mm)]
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
        topMargin=38 * mm,
        bottomMargin=40 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        title=f"{doc.title} {doc.number}",
        author="GLOBUS ENGINEERING",
    )
    template.build(story, onFirstPage=on_page, onLaterPages=on_page, canvasmaker=_NumberedCanvas)
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
            faded = brand_logo(faded=True)
            if faded is not None:  # logo de l'entreprise estompé au centre de chaque page diffusée
                iw, ih = faded.getSize()
                lw = min(w, h) * 0.7
                c.drawImage(faded, (w - lw) / 2, (h - lw * ih / iw) / 2, lw, lw * ih / iw, mask="auto")
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
