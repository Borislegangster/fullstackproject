---
id: erp-configurateur
title: Configurateur 3D (administration)
space: erp
section: Projets
order: 50
route: /erp/configurateur
perms: [configurator:manage, projects:read]
summary: Catalogue de matériaux et maquettes configurables - le client compare ses finitions en 3D avec prix et délais en direct, puis soumet son choix.
keywords: [configurateur, matériau, finition, 3D, GLB, option, prix, délai, catalogue]
related: [erp-hub-bim, erp-chantier-decisions-budget]
---

## Accès

Menu **Projets › Configurateur 3D**. Deux onglets : **Maquettes configurables** et **Catalogue** (réservé aux gestionnaires du configurateur).

## Onglet « Maquettes configurables »

Les maquettes configurables sont propres à chaque projet : choisissez d'abord un projet.

::: perm configurator:manage
### Créer une maquette configurable

1. **Maquette configurable** ouvre **Nouvelle maquette configurable** : **Version BIM** de référence (obligatoire), **Date limite des choix client**.
2. Ajoutez les zones (**Zone**) : clé, **Libellé** (ex. « Sol du séjour »), pièce, **Catégorie** de matériau, **Quantité** et unité, **Matériau de base (inclus au contrat)**, **Options proposées au client**, **Maillages 3D ciblés** (noms des objets du fichier GLB). **Retirer la zone** en supprime une.
3. **Créer la maquette configurable**, puis déposez le fichier 3D (GLB / glTF, 200 Mo maximum) et **Envoyer**.
4. **Aperçu** ouvre la maquette telle que le client la verra (fenêtre **Aperçu**).
:::

::: perm projects:publish_client
### Publier au client

Renseignez la **Date limite des choix** puis **Publier dans l'espace client** (ou **Retirer de l'espace client**). Le client compare ses scénarios et les soumet pour validation ; un choix validé devient une décision client figée.
:::

::: perm configurator:manage
## Onglet « Catalogue »

### Matériaux

Le catalogue du configurateur donne pour chaque matériau : prix, délai, disponibilité, rendu (couleur, rugosité, métallicité, textures) et période de validité. Filtres **Catégorie**, **Gamme**, **Disponibilité**.

- **Nouveau matériau** : catégorie et nom (obligatoires), description, fournisseur et référence, unité, **Prix unitaire**, devise, disponibilité, délai de livraison, rendu, objets 3D ciblés, validité, gamme.
- Ouvrez un matériau pour le **Modifier** ou le **Supprimer**.

### Catégories

**Nouvelle catégorie** : clé, nom (obligatoires) et ordre d'affichage.
:::
