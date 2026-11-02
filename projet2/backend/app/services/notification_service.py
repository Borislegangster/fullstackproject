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

    Also broadcasts the row over `/ws/notifications` so the recipient's UI
    updates instantly instead of waiting for the next poll.
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

    # Live push — non-fatal if the channel can't be reached.
    try:
        from app.api.realtime import notification_hub
        await notification_hub.push(user_id, {
            "type": "NOTIFICATION_CREATED",
            "payload": {
                "id": notif.id,
                "type": notif.type,
                "title": notif.title,
                "message": notif.message,
                "entity_type": notif.entity_type,
                "entity_id": notif.entity_id,
                "is_read": False,
                "created_at": notif.created_at.isoformat() if notif.created_at else None,
            },
        })
    except Exception as e:
        logger.warning(f"Notification WS push failed: {e}")

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
