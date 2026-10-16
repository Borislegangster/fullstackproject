---
id: erp-planning
title: Planification multi-projets
space: erp
section: Projets
order: 20
route: /erp/planning
perms: [planning:read]
summary: Gantt par projet, capacité des équipes semaine par semaine et calendriers de travail utilisés par l'ordonnancement.
keywords: [planning, gantt, capacité, charge, calendrier, jours fériés, surcharge]
related: [erp-chantier-planning, erp-agenda]
---

## Accès

Menu **Projets › Planning** (écran **Planification** : Gantt, dépendances, chemin critique, références, capacité des équipes et calendriers). Trois onglets.

## Onglet « Gantt projet »

Choisissez un projet pour afficher son diagramme de Gantt (tâches, dépendances, jalons, chemin critique, références figées). Les modifications (dépendances, ordonnancement, références) se font dans la fiche projet : voir [Planning et structure](doc:erp-chantier-planning).

## Onglet « Capacité »

Le tableau **Charge des équipes (jours par semaine)** additionne, pour chaque équipe, les jours planifiés par semaine. Au-delà de 6 jours ouvrés la semaine est en surcharge (en rouge) : réaffectez des tâches ou décalez-les avant que le retard n'apparaisse.

## Onglet « Calendriers de travail »

Les **Calendriers de travail** définissent les jours travaillés, les jours fériés et les heures par jour utilisés par l'ordonnancement (CPM).

::: perm planning:write
1. **Nouveau calendrier** : nom, projet (vide = calendrier de l'entreprise), **Jours travaillés** (ex. lundi à samedi), **Jours fériés** (dates), **Heures par jour**.
2. Ouvrez un calendrier pour le **Modifier** ou le **Supprimer**.
3. Relancez **Ordonnancer (CPM)** dans les projets concernés pour appliquer le nouveau calendrier.
:::
