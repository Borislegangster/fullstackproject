"""Default project templates — seeded idempotently so the lead → project
conversion can pre-fill the chantier phases out of the box (Section 5)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.erp import ProjectTemplate

DEFAULT_TEMPLATES = [
    {
        "name": "Villa R+1",
        "description": "Maison individuelle à étage (R+1).",
        "phases": [
            {"name": "Terrassement & Fondations", "duration_days": 30},
            {"name": "Gros Œuvre RDC", "duration_days": 45},
            {"name": "Gros Œuvre R+1", "duration_days": 45},
            {"name": "Toiture & Étanchéité", "duration_days": 20},
            {"name": "Menuiseries & Huisseries", "duration_days": 15},
            {"name": "Électricité & Plomberie", "duration_days": 25},
            {"name": "Revêtements & Finitions", "duration_days": 30},
            {"name": "Peinture & Décoration", "duration_days": 20},
            {"name": "VRD & Aménagements Ext.", "duration_days": 15},
            {"name": "Réception & Livraison", "duration_days": 5},
        ],
    },
    {
        "name": "Immeuble R+3",
        "description": "Immeuble collectif R+3.",
        "phases": [
            {"name": "Études & Fondations spéciales", "duration_days": 45},
            {"name": "Gros Œuvre RDC", "duration_days": 40},
            {"name": "Gros Œuvre R+1", "duration_days": 40},
            {"name": "Gros Œuvre R+2", "duration_days": 40},
            {"name": "Gros Œuvre R+3", "duration_days": 40},
            {"name": "Toiture-terrasse & Étanchéité", "duration_days": 20},
            {"name": "Cloisons & Réseaux (élec/plomberie)", "duration_days": 40},
            {"name": "Revêtements & Finitions", "duration_days": 45},
            {"name": "Ascenseur & Parties communes", "duration_days": 25},
            {"name": "VRD & Aménagements Ext.", "duration_days": 20},
            {"name": "Réception & Livraison", "duration_days": 10},
        ],
    },
    {
        "name": "Rénovation",
        "description": "Rénovation / réhabilitation d'un bâtiment existant.",
        "phases": [
            {"name": "Diagnostic & Dépose", "duration_days": 10},
            {"name": "Démolition partielle", "duration_days": 10},
            {"name": "Reprise structure & maçonnerie", "duration_days": 20},
            {"name": "Réseaux (élec/plomberie)", "duration_days": 15},
            {"name": "Cloisons & Isolation", "duration_days": 15},
            {"name": "Revêtements & Finitions", "duration_days": 20},
            {"name": "Peinture & Décoration", "duration_days": 12},
            {"name": "Réception & Livraison", "duration_days": 3},
        ],
    },
    {
        "name": "Bureau / Commercial",
        "description": "Aménagement de locaux bureau / commerce.",
        "phases": [
            {"name": "Études & Permis", "duration_days": 20},
            {"name": "Gros Œuvre / Structure", "duration_days": 40},
            {"name": "Façades & Vitrines", "duration_days": 20},
            {"name": "Cloisons & Faux-plafonds", "duration_days": 20},
            {"name": "Électricité, CVC & Réseaux", "duration_days": 30},
            {"name": "Revêtements & Agencement", "duration_days": 25},
            {"name": "Enseignes & Finitions", "duration_days": 12},
            {"name": "Réception & Livraison", "duration_days": 5},
        ],
    },
]


async def ensure_default_templates(db: AsyncSession) -> int:
    """Insert any missing default template (idempotent, matched by unique name).
    Returns the number of templates created."""
    existing = set((await db.execute(select(ProjectTemplate.name))).scalars().all())
    added = 0
    for tpl in DEFAULT_TEMPLATES:
        if tpl["name"] not in existing:
            db.add(ProjectTemplate(**tpl))
            added += 1
    if added:
        await db.commit()
    return added
