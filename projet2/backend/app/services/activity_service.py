"""Activity logging service — Audit trail for all admin actions."""
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.erp import ActivityLog

logger = logging.getLogger(__name__)


async def log_activity(
    db: AsyncSession,
    actor_id: str,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    old_value: Optional[dict] = None,
    new_value: Optional[dict] = None,
    description: str = "",
    ip_address: str = "",
):
    """
    Record an activity in the audit trail.

    Actions follow the convention: ENTITY_VERB
    Examples: LEAD_CREATED, LEAD_CONVERTED, PROJECT_CREATED, PHASE_VALIDATED,
              INVOICE_SENT, DOCUMENT_SHARED, TICKET_CREATED, USER_CREATED,
              USER_DEACTIVATED, APPOINTMENT_CONFIRMED, etc.
    """
    entry = ActivityLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        description=description,
        ip_address=ip_address,
    )
    db.add(entry)
    await db.flush()  # Let the caller commit within their transaction
    logger.info(f"Activity: {action} by {actor_id} on {entity_type}:{entity_id}")
    return entry
