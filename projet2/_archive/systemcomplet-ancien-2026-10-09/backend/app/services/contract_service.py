"""Auto-generated pre-filled construction contract (PDF) at lead conversion.

Section 6 senior recommendation: at project creation, generate the GED folders
AND a pre-filled contract PDF from the quote/lead data.
"""
from datetime import datetime

from app.services.pdf_service import html_to_pdf


def _fmt_amount(v) -> str:
    try:
        return f"{float(v or 0):,.0f}".replace(",", " ")
    except Exception:
        return "0"


def build_contract_html(
    *,
    client_name: str,
    client_email: str,
    client_phone: str,
    project_name: str,
    project_code: str,
    project_type: str,
    location: str,
    budget,
    phases=None,
    company_name: str = "Globus Engineering SARL",
) -> str:
    today = datetime.utcnow().strftime("%d/%m/%Y")
    rows = ""
    for i, ph in enumerate(phases or [], 1):
        rows += (
            f"<tr><td>{i}</td><td>{ph.get('name', '')}</td>"
            f"<td>{ph.get('duration_days', 0)} j</td></tr>"
        )
    if not rows:
        rows = "<tr><td colspan='3'>Phases définies ultérieurement</td></tr>"
    phone_part = f" — {client_phone}" if client_phone else ""
    return f"""<html><head><meta charset='utf-8'><style>
      body {{ font-family: Helvetica, Arial, sans-serif; color:#1a202c; font-size:11px; }}
      .head {{ background:#1A365D; color:#ffffff; padding:16px; }}
      .head h1 {{ margin:0; font-size:18px; }}
      h2 {{ color:#1A365D; font-size:13px; border-bottom:1px solid #cbd5e0; padding-bottom:3px; margin-top:16px; }}
      table {{ width:100%; border-collapse:collapse; margin:6px 0; }}
      td, th {{ border:1px solid #cbd5e0; padding:5px; text-align:left; }}
      .muted {{ color:#718096; }}
      .sign td {{ border:none; padding-top:36px; }}
    </style></head><body>
      <div class='head'>
        <h1>{company_name}</h1>
        <div>Contrat de construction — {project_code}</div>
      </div>
      <p class='muted'>Fait à Douala, le {today}</p>

      <h2>Entre les parties</h2>
      <p><b>L'Entreprise :</b> {company_name}, ci-après « l'Entreprise ».</p>
      <p><b>Le Client :</b> {client_name} — {client_email}{phone_part}, ci-après « le Client ».</p>

      <h2>Objet du contrat</h2>
      <p>Réalisation du projet <b>« {project_name} »</b> ({project_type or 'construction'})
      sis à {location or '—'}.</p>

      <h2>Montant prévisionnel</h2>
      <p>Le montant prévisionnel des travaux est de <b>{_fmt_amount(budget)} FCFA</b>
      (hors avenants).</p>

      <h2>Phases prévisionnelles</h2>
      <table><tr><th>#</th><th>Phase</th><th>Durée</th></tr>{rows}</table>

      <h2>Conditions</h2>
      <p>Le présent contrat est régi par les conditions générales de l'Entreprise.
      Les paiements s'effectuent par appels de fonds liés à l'avancement des phases.
      Toute modification fait l'objet d'un avenant écrit signé des deux parties.</p>

      <table class='sign'><tr>
        <td>L'Entreprise<br/><br/>__________________</td>
        <td>Le Client<br/><br/>__________________</td>
      </tr></table>
    </body></html>"""


def generate_contract_pdf(**kwargs) -> bytes:
    """Render the pre-filled contract to PDF bytes."""
    return html_to_pdf(build_contract_html(**kwargs))
