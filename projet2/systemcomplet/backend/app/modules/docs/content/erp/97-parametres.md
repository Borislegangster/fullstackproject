---
id: erp-parametres
title: Paramètres, intégrations, maintenance et sauvegardes
space: erp
section: Administration
order: 30
route: /erp/parametres
routes: [/erp/parametres/systeme]
perms: [settings:read, notifications:manage, integrations:manage, maintenance:manage]
summary: Paramètres applicatifs, activation progressive des fonctionnalités, règles et modèles de notification, prestataires de paiement et secrets, webhooks, mode maintenance, tâches planifiées, sauvegardes et restauration contrôlée.
keywords: [paramètre, configuration, fonctionnalité, feature flag, notification, modèle, règle, intégration, paiement, secret, webhook, maintenance, sauvegarde, restauration, système, tâche planifiée]
related: [erp-securite, erp-audit, erp-utilisateurs]
---

## Accès

Menu **Administration › Paramètres**. Onglets **Paramètres**, **Fonctionnalités**, **Notifications**, **Intégrations**, **Maintenance** : seuls ceux autorisés par votre rôle s'affichent.

::: perm settings:read
Le bouton **Système et sauvegardes** ouvre la page **Système** (état de la plateforme, tâches planifiées, sauvegardes).

## Onglet « Paramètres »

Les paramètres applicatifs sont regroupés par catégorie (entreprise, finances, chantier, site…). Chaque paramètre a une clé, une valeur et une description ; ceux marqués « exposé publiquement » sont lisibles sans connexion (site vitrine).
:::

::: perm settings:write
1. **Paramètre** : **Clé** (lettres, chiffres, points et soulignés), **Valeur**, **Catégorie**, **Description**, case **Exposé publiquement (lecture sans connexion)**. La valeur se saisit sans code : choisissez son type (texte, nombre, oui / non, liste, groupe de réglages) puis remplissez-la ; une liste reçoit ses éléments avec **Élément**, un groupe ses réglages nommés avec **Ajouter le réglage**.
2. Le crayon d'une ligne modifie la valeur ; l'enregistrement est audité.

> [!WARNING]
> Changer le type d'une valeur la réinitialise. Ne mettez jamais de secret dans un paramètre : utilisez **Intégrations › Clés et secrets des prestataires**.
:::

::: perm settings:read
## Onglet « Fonctionnalités »

Activation progressive des fonctionnalités : par rôles ciblés et par pourcentage d'utilisateurs.
:::

::: perm settings:write
- **Fonctionnalité** (ou le crayon) : **Clé**, **Description**, **Rôles ciblés (aucun = tous)** à cocher, **Pourcentage d'utilisateurs**, case **Activée**.
- L'interrupteur d'une ligne active ou coupe immédiatement la fonctionnalité.
:::

::: perm notifications:manage
## Onglet « Notifications »

Trois sous-onglets : **Règles de diffusion**, **Modèles de messages**, **Journal des envois**.

### Règles de diffusion

Qui est notifié, sur quel canal, pour quel événement.

1. **Règle** : **Nom**, **Événement déclencheur**, **Code du modèle**, **Priorité**, **Catégorie (préférences utilisateur)**, **Canaux** (application, e-mail, WhatsApp, SMS, push).
2. **Destinataires** : cochez les **Rôles internes** (option : seulement les membres du projet concerné), les **Rôles sur le projet concerné**, les **Personnes citées dans l'événement** (demandeur, personne affectée…), une permission, et au besoin **Tous les membres internes du projet**, **Le client du projet**, **Prévenir aussi l'auteur de l'action**.
3. **Conditions d'envoi (facultatives)** : **Condition** ajoute une ligne « information de l'événement » (ex. severity) avec ses **Valeurs acceptées** (ex. high, critical) ; un **Modèle d'e-mail dédié** peut remplacer celui de la règle.
4. Case **Active** puis enregistrez. L'interrupteur d'une règle la suspend sans la supprimer.

### Modèles de messages

