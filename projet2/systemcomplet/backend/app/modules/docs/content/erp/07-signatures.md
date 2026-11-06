---
id: erp-signatures
title: Signatures et cachet de l'entreprise
space: erp
section: Pilotage
order: 25
route: /erp/signatures
perms: [signatures:company]
summary: Signer à la main (souris, doigt, stylet) les documents émis par la plateforme - devis, contrats, factures, reçus, bons de commande, marchés, bulletins, rapports - et valider la signature par code ; le cachet de l'entreprise est apposé sur chaque document.
keywords: [signature, signer, manuscrite, cachet, tampon, OTP, code, devis, contrat, facture, reçu, rapport, validation, électronique]
related: [erp-crm, erp-facturation, erp-rapport-direction]
---

## Accès

Menu **Pilotage › Signatures**. La liste réunit tous les documents émis par la plateforme dès leur première édition : devis, contrats, factures et proformas, factures d'avoir, reçus et avis de paiement, bons de commande, marchés de sous-traitance, bulletins de paie, rapports de direction, passeports du bâtiment. Filtres **Statut** (« À signer par l'entreprise », « Signés par l'entreprise », « Tous les documents ») et **Type de document** ; colonnes **Entreprise** et **Client** : « Signé », « À signer » ou « À signer de nouveau ». **PDF** ouvre le document à jour, **Ouvrir** sa fiche.

Le **cachet de l'entreprise** (fond transparent) figure dans le bloc « GLOBUS ENGINEERING » de **chaque** document émis, signé ou non.

## Signer un document au nom de l'entreprise

1. **Signer** (dans la liste, ou dans l'encadré **Signatures** d'une fiche devis ou contrat) ouvre la fenêtre **Signer le document**. **Relire le document** ouvre le PDF.
2. **Votre signature manuscrite** : dessinez-la dans le cadre avec la souris, le doigt (téléphone, tablette) ou un stylet ; **Annuler le trait** retire le dernier trait, **Effacer** recommence. **Mémoriser ma signature** vous la propose ensuite (**Utiliser ma signature enregistrée** ou **Dessiner une nouvelle signature**).
3. **Validation électronique** : cochez **J'approuve et je signe**, choisissez **Recevoir le code par** (e-mail, SMS, WhatsApp) puis **Recevoir mon code** ; saisissez le code reçu et **Signer le document** (**Renvoyer le code** au besoin).
4. La signature est apposée sur le cachet, avec la mention « Signé par … le … à … » et la référence de la preuve (SIG-…). Le PDF conservé (pièce jointe, espace client) est réédité.

Double regard : la personne qui a établi un document ne le signe pas au nom de l'entreprise ; seul le super administrateur le peut, et c'est tracé.

## Signature caduque

La signature est liée au contenu exact du document (parties, lignes, montants, conditions). Si ce contenu change après la signature (par exemple un devis en brouillon modifié), elle n'est plus apposée : le document passe à « À signer de nouveau ». La page publique de vérification (QR code) liste les signatures et leur validité.

::: perm settings:read
## Cachet de l'entreprise

L'encadré **Cachet de l'entreprise** montre le cachet apposé (sur damier : fond transparent).
:::

::: perm settings:write
1. **Remplacer le cachet** ouvre la fenêtre **Remplacer le cachet** : déposez la photo ou le scan du cachet sur papier blanc ; le fond est retiré automatiquement ; **Enregistrer le cachet**.
2. **Cachet officiel** ouvre **Revenir au cachet officiel ?** : le cachet livré avec la plateforme est rétabli (**Revenir au cachet officiel**).
:::
