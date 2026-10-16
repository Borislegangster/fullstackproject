"""Sauvegardes (V4-BACKUP-40/41) : pg_dump chiffré AES-256-GCM, empreinte + signature HMAC, copie distante (S3),
rétention ; restauration de contrôle dans une base isolée avec vérifications ; restauration en place réservée au
break-glass (MFA + justification), précédée d'une sauvegarde de sécurité et exécutée en mode maintenance."""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from datetime import timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core import audit
from app.core.config import settings
from app.core.errors import BusinessRuleError, NotFound
from app.core.security import hmac_sign, keyring
from app.core.utils import utcnow
from app.modules.system.models import BackupJob

log = logging.getLogger("globus.backups")
RESTORE_TEST_DB = "globus_restore_test"
SANITY_TABLES = ("users", "projects", "audit_events", "documents", "payments")


def _tool(name: str) -> str:
    exe = name + (".exe" if os.name == "nt" else "")
    if settings.PG_BIN_DIR:
        candidate = Path(settings.PG_BIN_DIR) / exe
        if candidate.exists():
            return str(candidate)
    found = shutil.which(name)
    if found:
        return found
    try:  # PostgreSQL embarqué (développement / tests)
        import pgserver

        candidate = Path(pgserver.__file__).parent / "pginstall" / "bin" / exe
        if candidate.exists():
            return str(candidate)
    except ImportError:
        pass
    raise BusinessRuleError(
        f"{name} introuvable : installer le client PostgreSQL ou renseigner PG_BIN_DIR", code="PG_TOOLS_MISSING"
    )


def _conn_args(database: str | None = None) -> tuple[list[str], dict[str, str]]:
    url = make_url(settings.DATABASE_URL)
    args = ["-h", url.host or "localhost", "-p", str(url.port or 5432), "-U", url.username or "postgres"]
    env = {**os.environ}
    if url.password:
        env["PGPASSWORD"] = url.password
    return [*args, "-d", database or url.database or "postgres"], env


def _run(cmd: list[str], env: dict[str, str], timeout: int = 3600) -> None:
    result = subprocess.run(cmd, env=env, capture_output=True, timeout=timeout, check=False)  # noqa: S603
    if result.returncode != 0:
        raise RuntimeError((result.stderr or b"").decode("utf-8", "replace")[-2000:])


def _backup_dir() -> Path:
    path = Path(settings.BACKUP_DIR).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


def _dump_database(workdir: Path) -> Path:
    target = workdir / "database.dump"
    args, env = _conn_args()
    _run(
        [
            _tool("pg_dump"),
            *args,
            "--format=custom",
            "--compress=6",
            "--no-owner",
            "--no-privileges",
            "-f",
            str(target),
        ],
        env,
    )
    return target


def _zip_files(workdir: Path) -> Path:
    target = workdir / "files.zip"
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for label, root in (("private", settings.PRIVATE_STORAGE_DIR), ("public", settings.PUBLIC_MEDIA_DIR)):
            base = Path(root)
            if settings.PRIVATE_STORAGE_BACKEND == "s3" and label == "private":
                continue  # stockage objet : répliqué / versionné côté fournisseur
            if base.exists():
                for file in base.rglob("*"):
                    if file.is_file():
                        archive.write(file, f"{label}/{file.relative_to(base).as_posix()}")
    return target


def signature_of(checksum: str) -> str:
    return hmac_sign(f"backup:{checksum}")


