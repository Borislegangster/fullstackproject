---
id: erp-chantiers
title: Chantiers - liste et fiche projet
space: erp
section: Projets
order: 10
route: /erp/chantiers
routes: [/erp/chantiers/*, /erp/chantiers/*?onglet=synthese, /erp/chantiers/*?onglet=equipe, /erp/chantiers/*/synthese, /erp/chantiers/*/equipe]
perms: [projects:read]
summary: Créer un projet, retrouver un chantier, lire sa synthèse, modifier ses informations, gérer l'équipe projet et naviguer dans les 21 onglets de la fiche.
keywords: [projet, chantier, créer, archiver, équipe, membre, fiche]
related: [erp-chantier-planning, erp-chantier-suivi, erp-chantier-decisions-budget, erp-chantier-patrimoine, erp-chantier-jumeau-sequestre]
---

## La liste des chantiers

Menu **Projets › Chantiers**. La liste présente les projets, sites, phases, lots, le planning, les équipes et l'avancement. Filtrez par **Statut**, **Santé** (dans les temps / à risque / critique) et **Univers** (HOME, BUSINESS, PREMIUM, DIASPORA, ENGINEERING). Vous ne voyez que les projets de votre périmètre (projets dont vous êtes membre, sauf rôles à portée globale).

::: perm projects:write
### Créer un projet

1. Cliquez **Nouveau projet**.
2. Renseignez au minimum le **nom** ; complétez de préférence : client (organisation), univers, offre, type de projet, statut (prospect, étude, conception, permis, préparation, exécution, réception, garantie), adresse et ville (et coordonnées GPS pour le géorepérage), surface, niveaux, dates prévues, montant du contrat et devise, responsable, directeur de projet, commercial, **Visible par le client**, **Diaspora**.
3. Validez : le projet reçoit son code (PRJ-AAAA-NNNNN) et s'ouvre sur sa fiche.

> [!TIP]
> Un projet issu d'un contrat signé se crée plutôt depuis le CRM (**Créer le projet à partir du contrat**) : client, montant et échéancier sont alors repris automatiquement et l'accès du client est ouvert. Voir [CRM](doc:erp-crm).
:::

## La fiche projet

Cliquez un projet pour ouvrir sa fiche. En-tête : code, nom, ville, dates, statut et santé. Les onglets se suivent ainsi :

| Onglet | Contenu | Guide |
| --- | --- | --- |
| Synthèse | informations, indicateurs, prochains jalons, raccourcis | cette page |
| Confiance et preuves | indice de confiance, preuves certifiées | [Suivi du chantier](doc:erp-chantier-suivi) |
| Planning | planning intelligent, Gantt, tâches, références | [Planning et structure](doc:erp-chantier-planning) |
| Sites, phases, lots | structure du projet | [Planning et structure](doc:erp-chantier-planning) |
| Jalons | jalons et parts de paiement | [Planning et structure](doc:erp-chantier-planning) |
| Équipe | membres du projet | cette page |
| Journal de chantier | rapports quotidiens | [Suivi du chantier](doc:erp-chantier-suivi) |
| Photos et vidéos | médias, time-lapse, caméras | [Suivi du chantier](doc:erp-chantier-suivi) |
| Études et livrables | livrables d'études payants, validation client, facture d'études, remise | cette page |
| Décisions, Avenants, Budget, Risques | engagements et finances du projet | [Décisions, avenants et budget](doc:erp-chantier-decisions-budget) |
| Tranquillité, Garanties | dossier foncier et garanties | [Patrimoine du client](doc:erp-chantier-patrimoine) |
| Immersion et digests, Panneau connecté, Avis client | contenus client et image | [Suivi du chantier](doc:erp-chantier-suivi) |
| Jumeau numérique, Séquestre | avancement par l'image, fonds sous séquestre | [Jumeau et séquestre](doc:erp-chantier-jumeau-sequestre) |
| Bâtiment et maintenance, Énergie | passeport du bâtiment, études énergie | [Patrimoine du client](doc:erp-chantier-patrimoine) |

L'onglet affiché est repris dans l'adresse de la page : vous pouvez partager un lien direct vers un onglet.

## Onglet « Études et livrables »

La phase d'études précède le devis de travaux : plans, rendus 3D, notes de calcul sont réalisés, validés par le client,
facturés, puis remis.

1. Dans la [GED](doc:erp-ged), publiez chaque livrable au client et cochez **Livrable d'études payant** (fenêtre
   **Propriétés du document**) : le client le consulte en **aperçu filigrané** (PDF et images), sans pouvoir télécharger
   l'original.
2. Demandez sa validation dans l'onglet **Décisions** (type « Plan », **Type de référence** « Version de document »).
3. Émettez la facture d'études ([Facturation](doc:erp-facturation), type « Études et conception »).
4. Dans **Études et livrables**, choisissez la **Facture d'études** puis **Rattacher les livrables sans facture**.
5. Dès que la facture est entièrement réglée (paiement en ligne ou encaissement approuvé), les originaux sont **remis** au
   client : téléchargement sans filigrane, date de remise tracée, notification « Vos livrables d'études sont disponibles ».

Le tableau indique pour chaque livrable la validation du client, la facture liée et l'état **Aperçu seulement** ou
**Remis**. Le devis de travaux se fait ensuite depuis l'opportunité : il se rattache à ce projet.

## Onglet « Synthèse »

- **Informations** : client, univers, adresses, dates prévues et réelles, montant du contrat, responsables.
- Indicateurs : budget, engagé, dépensé, facturé, encaissé, marge, tâches en retard, incidents ouverts.
- **Prochains jalons**.
- Raccourcis **Hub BIM du projet**, **Documents (GED)** et **Achats du projet**.

::: perm projects:write
### Modifier le projet

Bouton **Modifier** (bloc Informations) : la fenêtre **Modifier le projet** reprend tous les champs de la création. Les changements sont journalisés.

### Archiver le projet

Bouton **Archiver** puis confirmation dans **Archiver le projet** : le projet disparaît des listes actives mais reste consultable et ses données sont conservées (rien n'est supprimé).
:::

## Onglet « Équipe »

Le bloc **Équipe projet** liste les membres et leur rôle sur le projet. Être membre donne accès au projet (pour les rôles sans portée globale) ; le rôle de projet précise la responsabilité (chef de projet, chef de chantier, client…).

::: perm projects:members
### Ajouter ou retirer un membre

1. Cliquez **Ajouter un membre**.
2. Dans **Ajouter un membre**, choisissez l'utilisateur et son rôle sur le projet ; restreignez si besoin ses lots, chantiers et **Disciplines** (cases issues des calques du Hub BIM du projet ; aucune case cochée = toutes les disciplines), l'accès aux finances, puis validez. La ligne du membre rappelle ses disciplines.
3. Pour retirer quelqu'un, cliquez **Retirer** sur sa ligne : il perd l'accès au projet immédiatement.
:::
