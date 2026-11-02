"""PDF reports for the Bureau d'Études collaboration sessions (Section 7).

  • Snapshot PDF  — a timestamped capture (image + note) archived in the GED.
  • Session summary PDF — all snapshots + validated decisions, archived in GED.
"""
from datetime import datetime

from app.services.pdf_service import html_to_pdf

_STYLE = """
  body { font-family: Helvetica, Arial, sans-serif; color:#1a202c; font-size:11px; }
  .head { background:#1A365D; color:#ffffff; padding:14px; }
  .head b { font-size:14px; }
  h2 { color:#1A365D; font-size:13px; border-bottom:1px solid #cbd5e0; padding-bottom:3px; }
  .muted { color:#718096; }
  ul { margin:4px 0 4px 16px; }
"""


def _img_block(image_url: str) -> str:
    """Embed a data-URI image; otherwise reference the URL (no remote fetch)."""
    if image_url and image_url.startswith("data:image"):
        return f"<img src='{image_url}' style='max-width:100%; border:1px solid #cbd5e0;' />"
    if image_url:
        return f"<p class='muted'>Image : {image_url}</p>"
    return "<p class='muted'>(pas d'image)</p>"


def build_snapshot_pdf(*, image_url: str, notes: str, project_code: str,
                       author_name: str, session_id: str) -> bytes:
    when = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
    return html_to_pdf(f"""<html><head><meta charset='utf-8'><style>{_STYLE}</style></head><body>
      <div class='head'><b>Globus BTP</b> — Capture de revue technique ({project_code})</div>
      <p class='muted'>Session {session_id} · capturé par {author_name} · {when}</p>
      {_img_block(image_url)}
      <h2>Note</h2>
      <p>{notes or '—'}</p>
    </body></html>""")


def build_session_summary_pdf(*, project_code: str, project_name: str,
                              started: str, ended: str,
                              snapshots: list, decisions: list) -> bytes:
    when = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
    snap_html = "".join(
        f"<li>{s.get('when', '')} — {s.get('notes') or 'capture'}</li>" for s in snapshots
    ) or "<li>Aucune capture</li>"
    dec_html = "".join(
        f"<li><b>[{d.get('author_role', '')}]</b> calque « {d.get('layer', '')} » — "
        f"{d.get('summary', '')}</li>"
        for d in decisions
    ) or "<li>Aucune décision validée</li>"
    return html_to_pdf(f"""<html><head><meta charset='utf-8'><style>{_STYLE}</style></head><body>
      <div class='head'><b>Globus BTP</b> — Compte-rendu de revue ({project_code})</div>
      <p class='muted'>Projet « {project_name} » · début {started} · fin {ended} · généré le {when}</p>
      <h2>Décisions validées ({len(decisions)})</h2>
      <ul>{dec_html}</ul>
      <h2>Captures ({len(snapshots)})</h2>
      <ul>{snap_html}</ul>
    </body></html>""")
