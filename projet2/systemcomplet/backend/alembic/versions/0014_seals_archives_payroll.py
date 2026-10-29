"""Sceaux d'authenticité des documents (QR), archives de chantiers restaurables, auteur du calcul de la paie.

- document_seals : chaque document émis (reçu, devis, proforma, avoir, bon de commande, marché, bulletin…) reçoit un
  code d'authenticité ; son QR renvoie vers la page publique de vérification.
- projects.archived_by_id / archive_reason : qui a archivé un chantier et pourquoi (affiché dans « Archives »,
  d'où le chantier peut être restauré).
- payroll_runs.computed_by_id : double regard — la paie est validée par une autre personne que celle qui l'a calculée.

Revision ID: 0014
Revises: 0013
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_seals",
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("entity_type", sa.String(length=40), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("reference", sa.String(length=80), nullable=True),
        sa.Column("title", sa.String(length=250), nullable=True),
        sa.Column("issued_on", sa.Date(), nullable=True),
        sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("party", sa.String(length=250), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_document_seals")),
        sa.UniqueConstraint("token", name=op.f("uq_document_seals_token")),
        sa.UniqueConstraint("entity_type", "entity_id", "kind", name="uq_document_seals_entity_kind"),
    )
    op.add_column("projects", sa.Column("archived_by_id", sa.Uuid(), nullable=True))
    op.add_column("projects", sa.Column("archive_reason", sa.Text(), nullable=True))
    op.create_foreign_key(
        op.f("fk_projects_archived_by_id_users"), "projects", "users", ["archived_by_id"], ["id"], ondelete="SET NULL"
    )
    op.add_column("payroll_runs", sa.Column("computed_by_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_payroll_runs_computed_by_id_users"),
        "payroll_runs",
        "users",
        ["computed_by_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_payroll_runs_computed_by_id_users"), "payroll_runs", type_="foreignkey")
    op.drop_column("payroll_runs", "computed_by_id")
    op.drop_constraint(op.f("fk_projects_archived_by_id_users"), "projects", type_="foreignkey")
    op.drop_column("projects", "archive_reason")
    op.drop_column("projects", "archived_by_id")
    op.drop_table("document_seals")
