---
id: erp-echeanciers
title: Échéanciers clients
space: erp
section: Finance
order: 30
route: /erp/finances/echeanciers
perms: [billing:read]
summary: Étudier les demandes d'échelonnement des clients, proposer un échéancier accepté par code, suivre les échéances, rappels et liens de paiement automatiques.
keywords: [échéancier, échelonnement, paiement fractionné, rappel, défaut, Mobile Money]
related: [erp-facturation, erp-finances]
---

## Principe

Un client peut demander à échelonner un appel de fonds ou une facture depuis son espace. La finance étudie la demande et propose un échéancier ; le client l'accepte par code ; les rappels et liens de paiement partent ensuite automatiquement avant chaque échéance. Menu **Finance › Échéanciers clients**.

Onglets : **À étudier** (demandes reçues), **Proposés** (en attente d'acceptation), **En cours**, **En défaut** (échéance impayée), **Tous**.

::: perm billing:write
## Proposer un échéancier

1. Dans **À étudier**, ouvrez la demande (montant, motif, nombre d'échéances souhaité).
2. **Proposer au client** ouvre **Proposer l'échéancier …** : ajustez les échéances (date, montant ; **Ajouter une échéance**) — le total doit égaler le montant restant dû.
3. Validez : le client reçoit la proposition et l'accepte par code depuis son espace.

## Refuser une demande

**Refuser** ouvre **Refuser la demande** : le **Motif communiqué au client** est obligatoire.
:::

## Suivre les échéanciers

Dans **En cours**, chaque échéance indique son statut (à venir, payée, en retard). Un échéancier passe **En défaut** si une échéance reste impayée après les relances : reprenez contact avec le client ; les montants restent recouvrables par les relances habituelles.
