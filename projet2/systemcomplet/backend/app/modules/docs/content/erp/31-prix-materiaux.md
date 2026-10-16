---
id: erp-prix-materiaux
title: Prix des matériaux et achats prédictifs
space: erp
section: Achats et logistique
order: 20
route: /erp/achats/prix
perms: [procurement:read]
summary: Indice local des prix réels (ciment, acier, sable…), tendance et prévision à 4 semaines, recommandations d'achat anticipé chiffrées.
keywords: [prix, indice, ciment, acier, tendance, prévision, anticiper, hausse]
related: [erp-achats, erp-fournisseurs]
---

## À quoi sert cet écran

Menu **Achats et logistique › Prix des matériaux** (écran **Indice des prix et achats prédictifs**). Les prix proviennent des données réelles : catalogues fournisseurs de l'extranet, bons de commande et factures. Pour chaque matériau : prix courant, tendance, prévision à 4 semaines.

::: perm procurement:approve
- **Actualiser** recalcule l'indice et les recommandations (calcul automatique chaque semaine).
:::

## Recommandations d'achat anticipé

Quand une hausse est prévue sur un matériau dont des chantiers auront besoin, une carte « Acheter maintenant » indique la hausse attendue, les quantités et l'**économie attendue**.

::: perm procurement:order
- **Anticiper** crée la commande anticipée (circuit d'achat habituel).
- **Écarter** ouvre **Écarter la recommandation** : indiquez le motif (stock suffisant, fournisseur déjà engagé…).
:::

> [!NOTE]
> Les prévisions sont indicatives : elles reposent sur l'historique réel et ne tiennent pas compte d'événements exceptionnels (pénurie, changement de taxe).
