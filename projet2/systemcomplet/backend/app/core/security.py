"""Primitives cryptographiques.

- Mots de passe : Argon2id (jamais réversible).
- Jetons d'accès : JWT HS256 courts ; jetons de rafraîchissement opaques (hachés en base, rotation).
- Chiffrement applicatif : AES-256-GCM avec trousseau de clés (rotation possible).
- Liens signés (téléchargements temporaires, portail fournisseur) : HMAC-SHA256.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.config import settings

# ---------------------------------------------------------------------------- mots de passe
_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2, hash_len=32, salt_len=16)

_COMMON_PASSWORDS = {
    "password",
    "motdepasse",
    "123456789012",
    "azertyuiop12",
    "qwertyuiop12",
    "globus123456",
    "administrateur",
    "password1234",
    "motdepasse123",
    "000000000000",
    "111111111111",
}


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        # Comparaison factice pour un temps constant face aux comptes inexistants.
        try:
            _hasher.verify(_TIMING_EQUALIZER_HASH, password)
        except Exception:  # noqa: BLE001
            pass
        return False
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except Exception:  # noqa: BLE001
        return True


_TIMING_EQUALIZER_HASH = _hasher.hash("globus-timing-equalizer")


def validate_password_strength(password: str, *, email: str | None = None) -> list[str]:
    """Retourne la liste des règles non respectées (vide = mot de passe accepté)."""
    problems: list[str] = []
    if len(password) < settings.PASSWORD_MIN_LENGTH:
        problems.append(f"au moins {settings.PASSWORD_MIN_LENGTH} caractères")
    if not re.search(r"[a-z]", password):
        problems.append("une lettre minuscule")
    if not re.search(r"[A-Z]", password):
        problems.append("une lettre majuscule")
    if not re.search(r"\d", password):
        problems.append("un chiffre")
    if not re.search(r"[^A-Za-z0-9]", password):
        problems.append("un caractère spécial")
    if password.lower() in _COMMON_PASSWORDS:
        problems.append("un mot de passe non trivial")
    if email:
        local = email.split("@")[0].lower()
        if len(local) >= 4 and local in password.lower():
            problems.append("ne pas contenir l'identifiant de l'adresse e-mail")
    return problems


# ---------------------------------------------------------------------------- jetons
def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def sha256_hex(value: str | bytes) -> str:
    data = value.encode() if isinstance(value, str) else value
    return hashlib.sha256(data).hexdigest()


def constant_time_equals(a: str | bytes, b: str | bytes) -> bool:
    a_b = a.encode() if isinstance(a, str) else a
    b_b = b.encode() if isinstance(b, str) else b
    return hmac.compare_digest(a_b, b_b)


def create_access_token(
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    roles: list[str],
    organization_id: uuid.UUID | None,
    mfa: bool,
    ttl_minutes: int | None = None,
    extra: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "sid": str(session_id),
        "roles": roles,
        "org": str(organization_id) if organization_id else None,
        "mfa": mfa,
        "typ": "access",
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes or settings.ACCESS_TOKEN_TTL_MINUTES)).timestamp()),
        "jti": uuid.uuid4().hex,
        "iss": "globus-api",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str, *, expected_type: str = "access") -> dict[str, Any]:
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=["HS256"],
        options={"require": ["exp", "iat", "sub", "typ"]},
        issuer="globus-api",
    )
    if payload.get("typ") != expected_type:
        raise jwt.InvalidTokenError("type de jeton inattendu")
    return payload


def create_purpose_token(purpose: str, subject: str, ttl_seconds: int, extra: dict[str, Any] | None = None) -> str:
    """Jeton JWT à usage ciblé (défi MFA, ticket WebSocket, téléchargement…)."""
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "typ": purpose,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=ttl_seconds)).timestamp()),
        "jti": uuid.uuid4().hex,
        "iss": "globus-api",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


# ---------------------------------------------------------------------------- signatures HMAC
def hmac_sign(message: str, *, key: str | None = None) -> str:
    secret = (key or settings.SECRET_KEY).encode()
    return base64.urlsafe_b64encode(hmac.new(secret, message.encode(), hashlib.sha256).digest()).decode().rstrip("=")


def sign_payload(data: dict[str, Any], ttl_seconds: int) -> str:
    body = dict(data)
    body["exp"] = int((datetime.now(UTC) + timedelta(seconds=ttl_seconds)).timestamp())
    raw = (
        base64.urlsafe_b64encode(json.dumps(body, separators=(",", ":"), sort_keys=True).encode()).decode().rstrip("=")
    )
    return f"{raw}.{hmac_sign(raw)}"


def verify_signed_payload(token: str) -> dict[str, Any] | None:
    try:
        raw, sig = token.rsplit(".", 1)
    except ValueError:
        return None
    if not constant_time_equals(hmac_sign(raw), sig):
        return None
    padded = raw + "=" * (-len(raw) % 4)
    try:
        data = json.loads(base64.urlsafe_b64decode(padded))
    except Exception:  # noqa: BLE001
        return None
    if int(data.get("exp", 0)) < int(datetime.now(UTC).timestamp()):
        return None
    return data


# ---------------------------------------------------------------------------- chiffrement AES-256-GCM
class KeyRing:
    """Trousseau de clés symétriques ; la clé courante chiffre, toutes déchiffrent."""

    def __init__(self) -> None:
        self.current_id = settings.MASTER_KEY_ID
        self.keys: dict[str, bytes] = {self.current_id: base64.b64decode(settings.MASTER_ENCRYPTION_KEY)}
        for chunk in filter(None, (settings.PREVIOUS_ENCRYPTION_KEYS or "").split(",")):
            kid, _, b64 = chunk.strip().partition(":")
            if kid and b64:
                self.keys[kid] = base64.b64decode(b64)
        for kid, key in self.keys.items():
            if len(key) != 32:
                raise ValueError(f"Clé {kid} invalide : 32 octets attendus")

    def encrypt(self, plaintext: bytes, *, aad: bytes | None = None) -> str:
        nonce = os.urandom(12)
        ct = AESGCM(self.keys[self.current_id]).encrypt(nonce, plaintext, aad)
        return f"enc:v1:{self.current_id}:" + base64.b64encode(nonce + ct).decode()

    def decrypt(self, token: str, *, aad: bytes | None = None) -> bytes:
        if not token.startswith("enc:v1:"):
            raise ValueError("Format chiffré inconnu")
        _, _, kid, b64 = token.split(":", 3)
        if kid not in self.keys:
            raise ValueError(f"Clé {kid} indisponible")
        blob = base64.b64decode(b64)
        return AESGCM(self.keys[kid]).decrypt(blob[:12], blob[12:], aad)

    def encrypt_bytes_raw(self, plaintext: bytes) -> bytes:
        """Chiffrement binaire de fichiers : en-tête kid + nonce + texte chiffré."""
        kid = self.current_id.encode()
        nonce = os.urandom(12)
        ct = AESGCM(self.keys[self.current_id]).encrypt(nonce, plaintext, b"globus-file")
        return b"GLBENC1" + len(kid).to_bytes(1, "big") + kid + nonce + ct

    def decrypt_bytes_raw(self, blob: bytes) -> bytes:
        if not blob.startswith(b"GLBENC1"):
            return blob
        klen = blob[7]
        kid = blob[8 : 8 + klen].decode()
        nonce = blob[8 + klen : 20 + klen]
        return AESGCM(self.keys[kid]).decrypt(nonce, blob[20 + klen :], b"globus-file")


_keyring: KeyRing | None = None


def keyring() -> KeyRing:
    global _keyring
    if _keyring is None:
        _keyring = KeyRing()
    return _keyring


def encrypt_str(value: str) -> str:
    return keyring().encrypt(value.encode("utf-8"))


def decrypt_str(value: str) -> str:
    return keyring().decrypt(value).decode("utf-8")


class EncryptedString(TypeDecorator[str]):
    """Colonne chiffrée au repos (AES-256-GCM) — déchiffrée à la lecture par l'ORM."""

    impl = Text
    cache_ok = True

    @property
    def python_type(self) -> type[str]:
        return str

    def process_bind_param(self, value: str | None, dialect: Any) -> str | None:
        if value is None or value == "":
            return value
        return encrypt_str(value)

    def process_result_value(self, value: str | None, dialect: Any) -> str | None:
        if value is None or value == "":
            return value
        try:
            return decrypt_str(value)
        except Exception:  # noqa: BLE001
            return None


def mask(value: str | None, visible: int = 4) -> str | None:
    if not value:
        return value
    if len(value) <= visible:
        return "•" * len(value)
    return "•" * (len(value) - visible) + value[-visible:]


def fingerprint(value: str) -> str:
    """Empreinte non réversible d'un secret (identification sans divulgation)."""
    return sha256_hex("globus-fp:" + value)[:12]


def generate_numeric_code(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))
