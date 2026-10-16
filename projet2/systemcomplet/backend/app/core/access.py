"""Contrôle d'accès contextuel (ABAC) : rôle + organisation + projet + chantier + lot + discipline +
ressource + sensibilité + statut du workflow (règle non négociable n°7, §21)."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Depends
from sqlalchemy import Select, false, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import Principal, get_principal
from app.core.errors import Forbidden, NotFound

CONFIDENTIALITY_LEVELS = ("public", "internal", "confidential", "very_sensitive")


class Access:
    """Évaluateur de droits pour un principal dans une session donnée (mémoïsé par requête)."""

    def __init__(self, principal: Principal, db: Session) -> None:
        self.p = principal
        self.db = db
        self._project_ids: set[uuid.UUID] | None = None
        self._memberships: dict[uuid.UUID, Any] | None = None

    # ------------------------------------------------------------------ permissions
    def has(self, *perms: str) -> bool:
        return self.p.has(*perms)

    def require(self, *perms: str) -> None:
        self.p.require(*perms)

    # ------------------------------------------------------------------ projets
    def _load_memberships(self) -> dict[uuid.UUID, Any]:
        if self._memberships is None:
            from app.modules.projects.models import Project, ProjectMember

            rows = self.db.execute(select(ProjectMember).where(ProjectMember.user_id == self.p.id)).scalars().all()
            self._memberships = {m.project_id: m for m in rows}
            if self.p.organization_id and self.p.org_kind == "client":
                org_projects = (
                    self.db.execute(
                        select(Project.id).where(
                            Project.client_organization_id == self.p.organization_id, Project.deleted_at.is_(None)
                        )
                    )
                    .scalars()
                    .all()
                )
                for pid in org_projects:
                    self._memberships.setdefault(pid, None)
        return self._memberships

    def project_scope(self) -> set[uuid.UUID] | None:
        """None = tous les projets (rôle à portée globale)."""
        if self.p.global_scope and self.p.is_internal:
            return None
        if self._project_ids is None:
            self._project_ids = set(self._load_memberships().keys())
        return self._project_ids

    def membership(self, project_id: uuid.UUID) -> Any:
        return self._load_memberships().get(project_id)

    def can_access_project(self, project_id: uuid.UUID | None) -> bool:
        if project_id is None:
            return self.p.is_internal
        scope = self.project_scope()
        return scope is None or project_id in scope

    def require_project(self, project_id: uuid.UUID | None, *perms: str) -> None:
        if perms:
            self.require(*perms)
        if not self.can_access_project(project_id):
            raise Forbidden("Accès refusé à ce projet", code="PROJECT_ACCESS_DENIED")

    def filter_by_project(self, stmt: Select[Any], column: Any, *, allow_null: bool = True) -> Select[Any]:
        scope = self.project_scope()
        if scope is None:
            return stmt
        if not scope:
            return stmt.where(column.is_(None)) if (allow_null and self.p.is_internal) else stmt.where(false())
        if allow_null and self.p.is_internal:
            return stmt.where(or_(column.in_(scope), column.is_(None)))
        return stmt.where(column.in_(scope))

    def can_view_project_finance(self, project_id: uuid.UUID) -> bool:
        if self.p.has("finance:read") and self.can_access_project(project_id):
            return True
        member = self.membership(project_id)
        if self.p.is_client and self.can_access_project(project_id):
            return True
        return bool(member and getattr(member, "can_view_finance", False))

    # ------------------------------------------------------------------ lots / disciplines
    def allowed_lots(self, project_id: uuid.UUID) -> set[uuid.UUID] | None:
        if self.project_scope() is None:
            return None
        member = self.membership(project_id)
        lots = getattr(member, "lots", None) if member else None
        return {uuid.UUID(str(x)) for x in lots} if lots else None

    def allowed_disciplines(self, project_id: uuid.UUID) -> set[str] | None:
        if self.project_scope() is None:
            return None
        member = self.membership(project_id)
        disciplines = getattr(member, "disciplines", None) if member else None
        return set(disciplines) if disciplines else None

    # ------------------------------------------------------------------ organisations
    def require_org(self, organization_id: uuid.UUID | None) -> None:
        if self.p.is_internal:
            return
        if organization_id is None or organization_id != self.p.organization_id:
            raise Forbidden("Ressource d'une autre organisation", code="ORGANIZATION_ACCESS_DENIED")

    # ------------------------------------------------------------------ documents
    def max_confidentiality(self) -> str:
        if self.p.has("documents:very_sensitive") and self.p.mfa_verified:
            return "very_sensitive"
        if self.p.has("documents:confidential"):
            return "confidential"
        if self.p.is_internal:
            return "internal"
        return "public"

    def can_read_confidentiality(self, level: str) -> bool:
        allowed = CONFIDENTIALITY_LEVELS.index(self.max_confidentiality())
        return CONFIDENTIALITY_LEVELS.index(level if level in CONFIDENTIALITY_LEVELS else "internal") <= allowed

    def allowed_confidentialities(self) -> list[str]:
        idx = CONFIDENTIALITY_LEVELS.index(self.max_confidentiality())
        return list(CONFIDENTIALITY_LEVELS[: idx + 1])


def get_or_404(db: Session, model: Any, obj_id: Any, *, label: str = "Ressource") -> Any:
    obj = db.get(model, obj_id)
    if obj is None or getattr(obj, "deleted_at", None) is not None:
        raise NotFound(f"{label} introuvable")
    return obj


def get_access(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)) -> Access:
    return Access(principal, db)
