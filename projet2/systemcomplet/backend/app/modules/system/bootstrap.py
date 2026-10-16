"""Données système idempotentes (autorisées en production : référentiels, pas de données métier fictives).

- catalogue des permissions et rôles par défaut ;
- organisation interne ;
- modèles/règles de notification ;
- politiques SLA, matrice d'approbation, disciplines BIM, catégories de matériaux, calendrier,
  formulaires publics, modèles d'inspection QHSE, paramètres du site (ligne unique vide).
"""

from __future__ import annotations

import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import DEFAULT_ROLES, PERMISSIONS
from app.modules.identity.models import Organization, Permission, Role, RolePermission

log = logging.getLogger("globus.bootstrap")


def ensure_permissions_and_roles(db: Session) -> None:
    existing = {p.code: p for p in db.execute(select(Permission)).scalars()}
    for perm in PERMISSIONS:
        row = existing.get(perm.code)
        if row is None:
            db.add(Permission(code=perm.code, module=perm.module, label=perm.label, sensitive=perm.sensitive))
        else:
            row.label, row.module, row.sensitive = perm.label, perm.module, perm.sensitive
    db.flush()
    roles = {r.code: r for r in db.execute(select(Role)).scalars()}
    for definition in DEFAULT_ROLES:
        role = roles.get(definition.code)
        if role is None:
            role = Role(
                code=definition.code,
                name=definition.name,
                description=definition.description,
                audience=definition.audience,
                is_system=True,
                global_scope=definition.global_scope,
                mfa_required=definition.mfa_required,
            )
            db.add(role)
            db.flush()
            for code in definition.permissions:
                role.permissions.append(RolePermission(role_id=role.id, permission_code=code))
        elif definition.code == "ADMIN":
            current = set(role.permission_codes)
            for code in definition.permissions:
                if code not in current:
                    role.permissions.append(RolePermission(role_id=role.id, permission_code=code))
    db.flush()


def ensure_internal_organization(db: Session) -> Organization:
    org = db.execute(select(Organization).where(Organization.kind == "internal").limit(1)).scalar_one_or_none()
    if org is None:
        org = Organization(
            name="GLOBUS ENGINEERING", kind="internal", legal_name="GLOBUS ENGINEERING", country="Cameroun"
        )
        db.add(org)
        db.flush()
    return org


