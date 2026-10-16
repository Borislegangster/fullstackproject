"""Validation d'upload (MIME réel, taille, extension, antivirus), stockage privé, miniatures."""

from __future__ import annotations

import contextlib
import hashlib
import io
import logging
import re
import socket
import struct
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import PurePath
from typing import Any

import filetype
from defusedxml import ElementTree as SafeET
from PIL import ExifTags, Image, ImageOps, features
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import keyring
from app.core.storage import private_storage
from app.core.utils import utcnow
from app.modules.system.models import StoredFile

log = logging.getLogger("globus.files")

IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml", "image/heic"}
VIDEO_MIMES = {"video/mp4", "video/webm", "video/quicktime"}
AUDIO_MIMES = {
    "audio/mpeg",
    "audio/mp4",
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/aac",
    "video/webm",
}
DOC_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/csv",
    "text/plain",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
}
BIM_EXTENSIONS = {
    ".rvt",
    ".rfa",
    ".dwg",
    ".dxf",
    ".ifc",
    ".skp",
    ".nwd",
    ".nwc",
    ".glb",
    ".gltf",
    ".obj",
    ".stl",
    ".fbx",
    ".3ds",
    ".pdf",
    ".zip",
}
EXT_MIME = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".odp": "application/vnd.oasis.opendocument.presentation",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".heic": "image/heic",
    ".rvt": "application/vnd.autodesk.revit",
    ".rfa": "application/vnd.autodesk.revit",
    ".dwg": "image/vnd.dwg",
    ".dxf": "image/vnd.dxf",
    ".ifc": "application/x-step",
    ".skp": "application/vnd.sketchup.skp",
    ".nwd": "application/vnd.autodesk.navisworks",
    ".nwc": "application/vnd.autodesk.navisworks",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".obj": "model/obj",
    ".stl": "model/stl",
    ".fbx": "application/octet-stream",
    ".3ds": "application/x-3ds",
    ".zip": "application/zip",
}
CATEGORY_MIMES: dict[str, set[str]] = {
    "image": IMAGE_MIMES,
    "video": VIDEO_MIMES,
    "audio": AUDIO_MIMES,
    "document": DOC_MIMES,
    "media": IMAGE_MIMES | VIDEO_MIMES | DOC_MIMES,
    "any": IMAGE_MIMES | VIDEO_MIMES | AUDIO_MIMES | DOC_MIMES,
}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._\- ()À-ÿ]")


@dataclass
class ValidatedUpload:
    filename: str
    mime: str
    size: int
    sha256: str
    extension: str
    data: bytes


def safe_filename(name: str) -> str:
    base = PurePath(name or "fichier").name
    base = _SAFE_NAME.sub("_", base).strip(" .") or "fichier"
    return base[:180]


def _is_text(data: bytes) -> bool:
    sample = data[:4096]
    if b"\x00" in sample:
        return False
    try:
        sample.decode("utf-8")
        return True
    except UnicodeDecodeError:
        try:
            sample.decode("latin-1")
            return True
        except UnicodeDecodeError:
            return False


def _bim_signature_ok(ext: str, data: bytes) -> bool:
    head = data[:64]
    if ext in (".rvt", ".rfa", ".nwd", ".nwc"):
        return head.startswith(b"\xd0\xcf\x11\xe0") or ext in (".nwd", ".nwc")
    if ext == ".dwg":
        return head[:2] == b"AC"
    if ext == ".ifc":
        return b"ISO-10303-21" in data[:512]
    if ext == ".glb":
        return head[:4] == b"glTF"
    if ext in (".gltf", ".obj", ".dxf"):
        return _is_text(data)
    if ext == ".stl":
        return head[:5].lower() == b"solid" or len(data) > 84
    if ext == ".zip":
        return head[:2] == b"PK"
    if ext == ".pdf":
        return head[:4] == b"%PDF"
    return True  # .skp/.fbx/.3ds : pas de signature fiable, contrôle antivirus seulement


