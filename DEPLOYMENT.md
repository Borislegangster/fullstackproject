# Globus BTP — Guide de déploiement

Ce guide couvre le déploiement de bout en bout en production : préparation
infra, secrets, migration PostgreSQL, build des images Docker, mise en
service, monitoring et runbook opérationnel.

---

## 1. Architecture cible

```
                   ┌───────────────┐
                   │    CDN / WAF  │  (Cloudflare, AWS CloudFront…)
                   └──────┬────────┘
                          │
                  ┌───────▼────────┐
                  │   Reverse-proxy│  (nginx, Traefik, Caddy)
                  │   TLS / mTLS   │
                  └───┬────────┬───┘
                      │        │
              ┌───────▼──┐  ┌──▼────────────┐
              │ frontend │  │ backend       │
              │ nginx    │  │ uvicorn x2    │
              │ :80      │  │ :8000         │
              └──────────┘  └──┬────────────┘
                               │ asyncpg
                          ┌────▼─────────┐
                          │ PostgreSQL 16│
                          └──────────────┘
```

Composants :
- **frontend** — bundle Vite servi par nginx (image `globus-btp-frontend`)
- **backend** — FastAPI sous uvicorn 2 workers (image `globus-btp-backend`)
- **postgres** — base persistante (volume Docker ou RDS / Cloud SQL)
- **CDN / WAF** — recommandé pour cache statique + protection DDoS

Le tout est orchestré dans [`docker-compose.yml`](docker-compose.yml).

---

## 2. Pré-requis

