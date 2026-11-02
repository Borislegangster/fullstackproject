"""Production seed script — bootstrap a fresh Globus BTP install.

Run once after a clean Alembic migration:
    docker compose exec backend python -m scripts.seed_production

The script is idempotent: re-running it is safe and will skip already-existing
records. It only creates rows that are clearly missing.

What it seeds:
  1. The first ADMIN user (prompted interactively or via env vars).
  2. The standard document templates (paie, contrat, attestation, ordre de
     mission, note de frais, bon de sortie) so HR can generate them right away.
"""
from __future__ import annotations

import asyncio
import os
import sys
from getpass import getpass

# Make `app.*` importable when running as `python scripts/seed_production.py`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.auth.models import User  # noqa: E402
from app.auth.service import hash_password  # noqa: E402
from app.database import AsyncSessionLocal, engine, Base  # noqa: E402
from app.models.erp import DocumentTemplate  # noqa: E402


# ── Document template definitions ────────────────────────────

TEMPLATES = [
    {
        "name": "Bulletin de paie",
        "description": "Bulletin de salaire mensuel — variables : nom, période, base, net.",
        "category": "paie",
        "icon_key": "BanknoteIcon",
        "template_body": """
<h2>Bulletin de paie — {{ period }}</h2>
<p><strong>Employé :</strong> {{ employee_name }}</p>
<p><strong>Matricule :</strong> {{ employee_code }}</p>
<table style="width:100%;border-collapse:collapse">
  <tr><td>Salaire de base</td><td style="text-align:right">{{ base_amount }} FCFA</td></tr>
  <tr><td>Primes</td><td style="text-align:right">{{ bonuses }} FCFA</td></tr>
  <tr><td>Retenues</td><td style="text-align:right">- {{ deductions }} FCFA</td></tr>
  <tr style="border-top:1px solid #000;font-weight:bold">
    <td>Net à payer</td><td style="text-align:right">{{ net_amount }} FCFA</td>
  </tr>
</table>
""".strip(),
        "placeholders": [
            {"key": "employee_name", "label": "Nom complet", "type": "string"},
            {"key": "employee_code", "label": "Matricule", "type": "string"},
            {"key": "period", "label": "Période (YYYY-MM)", "type": "string"},
            {"key": "base_amount", "label": "Salaire de base", "type": "number"},
            {"key": "bonuses", "label": "Primes", "type": "number"},
            {"key": "deductions", "label": "Retenues", "type": "number"},
            {"key": "net_amount", "label": "Net à payer", "type": "number"},
        ],
    },
    {
        "name": "Contrat de travail",
        "description": "Contrat CDI / CDD standard — variables : employé, poste, salaire.",
        "category": "contrat",
        "icon_key": "FileTextIcon",
        "template_body": """
<h2>Contrat de travail — {{ contract_type }}</h2>
<p>Entre <strong>Globus Engineering SARL</strong> et <strong>{{ employee_name }}</strong> :</p>
<p>Le salarié est engagé en qualité de <strong>{{ position }}</strong> à compter
du <strong>{{ start_date }}</strong>{% if end_date %} jusqu'au <strong>{{ end_date }}</strong>{% endif %}.</p>
<p>Rémunération mensuelle brute : <strong>{{ salary }} FCFA</strong>.</p>
""".strip(),
        "placeholders": [
            {"key": "contract_type", "label": "Type (CDI/CDD)", "type": "string"},
            {"key": "employee_name", "label": "Nom complet", "type": "string"},
            {"key": "position", "label": "Poste", "type": "string"},
            {"key": "start_date", "label": "Date début", "type": "date"},
            {"key": "end_date", "label": "Date fin (optionnel)", "type": "date"},
            {"key": "salary", "label": "Salaire mensuel", "type": "number"},
        ],
    },
    {
        "name": "Attestation de travail",
        "description": "Certifie qu'un salarié est employé par l'entreprise.",
        "category": "attestation",
        "icon_key": "ShieldCheckIcon",
        "template_body": """
<h2>Attestation de travail</h2>
<p>Je soussigné, représentant légal de Globus Engineering SARL,
atteste que <strong>{{ employee_name }}</strong> est employé(e) en qualité de
<strong>{{ position }}</strong> depuis le <strong>{{ hire_date }}</strong>.</p>
<p>La présente est délivrée pour : {{ purpose }}.</p>
""".strip(),
        "placeholders": [
            {"key": "employee_name", "label": "Nom complet", "type": "string"},
            {"key": "position", "label": "Poste", "type": "string"},
            {"key": "hire_date", "label": "Date d'embauche", "type": "date"},
            {"key": "purpose", "label": "Motif", "type": "string"},
        ],
    },
    {
        "name": "Ordre de mission",
        "description": "Mandate un collaborateur pour une mission terrain.",
        "category": "ordre_mission",
        "icon_key": "MapPinIcon",
        "template_body": """
<h2>Ordre de mission</h2>
<p><strong>Collaborateur :</strong> {{ employee_name }}</p>
<p><strong>Destination :</strong> {{ destination }}</p>
<p><strong>Objet :</strong> {{ subject }}</p>
<p><strong>Période :</strong> du {{ start_date }} au {{ end_date }}</p>
""".strip(),
        "placeholders": [
            {"key": "employee_name", "label": "Nom du collaborateur", "type": "string"},
            {"key": "destination", "label": "Destination", "type": "string"},
            {"key": "subject", "label": "Objet de la mission", "type": "string"},
            {"key": "start_date", "label": "Début", "type": "date"},
            {"key": "end_date", "label": "Fin", "type": "date"},
        ],
    },
    {
        "name": "Note de frais",
        "description": "Récapitulatif de dépenses à se faire rembourser.",
        "category": "note_frais",
        "icon_key": "ReceiptIcon",
        "template_body": """
<h2>Note de frais — {{ period }}</h2>
<p><strong>Émise par :</strong> {{ employee_name }}</p>
<p>{{ items_table | safe }}</p>
<p><strong>Total :</strong> {{ total }} FCFA</p>
""".strip(),
        "placeholders": [
            {"key": "employee_name", "label": "Nom complet", "type": "string"},
            {"key": "period", "label": "Période", "type": "string"},
            {"key": "items_table", "label": "Tableau des dépenses (HTML)", "type": "html"},
            {"key": "total", "label": "Total", "type": "number"},
        ],
    },
    {
        "name": "Bon de sortie",
        "description": "Autorisation de sortie de matériel du dépôt.",
        "category": "bon_sortie",
        "icon_key": "TruckIcon",
        "template_body": """
<h2>Bon de sortie</h2>
<p><strong>Date :</strong> {{ exit_date }}</p>
<p><strong>Demandeur :</strong> {{ requester }} ({{ project }})</p>
<p>{{ items_table | safe }}</p>
""".strip(),
        "placeholders": [
            {"key": "exit_date", "label": "Date de sortie", "type": "date"},
            {"key": "requester", "label": "Demandeur", "type": "string"},
            {"key": "project", "label": "Chantier destinataire", "type": "string"},
            {"key": "items_table", "label": "Articles (HTML)", "type": "html"},
        ],
    },
]


