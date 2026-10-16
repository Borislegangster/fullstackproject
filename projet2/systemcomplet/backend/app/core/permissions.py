"""Catalogue des permissions (RBAC) et rôles par défaut (§21).

Le contrôle ne se limite jamais au rôle : les vérifications ABAC (organisation, projet, chantier, lot,
discipline, ressource, sensibilité du document, statut du workflow) sont faites dans `app.core.access`.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Perm:
    code: str
    label: str
    sensitive: bool = False

    @property
    def module(self) -> str:
        return self.code.split(":", 1)[0]


PERMISSIONS: list[Perm] = [
    # Tableau de bord / pilotage
    Perm("dashboard:view", "Voir le tableau de bord"),
    Perm("dashboard:direction", "Voir le tableau de bord Direction (finances, marges)", True),
    # Projets / chantiers / planning
    Perm("projects:read", "Consulter les projets"),
    Perm("projects:write", "Créer / modifier les projets"),
    Perm("projects:delete", "Archiver les projets", True),
    Perm("projects:members", "Gérer les membres des projets"),
    Perm("projects:publish_client", "Publier des contenus vers le client"),
    Perm("site:report", "Saisir journal / avancement / photos chantier"),
    Perm("planning:read", "Consulter les plannings"),
    Perm("planning:write", "Modifier les plannings"),
    # Finance / facturation
    Perm("finance:read", "Consulter les finances", True),
    Perm("finance:write", "Saisir budgets, dépenses, caisses", True),
    Perm("finance:approve", "Valider les engagements / budgets", True),
    Perm("finance:pay", "Exécuter les paiements", True),
    Perm("finance:reconcile", "Rapprochements bancaires", True),
    Perm("billing:read", "Consulter la facturation", True),
    Perm("billing:write", "Créer les factures / avoirs", True),
    Perm("billing:validate", "Valider les factures fournisseurs", True),
    # CRM
    Perm("crm:read", "Consulter le CRM"),
    Perm("crm:write", "Gérer leads / opportunités / devis"),
    Perm("crm:assign", "Affecter les leads"),
    Perm("crm:contracts", "Gérer les contrats", True),
    # Achats / fournisseurs / livraisons / stocks
    Perm("procurement:read", "Consulter les achats"),
    Perm("procurement:request", "Créer des demandes d'achat"),
    Perm("procurement:approve", "Approuver les demandes d'achat"),
    Perm("procurement:order", "Émettre les bons de commande"),
    Perm("suppliers:read", "Consulter les fournisseurs"),
    Perm("suppliers:write", "Gérer les fournisseurs"),
    Perm("deliveries:read", "Consulter les livraisons"),
    Perm("deliveries:receive", "Réceptionner les livraisons (GRN)"),
    Perm("inventory:read", "Consulter les stocks"),
    Perm("inventory:write", "Mouvements de stock / inventaires"),
    Perm("equipment:read", "Consulter le matériel"),
    Perm("equipment:write", "Gérer le matériel"),
    # Sous-traitance / litiges
    Perm("subcontracting:read", "Consulter la sous-traitance"),
    Perm("subcontracting:write", "Gérer consultations / contrats"),
    Perm("subcontracting:award", "Attribuer les marchés", True),
    Perm("subcontracting:validate", "Valider les situations de travaux", True),
    Perm("subcontracting:derogate", "Accorder une dérogation de dépassement", True),
    Perm("disputes:read", "Consulter les litiges"),
    Perm("disputes:write", "Gérer les litiges"),
    Perm("disputes:decide", "Décider / escalader un litige", True),
    # QHSE / RH
    Perm("qhse:read", "Consulter le QHSE"),
    Perm("qhse:write", "Gérer incidents / inspections / actions"),
    Perm("hr:read", "Consulter les RH", True),
    Perm("hr:write", "Gérer les employés / présences", True),
    Perm("hr:payroll", "Gérer la paie", True),
    Perm("attendance:self", "Pointer sa présence"),
    # GED / BIM
    Perm("documents:read", "Consulter la GED"),
    Perm("documents:write", "Déposer / versionner des documents"),
    Perm("documents:approve", "Approuver des documents"),
    Perm("documents:publish", "Publier des documents"),
    Perm("documents:confidential", "Accéder aux documents confidentiels", True),
    Perm("documents:very_sensitive", "Accéder aux documents très sensibles", True),
    Perm("bim:read", "Consulter le Hub BIM"),
    Perm("bim:write", "Déposer des maquettes / annoter"),
    Perm("bim:coordinate", "Gérer issues / clashes"),
    Perm("bim:validate", "Valider / publier une version BIM"),
    Perm("configurator:manage", "Gérer catalogue matériaux / configurateur"),
    # Communication
    Perm("chat:use", "Utiliser la messagerie"),
    Perm("calls:use", "Passer des appels audio / vidéo"),
    Perm("calls:record", "Enregistrer des appels (avec consentement)", True),
    # Acquisition / contenus
    Perm("cms:read", "Consulter le CMS"),
    Perm("cms:write", "Éditer les contenus"),
    Perm("cms:review", "Relire / valider les contenus"),
    Perm("cms:publish", "Publier les contenus"),
    Perm("media:write", "Gérer la médiathèque"),
    Perm("seo:write", "Gérer le SEO / redirections"),
    Perm("analytics:read", "Consulter les statistiques"),
    Perm("newsletter:read", "Consulter la newsletter"),
    Perm("newsletter:write", "Gérer segments / modèles / campagnes"),
    Perm("newsletter:send", "Envoyer les campagnes"),
    # Support / agenda / rapports / IA
    Perm("support:read", "Consulter le SAV"),
    Perm("support:write", "Traiter les tickets SAV"),
    Perm("agenda:read", "Consulter l'agenda"),
    Perm("agenda:write", "Gérer l'agenda"),
    Perm("reports:read", "Consulter les rapports"),
    Perm("reports:export", "Exporter des données", True),
    Perm("ai:use", "Utiliser les assistants IA"),
    Perm("notifications:manage", "Gérer modèles / règles de notification"),
    # Administration / sécurité
    Perm("users:read", "Consulter les utilisateurs"),
    Perm("users:write", "Gérer les utilisateurs", True),
    Perm("roles:manage", "Gérer rôles et permissions", True),
    Perm("settings:read", "Consulter les paramètres"),
    Perm("settings:write", "Modifier les paramètres", True),
    Perm("integrations:manage", "Configurer les intégrations / secrets", True),
    Perm("security:read", "Consulter la sécurité (sessions, événements)", True),
    Perm("security:manage", "Gérer clés API / webhooks / sessions", True),
    Perm("audit:read", "Consulter le journal d'audit", True),
    Perm("backups:run", "Lancer des sauvegardes", True),
    Perm("backups:restore", "Restaurer (break-glass)", True),
    Perm("maintenance:manage", "Gérer le mode maintenance", True),
    # Portails externes
    Perm("client:portal", "Accéder à l'espace client"),
    Perm("client:pay", "Payer en ligne"),
    Perm("client:decide", "Valider des décisions / matériaux"),
    Perm("extranet:supplier", "Accéder à l'extranet fournisseur"),
    Perm("extranet:subcontractor", "Accéder à l'extranet sous-traitant"),
]

PERMISSION_CODES = {p.code for p in PERMISSIONS}

_READ_INTERNAL = [
    "dashboard:view",
    "projects:read",
    "planning:read",
    "documents:read",
    "bim:read",
    "chat:use",
    "calls:use",
    "agenda:read",
    "support:read",
    "qhse:read",
    "ai:use",
]


def _all() -> list[str]:
    return sorted(PERMISSION_CODES)


def _without(*excluded: str) -> list[str]:
    return sorted(PERMISSION_CODES - set(excluded))


@dataclass(frozen=True)
class RoleDef:
    code: str
    name: str
    audience: str  # internal / client / partner
    permissions: tuple[str, ...]
    global_scope: bool = False
    mfa_required: bool = False
    description: str = ""


DEFAULT_ROLES: list[RoleDef] = [
    RoleDef(
        "ADMIN",
        "Administrateur / DG",
        "internal",
        tuple(_all()),
        True,
        True,
        "Accès global, configuration, sécurité, audit.",
    ),
    RoleDef(
        "DIRECTION",
        "Direction / Responsable",
        "internal",
        tuple(
            _without(
                "backups:restore",
                "roles:manage",
                "integrations:manage",
                "maintenance:manage",
                "client:portal",
                "client:pay",
                "client:decide",
                "extranet:supplier",
                "extranet:subcontractor",
                "attendance:self",
            )
        ),
        True,
        True,
        "Supervision, KPI, validations critiques.",
    ),
    RoleDef(
        "CHEF_PROJET",
        "Chef de projet / Conducteur de travaux",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "projects:write",
                        "projects:members",
                        "projects:publish_client",
                        "site:report",
                        "planning:write",
                        "finance:read",
                        "billing:read",
                        "procurement:read",
                        "procurement:request",
                        "procurement:approve",
                        "procurement:order",
                        "suppliers:read",
                        "deliveries:read",
                        "deliveries:receive",
                        "inventory:read",
                        "equipment:read",
                        "subcontracting:read",
                        "subcontracting:write",
                        "subcontracting:validate",
                        "disputes:read",
                        "disputes:write",
                        "qhse:write",
                        "documents:write",
                        "documents:approve",
                        "documents:publish",
                        "documents:confidential",
                        "bim:write",
                        "bim:coordinate",
                        "bim:validate",
                        "configurator:manage",
                        "support:write",
                        "agenda:write",
                        "reports:read",
                        "reports:export",
                        "crm:read",
                        "users:read",
                        "attendance:self",
                    ]
                )
            )
        ),
        False,
        False,
        "Projet assigné, budget, planning, partenaires.",
    ),
    RoleDef(
        "ARCHITECTE",
        "Architecte",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "documents:write",
                        "documents:approve",
                        "bim:write",
                        "bim:coordinate",
                        "bim:validate",
                        "configurator:manage",
                        "agenda:write",
                        "attendance:self",
                    ]
                )
            )
        ),
        False,
        False,
        "Architecture, BIM, GED technique, issues.",
    ),
    RoleDef(
        "INGENIEUR",
        "Ingénieur Structure / MEP",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "documents:write",
                        "documents:approve",
                        "bim:write",
                        "bim:coordinate",
                        "bim:validate",
                        "agenda:write",
                        "attendance:self",
                    ]
                )
            )
        ),
        False,
        False,
        "Discipline, plans, issues, validations.",
    ),
    RoleDef(
        "CHEF_CHANTIER",
        "Chef de chantier",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "site:report",
                        "procurement:read",
                        "procurement:request",
                        "deliveries:read",
                        "deliveries:receive",
                        "inventory:read",
                        "inventory:write",
                        "equipment:read",
                        "qhse:write",
                        "bim:write",
                        "documents:write",
                        "subcontracting:read",
                        "attendance:self",
                        "hr:read",
                    ]
                )
            )
        ),
        False,
        False,
        "Terrain, réception, QHSE, stock, photos.",
    ),
    RoleDef(
        "TECHNICIEN",
        "Artisan / Technicien",
        "internal",
        (
            "dashboard:view",
            "projects:read",
            "planning:read",
            "documents:read",
            "bim:read",
            "site:report",
            "chat:use",
            "calls:use",
            "qhse:read",
            "attendance:self",
            "support:read",
        ),
        False,
        False,
        "Tâches assignées, plans autorisés, QR.",
    ),
    RoleDef(
        "COMMERCIAL",
        "Commercial",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "crm:read",
                        "crm:write",
                        "crm:assign",
                        "crm:contracts",
                        "newsletter:read",
                        "analytics:read",
                        "agenda:write",
                        "reports:read",
                        "attendance:self",
                    ]
                )
            )
        ),
        True,
        False,
        "Leads, opportunités, devis, contrats.",
    ),
    RoleDef(
        "MARKETING",
        "Marketing / Éditeur CMS",
        "internal",
        (
            "dashboard:view",
            "cms:read",
            "cms:write",
            "cms:review",
            "cms:publish",
            "media:write",
            "seo:write",
            "analytics:read",
            "newsletter:read",
            "newsletter:write",
            "newsletter:send",
            "crm:read",
            "chat:use",
            "calls:use",
            "agenda:read",
            "ai:use",
            "reports:read",
        ),
        True,
        False,
        "Vitrine, médiathèque, SEO, analytics, newsletter.",
    ),
    RoleDef(
        "ACHETEUR",
        "Acheteur / Logistique",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "procurement:read",
                        "procurement:request",
                        "procurement:approve",
                        "procurement:order",
                        "suppliers:read",
                        "suppliers:write",
                        "deliveries:read",
                        "deliveries:receive",
                        "inventory:read",
                        "inventory:write",
                        "billing:read",
                        "equipment:read",
                        "reports:read",
                        "reports:export",
                        "disputes:read",
                        "attendance:self",
                    ]
                )
            )
        ),
        True,
        False,
        "Demandes, commandes, fournisseurs, livraisons, stocks.",
    ),
    RoleDef(
        "MAGASINIER",
        "Magasinier",
        "internal",
        (
            "dashboard:view",
            "projects:read",
            "inventory:read",
            "inventory:write",
            "deliveries:read",
            "deliveries:receive",
            "procurement:read",
            "equipment:read",
            "equipment:write",
            "chat:use",
            "calls:use",
            "attendance:self",
        ),
        True,
        False,
        "Entrées/sorties, emplacements, inventaires.",
    ),
    RoleDef(
        "QHSE",
        "Responsable QHSE",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "qhse:write",
                        "hr:read",
                        "equipment:read",
                        "reports:read",
                        "reports:export",
                        "attendance:self",
                    ]
                )
            )
        ),
        True,
        False,
        "EPI, inspections, incidents, actions correctives.",
    ),
    RoleDef(
        "FINANCE",
        "Finance / Comptabilité",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "dashboard:direction",
                        "finance:read",
                        "finance:write",
                        "finance:approve",
                        "finance:pay",
                        "finance:reconcile",
                        "billing:read",
                        "billing:write",
                        "billing:validate",
                        "procurement:read",
                        "procurement:approve",
                        "suppliers:read",
                        "deliveries:read",
                        "subcontracting:read",
                        "disputes:read",
                        "disputes:write",
                        "hr:read",
                        "hr:payroll",
                        "reports:read",
                        "reports:export",
                        "crm:read",
                        "crm:contracts",
                        "attendance:self",
                    ]
                )
            )
        ),
        True,
        True,
        "Factures, paiements, rapprochements.",
    ),
    RoleDef(
        "RH",
        "Ressources humaines",
        "internal",
        tuple(
            sorted(
                set(
                    [
                        *_READ_INTERNAL,
                        "hr:read",
                        "hr:write",
                        "hr:payroll",
                        "users:read",
                        "reports:read",
                        "reports:export",
                        "attendance:self",
                    ]
                )
            )
        ),
        True,
        False,
        "Employés, présence, paie, docs RH.",
    ),
    RoleDef(
        "SOUS_TRAITANT",
        "Sous-traitant",
        "partner",
        (
            "extranet:subcontractor",
            "chat:use",
            "calls:use",
            "documents:read",
            "bim:read",
            "planning:read",
            "projects:read",
        ),
        False,
        False,
        "Contrat, lots, situations, factures, litiges.",
    ),
    RoleDef(
        "FOURNISSEUR",
        "Fournisseur",
        "partner",
        ("extranet:supplier", "chat:use"),
        False,
        False,
        "Bons de commande, confirmation, expédition/livraison, documents.",
    ),
    RoleDef(
        "CLIENT",
        "Client",
        "client",
        (
            "client:portal",
            "client:pay",
            "client:decide",
            "chat:use",
            "calls:use",
        ),
        False,
        False,
        "Ses projets, documents publiés, décisions, finance, 3D, messagerie.",
    ),
]

ROLE_CODES = {r.code for r in DEFAULT_ROLES}
INTERNAL_ROLE_CODES = {r.code for r in DEFAULT_ROLES if r.audience == "internal"}


def validate_catalog() -> None:
    for role in DEFAULT_ROLES:
        unknown = set(role.permissions) - PERMISSION_CODES
        if unknown:
            raise RuntimeError(f"Permissions inconnues pour {role.code}: {sorted(unknown)}")


validate_catalog()
