"""Auth Pydantic schemas."""
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class SetPasswordRequest(BaseModel):
    """Used for first-login forced password change and invitation link."""
    token: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    force_reset: bool = False  # True when must_change_password is set
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
