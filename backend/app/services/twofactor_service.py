"""Two-factor authentication service — TOTP enroll/verify/disable.

Backed by the `two_factor_secrets` table (Phase 1).
Uses pyotp for the TOTP RFC 6238 implementation. Backup codes are SHA-256
hashed before storage.
"""
import secrets
from typing import Optional

import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import sha256_hex
from app.models.erp import TwoFactorSecret
from app.utils.time import utcnow_naive


ISSUER = "Globus BTP"


def generate_secret() -> str:
    """Returns a base32-encoded TOTP secret."""
    return pyotp.random_base32()


def build_otp_uri(email: str, secret: str) -> str:
    """Build the otpauth:// URI consumed by Google/Microsoft Authenticator."""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=ISSUER,
    )


def verify_totp(secret: str, code: str, *, window: int = 1) -> bool:
    """Verify a 6-digit TOTP code with a ±1 step tolerance (≈30s)."""
    if not code or not code.strip().isdigit():
        return False
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=window)


# ── Backup codes ─────────────────────────────────────────────

def generate_backup_codes(n: int = 8, length: int = 10) -> list[str]:
    """Returns N random backup codes in the form XXXX-XXXXX (URL-safe chars)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars
    raw: list[str] = []
    for _ in range(n):
        s = "".join(secrets.choice(alphabet) for _ in range(length))
        raw.append(f"{s[:4]}-{s[4:]}")
    return raw


def hash_backup_code(code: str) -> str:
    return sha256_hex(code.replace("-", "").upper())


def hash_backup_codes(codes: list[str]) -> list[str]:
    return [hash_backup_code(c) for c in codes]


def consume_backup_code(stored_hashes: list[str], code: str) -> Optional[list[str]]:
    """Return the updated hash list if the code matched (consumed) else None."""
    h = hash_backup_code(code)
    if h in stored_hashes:
        return [s for s in stored_hashes if s != h]
    return None


# ── DB helpers ───────────────────────────────────────────────

async def get_secret_row(db: AsyncSession, user_id: str) -> Optional[TwoFactorSecret]:
    r = await db.execute(
        select(TwoFactorSecret).where(TwoFactorSecret.user_id == user_id)
    )
    return r.scalars().first()


async def is_2fa_enabled(db: AsyncSession, user_id: str) -> bool:
    row = await get_secret_row(db, user_id)
    return bool(row and row.enabled)


async def start_enrollment(db: AsyncSession, user: User) -> str:
    """Create or replace the pending TOTP secret for this user, returning the secret."""
    row = await get_secret_row(db, user.id)
    secret = generate_secret()
    if row:
        row.secret = secret
        row.enabled = False
        row.confirmed_at = None
        row.backup_codes = []
    else:
        row = TwoFactorSecret(
            user_id=user.id,
            secret=secret,
            enabled=False,
            backup_codes=[],
        )
        db.add(row)
    await db.flush()
    return secret


async def confirm_enrollment(
    db: AsyncSession, user: User, code: str
) -> tuple[bool, list[str]]:
    """Verify the 6-digit code and activate 2FA. Returns (success, backup_codes)."""
    row = await get_secret_row(db, user.id)
    if not row or row.enabled:
        return False, []
    if not verify_totp(row.secret, code):
        return False, []
    codes = generate_backup_codes()
    row.enabled = True
    row.confirmed_at = utcnow_naive()
    row.backup_codes = hash_backup_codes(codes)
    await db.flush()
    return True, codes


async def verify_login_code(
    db: AsyncSession, user_id: str, code: str
) -> bool:
    """Verify a TOTP code OR a backup code during login."""
    row = await get_secret_row(db, user_id)
    if not row or not row.enabled:
        return False
    # Try TOTP first
    if verify_totp(row.secret, code):
        row.last_used_at = utcnow_naive()
        await db.flush()
        return True
    # Try backup code (single-use, consumed on match)
    remaining = consume_backup_code(row.backup_codes or [], code)
    if remaining is not None:
        row.backup_codes = remaining
        row.last_used_at = utcnow_naive()
        await db.flush()
        return True
    return False


async def disable_2fa(db: AsyncSession, user_id: str) -> bool:
    row = await get_secret_row(db, user_id)
    if not row:
        return False
    await db.delete(row)
    await db.flush()
    return True
