"""Journal d'audit append-only (trigger) + index plein texte GED (français).

Revision ID: 0002
Revises: 0001
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # V4-AUDIT-34 : le journal est en ajout seul — toute modification/suppression est refusée.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION globus_audit_append_only() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_events est en ajout seul (append-only)';
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_events_no_update_delete
        BEFORE UPDATE OR DELETE ON audit_events
        FOR EACH ROW EXECUTE FUNCTION globus_audit_append_only();
        """
    )
    # Recherche plein texte (§12.2) sur le texte extrait des versions de documents.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_versions_fts ON document_versions "
        "USING gin (to_tsvector('french', coalesce(extracted_text, '') || ' ' || coalesce(original_name, '')))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_title_fts ON documents "
        "USING gin (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(description, '')))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cms_blog_posts_fts ON cms_blog_posts "
        "USING gin (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(excerpt, '')))"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_cms_help_articles_fts ON cms_help_articles "
        "USING gin (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(summary, '')))"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_cms_help_articles_fts")
    op.execute("DROP INDEX IF EXISTS ix_cms_blog_posts_fts")
    op.execute("DROP INDEX IF EXISTS ix_documents_title_fts")
    op.execute("DROP INDEX IF EXISTS ix_document_versions_fts")
    op.execute("DROP TRIGGER IF EXISTS audit_events_no_update_delete ON audit_events")
    op.execute("DROP FUNCTION IF EXISTS globus_audit_append_only()")
