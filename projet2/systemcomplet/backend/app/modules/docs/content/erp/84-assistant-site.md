---
id: erp-assistant-site
title: Assistant du site (Claude)
space: erp
section: Site web
order: 15
route: /erp/assistant-site
perms: [cms:write]
summary: Confiez à Claude toute la vitrine — analyse page par page, sections et textes manquants, images (médiathèque ou illustrations générées), articles, FAQ, menus, SEO, fréquentation — avec vos consignes et vos fichiers ; il prépare brouillons et propositions, vous regardez l'aperçu sur le site et validez.
keywords: [assistant, IA, Claude, rédaction, article, page, SEO, texte alternatif, image, génération d'images, illustration, audit, aperçu, menu, fréquentation, brouillon, proposition, validation]
related: [erp-cms, erp-media, erp-seo, erp-analytics]
---

## Principe

Menu **Site web › Assistant du site (Claude)**. Vous donnez une consigne, en français, avec les données utiles ; Claude travaille dans le site avec les mêmes règles que les écrans du CMS :

- il **lit** les pages, les collections (univers, offres, expertises, services, réalisations, blog, aide, FAQ, témoignages, équipe, partenaires, certifications, chiffres clés, vidéos, bannières), la médiathèque, l'audit SEO, les menus, les réglages et la fréquentation ;
- il **analyse la vitrine page par page**, telle que la voit un visiteur : sections et blocs vides, bannières sans image, textes trop courts, listes sans élément publié (« Aucun … publié »), pages de détail minces, SEO à reprendre ;
- il **complète** : sections et textes manquants, appels à l'action, questions fréquentes, articles de conseil, SEO, textes alternatifs, menus et textes généraux du site (slogan, promesse, méta-description par défaut, horaires) ;
- il **illustre** : images de la médiathèque d'abord ; s'il n'y a rien d'adapté et que la génération d'images est activée, il crée une illustration réaliste et professionnelle, la regarde, la refait si elle n'est pas crédible, et l'ajoute à la médiathèque (dossier « ia », crédit « Illustration générée par IA ») ;
- il **crée des brouillons** (pages, articles, réalisations, questions…) et modifie les brouillons : rien n'est en ligne ;
- tout ce que voient les visiteurs devient une **proposition à valider**, avec **aperçu sur le site** : modification d'une page ou d'un contenu publié, SEO d'un contenu publié, titre ou texte alternatif d'un média, menu, réglages du site, redirection, publication, retrait d'un contenu. Claude ne publie jamais seul.

Claude n'invente ni prix, ni délais, ni chiffres, ni réalisations, ni témoignages, ni membres de l'équipe : il s'appuie sur ce que vous fournissez, sur l'ERP ou sur ce qui est déjà sur le site, et vous dit ce qui manque (photos de chantiers réels, témoignages, chiffres). Une image générée est une illustration : elle n'est jamais présentée comme une réalisation, un chantier, une personne de l'équipe ou un client de GLOBUS.

## Donner une consigne

1. **Nouvelle demande** ouvre une conversation (ou choisissez une conversation de la liste pour la reprendre).
2. Cliquez un travail courant pour préremplir la consigne — **compléter toute la vitrine**, illustrer les pages, audit SEO complet, textes alternatifs des images, article de blog, nouvelle réalisation, page d'une offre, questions fréquentes, rapport de fréquentation, relecture du site, témoignages clients — puis complétez-la.
3. **Joindre des fichiers** (ou glissez-les dans la zone) : photos (ajoutées aussitôt à la médiathèque, dossier « assistant », et regardées par Claude), PDF (plaquette, descriptif), Word (.docx), Excel (.xlsx), textes (.txt, .md, .csv). Dix fichiers de 25 Mo au plus par message.
4. **Envoyer** (ou Ctrl + Entrée). Claude travaille en arrière-plan : les étapes s'affichent au fil de l'eau (lecture des contenus, création d'un brouillon, réglage SEO…), et vous pouvez quitter la page. Il termine par un compte rendu : brouillons créés, propositions en attente, ce qu'il reste à fournir.
5. Répondez dans la même conversation pour corriger ou poursuivre (« raccourcis le titre », « continue avec les 20 images suivantes »).

## Compléter toute la vitrine

Avec **Compléter toute la vitrine**, Claude lance l'analyse de toutes les pages, puis les traite par ordre d'importance (accueil, offres, services, expertises, réalisations, blog, FAQ, aide). Pour chaque page, il garde ce qui est bon, ajoute ce qui manque et prépare **une seule proposition complète par page** (s'il revient sur une page, sa nouvelle version remplace la précédente). Un tour compte jusqu'à 60 étapes ; pour un site entier, répondez « continue » pour qu'il poursuive là où il s'est arrêté.

## Regarder et valider

Le panneau **Propositions** liste ce que Claude a fait ou propose :

- « Brouillon enregistré » : déjà fait, rien n'est public ; **Voir sur le site** montre le brouillon tel qu'il sera publié, **Voir dans le CMS** ouvre l'élément.
- « Ajoutée à la médiathèque » : image générée, avec sa vignette ; **Voir le détail** montre la description utilisée.
- « À valider » : **Aperçu sur le site** ouvre la vraie page, avec l'en-tête et le pied de page du site, telle qu'elle sera une fois la proposition appliquée (bandeau « Mode aperçu », rien n'est enregistré) ; **Voir le détail** montre les changements ; **Appliquer** les exécute avec vos droits (la publication, le retrait et les réglages du site demandent le droit de publier), **Rejeter** les écarte. **Tout appliquer** valide toutes les propositions en attente ; celles qui sont refusées (droit manquant, contenu modifié entre-temps) sont signalées sans bloquer les autres.

Une proposition dont la page ou l'élément a été modifié depuis (dans le CMS ou par une autre conversation) est refusée : demandez à Claude de la refaire sur la version actuelle. Chaque modification passe par le circuit habituel : révisions, redirection automatique si une adresse change, journal d'audit, mise à jour du site dès l'application.

## Conversations et coût

Les conversations sont personnelles. **Archiver** ouvre **Archiver la conversation** : elle disparaît de la liste, les brouillons et modifications appliquées restent dans le CMS. L'en-tête indique la consommation de la conversation (jetons et estimation haute en dollars, au tarif public de Claude).

L'assistant demande la clé de l'API Claude, enregistrée par l'administrateur dans **Paramètres › Intégrations** ; sans elle, un message l'indique et l'envoi est désactivé.

La génération d'images est facultative : **Paramètres › Intégrations › Génération d'images (assistant du site)**, prestataire OpenAI (GPT Image) ou Google (Gemini) et sa clé. Sans elle, Claude se sert uniquement de la médiathèque et des images que vous joignez. L'en-tête de l'assistant indique ce qui est actif. Chaque image coûte de quelques centimes à quelques dizaines de centimes de dollar ; un plafond (40 images par 24 h par défaut, réglable) et une limite de 12 images par tour évitent les dérives. Les images générées sont comptées dans **Paramètres › IA** (fonction « site_assistant_image »).
