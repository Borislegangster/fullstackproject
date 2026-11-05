"""PDF service — HTML → PDF via xhtml2pdf (pure Python, cross-platform).

Renders Jinja2 templates from `app/templates/` and returns the PDF as bytes.
xhtml2pdf is chosen over WeasyPrint to avoid the GTK/Cairo system dependency
on Windows.
"""
from __future__ import annotations

import io
import os
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")

_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)


def _format_currency(value: Any) -> str:
    try:
        return f"{float(value or 0):,.0f}".replace(",", " ") + " FCFA"
    except (TypeError, ValueError):
        return f"{value} FCFA"


def _format_date(value: Any) -> str:
    if not value:
        return ""
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    return str(value)[:10]


_env.filters["currency"] = _format_currency
_env.filters["date_fr"] = _format_date


def render_template(template_name: str, context: dict) -> str:
    """Render a Jinja2 HTML template into a string."""
    return _env.get_template(template_name).render(**context)


def html_to_pdf(html: str) -> bytes:
    """Convert HTML to a PDF byte string. Raises RuntimeError if rendering fails."""
    from xhtml2pdf import pisa
    buffer = io.BytesIO()
    result = pisa.CreatePDF(html, dest=buffer, encoding="utf-8")
    if result.err:
        raise RuntimeError(f"PDF rendering failed: {result.err}")
    return buffer.getvalue()


def render_pdf(template_name: str, context: dict) -> bytes:
    """One-shot: render a Jinja2 template into a finished PDF."""
    html = render_template(template_name, context)
    return html_to_pdf(html)
