"""docs/RECETTE.md -> HTML imprimable (A4) -> docs/RECETTE.pdf, via Chrome (ou Edge / Chromium) sans interface.

Usage (depuis systemcomplet/) : backend/.venv/Scripts/python scripts/recette_pdf.py
Dépendance : markdown-it-py (déjà présent dans l'environnement du backend)."""

import html
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

from markdown_it import MarkdownIt

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "RECETTE.md"
OUT_HTML = pathlib.Path(tempfile.gettempdir()) / "recette-globus.html"
OUT_PDF = ROOT / "docs" / "RECETTE.pdf"
CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    shutil.which("google-chrome") or "",
    shutil.which("chromium") or "",
]
CHROME = next((c for c in CANDIDATES if c and pathlib.Path(c).exists()), None)
if CHROME is None:
    sys.exit("Chrome, Edge ou Chromium introuvable")

text = SRC.read_text(encoding="utf-8")
SCENES = len(re.findall(r"^- \[ \] \*\*[A-Z]+\d+\*\*", text, re.M))
# Cases à cocher : « - [ ] » et « [ ] » des tableaux deviennent des cases imprimées.
text = text.replace("- [ ] ", "- ☐ ").replace("| [ ] |", "| ☐ |")

md = MarkdownIt("commonmark", {"html": False, "typographer": False}).enable("table")
tokens = md.parse(text)

# Ancres des titres (sommaire cliquable dans le PDF).
toc, used = [], set()


def slug(s: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "section"
    out, n = base, 2
    while out in used:
        out, n = f"{base}-{n}", n + 1
    used.add(out)
    return out


for i, tok in enumerate(tokens):
    if tok.type == "heading_open" and tok.tag in ("h1", "h2"):
        title = tokens[i + 1].content
        anchor = slug(title)
        tok.attrSet("id", anchor)
        cls = "livre" if tok.tag == "h1" else ("chapitre" if title.startswith(("Chapitre", "Annexe")) else "")
        if cls:
            tok.attrSet("class", cls)
        if tok.tag == "h1" or title.startswith(("Chapitre", "Annexe")) or not any(t[0] == "h1" and t[1] != "La Villa Mballa" for t in toc):
            if title not in ("Le manuel de recette de la plateforme GLOBUS ENGINEERING", "Sommaire"):
                toc.append((tok.tag if tok.tag == "h1" else "h2", title, anchor))
    if tok.type == "heading_open" and tok.tag == "h3" and tokens[i + 1].content.startswith("Scène"):
        tok.attrSet("class", "scene")

body = md.renderer.render(tokens, md.options, {})
# Le titre principal sert de couverture : on retire le premier h1 et son sous-titre du corps.
body = re.sub(r'^<h1[^>]*>La Villa Mballa</h1>\s*', "", body, count=1)
body = body.replace("<li>☐ ", '<li class="check">☐ ')

toc_html = "".join(
    f'<li class="{"t1" if tag == "h1" else "t2"}"><a href="#{a}">{html.escape(t)}</a></li>'
    for tag, t, a in toc
    if t != "La Villa Mballa"
)

CSS = """
@page { size: A4; margin: 16mm 14mm 18mm 14mm;
  @bottom-center { content: "Recette GLOBUS ENGINEERING — page " counter(page) " / " counter(pages);
                   font: 8pt 'Segoe UI', Arial, sans-serif; color: #6b7280; } }
@page :first { @bottom-center { content: none; } }
* { box-sizing: border-box; }
body { font: 10pt/1.45 'Segoe UI', Arial, sans-serif; color: #1f2937; }
.cover { height: 262mm; display: flex; flex-direction: column; justify-content: center; text-align: center;
  border: 3px solid #0b3d91; border-radius: 6mm; padding: 20mm; page-break-after: always; }
.cover .brand { font-size: 13pt; letter-spacing: .25em; color: #0b3d91; font-weight: 700; }
.cover h1 { font-size: 34pt; color: #0b3d91; margin: 10mm 0 4mm; border: 0; }
.cover .sub { font-size: 15pt; color: #374151; }
.cover .meta { margin-top: 18mm; font-size: 10pt; color: #6b7280; }
.toc { page-break-after: always; }
.toc h2 { color: #0b3d91; border-bottom: 2px solid #0b3d91; }
.toc ul { list-style: none; padding: 0; }
.toc li.t1 { font-weight: 700; margin-top: 3mm; color: #0b3d91; }
.toc li.t2 { margin-left: 6mm; }
.toc a { color: inherit; text-decoration: none; }
h1.livre { page-break-before: always; font-size: 22pt; color: #fff; background: #0b3d91; padding: 6mm 8mm;
  border-radius: 3mm; margin-top: 0; }
h2 { font-size: 15pt; color: #0b3d91; border-bottom: 2px solid #0b3d91; padding-bottom: 1.5mm; margin-top: 7mm; }
h2.chapitre { page-break-before: always; }
h1.livre + h2.chapitre { page-break-before: avoid; }
h3 { font-size: 12pt; color: #0b3d91; margin: 6mm 0 2mm; }
h3.scene { background: #eef3fb; border-left: 4px solid #0b3d91; padding: 2mm 3mm; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 4mm 0 1mm; }
p, li { orphans: 3; widows: 3; }
table { border-collapse: collapse; width: 100%; margin: 2mm 0 3mm; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: #0b3d91; color: #fff; text-align: left; padding: 1.5mm 2mm; }
td { border: 1px solid #d1d5db; padding: 1.3mm 2mm; vertical-align: top; }
tr:nth-child(even) td { background: #f8fafc; }
code { font: 9pt Consolas, 'Courier New', monospace; background: #f1f5f9; border: 1px solid #e2e8f0;
  border-radius: 1mm; padding: 0 1mm; color: #0f172a; }
pre { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 2mm; padding: 3mm; white-space: pre-wrap;
  page-break-inside: avoid; }
pre code { border: 0; padding: 0; background: none; }
blockquote { margin: 3mm 0; padding: 2mm 4mm; background: #fff7ed; border-left: 4px solid #f59e0b; border-radius: 1mm;
  page-break-inside: avoid; }
blockquote p { margin: 1mm 0; }
ul, ol { padding-left: 6mm; }
li > p { margin: .5mm 0; }
li.check { list-style: none; margin-left: -6mm; font-weight: 600; color: #0b3d91; }
hr { border: 0; border-top: 1px dashed #cbd5e1; margin: 5mm 0; }
a { color: #0b3d91; }
strong { color: #111827; }
"""

page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Recette GLOBUS ENGINEERING</title>
<style>{CSS}</style></head><body>
<section class="cover">
  <div class="brand">GLOBUS ENGINEERING</div>
  <h1>La Villa Mballa</h1>
  <div class="sub">Manuel de recette de la plateforme<br>site vitrine · ERP · espace client · extranet · applications mobiles</div>
  <div class="meta">{SCENES} scènes · méthode, champs exacts, résultats attendus<br>Tableau de bord de la recette en annexe E</div>
</section>
<section class="toc"><h2>Sommaire</h2><ul>{toc_html}</ul></section>
{body}
</body></html>"""
OUT_HTML.write_text(page, encoding="utf-8")

subprocess.run(
    [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={OUT_PDF}",
        OUT_HTML.resolve().as_uri(),
    ],
    check=True,
    timeout=180,
    capture_output=True,
)
print(OUT_PDF, OUT_PDF.stat().st_size // 1024, "Ko")
