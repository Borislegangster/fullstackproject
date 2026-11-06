"""GED : mots-clés des documents remplis avec le nom du fichier.

Les documents déposés sans mot-clé (avant l'import multiple, ou par un formulaire qui ne les proposait pas) reçoivent
le nom de leur fichier, sans extension, comme le fait désormais chaque dépôt. Les mots-clés déjà saisis ne sont pas
touchés.

Revision ID: 0016
Revises: 0015
"""

from __future__ import annotations

import json
import re
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _stem(name: str) -> str:
    return (re.sub(r"\.[^./\\]+$", "", name).strip() or name).strip()[:100]


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT d.id, v.original_name FROM documents d "
            "JOIN document_versions v ON v.id = d.current_version_id "
            "WHERE d.tags IS NULL OR jsonb_typeof(d.tags) <> 'array' OR d.tags = '[]'::jsonb"
        )
    ).all()
    update = sa.text("UPDATE documents SET tags = CAST(:tags AS jsonb) WHERE id = :id")
    for document_id, original_name in rows:
        stem = _stem(original_name or "")
        if stem:
            bind.execute(update, {"tags": json.dumps([stem], ensure_ascii=False), "id": document_id})


def downgrade() -> None:
    """Rien à défaire : les mots-clés ajoutés restent des mots-clés ordinaires."""
