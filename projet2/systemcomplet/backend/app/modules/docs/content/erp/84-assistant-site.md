---
id: erp-assistant-site
title: Assistant du site (Claude)
space: erp
section: Site web
order: 15
route: /erp/assistant-site
perms: [cms:write]
summary: Confiez à Claude les travaux du site — articles, pages, réalisations, FAQ, SEO, textes alternatifs, analyse de la fréquentation — avec vos consignes et vos fichiers ; il crée des brouillons et vous validez ce qui sera visible.
keywords: [assistant, IA, Claude, rédaction, article, page, SEO, texte alternatif, image, fréquentation, brouillon, proposition, validation]
related: [erp-cms, erp-media, erp-seo, erp-analytics]
---

## Principe

Menu **Site web › Assistant du site (Claude)**. Vous donnez une consigne, en français, avec les données utiles ; Claude travaille dans le site avec les mêmes règles que les écrans du CMS :

- il **lit** les pages, les collections (univers, offres, expertises, services, réalisations, blog, aide, FAQ, témoignages, équipe, partenaires, certifications, chiffres clés, vidéos, bannières), la médiathèque, l'audit SEO, les réglages et la fréquentation ;
- il **crée des brouillons** (pages, articles, réalisations, questions…) et modifie les brouillons : rien n'est en ligne ;
- tout ce que voient les visiteurs devient une **proposition à valider** : modification d'un contenu publié, SEO d'un contenu publié, titre ou texte alternatif d'un média, redirection, publication. Claude ne publie jamais seul.

Claude n'invente ni prix, ni délais, ni références, ni témoignages : il s'appuie sur ce que vous fournissez ou sur ce qui est déjà sur le site, et vous demande ce qui manque.

## Donner une consigne

1. **Nouvelle demande** ouvre une conversation (ou choisissez une conversation de la liste pour la reprendre).
2. Cliquez un travail courant pour préremplir la consigne — audit SEO complet, textes alternatifs des images, article de blog, nouvelle réalisation, page d'une offre, questions fréquentes, rapport de fréquentation, relecture du site, témoignages clients — puis complétez-la.
3. **Joindre des fichiers** (ou glissez-les dans la zone) : photos (ajoutées aussitôt à la médiathèque, dossier « assistant », et regardées par Claude), PDF (plaquette, descriptif), Word (.docx), Excel (.xlsx), textes (.txt, .md, .csv). Dix fichiers de 25 Mo au plus par message.
4. **Envoyer** (ou Ctrl + Entrée). Claude travaille en arrière-plan : les étapes s'affichent au fil de l'eau (lecture des contenus, création d'un brouillon, réglage SEO…), et vous pouvez quitter la page. Il termine par un compte rendu : brouillons créés, propositions en attente, ce qu'il reste à fournir.
5. Répondez dans la même conversation pour corriger ou poursuivre (« raccourcis le titre », « continue avec les 20 images suivantes »).

## Valider les propositions

Le panneau **Propositions** liste ce que Claude a fait ou propose :

- « Brouillon enregistré » : déjà fait, rien n'est public ; **Voir dans le CMS** ouvre l'élément pour le relire et le publier.
- « À valider » : **Voir le détail** montre les changements ; **Appliquer** les exécute avec vos droits (la publication demande le droit de publier), **Rejeter** les écarte. **Tout appliquer** valide toutes les propositions en attente ; celles qui sont refusées (droit manquant, contenu modifié entre-temps) sont signalées sans bloquer les autres.

Chaque modification passe par le circuit habituel : révisions, redirection automatique si une adresse change, journal d'audit.

## Conversations et coût

Les conversations sont personnelles. **Archiver** ouvre **Archiver la conversation** : elle disparaît de la liste, les brouillons et modifications appliquées restent dans le CMS. L'en-tête indique la consommation de la conversation (jetons et estimation haute en dollars, au tarif public de Claude).

L'assistant demande la clé de l'API Claude, enregistrée par l'administrateur dans **Paramètres › Intégrations** ; sans elle, un message l'indique et l'envoi est désactivé.