**Modèle** (ou **Modifier**) : **Objet** (e-mail), **Contenu** avec variables `{{ number }}`, `{{ title }}`, `{{ link }}`… (rendu dans un environnement isolé), **Modèle WhatsApp approuvé (Meta)** pour WhatsApp, case **Actif**.

### Journal des envois

Chaque envoi, filtrable par canal et par statut (envoyé, échoué, en attente) : utile pour comprendre pourquoi quelqu'un n'a pas reçu un message.
:::

::: perm integrations:manage
## Onglet « Intégrations »

### Prestataires de paiement

État des prestataires de paiement mobile et carte. Paiements réels uniquement : un prestataire est activé par la configuration du serveur, puis ses clés sont renseignées ici. Les environnements de test des opérateurs sont refusés en production.

### Clés et secrets des prestataires

Les secrets sont chiffrés au repos et jamais réaffichés ; seule leur empreinte est visible.

1. **Régler** sur la ligne du secret ouvre **Définir — …** (ou **Renouveler — …** s'il existe déjà).
2. Saisissez la **Valeur**, puis **Enregistrer**. Si votre session n'est pas encore confirmée par la double authentification, la fenêtre **Confirmer avec votre double authentification** demande votre code, puis l'enregistrement reprend ([Mon compte](doc:erp-compte)).

### Webhooks sortants

Événements métier signés (HMAC-SHA256) envoyés vers vos outils (comptabilité, BI…).

1. **Webhook** : **Nom**, **URL (HTTPS)**, **Événements** abonnés, case **Actif**. Le secret de signature est affiché une seule fois.
2. **Tester** envoie un événement d'essai ; **Journal** ouvre **Journal — …** (chaque livraison, code de réponse, nouvelles tentatives) ; le crayon modifie le webhook.
:::

## Onglet « Maintenance »

L'onglet indique **Plateforme ouverte** ou **Maintenance en cours** (message, fin prévue, depuis quand). Pendant une maintenance, seuls les administrateurs accèdent à l'API ; les autres utilisateurs voient le message.

::: perm maintenance:manage
1. Saisissez le **Message affiché aux utilisateurs** (5 caractères minimum) et la **Fin prévue**.
2. **Activer** puis confirmez dans **Activer la maintenance** : les autres utilisateurs sont déconnectés de l'API jusqu'à la fin.
3. **Terminer la maintenance** rouvre la plateforme.
:::

::: perm settings:read
## Page « Système »

Accès : **Système et sauvegardes** depuis les Paramètres. Indicateurs : **Environnement** et version, taille de la **Base de données**, **Événements en attente**, **Événements en échec**, **Dernière sauvegarde**.

### Tâches planifiées

Liste des tâches automatiques (relances, sauvegardes, calculs nocturnes) avec leur dernière exécution et leur statut.
:::

::: perm maintenance:manage
**Lancer** exécute une tâche immédiatement.
:::

::: perm backups:run
### Sauvegardes

Sauvegardes chiffrées, signées, copiées hors site.

1. Choisissez le type : **Complète**, **Base de données** ou **Fichiers**, puis **Sauvegarder maintenant** : la sauvegarde s'exécute en arrière-plan.
2. **Vérifier** contrôle l'intégrité (empreinte et signature) d'une sauvegarde.
3. **Test de restauration** restaure la sauvegarde dans une base isolée pour prouver qu'elle est exploitable, sans toucher à la production.
:::

::: perm backups:restore
### Restaurer la production

**Restaurer** ouvre **Restauration de production** (opération irréversible, accès d'urgence) :

1. **Justification (20 caractères minimum)**.
2. **Votre code MFA**.
3. **Tapez RESTAURER pour confirmer**, puis validez.

> [!WARNING]
> Toutes les données saisies depuis la sauvegarde sont perdues. Faites d'abord un **Test de restauration** et une sauvegarde complète de l'état actuel. L'opération est tracée dans le [journal d'audit](doc:erp-audit).
:::

## Mes conflits de synchronisation (hors ligne)

Si vous avez modifié une donnée hors ligne (application mobile ou bureau) pendant qu'un collègue la modifiait aussi, le conflit apparaît sur la page **Système** avec les champs en conflit : **Garder la version serveur** ou **Garder ma version**.
