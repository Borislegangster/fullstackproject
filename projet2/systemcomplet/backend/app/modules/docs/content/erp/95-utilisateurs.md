---
id: erp-utilisateurs
title: Utilisateurs, invitations, rôles et équipes
space: erp
section: Administration
order: 10
route: /erp/utilisateurs
perms: [users:read, roles:manage]
summary: Créer les comptes et envoyer les invitations, gérer rôles et permissions (RBAC), organisations et équipes, verrouillages, double authentification et sessions - chaque changement est audité.
keywords: [utilisateur, compte, invitation, rôle, permission, RBAC, organisation, équipe, MFA, verrouillage, session, accès d'urgence]
related: [erp-roles-permissions, erp-securite, erp-audit]
---

## Accès

Menu **Administration › Utilisateurs et rôles** (comptes, invitations, rôles RBAC, organisations et équipes — chaque changement est audité). Onglets **Utilisateurs**, **Invitations**, **Rôles et permissions**, **Organisations**, **Équipes**.

::: perm users:read
## Onglet « Utilisateurs »

Les **Utilisateurs** : comptes internes, clients et partenaires ; rôles cumulables ; invitation par e-mail sécurisée. Filtres **Rôle**, **Type d'organisation**, **Statut**.
:::

::: perm users:write
### Créer un compte et inviter

1. **Nouvel utilisateur** : **E-mail**, **Prénom**, **Nom** et **Rôles** obligatoires ; téléphone, WhatsApp, fonction, **Métier**, **Disciplines**, organisation, projets et rôle sur le projet. Le métier se choisit dans la liste fermée des corps de métier et des métiers de chantier (manœuvre, conduite d'engins, grutier…), la même que pour le personnel RH ; laissez « Non précisé » pour un profil sans métier de chantier (architecte, comptable, client…). Les disciplines se cochent dans le référentiel du Hub BIM (architecture, structure, électricité…).
2. Laissez cochée **Envoyer l'invitation** et choisissez le canal : **E-mail** ou **WhatsApp (numéro requis)**, avec un message facultatif.
3. La personne reçoit un lien à usage unique, choisit son mot de passe et, si son profil l'exige, sa double authentification. Aucun mot de passe ne circule.

### Gérer un compte

Ouvrez l'utilisateur : la fiche affiche notamment son métier et ses disciplines. Le statut **Invité** signale un compte dont la personne n'a pas encore utilisé son lien d'activation (elle n'a pas choisi son mot de passe).

- **Renvoyer l'invitation** (compte invité, non activé) ouvre la fenêtre **Renvoyer l'invitation** : choisissez le canal (**E-mail**, ou **WhatsApp** si un numéro est renseigné) et un message facultatif, puis **Renvoyer**. Un nouveau lien, valable 7 jours, est envoyé ; les liens précédents encore valides sont annulés ; les rôles, l'organisation et les projets prévus sont conservés. Impossible pour un compte déjà activé (la personne se connecte, ou utilise **Mot de passe oublié ?**) ou désactivé (réactivez-le d'abord).
- **Modifier** : prénom, nom, téléphone, WhatsApp, fonction, **Métier** (liste fermée, « Non précisé » pour le retirer), **Disciplines** (cases à cocher) et organisation ; seuls les champs changés sont enregistrés. L'e-mail, les rôles, la double authentification et l'activation se gèrent par leurs commandes dédiées.
- **Enregistrer les rôles** après avoir coché ou décoché des rôles.
- **Déverrouiller** un compte bloqué après des échecs de connexion.
- Exiger ou non la double authentification pour ce compte.
- **Déconnecter partout** ouvre **Déconnecter toutes les sessions** (web, mobile, bureau) — en cas de perte d'appareil.
- **Désactiver le compte** (fenêtre du même nom) bloque l'accès sans supprimer l'historique ; le compte peut être réactivé.
:::

::: perm security:manage
- **Réinitialiser la MFA** ouvre **Réinitialiser la double authentification** (téléphone perdu) : opération critique, tracée, confirmée par votre propre code ; la personne devra reconfigurer sa MFA à la connexion suivante. Pour un administrateur, elle passe par l'accès d'urgence : **Confirmer (accès d'urgence)** avec une justification (accès limité dans le temps).
:::

::: perm users:read
## Onglet « Invitations »

Les **Invitations** : liens à usage unique, valables 7 jours, révocables avant acceptation (statut en attente, acceptée, expirée, révoquée), avec les rôles prévus pour la personne.
:::

::: perm users:write
- **Révoquer** une invitation en attente (envoyée par erreur ou à la mauvaise adresse).
- **Renvoyer** la dernière invitation d'une adresse dont le compte n'est pas encore activé (lien expiré, e-mail perdu, invitation révoquée par erreur) : même fenêtre **Renvoyer l'invitation**. C'est aussi le moyen de relancer un **client** invité automatiquement à la création de son projet, qui n'a pas encore de fiche dans l'onglet Utilisateurs.
:::

## Onglet « Rôles et permissions »

Chaque rôle regroupe des permissions (environ 97, par module : lecture, écriture, approbation, données sensibles). Ouvrez un rôle (**Voir**) pour consulter sa matrice. Le détail des rôles par défaut est dans [Rôles et permissions](doc:erp-roles-permissions).

::: perm roles:manage
- **Nouveau rôle** : nom, public, description, permissions cochées dans la matrice (les permissions **sensible** sont signalées), double authentification exigée. Le code interne du rôle est créé automatiquement à partir du nom (« Conducteur d'engins » → CONDUCTEUR_D_ENGINS) : rien à saisir.
- **Modifier** un rôle : la matrice est éditable (sauf le rôle Administrateur). Les droits des utilisateurs concernés changent immédiatement.
- Supprimer un rôle non système et sans utilisateur : fenêtre **Supprimer le rôle …**.
:::

::: perm users:read
## Onglet « Organisations »

Les **Organisations** : entreprise, clients (personnes morales), fournisseurs, sous-traitants, partenaires. Filtre **Type**.

## Onglet « Équipes »

Les **Équipes** (chef d'équipe, métier, membres) utilisées par le planning, le pointage et la capacité.
:::

::: perm users:write
- **Nouvelle organisation** : nom et type obligatoires, raison sociale, forme juridique, NIU, RCCM, coordonnées, site web, notes.
- **Nouvelle équipe** : nom obligatoire, organisation, chef d'équipe, **Métier** (même liste fermée que le personnel), description, membres. La fiche d'une équipe affiche le métier, le chef d'équipe, l'organisation et les membres par leur nom ; **Modifier** reprend les mêmes champs (seuls les champs changés sont enregistrés).
:::
