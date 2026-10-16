---
id: client-validations
title: Validations - décisions et avenants
space: client
section: Mon projet
order: 90
route: /espace-client/validations
summary: Valider ou refuser les décisions (choix de finitions, options techniques) et les avenants soumis à votre accord - chaque validation est sécurisée par code à usage unique et figée.
keywords: [validation, décision, avenant, choix, option, valider, refuser, approuver, code, OTP, signature]
related: [client-configurateur, client-passeport, client-preuves]
---

## Accès

Menu **Validations** : décisions et avenants soumis à votre accord. Onglets **Décisions** et **Avenants** (avec le nombre en attente) et **Historique**.

Chaque décision présente : numéro, nature, version, titre, échéance (« avant le … »), description, **Impact prix**, **Impact délai** et, s'il y a lieu, les options proposées avec leur prix.

::: perm client:decide
## Valider une décision

1. **Valider** ouvre **Valider la décision**.
2. Choisissez l'**Option retenue** s'il y a plusieurs options ; l'impact prix et délai est rappelé (un avenant est créé automatiquement si nécessaire).
3. **Recevoir le code par** e-mail, SMS ou WhatsApp, **Recevoir mon code**, saisissez le **Code reçu** et confirmez.

La validation est horodatée et associée à l'empreinte du contenu validé : elle ne peut plus être modifiée.

## Refuser une décision

**Refuser** ouvre **Refuser la décision** : indiquez le **Motif du refus** (5 caractères minimum) puis **Refuser**. Votre chef de projet est prévenu et vous propose une alternative.

## Avenants

Un avenant modifie le contrat (prix et/ou délai) : numéro, objet, montant, impact délai.

- **Approuver** ouvre **Approuver l'avenant** : même procédure par code puis **Approuver**.
- **Refuser** ouvre **Refuser l'avenant** : motif puis **Refuser**.
:::

> [!NOTE]
> Si votre profil ne permet que la consultation (co-titulaire, mandataire…), la page l'indique : « seul le titulaire du contrat peut valider ».

## Historique

Toutes les décisions et tous les avenants traités, avec leur statut (validé, refusé…) et leur date. Le détail de chaque validation (qui, quand, comment, empreinte) figure dans le **Journal des validations** du [Passeport projet](doc:client-passeport).
