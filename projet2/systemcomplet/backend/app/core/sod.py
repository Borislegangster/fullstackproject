"""Séparation des tâches (double regard) : celui qui saisit ou prépare ne valide pas lui-même.

Seul le super administrateur (rôle ADMIN) peut saisir puis approuver lui-même ; chaque cas est tracé au journal
d'audit (famille sécurité, criticité haute). Tous les autres suivent le circuit, quelle que soit l'opération.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.core import audit
from app.core.errors import BusinessRuleError

SUPER_ADMIN = "ADMIN"


def is_super_admin(principal: Any) -> bool:
    return SUPER_ADMIN in set(getattr(principal, "roles", ()) or ())


def require_other_person(
    db: Session,
    principal: Any,
    author_id: uuid.UUID | None,
    message: str,
    *,
    resource_type: str,
    resource_id: Any = None,
    project_id: uuid.UUID | None = None,
) -> bool:
    """Refuse qu'une personne valide sa propre saisie ; le super administrateur passe (tracé). Renvoie True quand
    l'administrateur valide lui-même sa saisie."""
    if author_id is None or author_id != principal.id:
        return False
    if not is_super_admin(principal):
        raise BusinessRuleError(message, code="SEGREGATION_OF_DUTIES")
    audit.record(
        db,
        family="security",
        module="sod",
        action="ADMIN_SELF_APPROVAL",
        resource_type=resource_type,
        resource_id=resource_id,
        project_id=project_id,
        diff={"rule": message},
        criticality="HIGH",
    )
    return True
