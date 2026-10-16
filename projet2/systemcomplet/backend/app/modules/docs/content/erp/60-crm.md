---
id: erp-crm
title: CRM - leads, opportunités, devis et contrats
space: erp
section: Commercial
order: 10
route: /erp/crm
routes: [/erp/crm/leads, /erp/crm/leads/*, /erp/crm/devis, /erp/crm/devis/*, /erp/crm/contrats, /erp/crm/contrats/*]
perms: [crm:read]
summary: Du lead au projet - qualification, opportunité, devis accepté par code, contrat signé et création du projet ; activités, contacts, affectation automatique et délais de réponse garantis.
keywords: [CRM, lead, prospect, opportunité, pipeline, devis, contrat, signature, OTP, relance, SLA, affectation, contact, estimation]
related: [erp-ambassadeurs, erp-assistant, erp-chantiers, erp-newsletter]
---

## Le parcours

Lead → qualification → opportunité → devis (accepté par code OTP) → contrat → projet : aucun prospect sans réponse dans les délais. Menu **Commercial › CRM** ; onglets **Tableau de bord**, **Leads**, **Pipeline**, **Devis**, **Contrats**, **Contacts**, **Activités**, **Réglages**.

## Onglet « Tableau de bord »

**Pipeline des opportunités** (valeur par étape), **Leads par source**, **Leads par univers**, **Leads par statut**.

## Onglet « Leads »

Les **Leads** arrivent du site (« Décrire mon projet », estimation instantanée, formulaires, simulateurs énergie et financement, panneau de chantier, parrainage), de WhatsApp et des saisies manuelles. Affectation automatique, délai de première réponse (SLA), score et température, attribution marketing. Filtres **Statut**, **Univers**, **Source**, **Température** ; **Exporter** selon vos droits.

::: perm crm:write
- **Nouveau lead** ouvre **Saisie d'un lead** (appel entrant, salon…) puis **Créer le lead**.
:::

### La fiche lead

- **Dossier « Décrire mon projet »** : réponses du prospect et taux de complétude.
- **Score** : règles de scoring (budget, urgence, complétude, univers…).
- **Estimation instantanée** (photo, croquis ou note vocale analysés) : fourchette indicative à valider par un ingénieur.
- **Activités** : appels, e-mails, WhatsApp, rendez-vous, relances — la première activité arrête le chronomètre du délai de réponse.

::: perm crm:write
- **Appeler**, **WhatsApp**, **E-mail** contactent le prospect (l'action est consignée).
- **Activité** ouvre **Nouvelle activité** (type, date, compte rendu, relance) ; **Fait** clôt une activité planifiée.
- **Valider l'estimation** après contrôle de l'estimation instantanée (elle devient visible du prospect dans la proposition).
- **Qualifier** ouvre **Qualification du lead** (besoin, budget, délai, décisionnaire) ; **Statut** ouvre **Statut du lead** (contacté, qualifié, perdu…).
- **Convertir en opportunité** ouvre **Convertir en opportunité** (montant estimé, étape, date de décision) ; **Voir le pipeline** ensuite.
:::

::: perm crm:assign
- **Affecter** ouvre **Affecter le lead** : choisissez le commercial (il est notifié).
:::

## Onglet « Pipeline »

Les opportunités par étape. Glissez une carte pour la faire avancer.

::: perm crm:write
- **Opportunité** ouvre **Nouvelle opportunité**.
- Une affaire perdue s'enregistre via **Opportunité perdue** (motif : prix, délai, concurrent, projet abandonné) : précieux pour l'analyse.
- **Devis** depuis une opportunité crée le devis associé.
:::

## Onglet « Devis »

Les **Devis** : envoi d'un lien sécurisé, suivi de consultation, acceptation par code OTP avec preuve, révisions. Filtre **Statut**. La fiche (**Détail estimatif**, **Échéancier**) propose **PDF**.

::: perm crm:write
1. **Nouveau devis** ouvre **Nouveau devis** : client, lignes (**Ligne** : désignation, quantité, prix unitaire, TVA), échéancier de paiement (**Échéance**), validité.
2. **Modifier** (brouillon) ouvre **Modifier le devis**.
3. **Envoyer** (ou **Renvoyer**) : le client reçoit un lien sécurisé et accepte par code ; **Copier** copie ce lien.
4. **Réviser** crée une nouvelle révision (l'ancienne reste consultable).
5. **Refus client** ouvre **Enregistrer le refus du client** (motif).
:::

::: perm crm:contracts
6. Sur un devis accepté, **Établir le contrat** ouvre **Établir le contrat** (conditions, échéancier contractuel).
:::

::: perm crm:contracts
## Onglet « Contrats »

Les **Contrats clients** (filtre **Statut**) avec leur **Échéancier contractuel**.

1. **Contrat signé** ouvre **Enregistrer la signature du contrat** : date, mode (OTP, signature manuscrite scannée), pièce ; **Enregistrer la signature**.
:::

::: perm crm:contracts
::: perm projects:write
2. **Créer le projet** ouvre **Créer le projet à partir du contrat** : le projet reprend client, montant et échéancier ; l'accès client est ouvert automatiquement (invitation e-mail / WhatsApp) — **Projet** ouvre ensuite la fiche.
:::
:::

## Onglet « Contacts »

Les **Contacts** (filtre **Diaspora**).

::: perm crm:write
- **Nouveau contact** : prénom obligatoire ; organisation, e-mail, téléphone, WhatsApp, fonction, ville, pays, diaspora, responsable, lead d'origine, notes, étiquettes. Modifier ou supprimer depuis la fiche.
:::

## Onglet « Activités »

Les **Activités et relances** de toute l'équipe (filtre **Statut**). **Marquer faite** clôt une relance.

## Onglet « Réglages »

::: perm crm:assign
- **Règles d'affectation des leads** : critères (univers, villes, pays, diaspora, sources, urgence) → commerciaux en tour de rôle ou au moins chargé. **Nouvelle règle** : nom, priorité, critères (univers et sources à cocher, villes, pays, diaspora, score minimal, demandes urgentes ; vide = tous les leads), commerciaux choisis dans l'annuaire, stratégie.
:::

::: perm settings:write
- **Politiques SLA** : délais de première réponse (leads) et de résolution (tickets SAV), escalades automatiques. **Nouvelle politique** : entité, nom, priorité, délais (minutes), escalade, heures ouvrées uniquement. L'escalade se compose de paliers (**Palier d'escalade**) : délai de dépassement en minutes, rôles à prévenir, réaffectation éventuelle du lead.
:::
