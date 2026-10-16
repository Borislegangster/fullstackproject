---
id: erp-media
title: Médiathèque
space: erp
section: Site web
order: 20
route: /erp/media
perms: [cms:read, media:write]
summary: Tous les médias du site - images optimisées (WebP / AVIF, variantes responsives), vidéos, documents ; texte alternatif, point focal, usages et archivage.
keywords: [média, image, photo, vidéo, YouTube, alt, accessibilité, archive, médiathèque]
related: [erp-cms, erp-seo]
---

## À quoi sert cet écran

Menu **Site web › Médiathèque**. Les images sont optimisées automatiquement (formats WebP et AVIF, variantes responsives) ; chaque média affiche ses usages (pages et contenus qui l'utilisent). **Afficher plus** charge la suite de la liste ; filtrez par type, dossier ou recherche.

::: perm media:write
## Ajouter des médias

- **Envoyer des fichiers** ouvre **Envoyer des fichiers** : glissez images, vidéos ou documents, choisissez le dossier puis **Envoyer**.
- **Vidéo YouTube / Vimeo** ouvre **Vidéo YouTube / Vimeo** : collez l'adresse puis **Ajouter**.

## Fiche d'un média

Cliquez un média (fenêtre **Média**) :

- Renseignez titre, dossier, **texte alternatif** (obligatoire pour l'accessibilité et le référencement ; **ALT libre** si l'image est décorative), légende, crédits ; **Enregistrer**.
- Cliquez sur l'image pour placer le point focal (cadrage des variantes).
- **Remplacer** le fichier en conservant ses usages ; **Ouvrir le fichier** pour l'original.
- **Archiver** ouvre **Archiver le média** ; **Restaurer** le réactive.
- **Recalculer les usages** met à jour le comptage des pages qui l'utilisent.
:::

::: perm cms:publish
Un média encore utilisé ne peut être archivé qu'avec le droit de publication (archivage forcé).
:::
