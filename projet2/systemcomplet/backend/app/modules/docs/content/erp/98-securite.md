---
id: erp-securite
title: Sécurité - sessions, verrouillages et clés d'API
space: erp
section: Administration
order: 40
route: /erp/securite
perms: [security:read]
summary: Tableau de bord Zero Trust - double authentification, comptes verrouillés, échecs de connexion, alertes, sessions actives de toutes les applications et clés d'API des intégrations.
keywords: [sécurité, session, MFA, double authentification, verrouillage, connexion, alerte, clé API, intégration, Zero Trust]
related: [erp-utilisateurs, erp-audit, erp-parametres]
---

## Accès

Menu **Administration › Sécurité**. Onglets **Synthèse**, **Sessions actives** et, selon vos droits, **Clés d'API**.

## Onglet « Synthèse »

- Indicateurs : **Comptes actifs**, taux de **Double authentification**, **MFA exigée non activée**, **Échecs de connexion (24 h)**, **Comptes verrouillés**.
- **Sessions actives** par application (web, mobile, bureau).
- **Comptes verrouillés** après plusieurs échecs de connexion, avec la date de fin du verrouillage.
- **MFA à activer** : comptes dont le rôle exige la double authentification mais qui ne l'ont pas encore configurée — relancez-les.
- **Alertes de sécurité récentes** : événements de criticité élevée ou critique (connexion suspecte, réinitialisation MFA, accès d'urgence…), issus de la chaîne d'audit infalsifiable.

::: perm users:write
Le cadenas d'un compte verrouillé le **déverrouille** immédiatement (après avoir vérifié avec la personne qu'il s'agit bien d'elle).
:::

## Onglet « Sessions actives »

Toutes les sessions en cours, toutes applications : **Utilisateur**, **Application**, appareil, **Méthode** de connexion, **Ouverte**, **Dernière activité**.

::: perm security:manage
Le bouton de déconnexion d'une ligne ouvre **Déconnecter …** : toutes les sessions de cet utilisateur sont révoquées immédiatement (web, mobile, bureau). À utiliser en cas d'appareil perdu ou d'activité suspecte.

## Onglet « Clés d'API »

Clés pour les intégrations machine à machine : portées limitées aux permissions choisies, restriction d'adresses IP, expiration.

1. **Nouvelle clé d'API** : **Nom**, **Portées (permissions accordées)**, **Expiration**, **Adresses IP autorisées (vide = toutes)**. Une portée sensible déclenche un avertissement : limitez alors l'adresse IP et la durée.
2. La fenêtre **Clé créée** affiche la clé **une seule fois** : copiez-la et stockez-la dans le coffre de l'outil appelant.
3. **Révoquer** ouvre **Révoquer la clé …** : les intégrations utilisant cette clé cessent immédiatement de fonctionner.

> [!WARNING]
> Une clé perdue ne se récupère pas : révoquez-la et créez-en une nouvelle.
:::