def run_backup(db: Session, job: BackupJob) -> BackupJob:
    """Exécute la sauvegarde décrite par `job` (database / files / full)."""
    job.status = "running"
    job.started_at = utcnow()
    db.commit()
    try:
        with tempfile.TemporaryDirectory(prefix="globus_backup_") as tmp:
            workdir = Path(tmp)
            parts: list[Path] = []
            if job.kind in ("database", "full", "pre_destructive"):
                parts.append(_dump_database(workdir))
            if job.kind in ("files", "full"):
                parts.append(_zip_files(workdir))
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as bundle:
                for part in parts:
                    bundle.write(part, part.name)
                manifest = {
                    "kind": job.kind,
                    "created_at": utcnow().isoformat(),
                    "database": make_url(settings.DATABASE_URL).database,
                    "app": "globus",
                    "alembic": "head",
                    "parts": [p.name for p in parts],
                }
                bundle.writestr("manifest.json", json.dumps(manifest))
            encrypted = keyring().encrypt_bytes_raw(buffer.getvalue())
        checksum = hashlib.sha256(encrypted).hexdigest()
        name = f"globus-{job.kind}-{utcnow():%Y%m%d-%H%M%S}-{job.id.hex[:8]}.glbk"
        path = _backup_dir() / name
        path.write_bytes(encrypted)
        job.file_path = str(path)
        job.size_bytes = len(encrypted)
        job.checksum = checksum
        job.signature = signature_of(checksum)
        job.encrypted = True
        if settings.PRIVATE_STORAGE_BACKEND == "s3":
            from app.core.storage import private_storage

            private_storage().put(f"backups/{name}", encrypted, "application/octet-stream")
            job.remote_copy_status = "copied"
        else:
            job.remote_copy_status = "local_only"
        job.status = "success"
        job.details = {**(job.details or {}), "parts": [p.name for p in parts]}
    except Exception as exc:
        log.exception("backup_failed")
        job.status = "failed"
        job.error = str(exc)[:2000]
        from app.core.events import emit

        emit(db, "system.alert", {"title": "Échec de sauvegarde", "message": job.error[:300]})
    job.finished_at = utcnow()
    audit.record(
        db,
        family="system",
        module="backups",
        action="BACKUP",
        resource_type="backup_job",
        resource_id=job.id,
        actor_id=job.triggered_by_id,
        actor_type="user" if job.triggered_by_id else "system",
        result="SUCCESS" if job.status == "success" else "FAIL",
        diff={"kind": job.kind, "size": job.size_bytes, "checksum": job.checksum},
        criticality="MEDIUM",
    )
    db.commit()
    return job


def verify(job: BackupJob) -> dict[str, Any]:
    if not job.file_path or not Path(job.file_path).exists():
        return {"ok": False, "reason": "Fichier de sauvegarde absent"}
    data = Path(job.file_path).read_bytes()
    checksum = hashlib.sha256(data).hexdigest()
    if checksum != job.checksum:
        return {"ok": False, "reason": "Empreinte différente (fichier altéré)"}
    if not hmac.compare_digest(signature_of(checksum), job.signature or ""):
        return {"ok": False, "reason": "Signature invalide"}
    try:
        with zipfile.ZipFile(io.BytesIO(keyring().decrypt_bytes_raw(data))) as bundle:
            names = bundle.namelist()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": f"Déchiffrement impossible : {exc}"}
    return {"ok": True, "checksum": checksum, "content": names}


def _extract_dump(job: BackupJob, workdir: Path) -> Path:
    check = verify(job)
    if not check["ok"]:
        raise BusinessRuleError(f"Sauvegarde invalide : {check['reason']}", code="BACKUP_INVALID")
    data = keyring().decrypt_bytes_raw(Path(job.file_path or "").read_bytes())
    with zipfile.ZipFile(io.BytesIO(data)) as bundle:
        if "database.dump" not in bundle.namelist():
            raise BusinessRuleError("Cette sauvegarde ne contient pas de base de données")
        bundle.extract("database.dump", workdir)
    return workdir / "database.dump"


def restore_test(db: Session, source: BackupJob, *, user_id: uuid.UUID | None) -> BackupJob:
    """Restauration de contrôle dans une base isolée + vérifications (comptages, chaîne d'audit)."""
    job = BackupJob(
        kind="restore_test",
        status="running",
        trigger="manual",
        triggered_by_id=user_id,
        started_at=utcnow(),
        source_backup_id=source.id,
        target_environment=RESTORE_TEST_DB,
    )
    db.add(job)
    db.commit()
    url = make_url(settings.DATABASE_URL)
    admin_url = url.set(database="postgres")
    try:
        with tempfile.TemporaryDirectory(prefix="globus_restore_") as tmp:
            dump = _extract_dump(source, Path(tmp))
            engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
            with engine.connect() as conn:
                conn.execute(text(f'DROP DATABASE IF EXISTS "{RESTORE_TEST_DB}" WITH (FORCE)'))
                conn.execute(text(f'CREATE DATABASE "{RESTORE_TEST_DB}"'))
            engine.dispose()
            args, env = _conn_args(RESTORE_TEST_DB)
            _run([_tool("pg_restore"), *args, "--no-owner", "--no-privileges", "--exit-on-error", str(dump)], env)
        restored = create_engine(url.set(database=RESTORE_TEST_DB))
        counts: dict[str, int] = {}
        with restored.connect() as conn:
            for table in SANITY_TABLES:
                # Noms issus de la constante SANITY_TABLES (jamais d'une saisie) : pas d'injection possible.
                counts[table] = int(conn.execute(text(f'SELECT count(*) FROM "{table}"')).scalar_one())  # nosec B608
            version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
        from sqlalchemy.orm import Session as OrmSession

        with OrmSession(restored) as restored_session:
            chain = audit.verify_chain(restored_session)
        restored.dispose()
        job.status = "success" if chain.get("valid") else "failed"
        job.details = {"counts": counts, "alembic_version": version, "audit_chain": chain}
        if job.status == "failed":
            job.error = "Chaîne d'audit rompue dans la sauvegarde restaurée"
    except Exception as exc:
        log.exception("restore_test_failed")
        job.status = "failed"
        job.error = str(exc)[:2000]
    job.finished_at = utcnow()
    audit.record(
        db,
        family="system",
        module="backups",
        action="RESTORE_TEST",
        resource_type="backup_job",
        resource_id=job.id,
        actor_id=user_id,
        result="SUCCESS" if job.status == "success" else "FAIL",
        diff={"source": str(source.id), "details": job.details},
        criticality="MEDIUM",
    )
    db.commit()
    return job


