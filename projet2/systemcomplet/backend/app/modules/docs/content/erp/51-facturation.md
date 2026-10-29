---
id: erp-facturation
title: Facturation clients et fournisseurs
space: erp
section: Finance
order: 20
route: /erp/facturation
routes: [/erp/facturation/fournisseurs, /erp/facturation/fournisseurs/*]
perms: [billing:read]
summary: Factures clients, appels de fonds, relances et liens de paiement, encaissements hors ligne (virement, espèces, chèque, Mobile Money direct), avoirs ; factures fournisseurs avec rapprochement 3 pièces, arbitrage des anomalies, bon à payer ; balance âgée et export comptable.
keywords: [facture, appel de fonds, acompte, TVA, avoir, relance, lien de paiement, encaissement, virement, espèces, chèque, preuve, rapprochement, 3 pièces, bon à payer, balance âgée, export comptable]
related: [erp-finances, erp-echeanciers, erp-sous-traitants]
---

## Accès

Menu **Finance › Facturation** : clients (appels de fonds, factures, avoirs, relances) et fournisseurs / sous-traitants (3 pièces, validation, bon à payer). Onglets **Factures clients**, **Appels de fonds**, **Factures fournisseurs**, **Anomalies 3 pièces**, **Factures sous-traitants**, **Avoirs**, **Balance âgée**, **Export comptable**.

## Onglet « Factures clients »

Circuit : **proforma** (brouillon) → **validation par une autre personne** (facture **définitive** : numéro, PDF et QR d'authenticité) → envoi (notification espace client) → règlement en ligne ou manuel → **facture d'avoir** éventuelle. La colonne **Catégorie** distingue : proforma, facture définitive, facture d'acompte, facture de situation (appel de fonds), facture de solde, facture d'études, annulée. Filtre **Statut** ; **Exporter** selon vos droits.

> [!NOTE]
> Double regard : la personne qui prépare une facture, un appel de fonds, un encaissement, un budget, une paie, un avoir de dépense… ne peut pas valider elle-même sa saisie ; une autre personne habilitée le fait. Seul le **super administrateur** peut saisir puis valider lui-même ; chaque cas est tracé au journal d'audit.

::: perm billing:write
- **Nouvelle facture** : **Titre**, **Date d'émission** et lignes obligatoires ; projet, organisation, contrat, type (facture, acompte, situation, solde, **Études et conception** : facture des études, dont le règlement remet au client les livrables d'études liés), échéance, taux de TVA (19,25 % par défaut), devise, notes.
- **Modifier le brouillon** tant qu'elle n'est pas validée ; **Proforma (PDF)** remet au client une facture proforma (tampon « PROFORMA », sans valeur comptable, avec son propre QR).
- **Envoyer au client** : il est notifié dans son espace et peut régler en ligne.
- **Relancer le client** : relance de paiement (espace client, e-mail, notification). Des relances graduées partent aussi automatiquement.
- **Copier un lien de paiement** : lien sécurisé à envoyer au client (WhatsApp, e-mail) pour payer sans se connecter.
:::

::: perm billing:validate
- **Valider (facture définitive)** : par une autre personne que celle qui a préparé la proforma ; la facture n'est plus modifiable, son PDF définitif est généré (numérotation définitive, QR d'authenticité).
- **Émettre une facture d'avoir** : montant et motif obligatoires ; le PDF de la facture d'avoir (note de crédit) est produit et visible du client. **Annuler la facture** : motif obligatoire ; le PDF est réédité avec le tampon « ANNULÉE ».
:::

- **PDF** télécharge la facture définitive ; chaque facture d'avoir a son propre PDF dans la fiche et dans l'onglet **Avoirs**.

La fiche d'une facture liste ses **Règlements** (y compris ceux imputés sur l'appel de fonds qui l'a générée) et ses relances.

## Onglet « Appels de fonds »

L'échéancier client lié aux jalons ; l'émission, par une autre personne que celle qui a préparé l'appel, génère sa **facture d'appel de fonds** définitive et la notification de paiement. Filtre **Statut**. La fiche d'un appel indique le **Montant appelé**, l'**Encaissé**, le **Reste dû**, les **Encaissements à approuver** et ses **Règlements**.

::: perm billing:write
- **Nouvel appel de fonds** : projet, libellé, montant obligatoires ; jalon, devise, échéance.
- **Émettre** (double regard) : la facture d'appel de fonds (TVA 19,25 %, PDF et QR) est générée et le client est notifié.
:::

::: perm finance:write, billing:write
## Enregistrer un encaissement hors ligne

Pour un règlement reçu hors plateforme (virement bancaire, espèces, chèque, dépôt Mobile Money direct sur le compte GLOBUS), sur un appel de fonds émis ou une facture validée, envoyée, partiellement payée ou en retard.

1. Action **Enregistrer un encaissement** (onglet **Appels de fonds** ou **Factures clients**).
2. **Montant encaissé** : prérempli avec le reste dû ; un paiement partiel est possible, jamais au-delà du reste dû (les encaissements déjà saisis et non approuvés sont déduits).
3. **Mode de règlement**, **Date de valeur** (crédit du compte, remise du chèque ou des espèces, jamais future).
4. **Référence** : n° de virement, de chèque ou de transaction Mobile Money, obligatoire sauf pour les espèces ; elle sert au rapprochement bancaire et une même référence ne peut pas être saisie deux fois.
5. **Preuve de l'encaissement** obligatoire (avis de crédit, bordereau de remise, copie du chèque, reçu Mobile Money), **Notes** facultatives.
6. **Enregistrer un encaissement** : le paiement est créé « à approuver » ; rien n'est encore réglé ni visible du client.

Sur la facture générée par un appel de fonds, l'encaissement est imputé sur l'appel, qui solde aussi la facture.
:::

> [!NOTE]
> Double regard : une **autre personne** disposant de la validation finance vérifie la preuve puis approuve l'encaissement dans [Finances › Paiements](doc:erp-finances) (seul le super administrateur peut saisir puis approuver lui-même). La pièce passe alors « Partiellement payé » ou « Payé », le reçu PDF est émis et le client est notifié.

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
