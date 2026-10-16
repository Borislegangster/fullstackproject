"""Suivi des opérations prestataires : nature (encaissement / transfert sortant), jeton de notification par
transaction (Orange Money), date de dernière relecture du statut (MTN MoMo : validation sur le téléphone).

Revision ID: 0004
Revises: 0003
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "payment_transactions",
        sa.Column("kind", sa.String(length=10), nullable=False, server_default="collection"),
    )
    op.add_column("payment_transactions", sa.Column("webhook_token_hash", sa.String(length=64), nullable=True))
    op.add_column("payment_transactions", sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_payment_transactions_webhook_token_hash", "payment_transactions", ["webhook_token_hash"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_payment_transactions_webhook_token_hash", table_name="payment_transactions")
    op.drop_column("payment_transactions", "last_checked_at")
    op.drop_column("payment_transactions", "webhook_token_hash")
    op.drop_column("payment_transactions", "kind")
