---
id: erp-achats
title: Achats - demandes, approbations et bons de commande
space: erp
section: Achats et logistique
order: 10
route: /erp/achats
routes: [/erp/achats/demandes, /erp/achats/demandes/*, /erp/achats/commandes, /erp/achats/commandes/*]
perms: [procurement:read]
summary: Le circuit d'achat complet - besoin, demande, approbation, choix du fournisseur, bon de commande envoyé par WhatsApp ou e-mail, confirmation, expédition, réception, facture et paiement.
keywords: [achat, demande d'achat, approbation, bon de commande, BC, fournisseur, WhatsApp, contre-offre, expédition, commande]
related: [erp-fournisseurs, erp-livraisons, erp-prix-materiaux, erp-facturation]
---

## Le circuit

Besoin → demande → approbation → bon de commande → envoi WhatsApp / e-mail / SMS → confirmation du fournisseur → livraison → réception → facture → paiement. Menu **Achats et logistique › Achats** ; onglets **Demandes d'achat**, **Mes approbations** (approbateurs), **Bons de commande**, **Indicateurs**.

## Onglet « Demandes d'achat »

Les **Demandes d'achat** expriment un besoin (chantier, zone, lot, urgence) qui passe par l'approbation hiérarchique avant toute commande. Filtres **Statut** et **Urgence**.

::: perm procurement:request
### Créer une demande

1. **Nouvelle demande** : **Projet** et lignes (article ou désignation libre, quantité, unité, prix estimé) obligatoires ; chantier, zone, lot, catégorie, centre de coût, **Urgence** (normale, urgente, critique), justification, **Besoin pour le**, ligne budgétaire.
2. Cochez **Soumettre immédiatement** ou enregistrez en brouillon puis, depuis la demande, **Soumettre**.
3. Tant qu'elle n'est pas approuvée, **Annuler** ouvre **Annuler la demande** (motif).
:::

::: perm procurement:approve
## Onglet « Mes approbations »

Les demandes soumises qui attendent votre décision. Ouvrez une demande, vérifiez le **Besoin exprimé** et son estimation, le budget et le **Circuit d'approbation**, puis **Approuver** ou **Refuser** (motif) et **Confirmer**. Au-delà de certains montants, plusieurs niveaux d'approbation s'enchaînent.
:::

::: perm procurement:order
## Commander à partir d'une demande approuvée

1. Dans la demande approuvée, bloc **Choix du fournisseur**, cliquez **Classer les fournisseurs** : classement automatique sur 100 — prix (40), délai (20), qualité (20), stock (10), zone de livraison (10) — pondéré par la couverture des lignes.
2. **Commander** sur le fournisseur choisi ouvre **Commande chez …** : vérifiez les lignes, prix, date prévue et adresse de livraison puis **Créer le bon de commande**. Les commandes créées apparaissent dans **Commandes générées**.
:::

## Onglet « Bons de commande »

Les **Bons de commande** sont envoyés par WhatsApp, e-mail ou SMS avec traçabilité, puis suivis jusqu'à la facture. Filtre **Statut** ; **Exporter** selon vos droits.

::: perm procurement:order
### Commande directe

**Commande directe** (sans demande préalable) : projet, fournisseur, **Justification** et lignes obligatoires ; chantier, lot, urgence, date prévue, adresse de livraison, conditions de paiement, notes. Selon le montant, la commande passe par l'approbation.
:::

### Suivre une commande

La fiche commande présente **Lignes**, **Informations**, **Messages fournisseur (WhatsApp / e-mail / SMS)** et **Livraisons, réceptions et factures**. Boutons **PDF** (bon de commande) et **QR réception** (à remettre au livreur : le scan ouvre la réception).

::: perm procurement:approve
- **Approuver** une commande en attente d'approbation.
:::

::: perm procurement:order
- **Envoyer au fournisseur** ouvre **Envoyer le bon de commande** : canal (WhatsApp, e-mail, SMS) et message ; **Envoyer**. **Relancer** renvoie la commande sans réponse.
- Si le fournisseur propose une contre-offre (prix, quantités, délai), **Accepter la contre-offre** ou relancez la négociation.
- **Saisir une expédition** ouvre **Expédition annoncée par le fournisseur** (date, transporteur, lignes expédiées) quand il l'annonce par téléphone.
- **Modifier** ouvre **Modifier la commande** (avant envoi ou en cours de négociation).
- **Noter le fournisseur** ouvre **Noter le fournisseur** (qualité, délai, service) après livraison.
- **Clôturer** ouvre **Clôturer la commande** une fois reçue et facturée.
- **Annuler** ouvre **Annuler la commande** (motif, fournisseur prévenu).
:::

- **Réceptionner** ouvre la réception de la commande (voir [Livraisons](doc:erp-livraisons)).

## Onglet « Indicateurs »

**Commandes par statut**, **Top fournisseurs (dépenses)**, délais moyens de validation et de livraison.
