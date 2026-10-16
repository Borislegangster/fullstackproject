---
id: extranet-factures
title: Factures
space: extranet
section: Facturation
order: 10
route: /extranet/factures
summary: Suivre le traitement de vos factures déposées - contrôle, validation, paiement, montants gelés en cas de litige.
keywords: [facture, contrôle, 3 pièces, validation, paiement, échéance, gelé, réglé]
related: [extranet-paiements, extranet-commandes, extranet-situations]
---

## Où déposer une facture

::: space extranet_subcontractor
- Sous-traitance : depuis une situation validée, **Déposer la facture** (voir [Situations](doc:extranet-situations)).
:::

::: space extranet_supplier
- Fournitures : depuis une commande livrée, **Déposer une facture** (voir [Commandes](doc:extranet-commandes)).
:::

Menu **Facturation › Factures** : la liste de vos factures et de leur traitement.

::: space extranet_subcontractor
## Factures de sous-traitance

**Mes factures** : **N° de facture**, **Type** (situation, avance, libération de retenue de garantie), **Date**, **Montant TTC**, **Réglé**, **Gelé** (montant bloqué par un [litige](doc:extranet-litiges) en cours), **Statut** (déposée, validée, payée…).
:::

::: space extranet_supplier
## Factures de fournitures

**Mes factures** : **N° de facture**, **Référence GLOBUS**, **Date**, **Échéance**, **TTC**, **Réglé**, **Contrôle** et **Statut**. Le **Contrôle** à 3 pièces (commande, réception, facture) affiche « Conforme » ou un écart : un écart doit être levé avec l'acheteur (avoir, livraison complémentaire) avant la mise en paiement.
:::

> [!NOTE]
> Une facture validée est payée à son échéance selon les conditions de votre commande ou de votre marché ; chaque règlement apparaît dans [Paiements](doc:extranet-paiements).
