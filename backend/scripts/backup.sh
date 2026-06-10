#!/usr/bin/env bash
# Backup script for Globus BTP — PostgreSQL DB + uploads/.
#
# Usage:
#   ./scripts/backup.sh                    # writes to ./backups/
#   BACKUP_DIR=/data/bk ./scripts/backup.sh
#
# Environment:
#   DATABASE_URL    postgresql://user:pass@host:5432/dbname
#                   (or postgres://… — both are accepted)
#   BACKUP_DIR      destination directory (default ./backups)
#   RETENTION_DAYS  how long to keep archives (default 30)
#   S3_BUCKET       optional s3://bucket/prefix — uploads via `aws s3 cp`
#
# Cron example (daily at 03:30):
#   30 3 * * * cd /app/backend && DATABASE_URL=... ./scripts/backup.sh >> /var/log/globus-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup ${TIMESTAMP}"

# ── 1. Database dump ─────────────────────────────────────────
if [[ -n "${DATABASE_URL:-}" ]]; then
  DB_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
  echo "  → pg_dump → ${DB_FILE}"
  pg_dump "$DATABASE_URL" --format=plain --no-owner --no-acl | gzip -9 > "$DB_FILE"
  echo "  → DB dump OK ($(du -h "$DB_FILE" | cut -f1))"
else
  echo "  ! DATABASE_URL not set — skipping DB dump"
fi

# ── 2. Uploads archive ───────────────────────────────────────
if [[ -d "$UPLOADS_DIR" ]]; then
  UP_FILE="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
  echo "  → tar uploads → ${UP_FILE}"
  tar -czf "$UP_FILE" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  echo "  → uploads archive OK ($(du -h "$UP_FILE" | cut -f1))"
else
  echo "  ! Uploads directory ${UPLOADS_DIR} not found — skipping"
fi

# ── 3. Optional S3 push ──────────────────────────────────────
if [[ -n "${S3_BUCKET:-}" ]]; then
  echo "  → Pushing to ${S3_BUCKET}"
  if command -v aws >/dev/null 2>&1; then
    [[ -f "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz" ]] && \
      aws s3 cp "${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz" "${S3_BUCKET}/db_${TIMESTAMP}.sql.gz"
    [[ -f "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" ]] && \
      aws s3 cp "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" "${S3_BUCKET}/uploads_${TIMESTAMP}.tar.gz"
  else
    echo "  ! aws CLI not installed — S3 push skipped"
  fi
fi

# ── 4. Retention policy ──────────────────────────────────────
echo "  → Purging archives older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -maxdepth 1 -type f -name "db_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name "uploads_*.tar.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date)] Backup ${TIMESTAMP} completed"
