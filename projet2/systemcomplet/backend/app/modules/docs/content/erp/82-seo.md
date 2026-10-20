---
id: erp-seo
title: SEO - référencement
space: erp
section: Site web
order: 30
route: /erp/seo
perms: [seo:write, cms:read]
summary: Audit des métadonnées, redirections, données structurées schema.org et réseaux sociaux ; sitemap et robots.txt générés automatiquement.
keywords: [SEO, référencement, métadonnées, title, description, redirection, 301, schema.org, sitemap, robots, réseaux sociaux]
related: [erp-cms, erp-analytics]
---

## Accès

Menu **Site web › SEO**. Onglets **Audit et métadonnées**, **Redirections**, **Données structurées**, **Réseaux sociaux**. Bloc **Fichiers publics** : liens vers **/sitemap.xml** et **/robots.txt**, générés automatiquement à chaque publication.

## Onglet « Audit et métadonnées »

Pour chaque page et contenu publié : titre, description, image de partage, indexation, avec les problèmes détectés (titre trop long, description manquante, image absente…).

::: perm seo:write
- **Optimiser** ouvre **SEO — …** : titre, méta-description, image de partage, indexation ; **Enregistrer**.
:::

## Onglet « Redirections »

Les **Redirections** 301 / 302 / 410 ; elles sont créées automatiquement lors d'un changement d'adresse d'un contenu publié.

::: perm seo:write
- **Nouvelle redirection** : **Chemin source** obligatoire, chemin cible, code HTTP, actif, note. Modifier ou supprimer depuis la fiche.
- Contrôles automatiques : une seule redirection par chemin source ; cible commençant par « / » (page du site) ou « https:// » ; l'accueil et les espaces de la plateforme (ERP, espace client…) ne se redirigent pas ; une boucle (A → B → A) est refusée. Quand un contenu est publié à une adresse, la redirection qui en partait est levée.
- **Importer un CSV** ouvre **Importer des redirections** (colonnes source, cible, code) puis **Importer**.
:::

## Onglet « Données structurées »

Les **Données structurées (schema.org)** : informations ajoutées au code d'une page pour les résultats enrichis des moteurs de recherche (l'organisation est déjà décrite automatiquement à partir des réglages du site).

::: perm seo:write
- **Ajouter** : **Type** (organisation, établissement local, service, article, page web, site web), **Page du site** choisie dans la liste, puis les **Propriétés** : choisissez une propriété (nom, description, zone desservie, téléphone, horaires, auteur, date de publication…) et **Ajouter la propriété**, saisissez sa valeur ; **Retirer** l'enlève. Aucun code à saisir.
- **Modifier** reprend les mêmes champs ; décochez **Actif** pour suspendre une donnée sans la supprimer.
:::

## Onglet « Réseaux sociaux »

Les liens **Réseaux sociaux** affichés sur le site (pied de page, partage).

::: perm cms:publish
- **Ajouter** : réseau et URL obligatoires, libellé, ordre, actif.
:::
