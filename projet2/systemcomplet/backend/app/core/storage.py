"""StorageProvider : volume local (médias publics CMS, fichiers privés) ou S3/R2 (fichiers privés lourds)."""

from __future__ import annotations

import os
import shutil
from collections.abc import Iterator
from pathlib import Path
from typing import Protocol

from app.core.config import settings


class StorageBackend(Protocol):
    name: str

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None: ...
    def get(self, key: str) -> bytes: ...
    def stream(self, key: str, chunk_size: int = 1024 * 256) -> Iterator[bytes]: ...
    def delete(self, key: str) -> None: ...
    def exists(self, key: str) -> bool: ...
    def size(self, key: str) -> int: ...


class LocalStorage:
    name = "local"

    def __init__(self, base_dir: str) -> None:
        self.base = Path(base_dir).resolve()
        self.base.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.base / key).resolve()
        if self.base not in path.parents and path != self.base:
            raise ValueError("Clé de stockage invalide")
        return path

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, path)

    def put_file(self, key: str, source: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, path)

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def stream(self, key: str, chunk_size: int = 1024 * 256) -> Iterator[bytes]:
        with self._path(key).open("rb") as handle:
            while chunk := handle.read(chunk_size):
                yield chunk

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def size(self, key: str) -> int:
        return self._path(key).stat().st_size

    def local_path(self, key: str) -> Path:
        return self._path(key)


class S3Storage:
    name = "s3"

    def __init__(self) -> None:
        import boto3

        from app.core.secrets import get_secret

        self.bucket = settings.S3_BUCKET
        # Clé secrète : coffre chiffré (saisie ERP / set-secret.sh) prioritaire, sinon variable d'environnement.
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=get_secret("S3_SECRET_ACCESS_KEY"),
        )

    def put(self, key: str, data: bytes, content_type: str | None = None) -> None:
        extra = {"ServerSideEncryption": "AES256"} if not settings.S3_ENDPOINT_URL else {}
        self.client.put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType=content_type or "application/octet-stream", **extra
        )

    def get(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def stream(self, key: str, chunk_size: int = 1024 * 256) -> Iterator[bytes]:
        body = self.client.get_object(Bucket=self.bucket, Key=key)["Body"]
        yield from body.iter_chunks(chunk_size)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:  # noqa: BLE001
            return False

    def size(self, key: str) -> int:
        return int(self.client.head_object(Bucket=self.bucket, Key=key)["ContentLength"])


_private: StorageBackend | None = None
_public: LocalStorage | None = None


def private_storage() -> StorageBackend:
    global _private
    if _private is None:
        _private = (
            S3Storage() if settings.PRIVATE_STORAGE_BACKEND == "s3" else LocalStorage(settings.PRIVATE_STORAGE_DIR)
        )
    return _private


def public_storage() -> LocalStorage:
    """Médias publics du CMS : volume local de l'hébergement (règle §5.1)."""
    global _public
    if _public is None:
        _public = LocalStorage(settings.PUBLIC_MEDIA_DIR)
    return _public


def reset_storage_cache() -> None:
    global _private, _public
    _private = None
    _public = None
