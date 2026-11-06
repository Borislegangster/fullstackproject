"""Signatures manuscrites des documents émis (devis, contrats, factures, reçus, rapports…).

- signatures.party : bloc de signature du PDF signé (company = GLOBUS ENGINEERING, client…) ; la signature dessinée
  (`signature_image_file_id`) est validée électroniquement par un code à usage unique (method = otp_drawn).
- document_seals.content_hash : empreinte du contenu engageant du document à sa dernière édition ; une signature
  n'est apposée que si son empreinte (`signatures.signed_hash`) est toujours celle du document.

Revision ID: 0015
Revises: 0014
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("signatures", sa.Column("party", sa.String(length=20), nullable=True))
    op.add_column("document_seals", sa.Column("content_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("document_seals", "content_hash")
    op.drop_column("signatures", "party")
