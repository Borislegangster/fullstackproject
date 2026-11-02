# Globus BTP — Backend operations scripts

## backup.sh — Daily backup
Dumps PostgreSQL DB + `uploads/` to `./backups/` (gzipped). Optionally pushes to S3.

```bash
DATABASE_URL=postgresql://… ./scripts/backup.sh
DATABASE_URL=… S3_BUCKET=s3://my-bucket/globus ./scripts/backup.sh
```

**Cron** (daily 03:30, log rotated):
```cron
30 3 * * * cd /app/backend && DATABASE_URL=… ./scripts/backup.sh >> /var/log/globus-backup.log 2>&1
```

## restore.sh — Disaster recovery
**Destructive.** Asks for `YES` confirmation, then replays the dump and (optionally)
extracts the uploads tarball.

```bash
DATABASE_URL=postgresql://… ./scripts/restore.sh \
    ./backups/db_20260601_033000.sql.gz \
    ./backups/uploads_20260601_033000.tar.gz
```

## Test the cycle (recommended monthly)
1. Pick the latest archive in `./backups/`.
2. Spin up a throwaway Postgres (e.g. `docker run -d -e POSTGRES_PASSWORD=… postgres:16`).
3. `DATABASE_URL=… ./scripts/restore.sh db_….sql.gz`
4. Boot the API against that DB, sanity-check a few records.
5. Drop the throwaway DB.

Document each successful test in `RUNBOOK.md` (date + responsible).
