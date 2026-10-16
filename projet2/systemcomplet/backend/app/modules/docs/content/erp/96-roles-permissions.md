---
id: erp-roles-permissions
title: Rôles et permissions de référence
space: erp
section: Administration
order: 20
routes: [/erp/utilisateurs?onglet=roles]
perms: [users:read, roles:manage]
summary: Les 17 rôles livrés par défaut, leur public et la double authentification exigée, et le catalogue des 97 permissions par module ; à adapter dans Utilisateurs et rôles.
keywords: [rôle, permission, droits, RBAC, matrice, sensible, MFA]
related: [erp-utilisateurs, erp-securite]
---

## Principe

Un utilisateur cumule un ou plusieurs rôles ; ses droits sont la somme des permissions de ses rôles. Les contrôles ne s'arrêtent pas au rôle : l'accès dépend aussi de l'organisation, du projet (être membre), du niveau de confidentialité d'un document et du statut du circuit (on ne valide pas ce qu'on a soi-même créé). Les rôles ci-dessous sont ceux livrés à l'installation : un administrateur peut les modifier ou en créer d'autres dans [Utilisateurs et rôles](doc:erp-utilisateurs) ; c'est toujours la configuration en vigueur qui s'applique, y compris pour cette documentation (chaque utilisateur n'y voit que ce que ses permissions réelles lui ouvrent).

## Rôles par défaut

