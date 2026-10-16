"""Contenu éditorial initial de la vitrine (positionnement marketing GLOBUS ENGINEERING).

Mécanisme de vente : CONFIANCE + PROJECTION + PREUVE, fondé sur la réassurance par la maîtrise du projet.
Promesse : « Vous avez un projet. Nous maîtrisons sa réalisation. » — signature « Concevoir. Calculer. Construire.
Contrôler. » — appel à l'action principal « Décrire mon projet ».
Parcours : ATTIRER (projection) → ÉDUQUER (expertise) → RASSURER (preuve) → RÉDUIRE LE RISQUE (transparence) →
CONVERTIR (accompagnement).

Ce module ne crée QUE du texte éditorial (aucun chiffre, projet, témoignage ou média inventé : ces éléments
restent vides tant que GLOBUS ne les a pas saisis — la vitrine affiche alors un état vide explicite, V4-CMS-06).
Idempotent : un contenu existant (même route / slug) n'est jamais écrasé.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import Principal
from app.modules.cms import models as m
from app.modules.cms import service
from app.modules.cms.schemas import PageIn

log = logging.getLogger("globus.seed.content")

CTA_DESCRIBE = {
    "label": "Décrire mon projet",
    "href": "/decrire-mon-projet",
    "style": "accent",
    "track_id": "cta_describe",
}
CTA_CALL = {"label": "Être rappelé", "href": "/contact#rappel", "style": "secondary", "track_id": "cta_callback"}
CTA_WHATSAPP = {"label": "WhatsApp", "href": "/contact#whatsapp", "style": "whatsapp", "track_id": "cta_whatsapp"}

UNIVERSES: list[dict[str, Any]] = [
    {
        "key": "HOME",
        "slug": "home",
        "name": "GLOBUS Home",
        "icon": "home",
        "accent": "#385AA6",
        "tagline": "Voir sa maison avant de la construire.",
        "mechanism": "Projection + Réassurance",
        "target": "Familles et particuliers qui construisent leur résidence principale",
        "promise": "Vous visualisez votre future maison en 3D, vous connaissez le budget et le planning avant le "
        "premier coup de pioche — puis vous suivez chaque étape depuis votre espace client.",
        "prospect_wants": "Être rassuré sur le budget, le délai et la qualité ; ne pas se faire surprendre par les "
        "imprévus ; comprendre chaque décision.",
        "description": "De l'esquisse à la remise des clés : conception architecturale, calcul de structure, permis de "
        "construire, construction et contrôle qualité, avec une maquette 3D pour choisir vos finitions "
        "en connaissance de cause.",
        "funnel": [
            "Terrain et besoins",
            "Conception et esquisse 3D",
            "Budget et planning maîtrisés",
            "Permis",
            "Construction suivie",
            "Remise des clés et garanties",
        ],
    },
    {
        "key": "BUSINESS",
        "slug": "business",
        "name": "GLOBUS Business",
        "icon": "building",
        "accent": "#385AA6",
        "tagline": "Avant de construire, sachez exactement ce que votre terrain peut vous rapporter.",
        "mechanism": "ROI + Maîtrise",
        "target": "Investisseurs, promoteurs et entreprises",
        "promise": "Étude de faisabilité, potentiel constructible, rentabilité prévisionnelle et pilotage rigoureux "
        "des coûts : vous investissez sur des chiffres, pas sur des promesses.",
        "prospect_wants": "Un retour sur investissement mesurable, des coûts tenus, des délais respectés et un "
        "interlocuteur unique.",
        "description": "Immeubles de rapport, bureaux, commerces, entrepôts : nous transformons un terrain en actif "
        "rentable avec une ingénierie maîtrisée et un reporting financier transparent.",
        "funnel": [
            "Analyse du terrain",
            "Faisabilité et rentabilité",
            "Conception optimisée",
            "Engagement budgétaire",
            "Construction pilotée",
            "Mise en exploitation",
        ],
    },
    {
        "key": "PREMIUM",
        "slug": "premium",
        "name": "GLOBUS Premium",
        "icon": "gem",
        "accent": "#FB8C43",
        "tagline": "Imaginez-le. Visualisez-le. Exigez-le.",
        "mechanism": "Projection + Exclusivité + Preuve",
        "target": "Clients exigeants : villas d'architecte et résidences de prestige",
        "promise": "Une architecture sur mesure, des matériaux d'exception choisis en 3D et une exécution "
        "documentée à chaque étape, jusqu'au moindre détail de finition.",
        "prospect_wants": "L'exclusivité, la qualité d'exécution, la confidentialité et la preuve que chaque "
        "engagement est tenu.",
        "description": "Conception d'auteur, configurateur de matériaux, visites immersives et contrôle qualité "
        "renforcé : votre projet est conduit avec l'exigence qu'il mérite.",
        "funnel": [
            "Rencontre et intentions",
            "Esquisse d'architecte",
            "Immersion 3D et matériaux",
            "Ingénierie",
            "Exécution documentée",
            "Livraison d'exception",
        ],
    },
    {
        "key": "DIASPORA",
        "slug": "diaspora",
        "name": "GLOBUS Diaspora",
        "icon": "globe",
        "accent": "#FB8C43",
        "tagline": "Vous êtes à Paris. Votre chantier est à Douala. Vous gardez le contrôle.",
        "mechanism": "Confiance + Transparence + Contrôle",
        "target": "Camerounais de la diaspora qui construisent au pays",
        "promise": "Un tableau de bord en ligne, des photos géolocalisées et datées, le budget en temps réel, des "
        "validations à distance sécurisées et des appels vidéo avec votre chef de projet.",
        "prospect_wants": "Ne plus dépendre d'intermédiaires, voir où va chaque franc, sécuriser le foncier et "
        "décider à distance en toute confiance.",
        "description": "Construire à distance sans angoisse : chaque paiement est tracé, chaque étape est prouvée, "
        "chaque décision est validée par vous, où que vous soyez.",
        "funnel": [
            "Sécurisation foncière",
            "Conception à distance",
            "Budget et échéancier",
            "Suivi en ligne",
            "Validations sécurisées",
            "Remise des clés (ou visite vidéo)",
        ],
    },
    {
        "key": "ENGINEERING",
        "slug": "engineering",
        "name": "GLOBUS Engineering Services",
        "icon": "compass",
        "accent": "#385AA6",
        "tagline": "L'ingénierie qui sécurise vos projets.",
        "mechanism": "Expertise + Preuve",
        "target": "Maîtres d'ouvrage, architectes, entreprises et institutions",
        "promise": "Études de structure, ingénierie des fluides, coordination BIM et contrôle d'exécution, "
        "livrées avec des notes de calcul et des plans conformes.",
        "prospect_wants": "Des études fiables, conformes aux normes, livrées à temps et défendables devant un "
        "bureau de contrôle.",
        "description": "Une équipe d'ingénieurs qui calcule, coordonne et contrôle — en mission complète ou en "
        "appui de vos équipes.",
        "funnel": [
            "Cahier des charges",
            "Relevés et données",
            "Études et calculs",
            "Coordination BIM",
            "Livrables vérifiés",
            "Assistance chantier",
        ],
    },
]

OFFERS: dict[str, list[dict[str, Any]]] = {
    "HOME": [
        {
            "slug": "maison-cle-en-main",
            "name": "Maison clé en main",
            "icon": "key",
            "summary": "Conception, permis, construction et remise des clés avec un interlocuteur unique.",
            "deliverables": [
                "Plans et maquette 3D",
                "Note de calcul structure",
                "Dossier de permis",
                "Budget détaillé",
                "Planning",
                "Suivi en ligne du chantier",
                "Procès-verbal de réception",
            ],
            "steps": [
                "Étude du terrain",
                "Esquisse et 3D",
                "Avant-projet chiffré",
                "Permis",
                "Construction",
                "Réception",
            ],
            "ideal_for": "Première construction, terrain disponible, besoin d'un pilotage complet.",
        },
        {
            "slug": "extension-renovation",
            "name": "Extension et rénovation",
            "icon": "hammer",
            "summary": "Agrandir ou moderniser votre maison sans mettre en péril la structure existante.",
            "deliverables": [
                "Diagnostic de l'existant",
                "Étude de faisabilité structurelle",
                "Plans",
                "Chiffrage",
                "Travaux suivis",
            ],
            "steps": ["Diagnostic", "Conception", "Chiffrage", "Travaux", "Contrôle"],
            "ideal_for": "Ajout d'un niveau, d'une pièce, réhabilitation complète.",
        },
    ],
    "BUSINESS": [
        {
            "slug": "faisabilite-rentabilite",
            "name": "Faisabilité et rentabilité foncière",
            "icon": "chart",
            "summary": "Ce que votre terrain peut accueillir, ce que cela coûte et ce que cela rapporte.",
            "deliverables": [
                "Analyse réglementaire",
                "Scénarios d'implantation",
                "Estimation des coûts",
                "Rentabilité prévisionnelle",
                "Recommandation argumentée",
            ],
            "steps": ["Collecte des données", "Scénarios", "Chiffrage", "Analyse financière", "Restitution"],
            "ideal_for": "Investisseur qui veut décider sur des chiffres avant d'engager un budget.",
        },
        {
            "slug": "immeuble-de-rapport",
            "name": "Immeuble de rapport et locaux professionnels",
            "icon": "building",
            "summary": "Concevoir et construire un actif rentable, avec un reporting de coûts transparent.",
            "deliverables": [
                "Programme optimisé",
                "Études complètes",
                "Engagements budgétaires suivis",
                "Reporting mensuel",
                "Livraison et documents d'exploitation",
            ],
            "steps": ["Programme", "Conception", "Consultation", "Construction pilotée", "Livraison"],
            "ideal_for": "Immeubles locatifs, bureaux, commerces, entrepôts.",
        },
    ],
    "PREMIUM": [
        {
            "slug": "villa-architecte",
            "name": "Villa d'architecte sur mesure",
            "icon": "gem",
            "summary": "Une architecture singulière, des finitions choisies en 3D, une exécution sans compromis.",
            "deliverables": [
                "Conception d'auteur",
                "Configurateur de matériaux",
                "Visite immersive",
                "Contrôle qualité renforcé",
                "Dossier des ouvrages exécutés",
            ],
            "steps": ["Intentions", "Esquisse", "Immersion 3D", "Ingénierie", "Exécution", "Livraison"],
            "ideal_for": "Résidence principale ou secondaire haut de gamme.",
        },
        {
            "slug": "design-finitions",
            "name": "Design intérieur et finitions d'exception",
            "icon": "palette",
            "summary": "Matériaux, ambiances et détails visualisés avant d'être posés, avec impact prix et délai immédiat.",
            "deliverables": [
                "Scénarios de finitions",
                "Comparatif prix / délai",
                "Validation sécurisée",
                "Suivi de pose",
            ],
            "steps": ["Choix guidés", "Visualisation 3D", "Comparaison", "Validation", "Mise en œuvre"],
            "ideal_for": "Projets qui exigent une cohérence esthétique totale.",
        },
    ],
    "DIASPORA": [
        {
            "slug": "construire-a-distance",
            "name": "Construire au pays à distance",
            "icon": "globe",
            "summary": "Tableau de bord, photos géolocalisées, budget en temps réel et appels vidéo : vous gardez la main.",
            "deliverables": [
                "Espace client sécurisé",
                "Rapports photo datés et géolocalisés",
                "Suivi budgétaire",
                "Validations par code OTP",
                "Réunions vidéo avec le chef de projet",
            ],
            "steps": [
                "Échange vidéo",
                "Conception",
                "Budget et échéancier",
                "Chantier suivi en ligne",
                "Remise des clés",
            ],
            "ideal_for": "Camerounais vivant à l'étranger qui veulent construire sans intermédiaire opaque.",
        },
        {
            "slug": "dossier-tranquillite",
            "name": "Dossier Tranquillité (sécurisation foncière)",
            "icon": "shield",
            "summary": "Titre, permis, actes et vérifications : votre dossier administratif suivi, prouvé et daté.",
            "deliverables": [
                "Inventaire des pièces",
                "Vérifications et statuts",
                "Échéances suivies",
                "Preuves archivées",
                "Responsable GLOBUS identifié",
            ],
            "steps": ["Collecte", "Vérifications", "Démarches", "Suivi des échéances", "Archivage"],
            "ideal_for": "Sécuriser un terrain avant d'investir dans la construction.",
        },
    ],
    "ENGINEERING": [
        {
            "slug": "etudes-structure",
            "name": "Études de structure béton armé",
            "icon": "beam",
            "summary": "Notes de calcul, plans de coffrage et de ferraillage conformes, prêts pour le bureau de contrôle.",
            "deliverables": [
                "Hypothèses et descente de charges",
                "Notes de calcul",
                "Plans de coffrage",
                "Plans de ferraillage",
                "Métrés",
            ],
            "steps": ["Données d'entrée", "Modélisation", "Calculs", "Plans", "Vérification"],
            "ideal_for": "Architectes, entreprises et maîtres d'ouvrage.",
        },
        {
            "slug": "bim-coordination",
            "name": "BIM, coordination et synthèse",
            "icon": "cube",
            "summary": "Maquettes fédérées, détection de conflits et coordination inter-métiers avant le chantier.",
            "deliverables": [
                "Maquettes par discipline",
                "Rapports de conflits",
                "Réunions de synthèse",
                "Plans coordonnés",
            ],
            "steps": ["Convention BIM", "Modélisation", "Fédération", "Détection de conflits", "Résolution"],
            "ideal_for": "Projets multi-lots où chaque erreur évitée en amont coûte moins cher qu'en chantier.",
        },
        {
            "slug": "controle-suivi-chantier",
            "name": "Contrôle et suivi d'exécution",
            "icon": "clipboard",
            "summary": "Visites, contrôles qualité, réception des ouvrages et rapports opposables.",
            "deliverables": ["Plan de contrôle", "Rapports de visite", "Fiches de non-conformité", "PV de réception"],
            "steps": ["Plan de contrôle", "Visites", "Rapports", "Levée des réserves", "Réception"],
            "ideal_for": "Maîtres d'ouvrage qui veulent une garantie indépendante de qualité.",
        },
    ],
}

EXPERTISES = [
    (
        "architecture",
        "Architecture",
        "architecture",
        "Des espaces pensés pour vos usages, votre budget et votre terrain.",
    ),
    (
        "structure",
        "Ingénierie structure",
        "structure",
        "Le calcul qui garantit la solidité et la durabilité des ouvrages.",
    ),
    ("fluides-mep", "Électricité, plomberie et CVC", "electricite", "Des réseaux dimensionnés, coordonnés et sûrs."),
    (
        "bim",
        "BIM et maquette numérique",
        "architecture",
        "Une représentation commune du projet pour décider avant de construire.",
    ),
    ("topographie-vrd", "Topographie et VRD", "vrd", "Relevés, implantation, voiries et réseaux divers."),
    (
        "pilotage-chantier",
        "Pilotage et contrôle de chantier",
        "securite",
        "Planning, qualité, sécurité et coûts maîtrisés.",
    ),
]

SERVICES = [
    ("conception-architecturale", "Conception architecturale", "architecture", "Esquisse, avant-projet, projet et 3D."),
    (
        "permis-de-construire",
        "Dossier de permis de construire",
        "architecture",
        "Montage et suivi du dossier administratif.",
    ),
    ("etude-structure", "Étude de structure", "ingenierie", "Descente de charges, calculs et plans d'exécution."),
    ("etudes-fluides", "Études fluides", "ingenierie", "Électricité, plomberie, climatisation et ventilation."),
    ("maquette-bim", "Maquette BIM et synthèse", "ingenierie", "Modélisation, fédération et détection de conflits."),
    (
        "construction-tous-corps",
        "Construction tous corps d'état",
        "construction",
        "Gros œuvre, second œuvre, finitions.",
    ),
    (
        "renovation-rehabilitation",
        "Rénovation et réhabilitation",
        "renovation",
        "Diagnostic, renforcement et modernisation.",
    ),
    ("gestion-de-projet", "Gestion de projet et OPC", "management", "Ordonnancement, pilotage, coordination."),
]

FAQ: list[tuple[str, str, list[tuple[str, str, str | None]]]] = [
    (
        "demarrer",
        "Démarrer un projet",
        [
            (
                "Par où commencer si je n'ai qu'une idée ?",
                "<p>Décrivez votre projet en quelques minutes : type d'ouvrage, localisation, budget envisagé et délai. "
                "Un conseiller vous rappelle pour clarifier vos besoins et vous orienter vers l'offre adaptée.</p>",
                None,
            ),
            (
                "Faut-il déjà posséder un terrain ?",
                "<p>Non. Nous pouvons vous accompagner dans l'analyse d'un terrain avant l'achat et dans la sécurisation "
                "foncière (Dossier Tranquillité).</p>",
                None,
            ),
        ],
    ),
    (
        "budget-paiements",
        "Budget et paiements",
        [
            (
                "Comment le budget est-il établi et suivi ?",
                "<p>Un devis détaillé est établi après étude. Pendant le chantier, vous suivez dans votre espace client les "
                "appels de fonds, les paiements, les reçus et les éventuels avenants, chacun validé par vous.</p>",
                None,
            ),
            (
                "Quels moyens de paiement sont acceptés ?",
                "<p>Virement bancaire, Mobile Money et carte bancaire selon les prestataires disponibles. Chaque paiement "
                "est tracé et fait l'objet d'un reçu.</p>",
                None,
            ),
            (
                "Que se passe-t-il si je modifie un choix en cours de chantier ?",
                "<p>L'impact sur le prix et le délai vous est présenté avant toute décision. Vous validez par code "
                "sécurisé et un avenant est établi : rien n'est modifié sans votre accord.</p>",
                None,
            ),
        ],
    ),
    (
        "diaspora",
        "Construire depuis l'étranger",
        [
            (
                "Comment suivre mon chantier à distance ?",
                "<p>Votre espace client présente l'avancement, les photos datées et géolocalisées, le budget, les "
                "documents et la messagerie avec l'équipe. Des appels vidéo peuvent être organisés.</p>",
                "DIASPORA",
            ),
            (
                "Comment valider une décision sans être sur place ?",
                "<p>Chaque décision vous est présentée avec son impact, puis validée par un code à usage unique envoyé "
                "par e-mail, SMS ou WhatsApp. La validation est horodatée et archivée.</p>",
                "DIASPORA",
            ),
        ],
    ),
    (
        "qualite-garanties",
        "Qualité et garanties",
        [
            (
                "Comment la qualité est-elle contrôlée ?",
                "<p>Contrôles à chaque étape clé, rapports de visite, réception des ouvrages et levée des réserves "
                "documentées.</p>",
                None,
            ),
            (
                "Que se passe-t-il après la livraison ?",
                "<p>Votre espace client reste ouvert : déclarez une demande de service après-vente, suivez l'intervention "
                "et consultez vos garanties.</p>",
                None,
            ),
        ],
    ),
]

HELP: list[tuple[str, str, str, list[tuple[str, str, str, str]]]] = [
    (
        "espace-client",
        "Votre espace client",
        "user",
        [
            (
                "payer-un-appel-de-fonds",
                "Payer un appel de fonds en ligne",
                "client",
                "Rubrique Finances → choisissez l'appel de fonds → « Payer » → sélectionnez le moyen de paiement. Le reçu "
                "est disponible dès la confirmation du paiement.",
            ),
            (
                "valider-une-decision",
                "Valider une décision ou un choix de matériau",
                "client",
                "Rubrique Validations → ouvrez la décision → vérifiez l'impact prix et délai → demandez le code → saisissez "
                "le code reçu. La décision est alors figée et horodatée.",
            ),
            (
                "consulter-mes-documents",
                "Consulter et télécharger mes documents",
                "client",
                "Rubrique Documents : seules les versions publiées et à jour sont affichées ; chaque document dispose d'un "
                "QR d'authenticité.",
            ),
        ],
    ),
    (
        "partenaires",
        "Fournisseurs et sous-traitants",
        "handshake",
        [
            (
                "confirmer-un-bon-de-commande",
                "Confirmer un bon de commande",
                "partner",
                "Ouvrez le lien sécurisé reçu par WhatsApp ou e-mail, ou votre extranet : confirmez, refusez ou proposez "
                "une contre-offre, puis annoncez l'expédition.",
            ),
            (
                "deposer-une-situation",
                "Déposer une situation de travaux",
                "partner",
                "Extranet → Marchés → Situations : saisissez les quantités de la période, joignez les photos probatoires "
                "et soumettez. Le contrôle terrain précède la validation.",
            ),
        ],
    ),
]

BLOG_CATEGORIES = [
    ("projection", "Projection", "Imaginer et visualiser son futur projet."),
    ("expertise", "Expertise", "Comprendre les choix techniques qui font la différence."),
    ("preuve", "Preuve", "Des réalisations documentées, étape par étape."),
    ("reassurance", "Réassurance", "Garanties, méthodes et engagements."),
    ("transparence", "Transparence", "Budget, planning et suivi : tout voir, tout comprendre."),
]


def _hero(title: str, subtitle: str, eyebrow: str | None = None) -> dict[str, Any]:
    return {
        "kind": "hero",
        "layout": "minimal",
        "eyebrow": eyebrow,
        "title": title,
        "subtitle": subtitle,
        "ctas": [CTA_DESCRIBE, CTA_CALL],
        "trust_points": ["Budget maîtrisé", "Suivi en ligne", "Décisions validées par vous"],
    }


PAGES: list[dict[str, Any]] = [
    {
        "route_key": "home",
        "path": "/",
        "title": "Accueil",
        "template": "landing",
        "seo": {
            "title": "GLOBUS ENGINEERING — Concevoir. Calculer. Construire. Contrôler.",
            "description": "Construction, ingénierie et BIM au Cameroun : visualisez votre projet en 3D, maîtrisez "
            "budget et délais, suivez votre chantier en ligne. Décrivez votre projet.",
            "sitemap_priority": "1.0",
            "sitemap_changefreq": "weekly",
        },
        "sections": [
            {
                "key": "hero",
                "blocks": [
                    _hero(
                        "Vous avez un projet. Nous maîtrisons sa réalisation.",
                        "Concevoir. Calculer. Construire. Contrôler. De l'idée à la remise des clés, "
                        "vous voyez, vous comprenez, vous décidez.",
                        "GLOBUS ENGINEERING",
                    )
                ],
            },
            {
                "key": "univers",
                "title": "Votre projet, votre univers",
                "blocks": [
                    {
                        "kind": "universes",
                        "title": "Choisissez l'accompagnement qui vous ressemble",
                        "subtitle": "Une même exigence, cinq façons de construire avec nous.",
                    }
                ],
            },
            {
                "key": "methode",
                "title": "La méthode GLOBUS",
                "blocks": [
                    {
                        "kind": "steps",
                        "title": "Concevoir. Calculer. Construire. Contrôler.",
                        "style": "cards",
                        "subtitle": "Chaque étape est visible, documentée et validée.",
                        "items": [
                            {
                                "title": "Concevoir",
                                "icon": "pencil",
                                "text": "Architecture et maquette 3D : vous voyez votre projet avant qu'il n'existe.",
                            },
                            {
                                "title": "Calculer",
                                "icon": "calculator",
                                "text": "Structure, fluides et budget : chaque choix est chiffré, chaque risque anticipé.",
                            },
                            {
                                "title": "Construire",
                                "icon": "crane",
                                "text": "Des équipes qualifiées, des approvisionnements tracés, un planning suivi.",
                            },
                            {
                                "title": "Contrôler",
                                "icon": "shield-check",
                                "text": "Contrôles qualité, preuves photo et validation de chaque étape par vous.",
                            },
                        ],
                    }
                ],
            },
            {
                "key": "confiance",
                "title": "Pourquoi nous faire confiance",
                "blocks": [
                    {
                        "kind": "trust",
                        "title": "La réassurance par la maîtrise du projet",
                        "items": [
                            {
                                "icon": "eye",
                                "title": "Projection",
                                "text": "Maquette 3D, visites immersives et choix de matériaux avec impact prix et délai immédiat.",
                            },
                            {
                                "icon": "award",
                                "title": "Expertise",
                                "text": "Architectes et ingénieurs qui conçoivent, calculent et coordonnent en BIM.",
                            },
                            {
                                "icon": "camera",
                                "title": "Preuve",
                                "text": "Photos datées et géolocalisées, rapports de chantier, documents versionnés.",
                            },
                            {
                                "icon": "lock",
                                "title": "Transparence",
                                "text": "Budget, paiements et décisions consultables en ligne, validés par code sécurisé.",
                            },
                        ],
                    }
                ],
            },
            {"key": "chiffres", "blocks": [{"kind": "stats", "title": "En chiffres", "source": "key_figures"}]},
            {
                "key": "realisations",
                "blocks": [{"kind": "projects", "title": "Nos réalisations", "mode": "featured", "limit": 6}],
            },
            {
                "key": "temoignages",
                "blocks": [
                    {"kind": "testimonials", "title": "Ils nous ont confié leur projet", "mode": "featured", "limit": 6}
                ],
            },
            {
                "key": "parcours",
                "title": "Comment ça se passe",
                "blocks": [
                    {
                        "kind": "steps",
                        "style": "funnel",
                        "title": "Votre parcours avec GLOBUS",
                        "items": [
                            {"title": "Vous décrivez votre projet", "text": "En quelques minutes, sans engagement."},
                            {
                                "title": "Nous vous rappelons",
                                "text": "Un conseiller clarifie vos besoins et vos priorités.",
                            },
                            {"title": "Vous visualisez et chiffrez", "text": "Esquisse, 3D, budget et planning."},
                            {
                                "title": "Vous décidez",
                                "text": "Chaque engagement est validé par vous, en toute transparence.",
                            },
                            {
                                "title": "Nous réalisons et prouvons",
                                "text": "Suivi en ligne jusqu'à la remise des clés.",
                            },
                        ],
                    }
                ],
            },
            {"key": "faq", "blocks": [{"kind": "faq", "title": "Questions fréquentes", "limit": 6}]},
            {
                "key": "cta-final",
                "blocks": [
                    {
                        "kind": "cta",
                        "title": "Votre projet mérite d'être maîtrisé.",
                        "text": "Décrivez-le maintenant : un conseiller vous recontacte rapidement.",
                        "theme": "accent",
                        "ctas": [CTA_DESCRIBE, CTA_WHATSAPP],
                    }
                ],
            },
        ],
    },
    {
        "route_key": "about",
        "path": "/a-propos",
        "title": "À propos",
        "seo": {
            "title": "À propos de GLOBUS ENGINEERING",
            "description": "Bureau d'études, d'ingénierie et entreprise de construction : notre mission est de vous "
            "faire construire en toute confiance, avec méthode et transparence.",
        },
        "sections": [
            {
                "key": "hero",
                "blocks": [
                    _hero(
                        "Construire avec méthode, prouver avec transparence.",
                        "GLOBUS ENGINEERING réunit architectes, ingénieurs et bâtisseurs autour d'une "
                        "promesse : vous permettre de construire sans angoisse.",
                        "Qui sommes-nous",
                    )
                ],
            },
            {
                "key": "mission",
                "blocks": [
                    {
                        "kind": "rich_text",
                        "html": "<h2>Notre mission</h2><p>Transformer chaque projet de construction en un parcours maîtrisé : conception "
                        "visible, calculs fiables, chantier suivi, décisions validées par le client et preuves archivées.</p>"
                        "<h2>Nos engagements</h2><ul><li>Un interlocuteur identifié pour chaque projet</li><li>Un budget "
                        "détaillé et des avenants toujours validés par vous</li><li>Un suivi en ligne avec photos datées et "
                        "géolocalisées</li><li>Des documents versionnés et authentifiables</li></ul>",
                    }
                ],
            },
            {"key": "expertises", "blocks": [{"kind": "expertises", "title": "Nos expertises", "limit": 6}]},
            {"key": "equipe", "blocks": [{"kind": "team", "title": "L'équipe", "limit": 12}]},
            {"key": "certifications", "blocks": [{"kind": "certifications", "title": "Certifications et agréments"}]},
            {"key": "partenaires", "blocks": [{"kind": "partners", "title": "Ils travaillent avec nous"}]},
            {
                "key": "cta",
                "blocks": [{"kind": "cta", "title": "Parlons de votre projet", "ctas": [CTA_DESCRIBE, CTA_CALL]}],
            },
        ],
    },
    {
        "route_key": "offers",
        "path": "/offres",
        "title": "Nos offres",
        "template": "listing",
        "seo": {
            "title": "Nos offres — maison, investissement, premium, diaspora, ingénierie",
            "description": "Cinq univers d'accompagnement pour construire au Cameroun : Home, Business, Premium, "
            "Diaspora et Engineering Services.",
        },
        "sections": [
            {
                "key": "hero",
                "blocks": [
                    _hero(
                        "Une offre pour chaque projet",
                        "Choisissez votre univers : chacun "
                        "répond à des attentes précises, avec la même exigence de maîtrise.",
                    )
                ],
            },
            {"key": "univers", "blocks": [{"kind": "universes", "title": "Nos univers"}]},
            {"key": "offres", "blocks": [{"kind": "offers", "title": "Toutes nos offres"}]},
            {
                "key": "cta",
                "blocks": [
                    {
                        "kind": "cta",
                        "title": "Vous hésitez entre plusieurs offres ?",
                        "text": "Décrivez votre projet : nous vous orientons vers la solution adaptée.",
                        "ctas": [CTA_DESCRIBE],
                    }
                ],
            },
        ],
    },
    {
        "route_key": "expertises",
        "path": "/expertises",
        "title": "Expertises",
        "template": "listing",
        "seo": {
            "title": "Nos expertises — architecture, structure, fluides, BIM",
            "description": "Architecture, ingénierie structure, électricité, plomberie, CVC, BIM, topographie et "
            "pilotage de chantier : des compétences intégrées au service de votre projet.",
        },
        "sections": [
            {
                "key": "hero",
                "blocks": [
                    _hero(
                        "L'expertise qui sécurise votre projet",
                        "Des architectes et ingénieurs qui conçoivent, calculent et coordonnent.",
                    )
                ],
            },
            {"key": "liste", "blocks": [{"kind": "expertises", "title": "Nos domaines d'expertise", "limit": 12}]},
            {"key": "cta", "blocks": [{"kind": "cta", "title": "Besoin d'une étude ?", "ctas": [CTA_DESCRIBE]}]},
        ],
    },
    {
        "route_key": "services",
        "path": "/services",
        "title": "Services",
        "template": "listing",
        "seo": {
            "title": "Nos services — de la conception à la construction",
            "description": "Conception architecturale, permis, études techniques, BIM, construction, rénovation et "
            "gestion de projet.",
        },
        "sections": [
            {
                "key": "hero",
                "blocks": [
                    _hero(
                        "Des services complets, de la conception à la livraison",
                        "Mission complète ou intervention ciblée : vous choisissez.",
                    )
                ],
            },
            {"key": "liste", "blocks": [{"kind": "services", "title": "Tous nos services", "limit": 30}]},
        ],
    },
    {
        "route_key": "projects",
        "path": "/projets",
        "title": "Réalisations",
        "template": "listing",
        "seo": {
            "title": "Nos réalisations",
            "description": "Projets réalisés et en cours : maisons, immeubles, "
            "villas et études, documentés étape par étape.",
        },
        "sections": [
            {
                "key": "hero",
                "blocks": [
                    _hero("La preuve par nos réalisations", "Chaque projet est documenté : avant, pendant, après.")
                ],
            },
            {"key": "liste", "blocks": [{"kind": "projects", "title": "Projets", "mode": "latest", "limit": 24}]},
        ],
    },
    {
        "route_key": "blog",
        "path": "/blog",
        "title": "Blog",
        "template": "listing",
        "seo": {
            "title": "Le blog GLOBUS — construire en toute connaissance de cause",
            "description": "Conseils, méthodes et coulisses de chantier pour réussir votre projet de construction "
            "au Cameroun.",
        },
        "sections": [{"key": "liste", "blocks": [{"kind": "blog", "title": "Derniers articles", "limit": 12}]}],
    },
    {
        "route_key": "describe-project",
        "path": "/decrire-mon-projet",
        "title": "Décrire mon projet",
        "seo": {
            "title": "Décrire mon projet de construction",
            "description": "Décrivez votre projet en quelques minutes : un conseiller GLOBUS vous recontacte pour "
            "étudier votre besoin, votre budget et votre délai.",
        },
        "sections": [
            {
                "key": "intro",
                "blocks": [
                    {
                        "kind": "rich_text",
                        "html": "<h2>Parlez-nous de votre projet</h2><p>Quelques informations suffisent : type d'ouvrage, localisation, "
                        "budget envisagé et délai souhaité. Vos données sont utilisées uniquement pour traiter votre demande.</p>",
                    }
                ],
            },
            {
                "key": "formulaire",
                "blocks": [
                    {"kind": "form", "form_key": "describe_project", "title": "Votre projet en quelques minutes"}
                ],
            },
            {
                "key": "ensuite",
                "blocks": [
                    {
                        "kind": "steps",
                        "title": "Et ensuite ?",
                        "style": "timeline",
                        "items": [
                            {"title": "Accusé de réception immédiat", "text": "Vous recevez votre numéro de demande."},
                            {"title": "Rappel d'un conseiller", "text": "Pour préciser vos besoins et vos priorités."},
                            {"title": "Proposition", "text": "Esquisse, budget et planning adaptés à votre projet."},
                        ],
                    }
                ],
            },
        ],
    },
    {
        "route_key": "contact",
        "path": "/contact",
        "title": "Contact",
        "seo": {
            "title": "Contacter GLOBUS ENGINEERING",
            "description": "Écrivez-nous, demandez à être rappelé ou contactez-nous sur WhatsApp : réponse rapide "
            "d'un conseiller.",
        },
        "sections": [
            {"key": "coordonnees", "blocks": [{"kind": "contact_info", "title": "Nos coordonnées"}]},
            {
                "key": "formulaire",
                "settings": {"anchor": "message"},
                "blocks": [{"kind": "form", "form_key": "contact", "title": "Écrivez-nous"}],
            },
            {
                "key": "rappel",
                "settings": {"anchor": "rappel"},
                "blocks": [{"kind": "form", "form_key": "callback", "title": "Être rappelé"}],
            },
            {"key": "plan", "blocks": [{"kind": "map", "title": "Nous trouver"}]},
        ],
    },
    {
        "route_key": "faq",
        "path": "/faq",
        "title": "Questions fréquentes",
        "seo": {
            "title": "FAQ — vos questions sur la construction avec GLOBUS",
            "description": "Budget, paiements, garanties, suivi à distance : les réponses à vos questions sur votre "
            "projet de construction.",
        },
        "sections": [{"key": "faq", "blocks": [{"kind": "faq", "title": "Questions fréquentes", "limit": 30}]}],
    },
    {
        "route_key": "help",
        "path": "/aide",
        "title": "Centre d'aide",
        "seo": {
            "title": "Centre d'aide",
            "description": "Guides d'utilisation de l'espace client et de l'extranet partenaires GLOBUS ENGINEERING.",
        },
        "sections": [
            {
                "key": "intro",
                "blocks": [
                    {
                        "kind": "rich_text",
                        "html": "<p>Retrouvez les guides pour payer en ligne, valider une décision, consulter vos documents ou "
                        "répondre à une commande.</p>",
                    }
                ],
            }
        ],
    },
]

LEGAL_PAGES = [
    (
        "legal-notice",
        "/mentions-legales",
        "Mentions légales",
        "<h2>Éditeur du site</h2><p>Les informations légales (raison sociale, forme juridique, capital, RCCM, NIU, "
        "siège social, directeur de la publication) sont celles renseignées dans les paramètres de l'entreprise.</p>"
        "<h2>Hébergement</h2><p>Les coordonnées de l'hébergeur sont communiquées sur simple demande.</p>"
        "<h2>Propriété intellectuelle</h2><p>L'ensemble des contenus du site est protégé. Toute reproduction sans "
        "autorisation est interdite.</p>"
        "<h2>Crédits typographiques</h2><p>Polices de la charte : Gilroy (Radomir Tinkov, licence web), Poppins "
        "(Indian Type Foundry, SIL Open Font License 1.1) et Doxent. Fonts made from "
        '<a href="http://www.onlinewebfonts.com">Web Fonts</a> is licensed by CC BY 4.0.</p>',
    ),
    (
        "privacy",
        "/confidentialite",
        "Politique de confidentialité",
        "<h2>Données collectées</h2><p>Nous collectons uniquement les données nécessaires au traitement de vos "
        "demandes, à l'exécution de vos projets et, avec votre consentement, à l'envoi d'informations.</p>"
        "<h2>Vos droits</h2><p>Vous pouvez demander l'accès, la rectification ou la suppression de vos données et "
        "retirer votre consentement à tout moment depuis votre compte ou par e-mail.</p>"
        "<h2>Sécurité</h2><p>Les données sensibles sont chiffrées ; les accès sont journalisés.</p>",
    ),
    (
        "cookies",
        "/cookies",
        "Politique cookies",
        "<p>Les cookies de mesure d'audience et publicitaires ne sont déposés qu'avec votre accord. Vous pouvez "
        "modifier vos choix à tout moment via le bandeau de gestion des cookies.</p>",
    ),
    (
        "terms",
        "/conditions-generales",
        "Conditions générales d'utilisation",
        "<p>L'utilisation du site et des espaces en ligne implique l'acceptation des présentes conditions. Les "
        "engagements contractuels relatifs à un projet sont régis par le contrat signé entre les parties.</p>",
    ),
]

MENUS: dict[str, tuple[str, list[dict[str, Any]]]] = {
    "header": (
        "Menu principal",
        [
            {"label": "Offres", "link_type": "page", "page_route_key": "offers"},
            {"label": "Expertises", "link_type": "page", "page_route_key": "expertises"},
            {"label": "Réalisations", "link_type": "page", "page_route_key": "projects"},
            {"label": "À propos", "link_type": "page", "page_route_key": "about"},
            {"label": "Blog", "link_type": "page", "page_route_key": "blog"},
            {"label": "Contact", "link_type": "page", "page_route_key": "contact"},
            {
                "label": "Décrire mon projet",
                "link_type": "page",
                "page_route_key": "describe-project",
                "highlight": True,
            },
        ],
    ),
    "footer_main": (
        "Pied de page",
        [
            {"label": "Offres", "link_type": "page", "page_route_key": "offers"},
            {"label": "Services", "link_type": "page", "page_route_key": "services"},
            {"label": "Chantiers en cours", "link_type": "path", "url": "/chantiers"},
            {"label": "Estimation instantanée", "link_type": "path", "url": "/estimation-instantanee"},
            {"label": "Énergie & confort", "link_type": "path", "url": "/energie-confort"},
            {"label": "Financement", "link_type": "path", "url": "/financement"},
            {"label": "FAQ", "link_type": "page", "page_route_key": "faq"},
            {"label": "Centre d'aide", "link_type": "page", "page_route_key": "help"},
            {"label": "Espace client", "link_type": "path", "url": "/connexion"},
        ],
    ),
    "footer_legal": (
        "Mentions",
        [
            {"label": "Mentions légales", "link_type": "page", "page_route_key": "legal-notice"},
            {"label": "Confidentialité", "link_type": "page", "page_route_key": "privacy"},
            {"label": "Cookies", "link_type": "page", "page_route_key": "cookies"},
            {"label": "CGU", "link_type": "page", "page_route_key": "terms"},
        ],
    ),
}


def _principal(db: Session) -> Principal:
    from app.core.permissions import PERMISSION_CODES
    from app.modules.identity.models import User

    user = db.execute(select(User).order_by(User.created_at)).scalars().first()
    if user is None:
        raise RuntimeError("Créer d'abord un compte administrateur (scripts/create_admin.py)")
    return Principal(
        user=user,
        session_id=None,
        roles={"ADMIN"},
        permissions=set(PERMISSION_CODES),
        org_kind="internal",
        global_scope=True,
        mfa_verified=True,
    )


def _publish(db: Session, principal: Principal, entity_type: str, obj: Any, publish: bool) -> None:
    if publish and obj.status != "published":
        service.transition(db, principal, entity_type, obj, "published", note="Contenu éditorial initial")


def _brand_media(db: Session, principal: Principal, filename: str, title: str, tags: list[str]) -> Any:
    """Élément de marque versé dans la médiathèque (V4-MEDIA-07 : la vitrine n'affiche que des médias référencés)."""
    from pathlib import Path

    from app.core.errors import Conflict
    from app.modules.cms.media import upload_media

    path = Path(__file__).resolve().parents[1] / "assets" / "brand" / filename
    if not path.exists():
        return None
    try:
        return upload_media(
            db,
            filename=filename,
            data=path.read_bytes(),
            title=title,
            alt_text="GLOBUS ENGINEERING",
            folder="marque",
            tags=tags,
            author_id=principal.user.id,
        ).id
    except Conflict as exc:
        return exc.details["media_id"] if isinstance(exc.details, dict) else None


def _brand_logo(db: Session, principal: Principal) -> Any:
    return _brand_media(db, principal, "logo-globus.png", "Logo GLOBUS ENGINEERING", ["logo", "marque"])


def _brand_icon(db: Session, principal: Principal) -> Any:
    """Icône unique de la plateforme (favicon, PWA, assistant, applications) — distincte du logo."""
    return _brand_media(db, principal, "icon-globus.png", "Icône GLOBUS ENGINEERING", ["icône", "marque"])


def seed_content(db: Session, *, publish: bool) -> dict[str, int]:
    """Crée le contenu éditorial manquant ; renvoie le nombre d'éléments créés par type."""
    principal = _principal(db)
    created = {
        "universes": 0,
        "offers": 0,
        "expertises": 0,
        "services": 0,
        "faq": 0,
        "help": 0,
        "pages": 0,
        "menus": 0,
        "blog_categories": 0,
    }
    settings_row = db.execute(select(m.SiteSettings)).scalars().first()
    if settings_row is not None:
        settings_row.slogan = settings_row.slogan or "Concevoir. Calculer. Construire. Contrôler."
        settings_row.promise = settings_row.promise or "Vous avez un projet. Nous maîtrisons sa réalisation."
        settings_row.default_meta_description = settings_row.default_meta_description or (
            "GLOBUS ENGINEERING : conception, ingénierie, construction et contrôle au Cameroun. Visualisez votre "
            "projet en 3D, maîtrisez votre budget et suivez votre chantier en ligne."
        )
        settings_row.city = settings_row.city or "Douala"
        settings_row.country = settings_row.country or "Cameroun"
        if settings_row.logo_media_id is None:
            settings_row.logo_media_id = _brand_logo(db, principal)
        if settings_row.favicon_media_id is None:
            settings_row.favicon_media_id = _brand_icon(db, principal)
    universes: dict[str, m.Universe] = {}
    for index, data in enumerate(UNIVERSES):
        row = db.execute(select(m.Universe).where(m.Universe.key == data["key"])).scalar_one_or_none()
        if row is None:
            row = m.Universe(sort_order=index, created_by_id=principal.id, **data)
            db.add(row)
            db.flush()
            service.add_revision(db, "universes", row, principal.id, note="Création")
            service.upsert_seo(
                db,
                "universe",
                row.slug,
                {"title": f"{row.name} — {row.tagline}"[:160], "description": (row.promise or "")[:300]},
            )
            created["universes"] += 1
        universes[row.key] = row
        _publish(db, principal, "universes", row, publish)
    for key, offers in OFFERS.items():
        for index, data in enumerate(offers):
            if db.execute(select(m.Offer.id).where(m.Offer.slug == data["slug"])).first():
                continue
            offer = m.Offer(
                universe_id=universes[key].id,
                sort_order=index,
                cta_label="Décrire mon projet",
                created_by_id=principal.id,
                **data,
            )
            db.add(offer)
            db.flush()
            service.add_revision(db, "offers", offer, principal.id, note="Création")
            service.upsert_seo(db, "offer", offer.slug, {"title": offer.name, "description": offer.summary})
            _publish(db, principal, "offers", offer, publish)
            created["offers"] += 1
    for index, (slug, name, discipline, summary) in enumerate(EXPERTISES):
        if db.execute(select(m.Expertise.id).where(m.Expertise.slug == slug)).first():
            continue
        row = m.Expertise(
            slug=slug, name=name, discipline=discipline, summary=summary, sort_order=index, created_by_id=principal.id
        )
        db.add(row)
        db.flush()
        service.add_revision(db, "expertises", row, principal.id, note="Création")
        _publish(db, principal, "expertises", row, publish)
        created["expertises"] += 1
    for index, (slug, name, category, summary) in enumerate(SERVICES):
        if db.execute(select(m.Service.id).where(m.Service.slug == slug)).first():
            continue
        row = m.Service(
            slug=slug, name=name, category=category, summary=summary, sort_order=index, created_by_id=principal.id
        )
        db.add(row)
        db.flush()
        service.add_revision(db, "services", row, principal.id, note="Création")
        _publish(db, principal, "services", row, publish)
        created["services"] += 1
    for c_index, (slug, name, items) in enumerate(FAQ):
        category = db.execute(select(m.FaqCategory).where(m.FaqCategory.slug == slug)).scalar_one_or_none()
        if category is None:
            category = m.FaqCategory(slug=slug, name=name, sort_order=c_index)
            db.add(category)
            db.flush()
        for i_index, (question, answer, universe) in enumerate(items):
            if db.execute(select(m.FaqItem.id).where(m.FaqItem.question == question)).first():
                continue
            item = m.FaqItem(
                category_id=category.id,
                question=question,
                answer=answer,
                universe=universe,
                sort_order=i_index,
                featured=i_index == 0,
                created_by_id=principal.id,
            )
            db.add(item)
            db.flush()
            service.add_revision(db, "faq_items", item, principal.id, note="Création")
            _publish(db, principal, "faq_items", item, publish)
            created["faq"] += 1
    for c_index, (slug, name, icon, articles) in enumerate(HELP):
        category = db.execute(select(m.HelpCategory).where(m.HelpCategory.slug == slug)).scalar_one_or_none()
        if category is None:
            category = m.HelpCategory(slug=slug, name=name, icon=icon, sort_order=c_index)
            db.add(category)
            db.flush()
        for a_index, (a_slug, title, audience, text) in enumerate(articles):
            if db.execute(select(m.HelpArticle.id).where(m.HelpArticle.slug == a_slug)).first():
                continue
            article = m.HelpArticle(
                category_id=category.id,
                slug=a_slug,
                title=title,
                audience=audience,
                summary=text[:200],
                sort_order=a_index,
                created_by_id=principal.id,
                body_blocks=[{"kind": "rich_text", "html": f"<p>{text}</p>"}],
            )
            db.add(article)
            db.flush()
            service.add_revision(db, "help_articles", article, principal.id, note="Création")
            _publish(db, principal, "help_articles", article, publish)
            created["help"] += 1
    for index, (slug, name, description) in enumerate(BLOG_CATEGORIES):
        if not db.execute(select(m.BlogCategory.id).where(m.BlogCategory.slug == slug)).first():
            db.add(m.BlogCategory(slug=slug, name=name, description=description, sort_order=index))
            created["blog_categories"] += 1
    for page in [
        *PAGES,
        *[
            {
                "route_key": key,
                "path": path,
                "title": title,
                "template": "legal",
                "body": body,
                "seo": {
                    "title": title,
                    "description": f"{title} du site GLOBUS ENGINEERING.",
                    "robots_index": True,
                    "sitemap_priority": "0.2",
                },
            }
            for key, path, title, body in LEGAL_PAGES
        ],
    ]:
        if db.execute(select(m.CmsPage.id).where(m.CmsPage.route_key == page["route_key"])).first():
            continue
        payload = {
            **page,
            "sections": [
                {**section, "blocks": [{"data": block} for block in section.get("blocks", [])]}
                for section in page.get("sections", [])
            ],
        }
        row = service.save_page(db, principal, PageIn.model_validate(payload))
        _publish(db, principal, "page", row, publish)
        created["pages"] += 1
    for key, (title, items) in MENUS.items():
        if db.execute(select(m.NavigationMenu.id).where(m.NavigationMenu.key == key)).first():
            continue
        menu = m.NavigationMenu(key=key, title=title)
        for index, item in enumerate(items):
            menu.items.append(m.NavigationItem(sort_order=index, **item))
        db.add(menu)
        created["menus"] += 1
    db.flush()
    log.info("seed_content", extra=created)
    return created
