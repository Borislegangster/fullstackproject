---
id: erp-cms
title: Contenus du site (CMS)
space: erp
section: Site web
order: 10
route: /erp/cms
routes: [/erp/cms/pages, /erp/cms/pages/*]
perms: [cms:read]
summary: Pages composées de blocs, collections (univers, offres, réalisations, blog, FAQ…), navigation, formulaires, commentaires et réglages du site - circuit brouillon, relecture, publication.
keywords: [CMS, site, page, bloc, publication, relecture, offre, univers, blog, article, FAQ, menu, formulaire, commentaire, réglages, maintenance]
related: [erp-media, erp-seo, erp-analytics]
---

## Le circuit de publication

Brouillon → relecture → validé → publié (→ archivé). Selon votre profil :

| Action | Droit |
| --- | --- |
| Rédiger, **Soumettre à relecture** | édition des contenus |
| **Valider**, **Renvoyer en brouillon** | relecture |
| **Publier**, **Publier directement**, **Archiver**, **Dépublier (brouillon)**, **Restaurer en brouillon** | publication |

Chaque publication met à jour le site en quelques secondes et conserve une révision restaurable. Menu **Site web › Contenus (CMS)** ; onglets **Pages**, **Collections**, **Navigation**, **Formulaires**, **Commentaires**, **Réglages du site**.

## Onglet « Pages »

La liste des pages (filtre par statut). Cliquez une page pour ouvrir l'éditeur, avec les onglets **Contenu**, **Propriétés**, **SEO** et **Historique**.

::: perm cms:write
### Créer et composer une page

1. **Nouvelle page** : titre et adresse (chemin).
2. Onglet **Contenu** : **Ajouter une section**, puis dans chaque section **Ajouter le bloc** (héros, texte, chiffres clés, offres, réalisations, témoignages, appel à l'action, galerie, FAQ, formulaire…). Pour un bloc avec boutons : **Ajouter un bouton** (libellé, lien) ; **Bouton** ajoute un bouton supplémentaire. Glissez pour réordonner ; masquez une section sans la supprimer.
3. Onglet **Propriétés** : modèle, univers, visibilité ; onglet **SEO** : titre, description, image de partage.
4. **Enregistrer** ; **Aperçu** ouvre la fenêtre **Aperçu — …** ; **Voir en ligne** ouvre la page publiée.
5. **Soumettre à relecture** (ou **Publier directement** si vous avez le droit de publication).
:::

::: perm cms:write
### Texte enrichi (blocs texte, corps de page, réponses de FAQ, contenus des collections)

La barre d'outils met en forme le texte (gras, titres, listes, citation, lien) et ajoute :

- **Image de la médiathèque** : choisissez l'image dans la médiathèque (ou envoyez-la), puis dans **Insérer une image de la médiathèque** la **Taille**, l'**Alignement** (centrée, à gauche ou à droite avec le texte autour, pleine largeur), le **Texte alternatif** et la **Légende** ; **Insérer l'image** la place à l'endroit du curseur (**Changer d'image** pour en choisir une autre).
- **Insérer du code HTML** : collez ou saisissez du HTML (colonnes, tableau, encadré, vidéo YouTube ou Vimeo, carte Google Maps ou OpenStreetMap…) ; **Aperçu** montre exactement ce qui sera affiché sur le site et ce qui a été retiré ; **Insérer le code** l'ajoute à l'endroit du curseur. Le HTML est affiché tel quel après contrôle de sécurité : les scripts, formulaires et attributs d'événement sont retirés, les images doivent venir de la médiathèque, les styles de mise en page (couleurs, marges, grilles, bordures…) sont conservés.
- **Code source HTML** (à droite de la barre) : édite tout le contenu en HTML ; un second clic revient à l'édition visuelle après le même contrôle.
:::

### Faire évoluer une page

Les boutons d'état ouvrent une fenêtre avec une note facultative ; à la publication, **Mise en ligne le (facultatif)** et **Retrait le (facultatif)** programment l'affichage.

::: perm cms:review
- **Valider** une page relue, ou **Renvoyer en brouillon** avec un commentaire.
:::

::: perm cms:publish
- **Publier**, **Archiver**, **Dépublier (brouillon)**, **Restaurer en brouillon**.
- **Supprimer la page** (fenêtre **Supprimer la page**) — préférez l'archivage pour une page publiée.
:::

::: perm cms:write
- Onglet **Historique** : chaque révision est conservée ; **Restaurer** ouvre **Restaurer la révision …** (le contenu actuel devient une nouvelle révision).
:::

## Onglet « Collections »

Les contenus structurés : **Univers**, **Offres**, **Expertises**, **Services**, **Réalisations** (avec avant / après et lien vers le projet ERP pour l'avancement réel ; filtre **Avancement**), **Articles** du blog, **Centre d'aide**, **FAQ**, **Témoignages**, **Équipe**, **Partenaires**, **Certifications**, **Chiffres clés** (avec leur source), **Vidéothèque**, **Bannières / popups**, ainsi que les catégories du blog, auteurs et catégories FAQ.

::: perm cms:write
- **Nouveau — …** crée un élément de la collection choisie ; ouvrez un élément pour le modifier et le faire évoluer dans le même circuit que les pages. Les listes simples (catégories, auteurs) utilisent **Ajouter**.
:::

- **Aperçu** ouvre **Aperçu — …** : le rendu réel, même pour un brouillon (visible uniquement par vous) :
  - **Page du site** : la page publique telle qu'elle sera affichée (univers, offres, expertises, services, réalisations, articles, aide), avec le choix **Ordinateur**, **Tablette** ou **Mobile** et **Ouvrir dans un onglet** (un bandeau « Mode aperçu » s'affiche, **Quitter l'aperçu** revient au site publié) ;
  - **Carte dans les listes** : l'élément tel qu'il apparaît dans les blocs et listes du site (témoignages, chiffres clés, équipe, partenaires, FAQ, bannières…).
- **Historique** ouvre **Historique — …** (révisions).

Les listes structurées se remplissent sans code : **Parcours client** des univers (une étape par ligne), **Étapes de l'offre** (titre et description) et **Résultats chiffrés** des réalisations (indicateur et valeur).

::: perm cms:publish
- Supprimer définitivement un élément (préférez l'archivage pour un contenu publié).
:::

## Onglet « Navigation »

Menus de l'en-tête et du pied de page.

::: perm cms:publish
- **Élément** ajoute une entrée (page, collection ou lien), **Sous-élément** un sous-menu ; mettez en avant un bouton (appel à l'action).
- **Enregistrer** puis **Publier le menu**.
:::

## Onglet « Formulaires »

Les **Formulaires** du site (contact, rappel, estimateur, newsletter…) : questions posées, consentements, traitement après l'envoi, accusé de réception et équipes prévenues — sans aucun code.

::: perm cms:publish
### Créer ou modifier un formulaire

**Nouveau formulaire** (ou **Modifier** sur une ligne) ouvre un éditeur en cinq étapes, avec à droite un **Aperçu en direct** du formulaire tel que le visiteur le verra :

1. **Identité** : **Emplacement sur le site** (Contact, Être rappelé, Estimateur, Newsletter… ou « Autre emplacement »), **Titre affiché**, **Phrase d'introduction**.
2. **Questions posées** : ajoutez les champs en un clic (**Prénom**, **Nom**, **E-mail**, **Téléphone**, **WhatsApp**, **Entreprise**, **Ville**, **Pays**, **Lieu du projet**, **Budget**, **Délai**, **Message**) ou un **Champ personnalisé** ; pour chacun, **Question affichée**, **Type de réponse**, exemple affiché, **Choix proposés** (listes) et **Obligatoire**. Les flèches changent l'ordre. Les champs prédéfinis remplissent automatiquement la fiche du prospect dans le CRM.
3. **Consentements (RGPD)** : activez **Être recontacté**, **Contact WhatsApp** ou **Newsletter**, adaptez le texte de la case et indiquez si elle est obligatoire pour envoyer.
4. **Après l'envoi** : choisissez le traitement (**Créer un prospect dans le CRM**, **Inscrire à la newsletter**, **Ouvrir une demande SAV**, **Simple archivage**), le **Message affiché après l'envoi**, l'**Accusé de réception envoyé au visiteur** (une réponse automatique ou le message standard) et **Qui est prévenu à chaque envoi ?** : cliquez les équipes à notifier (Commercial, Direction…).
5. **Protection anti-robot** : délai minimum avant envoi (curseur).

L'interrupteur en bas met le formulaire **en ligne** ou le désactive. Les points à compléter (titre, au moins un moyen de contact pour un prospect…) sont listés sous l'aperçu ; **Créer le formulaire** / **Enregistrer** s'active quand tout est prêt.

### Réponses automatiques

Accusés de réception envoyés au visiteur après un formulaire. **Nouvelle réponse** (ou **Modifier**) ouvre **Nouvelle réponse automatique** :

1. **Nom de la réponse** (choisi ensuite dans le formulaire) et **Envoyée par** **E-mail** ou **WhatsApp**.
2. **Objet de l'e-mail** (ou **Modèle WhatsApp approuvé par Meta**) et le texte : les boutons **Insérer** ajoutent à l'endroit du curseur **Prénom du visiteur**, **Numéro de la demande**, **Délai de réponse** ou **Univers choisi**, affichés entre crochets (ex. [Prénom du visiteur]) et remplacés par les vraies valeurs à chaque envoi.
3. L'aperçu **Ce que reçoit le visiteur** montre le message avec des valeurs d'exemple ; **Enregistrer**.
:::

- **Envois reçus** ouvre **Envois — …** : les réponses reçues par le formulaire.

## Onglet « Commentaires »

**Commentaires du blog** en attente de modération.

::: perm cms:write
- **Publier**, **Refuser** ou classer **Indésirable**.
- **Répondre** ouvre **Réponse publique de GLOBUS** puis **Publier la réponse**.
:::

## Onglet « Réglages du site »

Identité (raison sociale, slogan, promesse, logos, image de partage, **Icône de la plateforme**), coordonnées (e-mail, téléphone, WhatsApp — qui activent les boutons d'appel et WhatsApp du site), adresse et position, horaires, fiche Google Business, réseaux, référencement (modèle de titre, vérification Search Console, méta-description par défaut, **Pages à exclure des moteurs de recherche** : adresse de chaque page, ex. /offres/ancienne-offre), identifiants de mesure (chargés uniquement après consentement), politique de consentement et textes du bandeau cookies (titre, message, cookies nécessaires, mesure d'audience, marketing — un champ vide affiche le texte par défaut), **Message de maintenance (vide = site ouvert)**.

**Icône de la plateforme** : icône unique, appliquée partout dès l'enregistrement — onglet du navigateur (favicon), application installée sur ordinateur ou téléphone, raccourci iPhone / iPad, assistant du site, notifications, et futures applications mobile et bureau. Choisissez une image carrée PNG ou WebP (idéalement 512 px ou plus, fond transparent de préférence) ; les marges sont recadrées et toutes les tailles sont générées automatiquement. L'aperçu montre chaque déclinaison ; **Pack d'icônes (applications)** télécharge toutes les tailles (16 à 1 024 px, favicon, iOS, Android) et leur description pour les applications mobile et bureau. Le logo reste réservé aux en-têtes, pieds de page et documents : icône et logo ne se mélangent plus. Un navigateur peut garder l'ancienne icône quelques minutes (rechargez la page).

::: perm cms:publish
- Modifiez puis **Enregistrer**. Changer la version de la politique de consentement redemande le consentement à tous les visiteurs.
:::
