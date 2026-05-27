"""Notification service — In-app notification system for all users."""
import logging
from typing import Optional
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.erp import Notification

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    user_id: str,
    title: str,
    message: str = "",
    type: str = "info",
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
):
    """
    Create a notification for a specific user.

    Types: info, success, warning, error, invoice, message, sav, project, appointment
    """
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(notif)
    await db.flush()
    logger.info(f"Notification created for {user_id}: {title}")
    return notif


async def mark_read(db: AsyncSession, notification_id: str, user_id: str):
    """Mark a single notification as read (only if it belongs to the user)."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
        )
    )
    notif = result.scalars().first()
    if notif:
        notif.is_read = True
        await db.flush()
    return notif


async def mark_all_read(db: AsyncSession, user_id: str):
    """Mark all notifications for a user as read."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.flush()


async def get_unread_count(db: AsyncSession, user_id: str) -> int:
    """Get the count of unread notifications for a user."""
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    )
    return result.scalar() or 0
