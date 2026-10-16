"""Relances d'échéance des factures clients (une par palier : J-3, J+1, J+7, J+15, J+30, relances manuelles).

Revision ID: 0005
Revises: 0004
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payment_reminders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=False),
        sa.Column("amount_due", sa.Numeric(precision=18, scale=2), server_default="0", nullable=False),
        sa.Column("sent_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["sent_by_id"], ["users.id"], name="fk_payment_reminders_sent_by_id_users", ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_payment_reminders"),
        sa.UniqueConstraint(
            "target_type", "target_id", "stage", name="uq_payment_reminders_target_type_target_id_stage"
        ),
    )
    op.create_index("ix_payment_reminders_target_id", "payment_reminders", ["target_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_payment_reminders_target_id", table_name="payment_reminders")
    op.drop_table("payment_reminders")
