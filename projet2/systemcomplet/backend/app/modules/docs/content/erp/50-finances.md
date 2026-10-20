---
id: erp-finances
title: Finances - trésorerie, paiements, engagements, banque et caisses
space: erp
section: Finance
order: 10
route: /erp/finances
routes: [/erp/finances/paiements, /erp/finances/paiements/*]
perms: [finance:read]
summary: Pilotage de la trésorerie et des marges, paiements à double regard (approbation puis exécution manuelle ou Mobile Money, encaissements clients hors ligne), engagements, prévisions, rapprochement bancaire et petites caisses de chantier.
keywords: [finance, trésorerie, paiement, décaissement, encaissement, double validation, Mobile Money, MTN, Orange, banque, rapprochement, caisse, engagement, prévision, marge]
related: [erp-facturation, erp-echeanciers, erp-sequestre]
---

## Accès

Menu **Finance › Finances** : budgets, engagements, trésorerie, paiements à double regard, rapprochement bancaire, petites caisses. Onglets **Pilotage**, **Paiements**, **Engagements**, **Prévisions**, **Banque**, **Petites caisses**.

## Onglet « Pilotage »

- **Trésorerie prévisionnelle** : encaissements attendus (appels de fonds, prévisions pondérées) moins décaissements (factures fournisseurs et sous-traitants à échéance).
- **Marges par projet** : coût prévisionnel = le plus élevé du budget approuvé, de l'engagé et du dépensé.
- **Créances en retard** : appels de fonds échus non réglés (relances dans [Facturation](doc:erp-facturation)).

## Onglet « Paiements »

Les **Paiements** : encaissements clients (en ligne par carte ou Mobile Money confirmés par webhooks signés, ou hors ligne saisis depuis la [Facturation](doc:erp-facturation) avec preuve) et décaissements, approuvés à double regard. Filtres **Sens** (**Encaissements** / **Décaissements**) et **Statut** ; **Exporter** selon vos droits. La fiche **Paiement …** montre les **Pièces réglées**, l'**Historique** (créé et approuvé par qui), le **Reçu** et la **Preuve d'exécution** ou la **Preuve de l'encaissement**.

::: perm finance:pay
### Créer un ordre de paiement

**Ordre de paiement** ouvre **Nouvel ordre de paiement** : bénéficiaire et pièces à régler (factures fournisseurs ou sous-traitants validées « bon à payer »), montant, mode, date ; **Créer l'ordre de paiement**. L'ordre attend l'approbation.
:::

::: perm finance:approve
### Approuver (double regard)

Ouvrez le paiement « à approuver » puis **Approuver** (fenêtre **Approuver le paiement**). Vous ne pouvez pas approuver un ordre que vous avez créé vous-même : une seconde personne est requise.
:::

::: perm finance:approve
### Approuver un encaissement hors ligne

Filtrez **Sens** : **Encaissements** et **Statut** : « À approuver », puis ouvrez l'encaissement (bandeau **Encaissement à vérifier**).

1. Ouvrez la **Preuve de l'encaissement** et comparez montant, **Référence** et **Date de valeur** avec le relevé bancaire, le relevé Mobile Money ou la caisse.
2. **Approuver** ouvre **Approuver l'encaissement** : à la confirmation, l'appel de fonds ou la facture passe « Partiellement payé » ou « Payé », le **Reçu** PDF est émis, le client est notifié et le voit dans son espace (**Paiements et reçus**).
3. Sinon **Refuser** ouvre **Refuser l'encaissement** : **Motif** obligatoire ; la pièce reste due.

La personne qui a saisi l'encaissement ne peut jamais l'approuver, quel que soit son rôle ; elle peut seulement **Retirer la saisie** (fenêtre **Retirer la saisie**, motif obligatoire).
:::

::: role DIRECTION, ADMIN
### Paiement bloqué par le contrôle interne

Si le contrôle interne détecte une anomalie (coordonnées bancaires modifiées récemment, paiement en double, montant inhabituel), la fenêtre **Paiement bloqué par le contrôle interne** l'explique. Seule la Direction peut **Approuver par dérogation**, avec une justification tracée.
:::

::: perm finance:pay
### Exécuter le paiement

1. Sur un paiement approuvé, **Exécuter** ouvre **Exécuter le paiement**.
2. Choisissez le mode : **Virement / Mobile Money effectué hors plateforme (preuve jointe)** — saisissez la **Référence bancaire / Mobile Money** et joignez la **Preuve d'exécution** (ordre signé, reçu) — ou **Transfert automatique** par l'opérateur configuré (MTN MoMo / Orange Money crédite le numéro enregistré sur la fiche du bénéficiaire).
3. **Confirmer l'exécution**. Un transfert automatique passe « en cours » jusqu'à la confirmation de l'opérateur : **Actualiser le statut** relit son état.
:::

## Onglet « Engagements »

Les **Engagements** : bons de commande et marchés engagés, consommés au fil des factures validées. Filtre **Statut**.

## Onglet « Prévisions »

Les **Prévisions de trésorerie** : encaissements et décaissements attendus hors factures (pondérés par leur probabilité). Filtre **Sens**.

::: perm finance:write
- **Nouvelle prévision** : libellé, sens, **Date prévue** obligatoires ; projet, montant, **Probabilité**, détails. Modifiez ou supprimez depuis la fiche.
:::

## Onglet « Banque »

Les **Comptes bancaires et Mobile Money** : import des relevés, rapprochement automatique (référence + montant) puis manuel. Un encaissement hors ligne approuvé est reconnu par la référence saisie (n° de virement, de chèque, de transaction).

::: perm finance:reconcile
- **Nouveau compte** : nom obligatoire, banque, numéro, devise, type (banque, Mobile Money).
- **Importer et rapprocher** : déposez le relevé (CSV) ; les lignes reconnues sont rapprochées automatiquement.
- **Rapprocher** une ligne restante ouvre **Rapprochement manuel** : choisissez le paiement correspondant.
:::

## Onglet « Petites caisses »

Les **Petites caisses de chantier** : déclaration des dépenses avec justificatif, validation, solde et plafond.

::: perm finance:write
- **Nouvelle caisse** : nom obligatoire, projet, chantier, gestionnaire, **Plafond**.
- **Déclarer un mouvement** ouvre **Mouvement de caisse** : dépense ou approvisionnement, montant, motif, justificatif photo.
:::

::: perm finance:approve
- Sur un mouvement en attente : **Valider** ou **Refuser**. Le solde n'est débité qu'après validation.
:::
