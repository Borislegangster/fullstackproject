# Déploiement et exploitation — GLOBUS V4

## 1. Architecture de production (mono-serveur)

```
Internet ──► nginx :80/:443 (TLS 1.2/1.3, HSTS) ─┬─► web  (Next.js, :3000)   vitrine · espace client · ERP · extranet
                                                 ├─► api  (FastAPI, :8000)   /api/v1 · /ws · /health
                                                 └─► (renouvellement TLS : certbot, webroot ACME)
          coturn :3478 udp/tcp · :5349 tls · 49160-49260 udp   relais TURN des appels audio / vidéo
réseau interne « backend » (non routé) : PostgreSQL 16 · Redis 7 · (ClamAV)
worker : outbox (notifications, e-mails, WhatsApp, webhooks), planificateur (sauvegardes 03:30, relances, digests)
```

Volumes persistants : `pgdata`, `redisdata`, `media` (médias CMS), `private` (fichiers privés chiffrés au repos par le
contrôle d'accès applicatif), `backups` (sauvegardes chiffrées), `letsencrypt`.

## 2. Prérequis

- Ubuntu Server 24.04 LTS (ou Debian 12), 4 vCPU / 8 Go RAM minimum (16 Go conseillés avec ClamAV et maquettes BIM
  lourdes), 100 Go SSD, IPv4 publique fixe.
- Docker Engine ≥ 27 avec Compose v2, `openssl`, `git`.
- DNS : enregistrements A (et AAAA si IPv6) pour `<domaine>` et `www.<domaine>` vers le serveur.
- Pare-feu (fournisseur + `ufw`) : 22/tcp (restreint aux administrateurs), 80/tcp, 443/tcp, 3478/tcp+udp,
  5349/tcp, 49160-49260/udp. Rien d'autre : PostgreSQL et Redis ne sont jamais exposés.

## 3. Première mise en ligne

```bash
git clone <dépôt> /opt/globus && cd /opt/globus/projet2/systemcomplet
```

```bash
./infra/scripts/init-env.sh --domain <domaine> --public-ip <ip> --acme-email <email-exploitation>
```

Options : `--no-www` (domaine unique, ex. sous-domaine de test), `--private-ip <ip>` (IP publique NAT 1:1, ex. AWS),
`--ses-region <région>` (e-mails Amazon SES par le rôle IAM du serveur), `--no-payments` (aucun opérateur contractualisé).
Test de production sur AWS en attendant le VPS : voir [`infra/aws/README.md`](../infra/aws/README.md).

Génère sur le serveur, en `0600`, les fichiers `infra/env/*` (clé maître AES-256, clé JWT, mot de passe PostgreSQL,
secret TURN, secret de revalidation CMS). **Sauvegarder immédiatement `MASTER_ENCRYPTION_KEY` hors ligne**
(coffre-fort de la direction) : sans elle, ni les champs chiffrés ni les sauvegardes ne sont relisibles.

Compléter `infra/env/api.env` (ou plus tard l'administration → Intégrations, stockage chiffré en base) :
SMTP / SendGrid / Mailgun (obligatoire : l'API refuse de démarrer avec `EMAIL_PROVIDER=console`), prestataires de
paiement, WhatsApp Meta, Twilio, Autodesk APS, Anthropic.

**Paiements (réels uniquement, §16.1)** — `PAYMENT_PROVIDERS=mtn_momo,orange_money` (+ `stripe`, `flutterwave`,
`cinetpay` selon contrats) :

| Prestataire | Paramètres (`api.env`) | Secrets (coffre ou `api.env`) |
| --- | --- | --- |
| MTN MoMo (Collections + Disbursements) | `MTN_MOMO_BASE_URL` (URL de production communiquée par MTN), `MTN_MOMO_TARGET_ENVIRONMENT=mtncameroon` | `MTN_MOMO_COLLECTION_USER_ID`, `…_API_KEY`, `…_SUBSCRIPTION_KEY` ; idem `MTN_MOMO_DISBURSEMENT_*` pour les paiements sortants |
| Orange Money Web Payment | `ORANGE_OM_COUNTRY=cm`, `ORANGE_OM_MERCHANT_NAME` | `ORANGE_OM_AUTHORIZATION` (en-tête Basic fourni par Orange), `ORANGE_OM_MERCHANT_KEY` |

Déclarer chez MTN l'hôte de rappel (`providerCallbackHost`) = domaine de l'API. Les URL de notification sont signées
par transaction ; le statut est toujours relu auprès de l'opérateur avant d'être appliqué. L'API refuse de démarrer
en production avec MTN « sandbox » ou Orange « dev ».

```bash
./infra/scripts/deploy.sh
```

Construit les images (les contrôles qualité du web s'exécutent pendant la construction), obtient le certificat
Let's Encrypt (validation HTTP-01, acceptation des conditions Let's Encrypt), applique les migrations (service
`migrate`), démarre la pile. Puis :

```bash
docker compose --env-file infra/env/compose.env -f infra/docker-compose.yml exec api python scripts/create_admin.py --email <email> --first <prénom> --last <nom>
```

```bash
docker compose --env-file infra/env/compose.env -f infra/docker-compose.yml exec api python scripts/seed_content.py
```

Le contenu éditorial initial est créé **en brouillon** : relecture et publication par le circuit de validation du CMS.
Se connecter, activer le MFA (obligatoire : `MFA_ENFORCEMENT=enforce` pour ADMIN, DIRECTION, FINANCE), créer les
comptes internes, paramétrer l'entreprise (Paramètres), les intégrations, puis vérifier « Sécurité » et
« Système et sauvegardes ».

## 3 bis. Production actuelle : VPS Hostinger + déploiement continu

| Élément | Valeur |
| --- | --- |
| Serveur | Hostinger KVM 2 (2 vCPU, 8 Go, 100 Go), Ubuntu 26.04, `88.223.95.244` (`srv2071586.hstgr.cloud`) |
| Domaine | `globus-engineering-sarl.com` (A → VPS) ; `www` → redirection 301 vers le domaine |
| Pare-feu | pare-feu Hostinger `globus-production` : 22, 80, 443/tcp, 3478 tcp+udp, 5349/tcp, 49160-49260/udp |
| E-mails | messagerie Hostinger `contact@globus-engineering-sarl.com` : SMTP `smtp.hostinger.com:465` (SSL) ; SPF, DKIM et DMARC dans la zone DNS |
| Code | `/opt/globus/repo` (utilisateur `deploy`, extraction partielle de `projet2/systemcomplet`) |
| Images | `ghcr.io/borislegangster/globus-api` et `globus-web`, étiquette = commit |
| Stockage objet | AWS S3 `globus-engineering-storage-<compte>` (eu-west-3, pile CloudFormation `globus-storage`, [`infra/aws/globus-storage.yaml`](../infra/aws/globus-storage.yaml)) : fichiers privés + copies hors site des sauvegardes chiffrées ; versionné, chiffré, TLS obligatoire, journaux d'accès 90 j ; utilisateur IAM `globus-vps-storage` limité à ce bucket (clé secrète dans le coffre de l'API) |

Préparation (une fois, en root) puis environnement (en `deploy`) :

```bash
bash vps-bootstrap.sh --repo https://github.com/Borislegangster/fullstackproject.git --ci-key "<clé publique CI>"
```

```bash
runuser -u deploy -- /opt/globus/repo/projet2/systemcomplet/infra/scripts/init-env.sh --domain globus-engineering-sarl.com --public-ip 88.223.95.244 --acme-email contact@globus-engineering-sarl.com --email-from "GLOBUS ENGINEERING <contact@globus-engineering-sarl.com>" --smtp-host smtp.hostinger.com --smtp-port 465 --smtp-user contact@globus-engineering-sarl.com --no-payments --registry ghcr.io/borislegangster
```

Mot de passe de la boîte mail (saisie masquée, stocké chiffré dans le coffre de l'API, jamais dans un fichier) :

```bash
/opt/globus/repo/projet2/systemcomplet/infra/scripts/set-secret.sh SMTP_PASSWORD
```

**Déploiement continu** (`.github/workflows/globus-v4.yml`) : à chaque push sur `main` touchant
`projet2/systemcomplet/`, la CI teste l'API (PostgreSQL réel), le web (types, lint, anti-mock, liens, build), la
sécurité (gitleaks, pip-audit, npm audit), construit et publie les images sur GHCR, puis le job `deploy`
(environnement GitHub `production`) se connecte en SSH à `deploy@VPS`. La clé de la CI est limitée par
`authorized_keys` à la commande `/usr/local/sbin/globus-ci-deploy` (copie de `infra/scripts/ci-deploy.sh`) : elle
vérifie que le commit appartient à `main`, l'extrait, se connecte au registre avec le jeton éphémère du job (jamais
écrit sur disque) et lance `deploy.sh` (images tirées, migrations, redémarrage, contrôle de santé). Le job vérifie
ensuite le site public. Réglages GitHub : variables `GLOBUS_DEPLOY_ENABLED=true`, `GLOBUS_SITE_URL`, `VPS_HOST`,
`VPS_KNOWN_HOSTS` ; secret d'environnement `VPS_SSH_KEY`. Les APK Android (configuration `production.json`) sont
publiés comme artefacts du job `mobile`.

## 4. Mises à jour

Avec le déploiement continu : fusionner sur `main`, la mise en ligne suit automatiquement. Sans CI (images
construites sur le serveur) :

```bash
git pull && ./infra/scripts/deploy.sh
```

Retour arrière immédiat à une version publiée (les 3 dernières restent en cache ; historique `infra/env/releases.log`) :

```bash
GLOBUS_RELEASE=<commit> ./infra/scripts/deploy.sh
```

Les migrations sont appliquées avant le redémarrage de l'API (`migrate` doit réussir, sinon l'API reste sur
l'ancienne version). Les migrations sont à sens unique : avant une mise à jour majeure, lancer une sauvegarde
manuelle (administration → Système et sauvegardes) ; en cas d'échec, restaurer cette sauvegarde puis redéployer la
version précédente (`GLOBUS_VERSION` dans `infra/env/compose.env`).

## 5. Sauvegardes et restauration

- Sauvegarde complète quotidienne à 03:30 (base `pg_dump` + fichiers), chiffrée AES-256-GCM avec la clé maître,
  signée (empreinte SHA-256 + HMAC), rétention `BACKUP_RETENTION_DAYS` (30 j, minimum 7 conservées).
- Copie hors site : `PRIVATE_STORAGE_BACKEND=s3` (copie automatique des sauvegardes dans le bucket) ou synchronisation
  du volume `globus_backups` vers un stockage externe (rclone / rsync) chaque nuit.
- Contrôle : bouton « Vérifier » (empreinte + signature) et « Test de restauration » mensuel (administration →
  Paramètres → Système et sauvegardes) : restauration dans une base isolée, comptages de contrôle, rapport conservé.
- Restauration en place : uniquement sous accès d'urgence (break-glass : code MFA + justification, alerte aux
  administrateurs, journal d'audit critique), précédée d'une sauvegarde automatique « pré-destructive ».

## 6. Supervision

- Sondes : `https://<domaine>/health/live` (processus), `/health/ready` (base, Redis, stockage).
- Journaux JSON avec identifiant de corrélation : `docker compose … logs -f api worker`.
- Métriques Prometheus : `http://api:8000/metrics` depuis le réseau interne uniquement (bloqué par nginx).
- Alertes applicatives `system.alert` notifiées aux administrateurs : échec de sauvegarde, tâche planifiée en échec,
  événement en échec définitif (notifications, webhooks), ouverture d'un accès d'urgence.

## 7. Sécurité — points de contrôle avant ouverture

| Contrôle | Où |
| --- | --- |
| TLS 1.2/1.3, HSTS, redirection HTTP → HTTPS, `www` → domaine | `infra/nginx` |
| Configuration refusée si clés faibles, URL non HTTPS, cookies non sécurisés, environnement de test MTN / Orange, e-mail console, prestataire inconnu | `app/core/config.py` (démarrage) |
| Aucun mock ni donnée fictive livrés (V4-DEPLOY-42), seeder de démo absent de l'image | CI + `infra/docker/api.Dockerfile` |
| Conteneurs non root, PostgreSQL / Redis sur réseau interne non routé | `infra/docker-compose.yml` |
| MFA obligatoire rôles sensibles, sessions révocables, accès d'urgence journalisé | administration → Sécurité |
| Chaîne d'audit vérifiable, sauvegardes chiffrées testées | administration → Audit / Système |
| Dépendances auditées (pip-audit, npm audit), secrets jamais commités (gitleaks) | CI |

## 8. Dépannage

- `migrate` en échec : `docker compose … logs migrate` ; l'API n'est pas redémarrée tant que la migration échoue.
- L'API refuse de démarrer : le message « Configuration invalide : … » liste les paramètres à corriger dans
  `infra/env/api.env`.
- Appels vidéo sans connexion derrière certains réseaux mobiles : vérifier le profil `calls` (coturn), les ports UDP
  et `TURN_URLS`.
- Certificat : `docker compose … run --rm certbot certificates`.