def _prompt_admin_credentials() -> tuple[str, str, str, str]:
    """Read admin credentials from env vars (CI) or stdin (interactive)."""
    email = os.getenv("SEED_ADMIN_EMAIL")
    password = os.getenv("SEED_ADMIN_PASSWORD")
    first_name = os.getenv("SEED_ADMIN_FIRST_NAME", "Admin")
    last_name = os.getenv("SEED_ADMIN_LAST_NAME", "Globus")

    if not email:
        email = input("Email de l'administrateur initial : ").strip()
    if not password:
        password = getpass("Mot de passe (≥ 12 caractères) : ")
        if len(password) < 12:
            raise SystemExit("Mot de passe trop court — 12 caractères minimum.")

    return email, password, first_name, last_name


async def seed_admin(email: str, password: str, first_name: str, last_name: str) -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalars().first():
            print(f"[skip] Admin {email} existe déjà.")
            return
        db.add(User(
            email=email,
            password_hash=hash_password(password),
            first_name=first_name, last_name=last_name,
            role="ADMIN",
            is_active=True,
            must_change_password=False,
        ))
        await db.commit()
        print(f"[ok] Admin {email} créé.")


async def seed_templates() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(DocumentTemplate.name))
        already = {row[0] for row in existing.all()}
        created = 0
        for tpl in TEMPLATES:
            if tpl["name"] in already:
                continue
            db.add(DocumentTemplate(**tpl))
            created += 1
        if created:
            await db.commit()
            print(f"[ok] {created} templates créés.")
        else:
            print("[skip] Tous les templates existent déjà.")


async def ensure_schema() -> None:
    """Make sure ORM-declared tables exist.

    Production should use Alembic, but this guard keeps the script robust in
    a fresh dev DB or a Docker volume that was never migrated.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def main() -> None:
    print("--- Globus BTP -- Production seed ---")
    email, password, first_name, last_name = _prompt_admin_credentials()
    await ensure_schema()
    await seed_admin(email, password, first_name, last_name)
    await seed_templates()
    print("--- Termine OK ---")
    print(f"Connectez-vous sur le front avec : {email}")


if __name__ == "__main__":
    asyncio.run(main())