def ensure_reference_data(db: Session) -> None:
    from app.modules.cms.models import FormDefinition, SiteSettings
    from app.modules.configurator.models import MaterialCategory
    from app.modules.crm.models import SlaPolicy
    from app.modules.procurement.models import ApprovalRule
    from app.modules.projects.models import WorkCalendar
    from app.modules.qhse.models import InspectionTemplate

    if not db.execute(select(SlaPolicy.id).limit(1)).first():
        db.add_all(
            [
                SlaPolicy(
                    entity="lead",
                    name="Lead standard",
                    priority="normal",
                    response_minutes=240,
                    escalation=[{"after_minutes": 240, "notify_roles": ["DIRECTION"]}],
                ),
                SlaPolicy(
                    entity="lead",
                    name="Lead urgent / chaud",
                    priority="urgent",
                    response_minutes=60,
                    escalation=[{"after_minutes": 60, "notify_roles": ["DIRECTION"]}],
                ),
                SlaPolicy(
                    entity="ticket",
                    name="SAV urgent",
                    priority="urgent",
                    response_minutes=120,
                    resolution_minutes=1440,
                    escalation=[{"after_minutes": 240, "notify_roles": ["DIRECTION"]}],
                ),
                SlaPolicy(
                    entity="ticket",
                    name="SAV prioritaire",
                    priority="high",
                    response_minutes=480,
                    resolution_minutes=4320,
                ),
                SlaPolicy(
                    entity="ticket",
                    name="SAV normal",
                    priority="normal",
                    response_minutes=1440,
                    resolution_minutes=10080,
                ),
                SlaPolicy(
                    entity="ticket", name="SAV faible", priority="low", response_minutes=2880, resolution_minutes=20160
                ),
            ]
        )
    if not db.execute(select(ApprovalRule.id).limit(1)).first():
        db.add_all(
            [
                ApprovalRule(
                    entity="purchase_request",
                    name="DA ≤ 500 000 FCFA",
                    min_amount=Decimal("0"),
                    max_amount=Decimal("500000"),
                    level=1,
                    approver_role="CHEF_PROJET",
                ),
                ApprovalRule(
                    entity="purchase_request",
                    name="DA 500 000 – 5 000 000 FCFA (niveau 1)",
                    min_amount=Decimal("500000.01"),
                    max_amount=Decimal("5000000"),
                    level=1,
                    approver_role="CHEF_PROJET",
                ),
                ApprovalRule(
                    entity="purchase_request",
                    name="DA 500 000 – 5 000 000 FCFA (niveau 2)",
                    min_amount=Decimal("500000.01"),
                    max_amount=Decimal("5000000"),
                    level=2,
                    approver_role="ACHETEUR",
                ),
                ApprovalRule(
                    entity="purchase_request",
                    name="DA > 5 000 000 FCFA (niveau 1)",
                    min_amount=Decimal("5000000.01"),
                    max_amount=None,
                    level=1,
                    approver_role="CHEF_PROJET",
                ),
                ApprovalRule(
                    entity="purchase_request",
                    name="DA > 5 000 000 FCFA (niveau 2)",
                    min_amount=Decimal("5000000.01"),
                    max_amount=None,
                    level=2,
                    approver_role="DIRECTION",
                ),
                ApprovalRule(
                    entity="payment",
                    name="Paiement sortant > 2 000 000 FCFA",
                    min_amount=Decimal("2000000.01"),
                    max_amount=None,
                    level=1,
                    approver_role="DIRECTION",
                ),
                ApprovalRule(
                    entity="payment",
                    name="Paiement sortant ≤ 2 000 000 FCFA",
                    min_amount=Decimal("0"),
                    max_amount=Decimal("2000000"),
                    level=1,
                    approver_role="FINANCE",
                ),
            ]
        )
    # Disciplines BIM globales : ensure_default_disciplines() plus bas (une seule source ; sans autoflush, un second
    # semis dans la même transaction créait des doublons).
    if not db.execute(select(MaterialCategory.id).limit(1)).first():
        for index, (key, name) in enumerate(
            [
                ("sol", "Revêtements de sol"),
                ("mur", "Murs & peintures"),
                ("facade", "Façades"),
                ("toiture", "Toiture"),
                ("menuiserie", "Menuiseries"),
                ("sanitaire", "Sanitaires"),
                ("cuisine", "Cuisine"),
                ("eclairage", "Éclairage"),
                ("exterieur", "Aménagements extérieurs"),
            ]
        ):
            db.add(MaterialCategory(key=key, name=name, sort_order=index))
    if not db.execute(select(WorkCalendar.id).where(WorkCalendar.project_id.is_(None)).limit(1)).first():
        db.add(
            WorkCalendar(
                project_id=None,
                name="Calendrier standard Cameroun",
                working_days=[0, 1, 2, 3, 4, 5],
                holidays=[
                    "2026-01-01",
                    "2026-02-11",
                    "2026-05-01",
                    "2026-05-20",
                    "2026-08-15",
                    "2026-12-25",
                    "2027-01-01",
                    "2027-02-11",
                    "2027-05-01",
                    "2027-05-20",
                    "2027-08-15",
                    "2027-12-25",
                ],
            )
        )
    if not db.execute(select(InspectionTemplate.id).limit(1)).first():
        db.add_all(
            [
                InspectionTemplate(
                    name="Inspection sécurité chantier",
                    category="securite",
                    checklist=[
                        {"key": "epi", "label": "Port des EPI (casque, chaussures, gilet)", "weight": 3},
                        {"key": "balisage", "label": "Balisage et signalisation en place", "weight": 2},
                        {"key": "echafaudages", "label": "Échafaudages conformes et vérifiés", "weight": 3},
                        {"key": "electricite", "label": "Installations électriques provisoires protégées", "weight": 3},
                        {"key": "proprete", "label": "Circulation dégagée, chantier propre", "weight": 1},
                        {"key": "extincteurs", "label": "Extincteurs accessibles et vérifiés", "weight": 2},
                        {"key": "premiers_secours", "label": "Trousse de premiers secours disponible", "weight": 2},
                    ],
                ),
                InspectionTemplate(
                    name="Contrôle qualité béton",
                    category="qualite",
                    checklist=[
                        {
                            "key": "ferraillage",
                            "label": "Ferraillage conforme aux plans (diamètres, enrobage)",
                            "weight": 3,
                        },
                        {"key": "coffrage", "label": "Coffrage stable et étanche", "weight": 2},
                        {
                            "key": "dosage",
                            "label": "Dosage béton conforme (bon de livraison / formulation)",
                            "weight": 3,
                        },
                        {"key": "eprouvettes", "label": "Éprouvettes prélevées", "weight": 2},
                        {"key": "vibration", "label": "Vibration et cure réalisées", "weight": 2},
                    ],
                ),
                InspectionTemplate(
                    name="Contrôle environnemental",
                    category="environnement",
                    checklist=[
                        {"key": "dechets", "label": "Tri et évacuation des déchets", "weight": 2},
                        {"key": "poussieres", "label": "Maîtrise des poussières et du bruit", "weight": 1},
                        {"key": "produits", "label": "Stockage des produits dangereux", "weight": 3},
                    ],
                ),
            ]
        )
    if not db.execute(select(FormDefinition.id).limit(1)).first():
        consent_contact = {
            "key": "contact",
            "required": True,
            "label": "J'accepte que GLOBUS ENGINEERING traite mes données pour répondre à ma demande.",
        }
        consent_marketing = {
            "key": "marketing",
            "required": False,
            "label": "J'accepte de recevoir des informations et conseils de GLOBUS ENGINEERING.",
        }
        consent_whatsapp = {
            "key": "whatsapp",
            "required": False,
            "label": "J'accepte d'être recontacté(e) par WhatsApp.",
        }
        db.add_all(
            [
                FormDefinition(
                    key="contact",
                    title="Contact",
                    destination="crm_lead",
                    auto_reply_code="lead.auto_reply",
                    fields=[
                        {"name": "first_name", "label": "Prénom", "type": "text", "required": True},
                        {"name": "last_name", "label": "Nom", "type": "text", "required": True},
                        {"name": "email", "label": "E-mail", "type": "email", "required": True},
                        {"name": "phone", "label": "Téléphone / WhatsApp", "type": "tel", "required": False},
                        {"name": "subject", "label": "Objet", "type": "text", "required": True},
                        {"name": "message", "label": "Message", "type": "textarea", "required": True},
                    ],
                    consents=[consent_contact, consent_marketing, consent_whatsapp],
                    success_message="Merci ! Votre message est bien reçu. Un conseiller vous répond rapidement.",
                ),
                FormDefinition(
                    key="describe_project",
                    title="Décrire mon projet",
                    destination="crm_lead",
                    auto_reply_code="lead.auto_reply",
                    fields=[],
                    consents=[consent_contact, consent_marketing, consent_whatsapp],
                    success_message="Votre projet est enregistré. Un expert GLOBUS vous contacte pour en discuter.",
                ),
                FormDefinition(
                    key="newsletter",
                    title="Newsletter",
                    destination="newsletter",
                    fields=[
                        {"name": "email", "label": "E-mail", "type": "email", "required": True},
                    ],
                    consents=[
                        {
                            "key": "newsletter",
                            "required": True,
                            "label": "J'accepte de recevoir la newsletter (désinscription en un clic).",
                        }
                    ],
                    success_message="Vérifiez votre boîte e-mail pour confirmer l'inscription.",
                ),
                FormDefinition(
                    key="callback",
                    title="Être rappelé",
                    destination="crm_lead",
                    auto_reply_code="lead.auto_reply",
                    fields=[
                        {"name": "first_name", "label": "Prénom", "type": "text", "required": True},
                        {"name": "phone", "label": "Téléphone", "type": "tel", "required": True},
                        {"name": "slot", "label": "Créneau souhaité", "type": "text", "required": False},
                    ],
                    consents=[consent_contact, consent_whatsapp],
                    success_message="Merci, nous vous rappelons sur le créneau indiqué.",
                ),
            ]
        )
    if not db.execute(select(SiteSettings.id).limit(1)).first():
        db.add(
            SiteSettings(
                company_name="GLOBUS ENGINEERING",
                slogan="Concevoir. Calculer. Construire. Contrôler.",
                consent_texts={},
            )
        )
    _ensure_hr_defaults(db)
    from app.modules.bim.service import ensure_default_disciplines

    ensure_default_disciplines(db)
    db.flush()


