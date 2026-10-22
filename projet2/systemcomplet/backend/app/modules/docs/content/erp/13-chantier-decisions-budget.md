---
id: erp-chantier-decisions-budget
title: Fiche projet - décisions, avenants, budget et risques
space: erp
section: Chantier (fiche projet)
order: 30
routes: [/erp/chantiers/*?onglet=decisions, /erp/chantiers/*?onglet=avenants, /erp/chantiers/*?onglet=budget, /erp/chantiers/*?onglet=risques, /erp/chantiers/*/decisions, /erp/chantiers/*/avenants, /erp/chantiers/*/budget, /erp/chantiers/*/risques]
perms: [projects:read]
summary: Faire valider des choix au client par code, gérer les avenants (client puis finance), les versions de budget, engagements et dépenses, et le registre des risques.
keywords: [décision, OTP, validation client, avenant, budget, version, engagement, dépense, risque, exposition]
related: [erp-chantiers, erp-finances, erp-facturation]
---

## Onglet « Décisions »

Les **Décisions client** sont soumises à la validation du client par code à usage unique (OTP) ; une décision validée est figée (horodatage et empreinte, preuve opposable).

::: perm projects:write
### Demander une décision au client

1. Cliquez **Demander une décision**.
2. Renseignez le type (matériau, option, plan, budget, planning, autre) et le **Titre** (obligatoires), la description, les **Options proposées au client** (bouton **Option** : libellé, impact prix, impact délai, description), l'**Impact prix** et l'**Impact délai (jours)**, la référence éventuelle (type : version de document, version BIM, scénario du configurateur, puis **Pièce concernée** choisie dans la liste du projet) et la **Date d'échéance**.
3. Validez : le client est notifié et répond dans **Validations** de son espace. Le résultat (validée / refusée, horodatage, canal du code) s'affiche dans la liste.
:::

## Onglet « Avenants »

Circuit : brouillon → soumis au client (OTP) → approuvé par le client → approbation finance (impact budget et contrat).

::: perm projects:write
### Préparer et soumettre un avenant

1. **Nouvel avenant** : projet et **Titre** (obligatoires), lot, description, motif (demande client, technique, imprévu, réglementaire), **Impact coût**, **Impact délai (jours)**, lignes chiffrées (bouton **Ligne chiffrée** : désignation, quantité, unité, prix unitaire ; montant et total calculés).
2. Ouvrez l'avenant puis **Soumettre au client** : il le valide ou le refuse par code dans son espace.
3. **Repasser en brouillon** retire l'avenant de la validation client pour le corriger ; **Annuler** l'abandonne.
:::

::: perm finance:approve
### Approuver un avenant validé par le client

Ouvrez l'avenant « approuvé client » puis **Approuver (finance)** : le montant du contrat et le budget sont mis à jour. **Rejeter** le renvoie avec un motif.
:::

## Onglet « Budget »

Le bloc **Budgets (versions)** conserve chaque version (initiale, révisions) avec ses lignes par lot et catégorie ; la version approuvée sert de référence aux marges.

::: perm finance:write
- **Nouvelle version** ouvre **Nouvelle version de budget** : lignes (lot, catégorie, libellé, montant).
- **Nouvelle dépense** (liste **Dépenses**) : libellé, montant et **Date de la dépense** (obligatoires), lot, catégorie, **Justificatif (facture, ticket, reçu)** à déposer (photo ou PDF), **Visible par le client**. La colonne **Justificatif** l'ouvre (**Ouvrir**).
:::

::: perm finance:approve
- **Approuver** une version de budget en fait la référence du projet.
:::

- **Engagements** : commandes, contrats de sous-traitance et autres engagements imputés au projet, avec le consommé au fil des factures validées.
- **Dépenses** : toutes les dépenses imputées (achats, caisses, sous-traitance, saisies manuelles), avec leur origine.

## Onglet « Risques »

Registre des risques : probabilité, impact, responsable, mesures de maîtrise, plan de secours, échéance et **Exposition financière**.

::: perm projects:write
- **Nouveau risque** : projet et **Titre** (obligatoires) puis les autres champs ; ouvrez un risque pour le mettre à jour (statut, mesures) ou le supprimer.
:::