- Docker Engine 24+ et Docker Compose v2
- Domaine + certificat TLS (Let's Encrypt via Traefik / nginx-acme)
- Compte SMTP transactionnel (Gmail Workspace, SendGrid, Mailgun…)
- (Optionnel) Compte Autodesk APS pour le viewer BIM
- (Optionnel) Compte Sentry pour la télémétrie d'erreurs

---

## 3. Préparation des secrets

```bash
# Backend — clés JWT (≥ 64 octets aléatoires URL-safe)
python -c "import secrets; print(secrets.token_urlsafe(64))"  # JWT_SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"  # JWT_REFRESH_SECRET_KEY

# Postgres — mot de passe fort
openssl rand -base64 32
```

Copier `backend/.env.example` → `backend/.env` et `frontend/.env.example`
→ `frontend/.env.production`. Renseigner les variables réelles.

Variables critiques à ne PAS laisser vides en production :

| Variable                  | Origine                                      |
|---------------------------|----------------------------------------------|
| `DATABASE_URL`            | postgresql+asyncpg://user:pass@host/db       |
| `JWT_SECRET_KEY`          | `secrets.token_urlsafe(64)`                  |
| `JWT_REFRESH_SECRET_KEY`  | `secrets.token_urlsafe(64)` (≠ ci-dessus)    |
| `SMTP_HOST/USER/PASS`     | fournisseur SMTP                             |
| `FRONTEND_URL`            | URL publique du front                        |
| `CORS_ORIGINS`            | JSON liste avec le domaine du front          |
| `APS_CLIENT_ID/SECRET`    | (si BIM activé)                              |
| `SENTRY_DSN`              | (si Sentry activé)                           |

---

## 4. Migration de la base

En production on n'utilise PAS `Base.metadata.create_all`. On exécute
Alembic :

```bash
# Une fois le backend démarré
docker compose exec backend alembic upgrade head
```

Pour générer une nouvelle migration après changement de modèles :

```bash
docker compose exec backend alembic revision --autogenerate -m "votre message"
docker compose exec backend alembic upgrade head
```

Les index composites de Phase 8 (`ix_invoices_client_status`, etc.) sont
déclarés dans `app/models/erp.py` et seront picked up par `--autogenerate`.

---

## 5. Premier déploiement

```bash
# Cloner et builder
git clone https://github.com/globus-engineering/globus-btp.git
cd globus-btp

# Charger les variables d'env (peut aussi être passé via systemd ou compose)
cp backend/.env.example backend/.env && vim backend/.env

# Builder & démarrer
docker compose up -d --build

# Logs
docker compose logs -f backend

# Vérification health
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
```

Si `/health/ready` répond `"status": "ok"` avec `db.ok = true` et
`uploads.ok = true`, on est prêt à brancher le reverse-proxy public.

---

## 6. Seed initial production

Un seul admin doit être créé puis utiliser l'UI pour inviter les autres
utilisateurs.

```bash
docker compose exec backend python -m scripts.seed_production
```

Le script demande l'email + mot de passe initial de l'admin et crée :
- Compte ADMIN
- 6 templates de documents (paie, contrat, attestation, ordre de mission,
  note de frais, bon de sortie)

L'admin se connecte ensuite à `/erp` pour inviter le reste de l'équipe.

---

## 7. Monitoring

### Endpoints intégrés

- `GET /health` — liveness (probe Kubernetes / load balancer)
- `GET /health/ready` — readiness (DB + filesystem + SMTP + APS)
- `GET /health/metrics` — exposition format Prometheus

### Scrape Prometheus

```yaml
scrape_configs:
  - job_name: 'globus-btp'
    metrics_path: /health/metrics
    static_configs:
      - targets: ['backend:8000']
```

Compteurs exposés :
- `auth_login_success_total` / `auth_login_failures_total` /
  `auth_login_locked_total`
- `signing_otp_requests_total` / `signing_otp_failures_total` /
  `signing_completed_total`
- `process_uptime_seconds` (gauge)

### Sentry

Configurer `SENTRY_DSN` dans `backend/.env` puis redémarrer. Toutes les
exceptions non capturées remonteront automatiquement.

---

## 8. Sauvegarde / Restauration

```bash
# Dump quotidien
docker compose exec postgres pg_dump -U globus globus_btp \
  | gzip > backups/globus-$(date +%F).sql.gz

# Sauvegarde des uploads (signatures, PDF générés)
tar czf backups/uploads-$(date +%F).tar.gz \
  $(docker volume inspect -f '{{ .Mountpoint }}' globus-btp_backend_uploads)

# Restauration DB
gunzip < backups/globus-2026-05-30.sql.gz \
  | docker compose exec -T postgres psql -U globus -d globus_btp
```

Recommandation : cron quotidien + rotation 30 jours + copie offsite (S3,
Backblaze B2…).

---

## 9. Mise à jour

```bash
# Récupérer les dernières sources
git fetch && git pull

# Rebuild + redémarrage roulant (sans interruption visible)
docker compose pull
docker compose up -d --build

# Appliquer les éventuelles migrations
docker compose exec backend alembic upgrade head
```

---

## 10. Runbook incident

| Symptôme                            | Diagnostic                                           | Action                                                          |
|-------------------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| 502 Bad Gateway                     | uvicorn down / crash boot                            | `docker compose logs backend` puis `docker compose restart`     |
| `/health/ready` retourne `degraded` | DB down ou volume uploads RO                         | Vérifier `db.detail` ou `uploads.path`                          |
| Pic de `auth_login_failures_total`  | Tentative de bruteforce                              | Vérifier slowapi / activer fail2ban / bloquer IP au WAF         |
| WebSockets 401                      | Token expiré côté client                             | Vérifier que le front a bien `axiosClient` qui rafraîchit les jwt|
| PDFs vides / erreurs xhtml2pdf      | Police manquante côté container                      | Reconstruire l'image (Dockerfile installe pillow/jpeg/zlib)     |
| OTP signature jamais reçu          | SMTP mal configuré                                   | `curl /health/smtp` et tester en envoyant un email test         |

---

## 11. Tests sanity post-déploiement

```bash
# Liveness
curl https://api.example.com/health

# Readiness — doit renvoyer "ok"
curl https://api.example.com/health/ready

# Login
curl -X POST https://api.example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@…","password":"…"}'

# Metrics
curl https://api.example.com/health/metrics | head -20
```

Côté front, vérifier :
- Connexion à l'espace client
- Génération PDF facture
- Téléchargement Excel
- Réception d'une notification temps réel (WS)
- PWA installable depuis Chrome / Edge

---

Pour toute question opérationnelle, consulter `backend/app/main.py` (entry
point) et `backend/app/api/health.py` (endpoints de diagnostic).
