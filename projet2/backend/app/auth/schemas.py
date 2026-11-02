"""Auth Pydantic schemas."""
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class SetPasswordRequest(BaseModel):
    """Used for first-login forced password change and invitation link.

    Accepts BOTH `token` and `invitation_token` (alias) for forward/backward
    compatibility with frontend clients that send either field name.
    """
    token: Optional[str] = None
    invitation_token: Optional[str] = None
    new_password: str = Field(..., min_length=8)

    @model_validator(mode="after")
    def _ensure_token(self) -> "SetPasswordRequest":
        if not self.token and self.invitation_token:
            self.token = self.invitation_token
        if not self.token:
            raise ValueError("token (or invitation_token) is required")
        return self


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    force_reset: bool = False  # True when must_change_password is set
    must_setup_2fa: bool = False  # True when enforce_2fa policy requires enrollment
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: str
    phone: str = ""
    avatar_url: Optional[str] = None
    must_change_password: bool = False
    must_setup_2fa: bool = False  # enforce_2fa policy: staff must enroll


def user_to_out(user) -> "UserOut":
    """Build a UserOut payload from an ORM User row.

    Centralised so login / refresh / set-password / 2FA all produce the same
    shape and never drift apart.
    """
    return UserOut(
        id=user.id,
        email=user.email,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        full_name=user.full_name,
        role=user.role,
        phone=user.phone or "",
        avatar_url=user.avatar_url,
        must_change_password=user.must_change_password,
    )


class SessionOut(BaseModel):
    id: str
    device_label: str
    user_agent: str
    ip_address: str
    last_active_at: Optional[str] = None
    created_at: Optional[str] = None
    is_current: bool = False


# ── Two-factor authentication ─────────────────────────────────

class TwoFactorEnrollOut(BaseModel):
    """Returned from POST /auth/2fa/enroll — the OTP URI + base32 secret.

    Frontend renders the URI as a QR code and asks the user for a 6-digit code
    to confirm enrollment via POST /auth/2fa/verify.
    """
    otp_uri: str
    secret: str
    issuer: str = "Globus BTP"


class TwoFactorVerifyRequest(BaseModel):
    code: str


class TwoFactorVerifyResponse(BaseModel):
    detail: str
    backup_codes: list[str] = []


class TwoFactorLoginRequest(BaseModel):
    """Sent as a second step after login when the user has 2FA enabled."""
    challenge_token: str
    code: str


class TwoFactorDisableRequest(BaseModel):
    password: str
