#!/usr/bin/env bash
# Restore script for Globus BTP — Replays a pg_dump archive into the target DB.
#
# Usage:
#   ./scripts/restore.sh ./backups/db_20260601_033000.sql.gz
#   ./scripts/restore.sh ./backups/db_20260601_033000.sql.gz ./backups/uploads_20260601_033000.tar.gz
#
# Environment:
#   DATABASE_URL    Target Postgres URL (DESTRUCTIVE — drops & recreates schema)
#   UPLOADS_DIR     Where to extract uploads tarball (default ./uploads)

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <db_dump.sql.gz> [uploads.tar.gz]" >&2
  exit 2
fi

DB_DUMP="$1"
UPLOAD_TAR="${2:-}"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set" >&2
  exit 2
fi

if [[ ! -f "$DB_DUMP" ]]; then
  echo "ERROR: dump file not found: $DB_DUMP" >&2
  exit 2
fi

echo "============================================================"
echo "  ⚠️  DESTRUCTIVE OPERATION — restoring from backup"
echo "============================================================"
echo "  DB dump  : $DB_DUMP"
echo "  Uploads  : ${UPLOAD_TAR:-(none)}"
echo "  Target   : ${DATABASE_URL%%@*}@..."
echo ""
read -r -p "Type 'YES' to continue: " confirm
[[ "$confirm" == "YES" ]] || { echo "Aborted."; exit 1; }

echo ""
echo "[$(date)] Restoring DB..."
gunzip -c "$DB_DUMP" | psql "$DATABASE_URL"
echo "[$(date)] DB restore OK"

if [[ -n "$UPLOAD_TAR" && -f "$UPLOAD_TAR" ]]; then
  echo "[$(date)] Restoring uploads..."
  # Move current dir aside so we can roll back manually if needed
  if [[ -d "$UPLOADS_DIR" ]]; then
    mv "$UPLOADS_DIR" "${UPLOADS_DIR}.old-$(date +%s)"
  fi
  mkdir -p "$(dirname "$UPLOADS_DIR")"
  tar -xzf "$UPLOAD_TAR" -C "$(dirname "$UPLOADS_DIR")"
  echo "[$(date)] Uploads restore OK"
fi

echo "Done."
