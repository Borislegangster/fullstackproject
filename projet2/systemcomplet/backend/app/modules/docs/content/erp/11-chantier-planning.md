---
id: erp-chantier-planning
title: Fiche projet - planning, structure et jalons
space: erp
section: Chantier (fiche projet)
order: 10
routes: [/erp/chantiers/*?onglet=planning, /erp/chantiers/*?onglet=structure, /erp/chantiers/*?onglet=jalons, /erp/chantiers/*/planning, /erp/chantiers/*/structure, /erp/chantiers/*/jalons]
perms: [projects:read]
summary: Planning intelligent (météo, livraisons, absences), Gantt avec dépendances et chemin critique, tâches et avancement, sites, phases, lots et jalons de paiement.
keywords: [gantt, tâche, dépendance, CPM, chemin critique, baseline, référence, site, phase, lot, jalon, avancement, retard, météo]
related: [erp-chantiers, erp-planning]
---

## Onglet « Planning »

### Planning intelligent

Chaque matin, l'analyse automatique repère les risques de retard des 30 prochains jours : pluie annoncée sur les tâches extérieures, livraisons tardives, absences, retards en cascade. Chaque risque indique les tâches touchées et le décalage estimé.

::: perm planning:write
- **Analyser maintenant** relance l'analyse.
- **Replanifier** applique le décalage proposé : la fenêtre **Planning ajusté** montre la nouvelle date de fin.
- **Écarter** ignore un risque non pertinent : la fenêtre **Écarter le risque** demande un motif.
:::

::: perm projects:publish_client
- Pour un retard qui touche le client, choisissez **Prévenir le client** (message clair dans son espace) ou **Ne pas prévenir**.
:::

### Diagramme de Gantt

Le **Diagramme de Gantt** affiche tâches, durées, dépendances, jalons et chemin critique (en rouge).

::: perm planning:write
1. **Dépendance** : dans **Ajouter une dépendance**, choisissez la tâche précédente, la tâche suivante, le type (fin-début par défaut) et le décalage éventuel.
2. **Ordonnancer (CPM)** recalcule toutes les dates à partir des durées, dépendances, contraintes et calendriers de travail, puis indique la nouvelle fin prévue.
3. **Figer une référence** : dans **Figer une référence de planning**, nommez la référence (« Contrat », « Révision 1 »…). Elle apparaît dans **Références de planning (baselines)** et sert à mesurer les écarts.
:::

### Tâches

La liste des tâches (filtre **Statut**) présente le code WBS, les dates, l'avancement et la visibilité client.

::: perm planning:write
- **Nouvelle tâche** : titre (obligatoire), description, phase, lot, chantier, zone, tâche parente, code WBS, statut, priorité, dates et durée, jalon, heures estimées, coût prévu, points à vérifier (bouton **Point à vérifier**), contrainte de date, **Visible par le client**.
- Supprimer une tâche : ouvrez-la puis **Supprimer** (confirmation).
:::

- **Avancement** (dans la fiche d'une tâche) : saisissez le pourcentage (obligatoire), une note et des preuves (photos). L'avancement du projet est recalculé.

## Onglet « Sites, phases, lots »

::: perm projects:write
- **Nouveau site** : projet, code et nom (obligatoires), adresse et ville, coordonnées GPS et **Rayon de géorepérage (m)** (utilisé pour le pointage), chef de chantier, dates, instructions d'accès, notes sécurité, **URL du direct** (caméra).
- **Nouveau lot** : code et nom, discipline, budget, sous-traitant, statut et avancement.
:::

::: perm planning:write
- **Nouvelle phase** : nom, ordre, dates prévues et réelles, avancement, couleur, **Visible par le client**.
:::

Ouvrez un site, une phase ou un lot pour le modifier ou le supprimer (selon vos droits).

## Onglet « Jalons »

Les jalons portent les étapes clés et, le cas échéant, la **Part de paiement (%)** qui déclenche un appel de fonds.

::: perm planning:write
1. **Nouveau jalon** : nom, date d'échéance (obligatoires), description, statut, **Visible par le client**, part de paiement, ordre.
2. Quand l'étape est réalisée, ouvrez le jalon, **Modifier**, passez le statut à « atteint » et renseignez **Atteint le**.
:::

> [!NOTE]
> Un jalon atteint peut déclencher la demande de libération des fonds sous séquestre (voir [Jumeau et séquestre](doc:erp-chantier-jumeau-sequestre)).
