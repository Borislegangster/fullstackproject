# Applications mobiles GLOBUS (Flutter)

Trois applications, conformément au cahier des charges (§2, §2.5, §6, §14, §15) et à la décision du 16/10/2026
(Flutter pour les trois, au lieu de React Native prévu pour le terrain) :

| Application | Dossier | Public | Espace (`Me.spaces`) | `X-Client-App` |
| --- | --- | --- | --- | --- |
| **GLOBUS Client** | `apps/mobile-client` | clients, diaspora, investisseurs | `client` | `mobile-client` |
| **GLOBUS Terrain** | `apps/mobile-field` | tout le personnel (terrain et bureau), écrans filtrés par rôle / métier / permissions | `erp` | `mobile-field` |
| **GLOBUS Direction** | `apps/mobile-direction` | direction, responsables (KPI, validations, mini-ERP) | `erp` | `mobile-direction` |

Le socle commun est le paquet Dart `packages/globus_core` : charte (couleurs et polices générées depuis le web), client
API, authentification et MFA, temps réel, appels WebRTC, push, messagerie, notifications, compte, agenda, SAV,
documentation, visionneuses 3D, composants d'états.

## Principes

- **Aucune vérité métier dans les applications** : tout passe par l'API (`/api/v1`). Les écrans reprennent les chemins
  du web (`/espace-client/sav/{id}`…) : un lien de notification (in-app, push, e-mail) ouvre l'écran mobile correspondant ;
  un chemin sans écran mobile s'ouvre sur le site.
- **Authentification** : en-tête `X-Client-App` → l'API renvoie des jetons bearer (pas de cookies) ; refresh rotatif
  (une seule tentative partagée), jetons dans le stockage sécurisé du système (Keystore / Keychain / DPAPI) ;
  MFA TOTP ou codes de secours ; MFA obligatoire → seul « Mon compte › Sécurité » est accessible.
- **États explicites** (§3.1) : chargement, vide, erreur, hors ligne (bandeau daté), interdit, expiré.
- **Hors ligne** : les lectures sont mises en cache **chiffré** (AES-256-GCM, clé dans le stockage sécurisé), purgé à la
  déconnexion. Les écritures exigent le réseau (client) ; l'application terrain utilise la file `/sync` (idempotence,
  version de base, conflits explicites).
- **Idempotence** : `Idempotency-Key` sur les opérations critiques (paiement, messages, création de demandes).
- **HTTPS obligatoire** en version publiée (`GlobusConfig.problem`) ; HTTP accepté uniquement en debug vers
  localhost / 10.0.2.2 (`network_security_config_debug.xml`).
- **Icône** : icône unique de la plateforme (réglage CMS « Icône de la plateforme »), jamais le logo — à l'exécution via
  `/public/brand`, au lanceur via `dart run tool/sync_brand.dart <URL>` (pack public puis `flutter_launcher_icons`).
- **Libellés, charte et formulaires** : `node packages/globus_core/tool/gen_shared.mjs` régénère
  `lib/src/generated/*.g.dart` depuis `apps/web/src/lib/labels.ts`, `format.ts`, `app/globals.css`,
  `generated/schemas.ts` (schémas OpenAPI des corps de requête) et `lib/refs.ts` (champ → référentiel) — source
  unique ; `--check` en CI.
- **Formulaires générés** (`SchemaForm`, miroir du formulaire web) : un point d'entrée (« POST /chemin/{id} ») suffit ;
  types, contraintes, listes, lignes, fichiers et erreurs serveur champ par champ. Règle « aucun code technique » :
  les identifiants passent par un sélecteur de référentiel (projets, fournisseurs, utilisateurs…), les champs JSON et
  les identifiants sans référentiel ne sont jamais présentés.
