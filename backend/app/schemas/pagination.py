"""Reusable pagination schema & helpers for list endpoints."""
from typing import Generic, TypeVar, List, Optional

from pydantic import BaseModel
from fastapi import Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Standard pagination query parameters."""
    skip: int = 0
    limit: int = 50


def pagination_query(
    skip: int = Query(0, ge=0, description="Nombre d'éléments à ignorer"),
    limit: int = Query(50, ge=1, le=200, description="Nombre d'éléments par page (max 200)"),
) -> PaginationParams:
    """FastAPI dependency for pagination query params."""
    return PaginationParams(skip=skip, limit=limit)


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated response wrapping a list of items."""
    items: List[T]
    total: int
    skip: int
    limit: int
    has_more: bool


async def paginate(
    db: AsyncSession,
    base_query,
    skip: int = 0,
    limit: int = 50,
    serializer=None,
):
    """
    Execute a paginated query and return a PaginatedResponse-compatible dict.

    Args:
        db: Async database session
        base_query: SQLAlchemy select statement (without offset/limit)
        skip: Number of items to skip
        limit: Max items to return
        serializer: Optional callable to transform each row

    Returns:
        dict with items, total, skip, limit, has_more
    """
    # Count total matching rows
    count_q = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch the requested page
    result = await db.execute(base_query.offset(skip).limit(limit))
    rows = result.scalars().all()

    items = [serializer(r) for r in rows] if serializer else list(rows)

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + limit < total,
    }
