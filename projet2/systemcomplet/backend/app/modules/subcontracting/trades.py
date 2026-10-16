"""Référentiel des corps de métier (sous-traitance) et des métiers des personnes (RH, utilisateurs, équipes).

Les codes (snake_case) sont stockés tels quels sur les sous-traitants (`trades`), les qualifications (`trade`), les
salariés, les utilisateurs et les équipes (`trade`). Un maçon salarié et une entreprise de maçonnerie partagent le
code `maconnerie`.
La même liste figure côté web (apps/web/src/lib/labels.ts : `SUBCONTRACTING_TRADES`, `CREW_TRADES` et
`OPTION_LABELS`) ; tests/test_subcontracting_trades.py et tests/test_person_trades.py vérifient la concordance.
"""

from __future__ import annotations

from collections.abc import Iterable

from app.core.errors import BusinessRuleError

# Ordre d'affichage : déroulement d'un chantier (terrassement → finitions → lots techniques → extérieurs).
TRADES: dict[str, str] = {
    "terrassement": "Terrassement",
    "demolition": "Démolition",
    "gros_oeuvre": "Gros œuvre",
    "maconnerie": "Maçonnerie",
    "ferraillage": "Ferraillage",
    "coffrage": "Coffrage",
    "structure": "Structure",
    "charpente": "Charpente",
    "couverture": "Couverture",
    "etancheite": "Étanchéité",
    "menuiserie": "Menuiserie",
    "menuiserie_aluminium": "Menuiserie aluminium",
    "metallerie": "Métallerie et serrurerie",
    "platrerie": "Plâtrerie et faux plafonds",
    "carrelage": "Carrelage et revêtements",
    "peinture": "Peinture",
    "electricite": "Électricité",
    "courants_faibles": "Courants faibles",
    "plomberie": "Plomberie",
    "climatisation": "Climatisation",
    "securite_incendie": "Sécurité incendie",
    "ascenseurs": "Ascenseurs",
    "solaire": "Solaire",
    "vrd": "Voirie et réseaux divers (VRD)",
    "assainissement": "Assainissement",
    "forage": "Forage",
    "amenagements_exterieurs": "Aménagements extérieurs",
}

# Corps d'état touchant à la solidité ou au clos et couvert : approbation subordonnée à une décennale valide.
DECENNALE_TRADES: frozenset[str] = frozenset(
    {"gros_oeuvre", "maconnerie", "ferraillage", "coffrage", "structure", "charpente", "couverture", "etancheite"}
)


def ensure_known(values: Iterable[str] | None, *, tolerated: Iterable[str] | None = None) -> None:
    """Refuse tout code hors référentiel ; `tolerated` laisse passer les codes historiques déjà enregistrés."""
    kept = set(tolerated or [])
    unknown = [v for v in values or [] if v not in TRADES and v not in kept]
    if unknown:
        raise BusinessRuleError(
            f"Corps de métier inconnu : {', '.join(unknown)}. Choisissez-le dans la liste proposée.",
            code="UNKNOWN_TRADE",
        )


# Métiers individuels de chantier sans corps d'état propre : proposés pour les personnes (salariés, utilisateurs,
# équipes), jamais aux entreprises sous-traitantes.
CREW_TRADES: dict[str, str] = {
    "manoeuvre": "Manœuvre",
    "conduite_engins": "Conduite d'engins",
    "grutier": "Grutier",
    "chauffeur": "Chauffeur",
    "soudure": "Soudure",
    "topographie": "Topographie",
    "mecanique": "Mécanique d'engins",
    "magasinier": "Magasinier",
    "gardiennage": "Gardiennage",
    "nettoyage": "Nettoyage de chantier",
}

# Métier d'une personne : un corps de métier (mêmes codes que la sous-traitance) ou un métier de chantier.
PERSON_TRADES: dict[str, str] = {**TRADES, **CREW_TRADES}


def ensure_person_trade(value: str | None, *, current: str | None = None) -> None:
    """Métier d'une personne : vide ou issu de PERSON_TRADES ; le code déjà enregistré (`current`) reste accepté."""
    if value and value not in PERSON_TRADES and value != current:
        raise BusinessRuleError(
            f"Métier inconnu : {value}. Choisissez-le dans la liste proposée.",
            code="UNKNOWN_TRADE",
        )


def trade_label(code: str | None) -> str | None:
    """Libellé français d'un code de métier ; un code historique hors référentiel est rendu tel quel."""
    return PERSON_TRADES.get(code, code) if code else code