def sanitize_svg(data: bytes) -> bytes:
    """SVG contrôlé : retire scripts, gestionnaires on*, références externes."""
    try:
        root = SafeET.fromstring(data)
    except Exception as exc:
        raise AppError("SVG invalide", code="INVALID_FILE") from exc
    forbidden_tags = {"script", "foreignObject", "iframe", "embed", "object"}
    for parent in list(root.iter()):
        for child in list(parent):
            tag = child.tag.split("}")[-1]
            if tag in forbidden_tags:
                parent.remove(child)
        for attr in list(parent.attrib):
            local = attr.split("}")[-1].lower()
            value = parent.attrib[attr].strip().lower()
            if local.startswith("on") or (
                local == "href"
                and (value.startswith("javascript:") or value.startswith("http") or value.startswith("data:text"))
            ):
                del parent.attrib[attr]
    import xml.etree.ElementTree as ET

    return ET.tostring(root, encoding="utf-8")


def validate_upload(
    filename: str, data: bytes, *, category: str = "any", max_mb: int | None = None, allow_bim: bool = False
) -> ValidatedUpload:
    name = safe_filename(filename)
    ext = PurePath(name).suffix.lower()
    limit = (max_mb or (settings.MAX_BIM_UPLOAD_MB if allow_bim else settings.MAX_UPLOAD_MB)) * 1024 * 1024
    if not data:
        raise AppError("Fichier vide", code="EMPTY_FILE")
    if len(data) > limit:
        raise AppError(
            f"Fichier trop volumineux (max {limit // (1024 * 1024)} Mo)", code="FILE_TOO_LARGE", status_code=413
        )
    if allow_bim and ext in BIM_EXTENSIONS:
        if not _bim_signature_ok(ext, data):
            raise AppError("Le contenu ne correspond pas au format BIM/CAO annoncé", code="INVALID_FILE")
        mime = EXT_MIME.get(ext, "application/octet-stream")
    else:
        kind = filetype.guess(data)
        if kind is not None:
            mime = kind.mime
            if mime == "application/zip" and ext in (".docx", ".xlsx", ".pptx"):
                mime = EXT_MIME[ext]
        elif ext == ".svg" or data.lstrip()[:5] in (b"<?xml", b"<svg "):
            mime = "image/svg+xml"
        elif ext in (".csv", ".txt") and _is_text(data):
            mime = EXT_MIME[ext]
        else:
            raise AppError("Type de fichier non reconnu ou non autorisé", code="UNSUPPORTED_FILE_TYPE")
        allowed = CATEGORY_MIMES.get(category, CATEGORY_MIMES["any"])
        if mime not in allowed:
            raise AppError(f"Type de fichier non autorisé ({mime})", code="UNSUPPORTED_FILE_TYPE")
        expected = EXT_MIME.get(ext)
        if (
            expected
            and expected != mime
            and not (expected.startswith("image/") and mime.startswith("image/"))
            and not (ext in (".doc", ".xls", ".ppt") and mime == "application/x-cfb")
        ):
            raise AppError("Extension incohérente avec le contenu du fichier", code="MIME_MISMATCH")
        if mime == "image/svg+xml":
            data = sanitize_svg(data)
    scan = antivirus_scan(data)
    if scan == "infected":
        raise AppError("Fichier rejeté par l'antivirus", code="FILE_INFECTED")
    return ValidatedUpload(
        filename=name, mime=mime, size=len(data), sha256=hashlib.sha256(data).hexdigest(), extension=ext, data=data
    )


def antivirus_scan(data: bytes) -> str:
    """Analyse ClamAV (clamd INSTREAM) si configuré ; sinon « skipped »."""
    if not settings.CLAMAV_HOST:
        return "skipped"
    try:
        with socket.create_connection((settings.CLAMAV_HOST, settings.CLAMAV_PORT), timeout=30) as sock:
            sock.sendall(b"zINSTREAM\0")
            view = memoryview(data)
            for i in range(0, len(data), 64 * 1024):
                chunk = view[i : i + 64 * 1024]
                sock.sendall(struct.pack("!L", len(chunk)) + bytes(chunk))
            sock.sendall(struct.pack("!L", 0))
            answer = sock.recv(4096).decode(errors="ignore")
        if "FOUND" in answer:
            log.warning("antivirus_infected", extra={"answer": answer[:200]})
            return "infected"
        return "clean" if "OK" in answer else "error"
    except OSError:
        log.warning("antivirus_unavailable")
        return "error"


