"""Remise à zéro des données d'exploitation (avant la mise en service, ou après une recette).

Conservé : site vitrine et CMS (pages, collections, menus, formulaires, réglages du site, SEO), médiathèque, paramètres,
intégrations (secrets chiffrés), modèles et règles de notification, rôles et permissions, référentiels de configuration
(circuits d'approbation, délais garantis, grilles QHSE, catalogue EPI, horaires, partenaires de financement,
catalogue de matériaux, modèles et segments newsletter), sauvegardes et organisation interne de l'entreprise.

Supprimé : tous les comptes, projets et données métier (CRM, devis, contrats, factures, paiements, achats, stocks,
sous-traitance, RH, QHSE, SAV, GED, BIM, messagerie, notifications…), les données laissées par les visiteurs (envois
de formulaires, commentaires, statistiques, abonnés), le journal d'audit (la chaîne repart de cette opération) et les
compteurs de numérotation (le premier projet redevient PRJ-AAAA-00001).

Une sauvegarde complète est faite juste avant ; si elle échoue, rien n'est supprimé. Un nouvel administrateur est
invité par e-mail (lien d'activation, double authentification obligatoire)."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import Table, delete, func, select, text
from sqlalchemy.orm import Session

from app.core import audit
from app.core.database import Base
from app.core.errors import BusinessRuleError

log = logging.getLogger(__name__)

# Module entièrement conservé (contenus du site), sauf les données laissées par les visiteurs.
_KEEP_MODULES = {"cms"}
_CMS_VISITOR_DATA = {"form_submissions", "cms_blog_comments", "cms_blog_shares", "cms_blog_reactions"}
_KEEP_TABLES = {
    "roles",
    "permissions",
    "role_permissions",
    "notification_rules",
    "notification_templates",
    "settings",
    "feature_flags",
    "secret_entries",
    "webhook_endpoints",
    "backup_jobs",
    "sla_policies",
    "approval_rules",
    "inspection_templates",
    "ppe_items",
    "work_schedules",
    "financing_partners",
    "material_categories",
    "materials",
    "email_templates",
    "email_template_versions",
    "newsletter_segments",
    "marketing_automations",
}
# Tables conservées en partie : seules les lignes générales (sans projet, organisation interne, fichiers du
# catalogue de matériaux) restent.
_PARTIAL = {
    "organizations": "kind <> 'internal'",
    "work_calendars": "project_id IS NOT NULL",
    "discipline_layers": "project_id IS NOT NULL",
    "bim_clash_rules": "project_id IS NOT NULL",
    "stored_files": (
        "id NOT IN (SELECT f FROM (SELECT texture_file_id AS f FROM materials UNION SELECT normal_map_file_id "
        "FROM materials UNION SELECT image_file_id FROM materials) refs WHERE f IS NOT NULL)"
    ),
}
# Colonnes qui décident du sort d'une ligne partielle : jamais neutralisées avant la suppression (sinon un calendrier de
# projet deviendrait un calendrier général et serait conservé).
_PARTIAL_KEYS = {
    ("work_calendars", "project_id"),
    ("discipline_layers", "project_id"),
    ("bim_clash_rules", "project_id"),
}
# Vidé d'un bloc (le déclencheur « ajout seul » interdit les suppressions ligne à ligne).
_TRUNCATE = {"audit_events"}

CONFIRMATION = "REMETTRE A ZERO"


def _module_of() -> dict[str, str]:
    return {
        m.local_table.name: m.class_.__module__.replace("app.modules.", "").replace(".models", "")
        for m in Base.registry.mappers
    }


def plan() -> dict[str, list[str]]:
    """Répartition des tables : conservées, conservées en partie, supprimées."""
    modules = _module_of()
    keep, purge = [], []
    for name in Base.metadata.tables:
        if name in _PARTIAL:
            continue
        if (modules.get(name) in _KEEP_MODULES and name not in _CMS_VISITOR_DATA) or name in _KEEP_TABLES:
            keep.append(name)
        else:
            purge.append(name)
    return {"keep": sorted(keep), "partial": sorted(_PARTIAL), "purge": sorted(purge)}


def _count(db: Session, table: Table, where: str | None = None) -> int:
    stmt = select(func.count()).select_from(table)
    if where:
        stmt = stmt.where(text(where))
    return int(db.scalar(stmt) or 0)


_GROUPS = {
    "Comptes et accès": ["users", "invitations", "user_sessions", "teams", "organizations"],
    "Projets et chantiers": ["projects", "tasks", "daily_logs", "site_media", "decisions", "change_orders"],
    "Commercial (CRM, devis, contrats)": ["leads", "contacts", "opportunities", "quotes", "contracts"],
    "Finance et facturation": ["client_invoices", "supplier_invoices", "payments", "funds_calls", "budgets"],
    "Achats, stocks, fournisseurs": ["purchase_requests", "purchase_orders", "suppliers", "stock_items"],
    "Sous-traitance": ["subcontractors", "tenders", "subcontracts", "situations"],
    "RH, QHSE, matériel": ["employees", "attendances", "incidents", "equipment"],
    "SAV, GED, BIM": ["tickets", "documents", "bim_models"],
    "Messagerie et notifications": ["messages", "conversations", "notifications"],
    "Données des visiteurs du site": [
        "form_submissions",
        "cms_blog_comments",
        "newsletter_subscribers",
        "analytics_events",
        "assistant_conversations",
    ],
    "Journal d'audit": ["audit_events"],
}
_KEPT = {
    "Pages du site": "cms_pages",
    "Articles du blog": "cms_blog_posts",
    "Offres": "cms_offers",
    "Réalisations": "cms_portfolio_projects",
    "Médias": "media_assets",
    "Menus": "navigation_menus",
    "Formulaires": "form_definitions",
    "Paramètres": "settings",
    "Clés des intégrations": "secret_entries",
    "Rôles": "roles",
    "Sauvegardes": "backup_jobs",
}


def preview(db: Session) -> dict[str, Any]:
    """Ce qui sera supprimé et conservé (nombres de lignes), affiché avant confirmation."""
    tables = Base.metadata.tables
    deleted = []
    for label, names in _GROUPS.items():
        total = 0
        for name in names:
            if name in tables:
                total += _count(db, tables[name], _PARTIAL.get(name))
        deleted.append({"label": label, "count": total})
    kept = [{"label": label, "count": _count(db, tables[name])} for label, name in _KEPT.items() if name in tables]
    return {"deleted": deleted, "kept": kept, "confirmation": CONFIRMATION}


def _delete_order(purge: set[str]) -> list[Table]:
    """Tables à vider, enfants avant parents (les références circulaires sont d'abord neutralisées)."""
    ordered = [t for t in Base.metadata.sorted_tables if t.name in purge or t.name in _PARTIAL]
    return list(reversed(ordered))


def purge(db: Session) -> dict[str, int]:
    """Suppression proprement dite (dans la transaction de l'appelant, sans validation) ; renvoie les lignes
    supprimées par table. Appelée seule dans une transaction annulée, elle sert d'essai à blanc."""
    tables = Base.metadata.tables
    doomed_full = set(plan()["purge"]) - _TRUNCATE
    counts: dict[str, int] = {}
    # 2. Références circulaires entre tables supprimées (ex. compte ↔ fichier d'avatar) : neutralisées d'abord.
    doomed = doomed_full | set(_PARTIAL)
    for name in sorted(doomed):
        table = tables[name]
        cols = {
            fk.parent.name
            for fk in table.foreign_keys
            if fk.parent.nullable and fk.column.table.name in doomed and (name, fk.parent.name) not in _PARTIAL_KEYS
        }
        for col in sorted(cols):
            db.execute(table.update().where(table.c[col].is_not(None)).values({col: None}))
    # 3. Suppression, enfants avant parents ; les tables conservées perdent seulement leurs mentions
    # « créé par » (ON DELETE SET NULL).
    for table in _delete_order(doomed_full):
        where = _PARTIAL.get(table.name)
        stmt = delete(table).where(text(where)) if where else delete(table)
        result = db.execute(stmt)
        if result.rowcount:
            counts[table.name] = int(result.rowcount)
    for name in _TRUNCATE:
        counts[name] = _count(db, tables[name])
        db.execute(text(f"TRUNCATE TABLE {name} RESTART IDENTITY"))
    return counts


def run(
    db: Session,
    *,
    actor_id: uuid.UUID,
    actor_email: str,
    admin_email: str,
    admin_first_name: str,
    admin_last_name: str,
    break_glass_id: uuid.UUID,
) -> dict[str, Any]:
    from app.modules.admin import backups
    from app.modules.identity.models import Organization, User
    from app.modules.identity.service import assign_roles, invite_user, normalize_email
    from app.modules.system.models import BackupJob, StoredFile

    # 1. Sauvegarde complète de l'état actuel : sans elle, aucune suppression.
    job = BackupJob(kind="pre_destructive", trigger="reset", triggered_by_id=actor_id, break_glass_id=break_glass_id)
    db.add(job)
    db.commit()
    backups.run_backup(db, job)
    if job.status != "success":
        raise BusinessRuleError(
            f"Sauvegarde préalable impossible : aucune donnée n'a été supprimée ({job.error or 'erreur inconnue'}).",
            code="RESET_BACKUP_FAILED",
        )
    backup_id = job.id

    blobs = [
        (row.backend, row.storage_key)
        for row in db.execute(select(StoredFile).where(text(_PARTIAL["stored_files"]))).scalars()
        if row.storage_key
    ]
    try:
        counts = purge(db)
        # 4. Nouvel administrateur : compte invité (mot de passe choisi à l'activation, MFA obligatoire).
        email = normalize_email(admin_email)
        internal = db.execute(select(Organization).where(Organization.kind == "internal").limit(1)).scalars().first()
        admin = User(
            email=email,
            first_name=admin_first_name,
            last_name=admin_last_name,
            organization_id=internal.id if internal else None,
            mfa_required=True,
        )
        db.add(admin)
        db.flush()
        assign_roles(db, admin, ["ADMIN"], granted_by=None)
        invitation, _token = invite_user(
            db,
            inviter=None,
            email=email,
            first_name=admin_first_name,
            last_name=admin_last_name,
            role_codes=["ADMIN"],
            organization_id=admin.organization_id,
            project_ids=[],
            message="Remise à zéro de la plateforme : vous êtes le nouvel administrateur.",
        )
        # 5. Premier maillon du nouveau journal d'audit.
        audit.record(
            db,
            family="security",
            module="system",
            action="DATA_RESET",
            resource_type="platform",
            actor_label=actor_email,
            diff={
                "backup_id": str(backup_id),
                "admin": email,
                "deleted_rows": sum(counts.values()),
                "tables": len(counts),
            },
            criticality="CRITICAL",
        )
        db.commit()
    except Exception:
        db.rollback()
        log.exception("data_reset_failed")
        raise
    # 6. Fichiers privés des données supprimées (best effort, après validation).
    removed = _remove_blobs(blobs)
    from app.modules.cms.service import refresh_site

    refresh_site()
    return {
        "backup_id": backup_id,
        "admin_email": email,
        "invitation_id": invitation.id,
        "deleted_rows": sum(counts.values()),
        "deleted_files": removed,
    }


def _remove_blobs(blobs: list[tuple[str, str]]) -> int:
    from app.core.config import settings
    from app.core.storage import private_storage

    storage = private_storage()
    removed = 0
    for backend, key in blobs:
        if backend and backend != settings.PRIVATE_STORAGE_BACKEND:
            continue
        try:
            storage.delete(key)
            removed += 1
        except Exception:  # noqa: BLE001 - un fichier déjà absent ne bloque pas la remise à zéro
            log.warning("reset_blob_delete_failed", extra={"key": key})
    return removed
