---
id: erp-rapports
title: Rapports, exports, anomalies et prévisions
space: erp
section: Pilotage
order: 10
route: /erp/rapports
routes: [/erp/rapports/anomalies]
perms: [reports:read]
summary: Synthèse hebdomadaire, exports Excel / CSV de vos données, anomalies détectées automatiquement (contrôle interne) et prévisions coût / délai par la valeur acquise.
keywords: [rapport, export, excel, csv, anomalie, fraude, contrôle interne, EVM, CPI, SPI, prévision]
related: [erp-tableau-de-bord, erp-rapport-direction, erp-ia]
---

## Accès

Menu **Pilotage › Rapports**. L'écran comporte quatre onglets ; certains n'apparaissent que si votre profil y a droit.

## Onglet « Synthèse hebdomadaire »

Chiffres de la semaine en cours : **Nouveaux leads**, **Bons de commande émis**, **Encaissements**, **Incidents QHSE**, ainsi que l'activité chantier. Aucune action n'est requise : c'est une lecture rapide.

::: perm reports:export
## Onglet « Exports »

Les exports sont limités à votre périmètre (projets auxquels vous êtes affecté, niveau de confidentialité) et chaque export est tracé dans le journal d'audit.

1. Ouvrez l'onglet **Exports**.
2. Pour le jeu de données voulu (chantiers, factures clients, factures fournisseurs, paiements, bons de commande, leads, tickets, incidents, pointages…), cliquez **Excel** ou **CSV**.
3. Le fichier se télécharge immédiatement.

> [!NOTE]
> Les boutons **Exporter** présents sur les listes des autres écrans utilisent le même mécanisme (même droit, même traçabilité).
:::

::: perm reports:read, finance:read
## Onglet « Anomalies »

Le contrôle interne détecte automatiquement : factures supérieures au bon de commande, prix ou quantités hors norme, factures en double ou quasi dupliquées, facture antérieure à la commande, fractionnement de commandes, paiements inhabituels ou en double, coordonnées bancaires modifiées, écarts de stock et pointages atypiques. Chaque anomalie indique le **montant à risque**, la **gravité** et les preuves (panneau de détail).

- Filtrez par **Statut** (nouvelle, confirmée, écartée, résolue) et par **Type**.
- Cliquez une ligne pour voir la description et les éléments de preuve.

::: perm reports:export
### Lancer une analyse

Le bouton **Lancer une analyse** relance immédiatement toutes les règles de détection (elles tournent aussi automatiquement chaque nuit). Un message récapitule le nombre d'anomalies trouvées par type.
:::

::: perm finance:approve, procurement:approve, reports:export
### Traiter une anomalie

1. Ouvrez l'anomalie.
2. Choisissez **Confirmer** (l'anomalie est réelle : à traiter), **Écarter (faux positif)** ou **Marquer résolue**.
3. Saisissez la **Note de revue** (obligatoire) puis validez : la décision, son auteur et la date restent visibles dans la fiche.
:::
:::

## Onglet « Prévisions »

Prévision coût / délai par la valeur acquise (EVM) :

1. Choisissez un projet dans **Choisir un projet…**.
2. Lisez le **CPI** (performance des coûts : moins de 1 = dépassement), le **SPI** (performance du planning : moins de 1 = retard), le **coût à terminaison estimé** et la **date d'achèvement estimée**, ainsi que leur évolution dans le graphique.
3. **Recalculer** met à jour la prévision avec les dernières données (avancement, dépenses, engagements).
