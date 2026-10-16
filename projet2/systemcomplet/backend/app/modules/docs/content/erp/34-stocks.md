---
id: erp-stocks
title: Stocks
space: erp
section: Achats et logistique
order: 50
route: /erp/stocks
routes: [/erp/stocks/*]
perms: [inventory:read]
summary: Entrées, sorties chantier, transferts, ajustements, réservations par chantier, inventaires, lots matière et valorisation au coût moyen pondéré (CMUP).
keywords: [stock, article, dépôt, emplacement, entrée, sortie, transfert, inventaire, réservation, CMUP, seuil]
related: [erp-livraisons, erp-achats]
---

## Accès

Menu **Achats et logistique › Stocks**. Onglets **État du stock**, **Mouvements**, **Affectations chantier**, **Inventaires**, **Articles, dépôts, emplacements**.

## Onglet « État du stock »

Quantités par article et par dépôt, valeur au CMUP et **Valorisation par dépôt**. Cochez **Seulement sous le seuil** pour voir les articles à réapprovisionner. Cliquez un article pour sa **Répartition (dépôts, emplacements, lots)** et son historique.

::: perm inventory:write
### Mouvements manuels

Depuis l'état du stock ou la fiche d'un article : **Entrée** (réception hors commande), **Sortie chantier**, **Transfert** entre dépôts, **Ajustement** (casse, perte, correction, avec motif). Chaque mouvement est tracé.
:::

## Onglet « Mouvements »

Les **Mouvements de stock** : entrées, sorties chantier, transferts, ajustements, inventaires — traçabilité complète, filtre **Type**.

## Onglet « Affectations chantier »

Les **Affectations chantier** réservent du stock pour un chantier, un lot ou une tâche, puis suivent la sortie, le retour et la consommation (imputation du coût au chantier). Filtre **Statut**.

::: perm inventory:write
1. **Réserver pour un chantier** : article, dépôt, projet et quantité obligatoires ; chantier, lot, tâche.
2. **Sortir** : quantité sortie (et dépôt, motif).
3. **Retour** : quantité revenue au dépôt.
4. **Consommé** : déclare la quantité sortie comme consommée (le coût est imputé au chantier).
5. **Annuler** la réservation si elle n'est plus utile.
:::

## Onglet « Inventaires »

Les **Inventaires** : comptage par dépôt, écarts calculés, validation avec ajustement automatique.

::: perm inventory:write
1. **Lancer un inventaire** : dépôt (et notes).
2. **Saisir / valider** ouvre **Inventaire …** : saisissez les quantités comptées, **Enregistrer le comptage** (plusieurs fois si besoin).
3. **Valider l'inventaire** : les écarts génèrent les ajustements de stock.
:::

## Onglet « Articles, dépôts, emplacements »

- **Articles** et **Lots matière** (traçabilité des lots).
- **Dépôts** et **Emplacements** (rayonnages, zones de chantier).

::: perm inventory:write
- **Nouvel article** : **Référence (SKU)** et nom obligatoires ; catégorie, unité, **Seuil d'alerte**, quantité de réapprovisionnement, fournisseur préféré, consommable, code-barres.
- **Nouveau dépôt** : code et nom, type (central, chantier), chantier, projet, adresse, responsable.
- **Nouvel emplacement** : dépôt, code et libellé.
:::