def _ensure_hr_defaults(db: Session) -> None:
    """Horaire de référence et paramètres de paie (non revus : la validation de paie exige leur revue)."""
    from datetime import time

    from app.modules.hr.models import WorkSchedule
    from app.modules.hr.service import DEFAULT_PAYROLL_PARAMETERS
    from app.modules.system.models import Setting

    if not db.execute(select(WorkSchedule.id).limit(1)).first():
        db.add(
            WorkSchedule(
                name="Horaire chantier standard",
                start_time=time(7, 30),
                end_time=time(16, 30),
                break_minutes=60,
                working_days=[0, 1, 2, 3, 4, 5],
                is_default=True,
            )
        )
    if db.get(Setting, "payroll_parameters") is None:
        db.add(
            Setting(
                key="payroll_parameters",
                category="hr",
                value=dict(DEFAULT_PAYROLL_PARAMETERS),
                description=(
                    "Cotisations CNPS/CFC/FNE, barème IRPP, CAC, RAV, TDL — à faire valider par le cabinet comptable."
                ),
            )
        )


def bootstrap(db: Session) -> None:
    from app.modules.notifications.service import ensure_defaults

    ensure_permissions_and_roles(db)
    ensure_internal_organization(db)
    ensure_reference_data(db)
    ensure_defaults(db)
    db.commit()
    log.info("bootstrap_done")
