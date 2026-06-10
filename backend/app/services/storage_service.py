import aioboto3
import logging
from typing import Optional
from botocore.exceptions import ClientError
from app.config import get_settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.settings = get_settings()
        self.session = aioboto3.Session(
            aws_access_key_id=self.settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=self.settings.S3_SECRET_ACCESS_KEY,
            region_name=self.settings.S3_REGION_NAME
        )
        self.bucket = self.settings.S3_BUCKET_NAME
        self.endpoint_url = self.settings.S3_ENDPOINT_URL
        self.use_cloud = self.settings.USE_CLOUD_STORAGE

    def _get_client(self):
        return self.session.client(
            "s3",
            endpoint_url=self.endpoint_url
        )

    async def upload_file_secure(self, content: bytes, storage_key: str, content_type: str = "application/octet-stream") -> str:
        """Uploads a file securely to S3/R2 and returns the storage key."""
        if not self.use_cloud:
            logger.warning("Cloud storage is disabled. Simulated upload.")
            return storage_key

        if not self.bucket:
            raise ValueError("S3_BUCKET_NAME is not configured")

        try:
            async with self._get_client() as s3:
                await s3.put_object(
                    Bucket=self.bucket,
                    Key=storage_key,
                    Body=content,
                    ContentType=content_type,
                    ServerSideEncryption="AES256"
                )
            logger.info(f"Successfully uploaded {storage_key} to {self.bucket}")
            return storage_key
        except ClientError as e:
            logger.error(f"Failed to upload {storage_key}: {e}")
            raise RuntimeError(f"Storage upload error: {e}")

    async def generate_presigned_url(self, storage_key: str, expiration: int = 300) -> str:
        """Generates a short-lived presigned URL for downloading a file."""
        if not self.use_cloud:
            # Fallback for local dev mode: assume the file exists locally under the same path logic
            return f"/uploads/{storage_key}"

        if not self.bucket:
            raise ValueError("S3_BUCKET_NAME is not configured")

        try:
            async with self._get_client() as s3:
                url = await s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': self.bucket, 'Key': storage_key},
                    ExpiresIn=expiration
                )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL for {storage_key}: {e}")
            raise RuntimeError(f"Storage URL generation error: {e}")

    async def delete_file(self, storage_key: str) -> None:
        """Deletes a file from the bucket."""
        if not self.use_cloud:
            return

        if not self.bucket:
            return

        try:
            async with self._get_client() as s3:
                await s3.delete_object(
                    Bucket=self.bucket,
                    Key=storage_key
                )
            logger.info(f"Successfully deleted {storage_key} from {self.bucket}")
        except ClientError as e:
            logger.error(f"Failed to delete {storage_key}: {e}")
            # Do not raise here; soft deletes shouldn't fail if the file is already gone

_storage_service = StorageService()

def get_storage_service() -> StorageService:
    return _storage_service


def _human_size(size: int) -> str:
    return f"{size / 1_048_576:.1f} MB" if size > 1_048_576 else f"{size / 1024:.0f} KB"


async def store_upload(
    content: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
    prefix: str = "files",
    public: bool = False,
) -> tuple[str, str, str]:
    """Persist bytes to S3/R2 (when USE_CLOUD_STORAGE) or the local /uploads dir.

    Single entry point used by every client & ERP upload so behaviour stays
    consistent. Returns ``(url, size_str, storage_key)``:

      • local mode            → url = "/uploads/<file>"  (storage_key still set)
      • cloud + public asset  → url = "<S3_PUBLIC_BASE_URL>/<key>" (directly loadable)
      • cloud + private file  → url = ""  (caller builds a secure download route by row id)

    Public assets only go to the cloud when ``S3_PUBLIC_BASE_URL`` is configured;
    otherwise they stay local so they remain servable without presigning.
    """
    import os
    import uuid

    from app.api.admin_media import UPLOAD_DIR  # lazy: avoids an import cycle

    svc = get_storage_service()
    ext = os.path.splitext(filename or "file")[1].lower()
    fname = f"{uuid.uuid4()}{ext}"
    storage_key = f"{prefix}/{fname}"
    size_str = _human_size(len(content))
    public_base = (getattr(svc.settings, "S3_PUBLIC_BASE_URL", None) or "").rstrip("/")

    cloud_ok = bool(svc.use_cloud and svc.bucket)
    if cloud_ok and (not public or public_base):
        await svc.upload_file_secure(content, storage_key, content_type or "application/octet-stream")
        url = f"{public_base}/{storage_key}" if public else ""
        return url, size_str, storage_key

    # Local fallback (dev, or public asset without a public base URL configured)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
        f.write(content)
    return f"/uploads/{fname}", size_str, storage_key