def restore_in_place(db: Session, source: BackupJob, *, user_id: uuid.UUID, break_glass_id: uuid.UUID) -> BackupJob:
    """Restauration destructive : sauvegarde de sécurité, maintenance, pg_restore --clean, fin de maintenance."""
    from app.modules.admin.state import invalidate
    from app.modules.system.models import Setting

    job = BackupJob(
        kind="restore",
        status="running",
        trigger="manual",
        triggered_by_id=user_id,
        started_at=utcnow(),
        source_backup_id=source.id,
        target_environment="production" if settings.is_production else settings.ENV,
        break_glass_id=break_glass_id,
    )
    db.add(job)
    db.commit()
    safety = BackupJob(kind="pre_destructive", trigger="pre_destructive", triggered_by_id=user_id)
    db.add(safety)
    db.flush()
    run_backup(db, safety)
    if safety.status != "success":
        job.status = "failed"
        job.error = "Sauvegarde de sécurité impossible : restauration annulée"
        job.finished_at = utcnow()
        db.commit()
        return job
    maintenance = db.get(Setting, "maintenance") or Setting(key="maintenance", category="system", value={})
    maintenance.value = {
        "enabled": True,
        "message": "Restauration en cours — retour imminent.",
        "since": utcnow().isoformat(),
    }
    db.merge(maintenance)
    db.commit()
    invalidate("maintenance")
    try:
        with tempfile.TemporaryDirectory(prefix="globus_restore_") as tmp:
            dump = _extract_dump(source, Path(tmp))
            args, env = _conn_args()
            _run(
                [_tool("pg_restore"), *args, "--clean", "--if-exists", "--no-owner", "--no-privileges", str(dump)], env
            )
        job.status = "success"
        job.details = {"safety_backup_id": str(safety.id)}
    except Exception as exc:
        log.exception("restore_failed")
        job.status = "failed"
        job.error = str(exc)[:2000]
    finally:
        db.rollback()
        row = db.get(Setting, "maintenance")
        if row is not None:
            row.value = {"enabled": False}
        job = db.merge(job)
        job.finished_at = utcnow()
        db.commit()
        invalidate("maintenance")
    audit.record_independent(
        family="security",
        module="backups",
        action="RESTORE",
        resource_type="backup_job",
        resource_id=str(job.id),
        actor_id=user_id,
        result="SUCCESS" if job.status == "success" else "FAIL",
        diff={"source": str(source.id), "break_glass": str(break_glass_id)},
        criticality="CRITICAL",
    )
    return job


def purge_old(db: Session) -> int:
    cutoff = utcnow() - timedelta(days=settings.BACKUP_RETENTION_DAYS)
    jobs = (
        db.execute(
            select(BackupJob)
            .where(BackupJob.status == "success", BackupJob.kind.in_(["database", "full"]))
            .order_by(BackupJob.created_at.desc())
        )
        .scalars()
        .all()
    )
    removed = 0
    for job in jobs[settings.BACKUP_KEEP_MIN :]:
        if job.created_at < cutoff and job.file_path:
            Path(job.file_path).unlink(missing_ok=True)
            job.status = "purged"
            removed += 1
    return removed


def scheduled_backup(db: Session) -> dict[str, Any]:
    """Job quotidien : sauvegarde complète + purge selon la rétention."""
    job = BackupJob(kind="full", trigger="schedule")
    db.add(job)
    db.flush()
    run_backup(db, job)
    removed = purge_old(db)
    return {"items": 1, "status": job.status, "purged": removed}


def get_job(db: Session, job_id: uuid.UUID) -> BackupJob:
    job = db.get(BackupJob, job_id)
    if job is None:
        raise NotFound("Sauvegarde introuvable")
    return job