- **Ressources déclaratives** (`ResourceConfig`, miroir de `components/erp/resource.tsx`) : liste paginée filtrable,
  fiche lisible (jamais d'identifiant affiché), actions (formulaire, confirmation, motif) selon les permissions.
- **Pages poussées** : toujours sur le navigateur racine (au-dessus du cadre : pas de double barre).

## Visionneuses 3D (maquette BIM, configurateur, 360°)

Les visionneuses three.js / Autodesk APS du web sont réutilisées dans une vue web sécurisée :

1. l'application appelle `POST /api/v1/auth/web-session {"next": "/embarque/…"}` (bearer) ;
2. l'API crée un jeton **à usage unique, 60 s**, lié à la session de l'application, limité aux pages `/embarque/` ;
3. la vue web ouvre `GET /api/v1/auth/web-session/{jeton}` : session web (cookies) puis redirection vers la page ;
4. pages `apps/web/src/app/embarque/{maquette,configurateur,360}` : visionneuse seule, pont JavaScript
   `GlobusApp` (configurateur : scénario, matériau d'une zone, sélection par toucher, capture).

Session de l'application révoquée → le lien est refusé (`WEB_HANDOFF_EXPIRED`). Audit : `WEB_HANDOFF_ISSUED` / `WEB_HANDOFF_OPENED`.

## Construire

Prérequis : Flutter 3.47 (`C:\Users\boris\flutter`), SDK Android 36 (`C:\Users\boris\Android\Sdk`), JDK 17+.

```bash
cd apps/mobile-client
flutter pub get
flutter analyze
flutter test
flutter build apk --release --dart-define-from-file=config/production.json
```

- `config/dev.json` : API locale (`http://localhost:8010`) — émulateur : `adb reverse tcp:8010 tcp:8010` et
  `adb reverse tcp:3010 tcp:3010` (pages embarquées).
- `config/production.json` : production (`https://globus-engineering-sarl.com`, VPS Hostinger) — configuration des
  APK publiés par la CI ; `config/test-aws.json` : ancien serveur de test AWS.
- Push FCM en production : projet Firebase `globus-41293` (3 applications Android déclarées), identifiants publics
  dans `config/production.json` ; compte de service saisi dans l'ERP (Intégrations › « Compte de service Firebase »).
- Push FCM (autre environnement) : ajouter `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_SENDER_ID`, `FIREBASE_PROJECT_ID`
  (et `FIREBASE_IOS_BUNDLE_ID`) au fichier de configuration, et `FCM_SERVICE_ACCOUNT_JSON` côté serveur. Sans eux,
  les notifications restent reçues dans l'application, par e-mail et WhatsApp.
- Signature de publication Android : `android/key.properties` (non versionné : `storeFile`, `storePassword`,
  `keyAlias`, `keyPassword`) ; sans ce fichier, la version « release » est signée avec la clé de débogage (tests internes).
- iOS : construction sur macOS (`flutter build ipa`) avec un compte Apple Developer ; identifiant
  `com.globusengineering.client`.

## Application terrain (GLOBUS Terrain)

Application unique du personnel ; chaque rubrique est filtrée par les permissions du serveur (même menu que l'ERP).

- **Hors ligne** (`OfflineQueue`, fichier chiffré AES-256-GCM) : mutations `/sync/push` (avancement, journal, incident,
  pointage par badge, sortie de stock) avec `client_mutation_id` et `base_version` ; fichiers (photos, rapports vocaux,
  photos d'incident) envoyés **avant** les mutations ; appels rejouables (auto-pointage `/hr/attendance/self`) avec la
  même clé d'idempotence au renvoi ; lot refusé (4xx) → « refusé » visible, jamais rejoué en boucle ; conflits arbitrés
  dans « Synchronisation » (bureau / moi / fusion champ par champ). Envoi au démarrage, au retour du réseau, au premier
  plan et toutes les 2 minutes ; purge à la déconnexion.
- **Photos d'incident hors ligne** : envoyées à `/qhse/files`, rattachées à l'incident par empreinte SHA-256 et auteur
  (`photo_checksums` du gestionnaire `incident`).
- **Scanner universel** : `GLOBUS:ZONE:` (zone : plans, tâches, photos avant / après, issues), `GLOBUS:SITE:`
  (auto-pointage géolocalisé), `GLOBUS:EMP:` (badge), `GLOBUS:PO:` (réception), `GLOBUS:EQP:` (matériel).
- **Plans** : seule la version publiée s'ouvre ; alerte « plan périmé » pour un plan téléchargé sur le téléphone puis
  remplacé (`/sync/pull` → `documents`).
- Rubriques : tâches, planning, journal, photos, rapports vocaux (IA validée), plans et maquette 3D, issues BIM,
  livraisons et réceptions (idempotentes, photos / BL), lecture IA de documents, stock (affectations, sorties,
  inventaires), matériel, QHSE (incidents, inspections, actions, quarts d'heure), SAV et entretien, pointage, espace RH
  (congés, bulletins), messagerie, appels, agenda.
- Identifiant Android / iOS : `com.globusengineering.terrain`.

## Application direction (GLOBUS Direction)

Tableau de bord (§7.1 : portefeuille, trésorerie, marges, santé, approbations, satisfaction, livraisons, contrôles,
partenaires, entonnoir), **Validations** (demandes d'achat de mon niveau, commandes, paiements, situations, factures en
anomalie, congés, documents en revue, actions QHSE, décisions client en attente), chantiers (indicateurs, budget,
indice de confiance, synthèse IA, planning, décisions, terrain), achats, fournisseurs, livraisons, stocks, matériel,
sous-traitance (marchés, consultations, situations, litiges), finance (paiements, factures, appels de fonds,
échéanciers, financements), commercial (leads, opportunités, devis, contrats, contacts, SAV), RH (personnel, congés,
paie), QHSE, rapport de direction hebdomadaire, anomalies IA, administration (utilisateurs, sécurité, sessions, audit).
Identifiant : `com.globusengineering.direction`. Gestion du site web (CMS, SEO, médiathèque) : sur l'ERP web.

## Tests

- `packages/globus_core/test` : client API (en-têtes, refresh concurrent, erreurs, idempotence, cache hors ligne,
  MFA), authentification, formats, libellés, liens, configuration.
- `packages/globus_core/test/offline_queue_test.dart` : file hors ligne (chiffrement, relecture, conflit, refus,
  rejeu idempotent, fichiers avant mutations, purge) ; `schema_form_test.dart` : formulaires générés.
- `apps/mobile-client/test`, `apps/mobile-field/test`, `apps/mobile-direction/test` : écrans avec serveur simulé au
  niveau HTTP (droits, parcours, hors ligne, validation d'un paiement).
- `apps/*/integration_test` : parcours réels contre l'API de développement (`dev_server.py --seed`, comptes
  `client@`, `chef.chantier@`, `direction@globus.demo`) sur émulateur Android ; captures enregistrées par
  `test_driver/integration_test.dart`. Émulateur lent : construire d'abord en profil x64
  (`flutter build apk --profile --target=integration_test/… --target-platform android-x64`) puis
  `flutter drive --use-application-binary=…`.
- **Robot de parcours** (`packages/globus_e2e`, `apps/*/test/e2e/crawl_test.dart`) : contre l'API de développement
  (`python backend/scripts/dev_server_isolated.py --seed --port 8010`), ouvre chaque rubrique du menu, la première fiche
  de chaque liste, chaque formulaire et chaque bouton (refermés sans validation) et relève erreurs, formulaires ou pages
  indisponibles, libellés anglais ou techniques, valeurs brutes (codes, décimales, dates ISO), statuts non traduits,
  exceptions et débordements. Sans appareil : requêtes synchrones (curl), captures `build/parcours/<appli>/` et
  `rapport.txt`. Lancement : `flutter test test/e2e/crawl_test.dart --dart-define=GLOBUS_E2E_API=http://127.0.0.1:8010`
  (ignoré sans cette variable). Les fonctions natives (caméra, micro, fichiers, vue 3D) restent à tester sur téléphone.
- Contrôles statiques : `python packages/globus_core/tool/check_mobile_api.py` (chaque chemin appelé existe dans
  l'API, en CI) ; `backend/tests/test_labels_coverage.py` (libellé français pour chaque champ et chaque valeur
  d'énumération, web et mobile).
- Backend : `backend/tests/test_mobile_apps.py` (jetons mobiles, passerelle web, push FCM, photos d'incident hors ligne).
