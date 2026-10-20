"""Encaissements clients hors ligne (virement, espèces, chèque, Mobile Money direct) : date de valeur du paiement.

Revision ID: 0010
Revises: 0009
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("payments", sa.Column("value_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("payments", "value_date")
