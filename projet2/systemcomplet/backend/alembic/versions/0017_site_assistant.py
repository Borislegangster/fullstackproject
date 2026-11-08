"""Assistant du site (Claude) : conversations, historique, actions proposées.

- site_assistant_sessions : conversations de l'équipe éditoriale (état du travail, historique exact envoyé au
  modèle, consommation de jetons) ;
- site_assistant_messages : fil lisible (consignes, réponses, étapes, pièces jointes) ;
- site_assistant_actions : opérations de Claude — appliquées d'office (brouillons) ou proposées, puis appliquées
  ou rejetées par une personne.

Revision ID: 0017
Revises: 0016
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "site_assistant_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("state", sa.String(length=20), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("transcript", JSON, nullable=False),
        sa.Column("input_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("output_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("model", sa.String(length=60), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_site_assistant_sessions_user", "site_assistant_sessions", ["user_id", "updated_at"])
    op.create_table(
        "site_assistant_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("attachments", JSON, nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(["session_id"], ["site_assistant_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_site_assistant_messages_session", "site_assistant_messages", ["session_id", "created_at"])
    op.create_table(
        "site_assistant_actions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("tool", sa.String(length=60), nullable=False),
        sa.Column("summary", sa.String(length=400), nullable=False),
        sa.Column("payload", JSON, nullable=False),
        sa.Column("target_type", sa.String(length=40), nullable=True),
        sa.Column("target_id", sa.String(length=80), nullable=True),
        sa.Column("target_label", sa.String(length=300), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("result", JSON, nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("decided_by_id", sa.Uuid(), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(["session_id"], ["site_assistant_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["decided_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_site_assistant_actions_session", "site_assistant_actions", ["session_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_site_assistant_actions_session", table_name="site_assistant_actions")
    op.drop_table("site_assistant_actions")
    op.drop_index("ix_site_assistant_messages_session", table_name="site_assistant_messages")
    op.drop_table("site_assistant_messages")
    op.drop_index("ix_site_assistant_sessions_user", table_name="site_assistant_sessions")
    op.drop_table("site_assistant_sessions")
