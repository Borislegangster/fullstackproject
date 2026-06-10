"""User preferences — Notifications, theme, locale."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.auth.service import get_current_user
from app.database import get_db
from app.models.erp import UserPreferences

router = APIRouter(prefix="/me/preferences", tags=["User Preferences"])


from app.utils.time import utcnow_naive as _now


DEFAULT_NOTIFS = {
    "chantier": True,
    "finances": True,
    "documents": True,
    "messages": True,
    "sav": True,
    "qhse": True,
}


class PreferencesUpdate(BaseModel):
    notif_email: Optional[dict] = None
    notif_sms: Optional[dict] = None
    notif_push: Optional[dict] = None
    theme: Optional[str] = None
    locale: Optional[str] = None


async def _get_or_create(db: AsyncSession, user_id: str) -> UserPreferences:
    r = await db.execute(select(UserPreferences).where(UserPreferences.user_id == user_id))
    p = r.scalars().first()
    if not p:
        p = UserPreferences(
            user_id=user_id,
            notif_email=DEFAULT_NOTIFS.copy(),
            notif_sms=DEFAULT_NOTIFS.copy(),
            notif_push=DEFAULT_NOTIFS.copy(),
        )
        db.add(p)
        await db.commit()
        await db.refresh(p)
    return p


@router.get("")
async def get_prefs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    p = await _get_or_create(db, user.id)
    return {
        "notif_email": p.notif_email or DEFAULT_NOTIFS,
        "notif_sms": p.notif_sms or DEFAULT_NOTIFS,
        "notif_push": p.notif_push or DEFAULT_NOTIFS,
        "theme": p.theme,
        "locale": p.locale,
    }


@router.patch("")
async def update_prefs(
    data: PreferencesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    p = await _get_or_create(db, user.id)
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        if v is not None:
            setattr(p, k, v)
    p.updated_at = _now()
    await db.commit()
    return {"detail": "Préférences mises à jour"}