| Rôle | Code | Public | Double authentification | Périmètre |
| --- | --- | --- | --- | --- |
| Administrateur / DG | `ADMIN` | Interne | obligatoire | Accès global, configuration, sécurité, audit. |
| Direction / Responsable | `DIRECTION` | Interne | obligatoire | Supervision, KPI, validations critiques. |
| Chef de projet / Conducteur de travaux | `CHEF_PROJET` | Interne | recommandée | Projet assigné, budget, planning, partenaires. |
| Architecte | `ARCHITECTE` | Interne | recommandée | Architecture, BIM, GED technique, issues. |
| Ingénieur Structure / MEP | `INGENIEUR` | Interne | recommandée | Discipline, plans, issues, validations. |
| Chef de chantier | `CHEF_CHANTIER` | Interne | recommandée | Terrain, réception, QHSE, stock, photos. |
| Artisan / Technicien | `TECHNICIEN` | Interne | recommandée | Tâches assignées, plans autorisés, QR. |
| Commercial | `COMMERCIAL` | Interne | recommandée | Leads, opportunités, devis, contrats. |
| Marketing / Éditeur CMS | `MARKETING` | Interne | recommandée | Vitrine, médiathèque, SEO, analytics, newsletter. |
| Acheteur / Logistique | `ACHETEUR` | Interne | recommandée | Demandes, commandes, fournisseurs, livraisons, stocks. |
| Magasinier | `MAGASINIER` | Interne | recommandée | Entrées/sorties, emplacements, inventaires. |
| Responsable QHSE | `QHSE` | Interne | recommandée | EPI, inspections, incidents, actions correctives. |
| Finance / Comptabilité | `FINANCE` | Interne | obligatoire | Factures, paiements, rapprochements. |
| Ressources humaines | `RH` | Interne | recommandée | Employés, présence, paie, docs RH. |
| Sous-traitant | `SOUS_TRAITANT` | Partenaire | recommandée | Contrat, lots, situations, factures, litiges. |
| Fournisseur | `FOURNISSEUR` | Partenaire | recommandée | Bons de commande, confirmation, expédition/livraison, documents. |
| Client | `CLIENT` | Client | obligatoire (dès l'activation) | Ses projets, documents publiés, décisions, finance, 3D, messagerie. |

Les rôles à portée globale (Administrateur, Direction) voient tous les projets ; les autres ne voient que les projets dont ils sont membres.

## Catalogue des permissions

Les permissions marquées **sensible** donnent accès à des données ou à des actions à fort enjeu (finances, données personnelles, sécurité) : à n'accorder qu'à bon escient.

### Pilotage

- `dashboard:view` — Voir le tableau de bord
- `dashboard:direction` — Voir le tableau de bord Direction (finances, marges) (**sensible**)

### Projets

- `projects:read` — Consulter les projets
- `projects:write` — Créer / modifier les projets
- `projects:delete` — Archiver les projets (**sensible**)
- `projects:members` — Gérer les membres des projets
- `projects:publish_client` — Publier des contenus vers le client

### Chantier

- `site:report` — Saisir journal / avancement / photos chantier

### Planning

- `planning:read` — Consulter les plannings
- `planning:write` — Modifier les plannings

### Finance

- `finance:read` — Consulter les finances (**sensible**)
- `finance:write` — Saisir budgets, dépenses, caisses (**sensible**)
- `finance:approve` — Valider les engagements / budgets (**sensible**)
- `finance:pay` — Exécuter les paiements (**sensible**)
- `finance:reconcile` — Rapprochements bancaires (**sensible**)

### Facturation

- `billing:read` — Consulter la facturation (**sensible**)
- `billing:write` — Créer les factures / avoirs (**sensible**)
- `billing:validate` — Valider les factures fournisseurs (**sensible**)

### CRM

- `crm:read` — Consulter le CRM
- `crm:write` — Gérer leads / opportunités / devis
- `crm:assign` — Affecter les leads
- `crm:contracts` — Gérer les contrats (**sensible**)

### Achats

- `procurement:read` — Consulter les achats
- `procurement:request` — Créer des demandes d'achat
- `procurement:approve` — Approuver les demandes d'achat
- `procurement:order` — Émettre les bons de commande

### Fournisseurs

- `suppliers:read` — Consulter les fournisseurs
- `suppliers:write` — Gérer les fournisseurs

### Livraisons

- `deliveries:read` — Consulter les livraisons
- `deliveries:receive` — Réceptionner les livraisons (GRN)

### Stocks

- `inventory:read` — Consulter les stocks
- `inventory:write` — Mouvements de stock / inventaires

### Matériel

- `equipment:read` — Consulter le matériel
- `equipment:write` — Gérer le matériel

### Sous-traitance

- `subcontracting:read` — Consulter la sous-traitance
- `subcontracting:write` — Gérer consultations / contrats
- `subcontracting:award` — Attribuer les marchés (**sensible**)
- `subcontracting:validate` — Valider les situations de travaux (**sensible**)
- `subcontracting:derogate` — Accorder une dérogation de dépassement (**sensible**)

### Litiges

- `disputes:read` — Consulter les litiges
- `disputes:write` — Gérer les litiges
- `disputes:decide` — Décider / escalader un litige (**sensible**)

### QHSE

- `qhse:read` — Consulter le QHSE
- `qhse:write` — Gérer incidents / inspections / actions

### RH

- `hr:read` — Consulter les RH (**sensible**)
- `hr:write` — Gérer les employés / présences (**sensible**)
- `hr:payroll` — Gérer la paie (**sensible**)

### Pointage

- `attendance:self` — Pointer sa présence

### GED

- `documents:read` — Consulter la GED
- `documents:write` — Déposer / versionner des documents
- `documents:approve` — Approuver des documents
- `documents:publish` — Publier des documents
- `documents:confidential` — Accéder aux documents confidentiels (**sensible**)
- `documents:very_sensitive` — Accéder aux documents très sensibles (**sensible**)

### BIM

- `bim:read` — Consulter le Hub BIM
- `bim:write` — Déposer des maquettes / annoter
- `bim:coordinate` — Gérer issues / clashes
- `bim:validate` — Valider / publier une version BIM

### Configurateur

- `configurator:manage` — Gérer catalogue matériaux / configurateur

### Messagerie

- `chat:use` — Utiliser la messagerie

### Appels

- `calls:use` — Passer des appels audio / vidéo
- `calls:record` — Enregistrer des appels (avec consentement) (**sensible**)

### CMS

- `cms:read` — Consulter le CMS
- `cms:write` — Éditer les contenus
- `cms:review` — Relire / valider les contenus
- `cms:publish` — Publier les contenus

### Médiathèque

- `media:write` — Gérer la médiathèque

### SEO

- `seo:write` — Gérer le SEO / redirections

### Analytics

- `analytics:read` — Consulter les statistiques

### Newsletter

- `newsletter:read` — Consulter la newsletter
- `newsletter:write` — Gérer segments / modèles / campagnes
- `newsletter:send` — Envoyer les campagnes

### SAV

- `support:read` — Consulter le SAV
- `support:write` — Traiter les tickets SAV

### Agenda

- `agenda:read` — Consulter l'agenda
- `agenda:write` — Gérer l'agenda

### Rapports

- `reports:read` — Consulter les rapports
- `reports:export` — Exporter des données (**sensible**)

### IA

- `ai:use` — Utiliser les assistants IA

### Notifications

- `notifications:manage` — Gérer modèles / règles de notification

### Utilisateurs

- `users:read` — Consulter les utilisateurs
- `users:write` — Gérer les utilisateurs (**sensible**)

### Rôles

- `roles:manage` — Gérer rôles et permissions (**sensible**)

### Paramètres

- `settings:read` — Consulter les paramètres
- `settings:write` — Modifier les paramètres (**sensible**)

### Intégrations

- `integrations:manage` — Configurer les intégrations / secrets (**sensible**)

### Sécurité

- `security:read` — Consulter la sécurité (sessions, événements) (**sensible**)
- `security:manage` — Gérer clés API / webhooks / sessions (**sensible**)

### Audit

- `audit:read` — Consulter le journal d'audit (**sensible**)

### Sauvegardes

- `backups:run` — Lancer des sauvegardes (**sensible**)
- `backups:restore` — Restaurer (break-glass) (**sensible**)

### Maintenance

- `maintenance:manage` — Gérer le mode maintenance (**sensible**)

### Espace client

- `client:portal` — Accéder à l'espace client
- `client:pay` — Payer en ligne
- `client:decide` — Valider des décisions / matériaux

### Extranet

- `extranet:supplier` — Accéder à l'extranet fournisseur
- `extranet:subcontractor` — Accéder à l'extranet sous-traitant
