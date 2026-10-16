# GLOBUS ENGINEERING — Système complet V4

> Vous avez un projet. Nous maîtrisons sa réalisation. — *Concevoir. Calculer. Construire. Contrôler.*

Plateforme unique (Spec Master V4) : site vitrine piloté par CMS, espace client, ERP web, extranet partenaires
(fournisseurs, sous-traitants), API métier, temps réel (notifications, messagerie, appels WebRTC), BIM / 3D,
paiements en ligne, IA. Applications desktop et mobiles : phase suivante, sur la même API.

| Dossier | Contenu |
| --- | --- |
| `backend/` | API FastAPI + PostgreSQL (`app/core`, `app/modules/<domaine>`, `app/providers`, `app/websocket`, `app/workers`), migrations Alembic, tests |
| `apps/web/` | Next.js 15 (App Router) : vitrine `/`, espace client `/espace-client`, ERP `/erp`, extranet `/extranet` |
| `infra/` | Images Docker, Docker Compose de production, nginx (TLS), coturn, scripts `init-env.sh` / `deploy.sh` |
| `docs/` | Exploitation : [déploiement](docs/DEPLOIEMENT.md), [revue de recette V4](docs/REVUE_V4.md) (42 critères), [propositions d'innovation](docs/INNOVATIONS.md) |

## Démarrage local (sans Docker ni PostgreSQL installé)

Prérequis : Python 3.12, Node.js ≥ 20.11.

```bash
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt   # Windows
cd apps/web && npm ci
```

Deux terminaux :

```bash
backend/.venv/Scripts/python backend/scripts/dev_server.py --seed
```

```bash
npm --prefix apps/web run dev:local
```

- API : http://127.0.0.1:8010/api/v1/docs — PostgreSQL embarqué (`pgserver`), base `globus_dev`, migrations
  appliquées automatiquement, jeu de démonstration chargé avec `--seed` (`--reset` pour repartir de zéro).
- Web : http://localhost:3010 — comptes de démonstration (un par rôle) : [`backend/scripts/DEMO_ACCOUNTS.md`](backend/scripts/DEMO_ACCOUNTS.md).
- E-mails / SMS / WhatsApp en mode « console » (consultables dans l'administration).
- Vitrine de démonstration illustrée (scènes générées : villa, tour, océan, diaspora, plan, chantier — aucun téléchargement) ; documents Excel / Word / CSV dans la GED pour tester l'aperçu intégré des fichiers. Sur une base déjà chargée, `--seed` ajoute ces visuels sans rien écraser.
- Comptes clients : **sur invitation uniquement** (administration ou signature du contrat) ; changement du mot de passe et MFA imposés à l'activation (`/activation`).
- Paiements **réels uniquement** (MTN MoMo, Orange Money, Stripe, Flutterwave, CinetPay) : en local, utilisez les
  environnements de test officiels des opérateurs (bac à sable MTN : `python backend/scripts/momo_sandbox_user.py`,
  puis `PAYMENT_PROVIDERS=mtn_momo`). Détails : [backend/scripts/DEMO_ACCOUNTS.md](backend/scripts/DEMO_ACCOUNTS.md).

## Contrôles qualité (exécutés en CI : `.github/workflows/globus-v4.yml`)

```bash
cd backend && .venv/Scripts/python -m ruff check app tests scripts && .venv/Scripts/python -m pytest
```

```bash
cd apps/web && npm run verify
```

`npm run verify` enchaîne : types, lint (0 avertissement), **V4-DEPLOY-42** (`check:mocks` : aucun mock ni donnée
fictive dans le code de production web + API), `check:links` (chaque lien profond des notifications / e-mails
correspond à une route), `check:docs` (documentation intégrée exhaustive : chaque menu, onglet, bouton et fenêtre
de l'interface est décrit, aucune permission inconnue), build de production. Les formulaires de l'ERP sont générés depuis l'OpenAPI
(`python backend/scripts/export_openapi.py` puis `npm run gen:schemas`).

## Documentation intégrée (ERP, espace client, extranet)

Menu **Aide › Documentation** et bouton **?** (aide de l'écran affiché) dans chaque espace. Le contenu est versionné
dans `backend/app/modules/docs/content/<erp|client|extranet>/*.md` (en-tête : identifiant, rubrique, écrans couverts,
permissions ; blocs réservés `::: perm …` / `::: role …` / `::: space …`). L'API `/api/v1/documentation` filtre côté
serveur : chacun ne reçoit que les pages et procédures autorisées par ses espaces, rôles et permissions (une page
interdite répond 404 comme une page inexistante). Le personnel en relation avec les clients ou partenaires lit leurs
guides en « vue support ». Toute évolution de l'interface doit être documentée : `npm run check:docs` échoue sinon.

## Production

Voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md) : serveur Linux + Docker, `infra/scripts/init-env.sh` (secrets générés
sur le serveur, jamais versionnés), `infra/scripts/deploy.sh` (images, TLS Let's Encrypt, migrations, démarrage).
