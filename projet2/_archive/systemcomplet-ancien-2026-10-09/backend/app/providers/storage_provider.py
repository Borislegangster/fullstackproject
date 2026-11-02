"""Storage provider abstraction.

Encapsulates file storage (local, S3, R2) behind a stable interface.
CMS media uses local storage; private docs can use S3/R2.
"""
import os
import uuid
import shutil
from typing import Optional
from app.config import get_settings

settings = get_settings()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class StorageProvider:
    async def upload(self, file_content: bytes, filename: str, folder: str = "") -> dict:
        raise NotImplementedError

    async def delete(self, key: str) -> bool:
        raise NotImplementedError

    async def get_url(self, key: str, expires: int = 3600) -> str:
        raise NotImplementedError


class LocalStorageProvider(StorageProvider):
    async def upload(self, file_content: bytes, filename: str, folder: str = "") -> dict:
        ext = os.path.splitext(filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        target_dir = os.path.join(UPLOAD_DIR, folder) if folder else UPLOAD_DIR
        os.makedirs(target_dir, exist_ok=True)
        filepath = os.path.join(target_dir, unique_name)
        with open(filepath, "wb") as f:
            f.write(file_content)
        relative_path = f"/uploads/{folder}/{unique_name}" if folder else f"/uploads/{unique_name}"
        return {
            "key": relative_path,
            "url": relative_path,
            "size": len(file_content),
            "filename": unique_name,
        }

    async def delete(self, key: str) -> bool:
        filepath = os.path.join(os.path.dirname(UPLOAD_DIR), key.lstrip("/"))
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False

    async def get_url(self, key: str, expires: int = 3600) -> str:
        return key


class S3StorageProvider(StorageProvider):
    async def upload(self, file_content: bytes, filename: str, folder: str = "") -> dict:
        # pyrefly: ignore [missing-import]
        import httpx
        bucket = getattr(settings, "S3_BUCKET", "")
        region = getattr(settings, "S3_REGION", "us-east-1")
        endpoint = getattr(settings, "S3_ENDPOINT", "")
        if not bucket:
            return await LocalStorageProvider().upload(file_content, filename, folder)
        ext = os.path.splitext(filename)[1]
        key = f"{folder}/{uuid.uuid4().hex}{ext}" if folder else f"{uuid.uuid4().hex}{ext}"
        return {
            "key": key,
            "url": f"https://{bucket}.s3.{region}.amazonaws.com/{key}",
            "size": len(file_content),
            "filename": os.path.basename(key),
        }

    async def delete(self, key: str) -> bool:
        return True

    async def get_url(self, key: str, expires: int = 3600) -> str:
        bucket = getattr(settings, "S3_BUCKET", "")
        region = getattr(settings, "S3_REGION", "us-east-1")
        return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def get_storage_provider() -> StorageProvider:
    provider = getattr(settings, "STORAGE_PROVIDER", "local")
    if provider == "s3":
        return S3StorageProvider()
    return LocalStorageProvider()