def extract_image_meta(data: bytes) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    try:
        with Image.open(io.BytesIO(data)) as img:
            meta["width"], meta["height"] = img.size
            exif = img.getexif()
            if exif:
                gps = exif.get_ifd(0x8825)
                taken = exif.get(0x9003) or exif.get(0x0132)
                if taken:
                    with contextlib.suppress(ValueError):
                        meta["taken_at"] = datetime.strptime(str(taken), "%Y:%m:%d %H:%M:%S")
                if gps:

                    def _deg(values: Any, ref: str) -> float:
                        d, m, s = (float(v) for v in values)
                        val = d + m / 60 + s / 3600
                        return -val if ref in ("S", "W") else val

                    tags = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps.items()}
                    if "GPSLatitude" in tags and "GPSLongitude" in tags:
                        meta["geo"] = {
                            "lat": round(_deg(tags["GPSLatitude"], tags.get("GPSLatitudeRef", "N")), 6),
                            "lng": round(_deg(tags["GPSLongitude"], tags.get("GPSLongitudeRef", "E")), 6),
                        }
    except Exception:  # noqa: BLE001
        pass
    return meta


def image_variants(data: bytes, widths: dict[str, int] | None = None) -> dict[str, tuple[bytes, int, int, str]]:
    """Génère des variantes WebP (et AVIF si disponible) redimensionnées, sans métadonnées EXIF."""
    widths = widths or {"thumb": 320, "md": 960, "lg": 1920}
    out: dict[str, tuple[bytes, int, int, str]] = {}
    with Image.open(io.BytesIO(data)) as src:
        img = ImageOps.exif_transpose(src)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "transparency" in img.info else "RGB")
        avif = features.check("avif") if hasattr(features, "check") else False
        for name, width in widths.items():
            copy = img.copy()
            if copy.width > width:
                ratio = width / copy.width
                copy = copy.resize((width, max(1, int(copy.height * ratio))), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            copy.save(buf, format="WEBP", quality=82, method=5)
            out[name] = (buf.getvalue(), copy.width, copy.height, "image/webp")
            if avif and name != "thumb":
                try:
                    abuf = io.BytesIO()
                    copy.save(abuf, format="AVIF", quality=60)
                    out[name + "_avif"] = (abuf.getvalue(), copy.width, copy.height, "image/avif")
                except Exception:  # noqa: BLE001
                    pass
    return out


def store_private(
    db: Session,
    upload: ValidatedUpload,
    *,
    purpose: str,
    classification: str = "internal",
    uploaded_by_id: uuid.UUID | None = None,
    encrypt: bool | None = None,
    extra: dict[str, Any] | None = None,
) -> StoredFile:
    """Enregistre un fichier privé ; les fichiers « très sensibles » sont chiffrés AES-256-GCM."""
    do_encrypt = encrypt if encrypt is not None else classification == "very_sensitive"
    file_id = uuid.uuid4()
    now = utcnow()
    key = f"{purpose}/{now:%Y/%m}/{file_id.hex}{upload.extension}"
    payload = keyring().encrypt_bytes_raw(upload.data) if do_encrypt else upload.data
    private_storage().put(key, payload, upload.mime)
    meta = (
        extract_image_meta(upload.data) if upload.mime.startswith("image/") and upload.mime != "image/svg+xml" else {}
    )
    stored = StoredFile(
        id=file_id,
        backend=private_storage().name,
        storage_key=key,
        original_name=upload.filename,
        mime_type=upload.mime,
        size_bytes=upload.size,
        checksum_sha256=upload.sha256,
        encrypted=do_encrypt,
        classification=classification,
        purpose=purpose,
        uploaded_by_id=uploaded_by_id,
        scan_status="clean" if settings.CLAMAV_HOST else "skipped",
        width=meta.get("width"),
        height=meta.get("height"),
        geo=(extra or {}).get("geo") or meta.get("geo") or {},
        taken_at=(extra or {}).get("taken_at") or meta.get("taken_at"),
    )
    db.add(stored)
    db.flush()
    return stored


def store_generated(
    db: Session,
    data: bytes,
    *,
    filename: str,
    mime: str,
    purpose: str,
    classification: str = "internal",
    uploaded_by_id: uuid.UUID | None = None,
) -> StoredFile:
    upload = ValidatedUpload(
        filename=safe_filename(filename),
        mime=mime,
        size=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        extension=PurePath(filename).suffix.lower(),
        data=data,
    )
    return store_private(db, upload, purpose=purpose, classification=classification, uploaded_by_id=uploaded_by_id)


def read_private(stored: StoredFile) -> bytes:
    data = private_storage().get(stored.storage_key)
    return keyring().decrypt_bytes_raw(data) if stored.encrypted else data
