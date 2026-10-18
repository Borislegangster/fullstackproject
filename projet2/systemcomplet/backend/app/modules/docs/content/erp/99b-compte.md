---
id: erp-compte
title: Mon compte - profil, mot de passe, double authentification, sessions
space: erp
section: Administration
order: 60
route: /erp/compte
summary: Modifier son profil et son mot de passe, configurer la double authentification (application, clé de sécurité ou biométrie, codes de secours), gérer ses sessions, appareils de confiance et préférences de notification.
keywords: [compte, profil, mot de passe, MFA, double authentification, TOTP, clé de sécurité, biométrie, WebAuthn, codes de secours, session, appareil, push, notification]
related: [erp-notifications, erp-premiers-pas, erp-securite]
---

## Accès

Menu **Administration › Mon compte**, ou votre nom en haut à droite. Onglets **Profil**, **Sécurité**, **Sessions et appareils**, **Notifications**.

## Onglet « Profil »

1. **Informations personnelles** : **Prénom**, **Nom** (obligatoires), **Téléphone**, **WhatsApp**, **Fonction**, **Fuseau horaire** (les dates et heures s'affichent dans ce fuseau). **Enregistrer**.
2. **Mot de passe** : **Mot de passe actuel**, **Nouveau mot de passe** (12 caractères minimum, la robustesse est vérifiée), **Confirmation**, puis **Modifier le mot de passe**. Vos autres sessions sont fermées par sécurité.

L'adresse e-mail (identifiant) ne se modifie que par un administrateur.

## Onglet « Sécurité » : double authentification

Badge **Activée**, **Désactivée** ou **Obligatoire** (si votre rôle l'exige : tant qu'elle n'est pas activée, l'accès aux fonctions est restreint).

### Application d'authentification (TOTP)

1. **Configurer une application d'authentification** ouvre **Configurer l'application d'authentification**.
2. Scannez le QR code avec Google Authenticator, Microsoft Authenticator, FreeOTP ou équivalent.
3. Saisissez le **Code à 6 chiffres** puis **Activer**.
4. La fenêtre **Vos codes de secours** affiche des codes à usage unique : **Télécharger** ou notez-les hors ligne, puis **J'ai conservé mes codes**. Ils ne seront plus affichés.

### Clé de sécurité ou biométrie

Donnez un nom (ex. « Téléphone pro », « YubiKey ») puis **Ajouter une clé / biométrie** : suivez l'invite du navigateur (empreinte, visage, code de l'appareil ou clé USB/NFC). L'icône corbeille d'un facteur le supprime.

### Codes de secours

**Régénérer les codes de secours** ouvre **Régénérer les codes de secours** : saisissez le **Code de votre application d'authentification**, puis **Régénérer**. Les anciens codes ne fonctionnent plus.

### Confirmer une opération sensible

Certaines opérations (secrets des intégrations, réglages de sécurité) exigent une session confirmée par la double authentification. Si votre session ne l'est pas encore, la fenêtre **Confirmer avec votre double authentification** s'ouvre : saisissez le **Code à 6 chiffres de votre application d'authentification** (ou **Utiliser un code de secours**), puis **Confirmer** : l'opération reprend automatiquement et votre session reste confirmée. Sans double authentification active, **Activer la double authentification** ouvre cet onglet.

### Désactiver la double authentification

**Désactiver le MFA** ouvre **Désactiver la double authentification** (impossible si votre rôle l'exige) : **Mot de passe** et **Code TOTP ou code de secours**, puis **Désactiver**. Votre compte sera moins protégé.

> [!TIP]
> Téléphone perdu sans code de secours : demandez à un administrateur une réinitialisation de votre double authentification (voir [Utilisateurs](doc:erp-utilisateurs)).

## Onglet « Sessions et appareils »

- **Sessions actives** : application, appareil, adresse, dernière activité ; **Session actuelle** signalée. **Révoquer** ferme une session ; **Fermer les autres sessions** (fenêtre du même nom) déconnecte tous vos autres appareils.
- **Appareils** : un appareil de confiance n'exige pas le second facteur pendant 30 jours (sauf profils sensibles). **Révoquer** retire la confiance.
- **Historique de sécurité** : connexions, échecs, changements de mot de passe et de MFA de votre compte.

> [!WARNING]
> Une connexion que vous ne reconnaissez pas : **Fermer les autres sessions**, changez votre mot de passe et prévenez l'administrateur.

## Onglet « Notifications »

**Préférences de notification** : pour chaque **Catégorie**, cochez les canaux (Application, Push, E-mail, WhatsApp, SMS). Les alertes de sécurité restent actives.

- **Activer le push** demande l'autorisation du navigateur pour recevoir les notifications même onglet fermé ; **Désactiver le push sur ce navigateur** l'arrête. « Push non pris en charge » : navigateur incompatible ou site non installé (sur iPhone, ajoutez d'abord le site à l'écran d'accueil).
