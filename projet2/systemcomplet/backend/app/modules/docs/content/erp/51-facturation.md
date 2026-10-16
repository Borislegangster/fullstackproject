---
id: erp-facturation
title: Facturation clients et fournisseurs
space: erp
section: Finance
order: 20
route: /erp/facturation
routes: [/erp/facturation/fournisseurs, /erp/facturation/fournisseurs/*]
perms: [billing:read]
summary: Factures clients, appels de fonds, relances et liens de paiement, avoirs ; factures fournisseurs avec rapprochement 3 pièces, arbitrage des anomalies, bon à payer ; balance âgée et export comptable.
keywords: [facture, appel de fonds, acompte, TVA, avoir, relance, lien de paiement, rapprochement, 3 pièces, bon à payer, balance âgée, export comptable]
related: [erp-finances, erp-echeanciers, erp-sous-traitants]
---

## Accès

Menu **Finance › Facturation** : clients (appels de fonds, factures, avoirs, relances) et fournisseurs / sous-traitants (3 pièces, validation, bon à payer). Onglets **Factures clients**, **Appels de fonds**, **Factures fournisseurs**, **Anomalies 3 pièces**, **Factures sous-traitants**, **Avoirs**, **Balance âgée**, **Export comptable**.

## Onglet « Factures clients »

Circuit : brouillon → validation → envoi (notification espace client) → règlement en ligne ou manuel → avoir éventuel. Filtre **Statut** ; **Exporter** selon vos droits.

::: perm billing:write
- **Nouvelle facture** : **Titre**, **Date d'émission** et lignes obligatoires ; projet, organisation, contrat, type (facture, acompte, situation, solde), échéance, taux de TVA (19,25 % par défaut), devise, notes.
- **Modifier le brouillon** tant qu'elle n'est pas validée.
- **Envoyer au client** : il est notifié dans son espace et peut régler en ligne.
- **Relancer le client** : relance de paiement (espace client, e-mail, notification). Des relances graduées partent aussi automatiquement.
- **Copier un lien de paiement** : lien sécurisé à envoyer au client (WhatsApp, e-mail) pour payer sans se connecter.
:::

::: perm billing:validate
- **Valider** : la facture n'est plus modifiable et son PDF est généré (numérotation définitive).
- **Émettre un avoir** : montant et motif obligatoires ; **Annuler la facture** : motif obligatoire.
:::

- **PDF** télécharge la facture.

## Onglet « Appels de fonds »

L'échéancier client lié aux jalons ; l'émission génère la facture d'acompte et la notification de paiement. Filtre **Statut**.

::: perm billing:write
- **Nouvel appel de fonds** : projet, libellé, montant obligatoires ; jalon, devise, échéance.
- **Émettre** : une facture d'acompte (TVA 19,25 %) est générée et le client est notifié.
:::

## Onglet « Factures fournisseurs »

Les **Factures fournisseurs** : rapprochement 3 pièces (commande, réception, facture) avec tolérances, arbitrage des anomalies, validation finance, paiement. Filtre **Statut**.

::: perm billing:write
### Saisir une facture fournisseur

**Saisir une facture** ouvre **Facture fournisseur** : fournisseur, référence et date de sa facture, bon de commande, lignes (**Ligne**) ; **Enregistrer la facture**. Les factures déposées par les fournisseurs sur l'extranet arrivent directement ici.
:::

La fiche (**… — fournisseur**) présente le **Rapprochement 3 pièces** (écarts de quantité et de prix au regard des tolérances), les **Lignes facturées** et les **Règlements** ; **Facture PDF** ouvre la pièce.

::: perm billing:write
- **Rapprocher** lance le rapprochement avec la commande et les réceptions.
:::

::: perm finance:approve
- **Arbitrer** une facture en anomalie ouvre **Arbitrage de l'anomalie** : accepter l'écart (avec justification) ou demander un avoir.
:::

::: perm billing:validate
- **Valider (bon à payer)** une facture rapprochée.
- **Avoir fournisseur** ouvre **Avoir fournisseur** (montant, motif).
:::

::: perm finance:pay
- **Payer** ouvre **Ordre de paiement** pour la facture (puis approbation et exécution : voir [Finances](doc:erp-finances)).
:::

::: perm disputes:write
- **Ouvrir un litige** ouvre **Ouvrir un litige fournisseur** : le montant contesté est gelé.
:::

## Onglet « Anomalies 3 pièces »

Les factures dont le rapprochement dépasse les tolérances, à arbitrer en priorité.

## Onglet « Factures sous-traitants »

Les factures issues des situations validées ; validation pour paiement (voir [Sous-traitance](doc:erp-sous-traitants)).

## Onglet « Avoirs »

Les **Avoirs** clients et fournisseurs ; filtre **Côté**.

## Onglet « Balance âgée »

Créances et dettes par tranche d'ancienneté : **Non échu**, **1–30 j**, **31–60 j**, **61–90 j**, **+ 90 j**.

::: perm reports:export
## Onglet « Export comptable »

Choisissez la période puis **Export comptable (CSV)** : écritures de ventes, d'achats et de règlements pour votre logiciel comptable.
:::
