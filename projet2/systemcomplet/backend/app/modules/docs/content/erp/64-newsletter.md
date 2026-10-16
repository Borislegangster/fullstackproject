---
id: erp-newsletter
title: Newsletter et marketing
space: erp
section: Commercial
order: 50
route: /erp/newsletter
perms: [newsletter:read]
summary: Abonnés consentis (double opt-in), segments dynamiques, modèles versionnés, campagnes programmées et mesurées, scénarios automatiques.
keywords: [newsletter, campagne, e-mail, abonné, segment, modèle, automatisation, désinscription, ouverture, clic]
related: [erp-crm, erp-analytics]
---

## Accès

Menu **Commercial › Newsletter** (écran **Newsletter et marketing**). Onglets **Campagnes**, **Abonnés**, **Segments**, **Modèles**, **Automatisations**.

## Onglet « Abonnés »

Les **Abonnés** : double opt-in, preuve de consentement, désinscription en un clic, nettoyage automatique des rebonds. Filtres **Statut** et **Source**. La fiche montre e-mail, statut, source, date de confirmation, dernière interaction, pays, rebonds.

::: perm newsletter:write
- Ajustez **Tags** et **Centres d'intérêt (univers, thèmes)** puis **Enregistrer**.
- **Désinscrire** ouvre **Désinscrire l'abonné** (à la demande de la personne) : il ne recevra plus rien.
:::

## Onglet « Segments »

Les **Segments** : audiences dynamiques recalculées à chaque envoi (seuls les abonnés confirmés sont ciblés).

::: perm newsletter:write
- **Nouveau segment** : nom obligatoire, description, règles (au moins un de ces tags, tous ces tags, centres d'intérêt, sources, pays, diaspora). Modifier ou supprimer depuis la fiche.
:::

## Onglet « Modèles »

Modèles d'e-mails versionnés : chaque modification crée une version, les campagnes envoyées gardent la leur. Vues **HTML**, **Aperçu** et **Version texte**.

::: perm newsletter:write
- **Nouveau modèle** ou **Nouvelle version** d'un modèle existant : objet, contenu HTML, version texte, variables (prénom, lien de désinscription ajouté automatiquement) ; **Aperçu** avant d'enregistrer.
:::

## Onglet « Campagnes »

Les **Campagnes** et leurs statistiques : **Délivrés**, **Ouvertures uniques**, **Clics uniques**, **Désinscriptions** et rebonds.

::: perm newsletter:write
- **Nouvelle campagne** ouvre **Nouvelle campagne** : nom, modèle et version, segment, expéditeur ; **Créer la campagne** (brouillon).
:::

::: perm newsletter:send
- **Envoyer maintenant** ouvre **Envoyer la campagne** (confirmation avec le nombre de destinataires).
- **Programmer** ouvre **Programmer l'envoi** (date et heure).
- **Annuler la campagne** ouvre **Annuler la campagne** (avant envoi).
:::

## Onglet « Automatisations »

Les **Automatisations** : scénarios déclenchés (bienvenue, relance de lead, nurturing par univers, réactivation).

::: perm newsletter:write
- **Nouveau scénario** : nom, type et déclencheur obligatoires, réglage du déclencheur (jours d'inactivité ou tag selon le cas), étapes (bouton **Étape** : délai en heures, modèle d'e-mail, objet facultatif), **Actif**.
:::
