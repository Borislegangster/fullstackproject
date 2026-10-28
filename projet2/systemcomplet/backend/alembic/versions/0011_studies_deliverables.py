"""Parcours « études d'abord » : nature des devis et contrats (études / travaux), livrables d'études payants.

Revision ID: 0011
Revises: 0010
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    for table in ("quotes", "contracts"):
        op.add_column(table, sa.Column("nature", sa.String(20), nullable=False, server_default="travaux"))
    op.add_column("documents", sa.Column("paid_deliverable", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("documents", sa.Column("unlock_invoice_id", sa.Uuid(), nullable=True))
    op.add_column("documents", sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_documents_unlock_invoice_id_client_invoices",
        "documents",
        "client_invoices",
        ["unlock_invoice_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_documents_unlock_invoice_id", "documents", ["unlock_invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_documents_unlock_invoice_id", table_name="documents")
    op.drop_constraint("fk_documents_unlock_invoice_id_client_invoices", "documents", type_="foreignkey")
    for column in ("delivered_at", "unlock_invoice_id", "paid_deliverable"):
        op.drop_column("documents", column)
    for table in ("quotes", "contracts"):
        op.drop_column(table, "nature")
