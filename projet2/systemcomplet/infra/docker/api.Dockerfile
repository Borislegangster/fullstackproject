# syntax=docker/dockerfile:1.7
# Image unique API + worker GLOBUS (FastAPI, Python 3.12). Contexte de construction : racine systemcomplet/.
#   docker build -f infra/docker/api.Dockerfile -t globus/api:4.0.0 .
# Processus : API = commande par défaut ; worker = `python -m app.workers.main` ; migrations = `alembic upgrade head`.

FROM python:3.12-slim-bookworm AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip wheel --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim-bookworm AS runtime
# pg_dump / pg_restore (sauvegardes chiffrées V4) : même version majeure que le serveur PostgreSQL.
ARG PG_MAJOR=16
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Africa/Douala
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg tzdata fonts-dejavu-core \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends "postgresql-client-${PG_MAJOR}" \
 && apt-get purge -y gnupg \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
RUN groupadd --system --gid 10001 globus \
 && useradd --system --uid 10001 --gid globus --home-dir /app --shell /usr/sbin/nologin globus
WORKDIR /app
COPY --from=build /wheels /wheels
COPY backend/requirements.txt ./
RUN pip install --no-index --find-links /wheels -r requirements.txt && rm -rf /wheels
COPY backend/alembic.ini ./
COPY backend/alembic ./alembic
COPY backend/app ./app
COPY backend/scripts/create_admin.py backend/scripts/seed_content.py ./scripts/
# V4-DEPLOY-42 : le jeu de démonstration (et ses illustrations générées) n'est jamais embarqué en production.
RUN rm -f app/seeds/demo.py app/seeds/illustrations.py \
 && find app -name "__pycache__" -prune -exec rm -rf {} + \
 && mkdir -p /data/public_media /data/private /data/backups \
 && chown -R globus:globus /data
ENV ENV=production \
    WORKER_INLINE=false \
    LOG_JSON=true \
    PUBLIC_MEDIA_DIR=/data/public_media \
    PRIVATE_STORAGE_DIR=/data/private \
    BACKUP_DIR=/data/backups
USER globus
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health/live || exit 1
# keep-alive (75 s) supérieur à celui des connexions amont de nginx (60 s) : pas de fermeture concurrente.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header", "--timeout-keep-alive", "75"]
