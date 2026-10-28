"""Liens des notifications personnelles ouverts dans l'espace de chacun (client, partenaire, ERP) :
- « Nouvelle connexion » : « Mon compte › Sessions et appareils » au lieu de la page d'administration de la sécurité ;
- « Appel manqué » : l'écran « Appels » de l'espace (un client ou un partenaire n'a pas accès à l'ERP).

Seuls les modèles système encore identiques à ceux livrés sont mis à jour (un modèle personnalisé est laissé tel quel).

Revision ID: 0012
Revises: 0011
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_LINKS = [
    ("security.new_device", "Connexion depuis un nouvel appareil ({{ device }}).", "/erp/securite", "/compte?onglet=sessions"),
    ("call.missed", "{{ caller }} a tenté de vous joindre.", "/erp/appels", "/appels"),
]


def _relink(code: str, body: str, old: str, new: str) -> None:
    op.get_bind().execute(
        sa.text(
            "UPDATE notification_templates SET body = :new_body "
            "WHERE code = :code AND channel = 'in_app' AND body = :old_body"
        ),
        {"code": code, "new_body": f"{body}\n---\n{new}", "old_body": f"{body}\n---\n{old}"},
    )


def upgrade() -> None:
    for code, body, old, new in _LINKS:
        _relink(code, body, old, new)


def downgrade() -> None:
    for code, body, old, new in _LINKS:
        _relink(code, body, new, old)
