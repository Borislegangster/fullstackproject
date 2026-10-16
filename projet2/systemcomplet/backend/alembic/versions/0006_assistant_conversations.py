"""Assistant de la vitrine : conversations des visiteurs (mode IA / règles, lead créé, page d'origine).

Revision ID: 0006
Revises: 0005
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "assistant_conversations",
        sa.Column(
            "messages", sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"), nullable=False
        ),
        sa.Column("page_path", sa.String(length=250), nullable=True),
        sa.Column("ip_hash", sa.String(length=64), nullable=True),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["leads.id"], name=op.f("fk_assistant_conversations_lead_id_leads"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assistant_conversations")),
    )
    op.create_index(op.f("ix_assistant_conversations_ip_hash"), "assistant_conversations", ["ip_hash"], unique=False)
    op.create_index(op.f("ix_assistant_conversations_lead_id"), "assistant_conversations", ["lead_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_assistant_conversations_lead_id"), table_name="assistant_conversations")
    op.drop_index(op.f("ix_assistant_conversations_ip_hash"), table_name="assistant_conversations")
    op.drop_table("assistant_conversations")
