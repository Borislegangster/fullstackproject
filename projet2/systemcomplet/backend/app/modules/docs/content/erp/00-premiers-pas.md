---
id: erp-premiers-pas
title: Premiers pas dans l'ERP
space: erp
section: Prise en main
order: 10
route: /erp/documentation
summary: Se connecter, sécuriser son compte, se repérer dans les menus et utiliser les listes, fiches, filtres et exports communs à tous les écrans.
keywords: [connexion, mot de passe, double authentification, MFA, menu, liste, export, filtre, aide]
related: [erp-compte, erp-notifications, erp-tableau-de-bord]
---

## Votre accès

Les comptes sont créés par l'administration : il n'existe pas d'inscription libre. Vous recevez une invitation par e-mail (ou WhatsApp) contenant un lien personnel, valable quelques jours.

1. Ouvrez le lien d'invitation, vérifiez vos nom et prénom, choisissez un mot de passe solide puis cliquez **Activer et continuer**.
2. Si votre profil l'exige (Administration, Direction, Finance…), configurez immédiatement la double authentification : un bandeau rouge « La double authentification est obligatoire pour votre profil » reste affiché tant qu'elle n'est pas active ; cliquez **Activer maintenant**.
3. Si vous avez déjà activé votre accès, utilisez **J'ai déjà activé mon accès : me connecter**.

## Se connecter

1. Sur la page de connexion, saisissez votre adresse e-mail et votre mot de passe, cochez **Rester connecté** sur un appareil personnel, puis cliquez **Se connecter**.
2. Si la double authentification est active, saisissez le code à 6 chiffres de votre application puis **Vérifier**, ou cliquez **Utiliser ma clé de sécurité** (clé physique, empreinte, reconnaissance faciale). **Retour** revient au mot de passe.
3. Mot de passe oublié : cliquez **Mot de passe oublié ?**, saisissez votre e-mail, **Envoyer le lien**, puis ouvrez le lien reçu, choisissez le nouveau mot de passe et **Enregistrer**. **Retour à la connexion** ramène à l'écran précédent.

> [!WARNING]
> Après plusieurs échecs, le compte est verrouillé temporairement. Un administrateur peut le déverrouiller depuis [Utilisateurs et rôles](doc:erp-utilisateurs).

## Se repérer

- **Menu latéral** : il ne présente que les écrans auxquels votre rôle donne accès. Sur téléphone, ouvrez-le avec l'icône ☰ en haut à gauche.
- **Barre du haut** : le point coloré indique la connexion temps réel (vert : connecté, orange : connexion en cours, rouge : coupée) ; l'icône **?** ouvre l'aide de l'écran affiché ; la cloche affiche vos notifications ; votre avatar donne accès à **Mon compte** et à la déconnexion.
- **Hors connexion** : un bandeau orange signale que les données affichées peuvent ne plus être à jour ; les saisies faites hors ligne sont synchronisées au retour du réseau.
- **Aide** : le menu **Aide › Documentation** regroupe ces guides. Vous n'y voyez que les fonctions auxquelles vous avez accès ; la recherche fonctionne sur les mêmes pages.

## Utiliser les listes

La plupart des écrans présentent une liste paginée (25 lignes par défaut) :

- **Rechercher** : la zone de recherche filtre sur les champs principaux (numéro, nom, titre…).
- **Filtres** : les listes déroulantes au-dessus du tableau (statut, catégorie, projet…) se combinent ; l'icône de rafraîchissement recharge la liste.
- **Pagination** : choisissez le nombre de lignes par page et naviguez avec les flèches.
- **Exporter** : lorsque le bouton est présent, il télécharge la liste au format Excel (réservé aux profils autorisés à exporter ; chaque export est tracé).
- **Fiche** : cliquez une ligne pour ouvrir son panneau latéral. Les boutons en bas du panneau dépendent de vos droits : **Modifier**, **Supprimer** (avec confirmation, action journalisée) et les actions propres à l'écran (valider, émettre, clôturer…).
- **Créer** : le bouton principal en haut à droite (« Nouveau… ») ouvre un formulaire ; les champs marqués d'un astérisque sont obligatoires ; les erreurs s'affichent sous chaque champ.

## Bonnes pratiques

- Les validations importantes (paiements, décisions, situations, documents) passent par un circuit d'approbation et, souvent, par une double validation par deux personnes distinctes : c'est voulu.
- Chaque action sensible est inscrite au journal d'audit infalsifiable.
- Ne partagez jamais votre compte : déconnectez-vous des appareils partagés depuis **Mon compte › Sessions et appareils**.
