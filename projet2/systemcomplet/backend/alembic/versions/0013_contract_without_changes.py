"""Avenants séparés du contrat : le montant du contrat d'un projet redevient celui du contrat signé.

Jusqu'ici, l'approbation d'un avenant ajoutait son montant au contrat du projet (et l'espace client l'ajoutait une
seconde fois à l'affichage). Le total des avenants approuvés est retiré du montant du contrat : il est désormais
suivi à part (tableaux de bord, finances, exports) et facturé séparément.

Revision ID: 0013
Revises: 0012
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_APPROVED = (
    "SELECT project_id, SUM(cost_impact) AS total FROM change_orders "
    "WHERE status = 'approved' GROUP BY project_id"
)


def upgrade() -> None:
    op.execute(
        "UPDATE projects AS p SET contract_amount = GREATEST(p.contract_amount - t.total, 0) "
        f"FROM ({_APPROVED}) AS t WHERE t.project_id = p.id AND t.total <> 0"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE projects AS p SET contract_amount = p.contract_amount + t.total "
        f"FROM ({_APPROVED}) AS t WHERE t.project_id = p.id AND t.total <> 0"
    )
