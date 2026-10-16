"""Clés étrangères différées (cycles users ↔ stored_files, contacts ↔ leads).

Les contraintes déclarées `use_alter=True` sont omises par `op.create_table` : elles sont créées ici, une fois
toutes les tables présentes.

Revision ID: 0003
Revises: 0002
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFERRED = (
    ("fk_users_avatar_file_id_stored_files", "users", "stored_files", "avatar_file_id"),
    ("fk_contacts_source_lead_id_leads", "contacts", "leads", "source_lead_id"),
)


def upgrade() -> None:
    for name, source, target, column in DEFERRED:
        op.create_foreign_key(name, source, target, [column], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    for name, source, _target, _column in DEFERRED:
        op.drop_constraint(name, source, type_="foreignkey")
