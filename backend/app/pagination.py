"""Pagination helpers.

Goal: every list endpoint gets a uniform `?skip=&limit=` interface and a
predictable envelope `{items, total, skip, limit}` so the front-end can build
generic pagination controls.

Usage:
    from app.pagination import PaginationParams, paginate_query
    @router.get("/foo")
    async def list_foo(p: PaginationParams = Depends(), db=Depends(get_db)):
        q = select(Foo).where(Foo.deleted_at.is_(None)).order_by(Foo.created_at.desc())
        return await paginate_query(db, q, p, serializer=lambda f: {...})
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterable, Optional

from fastapi import Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select


MAX_LIMIT = 200
DEFAULT_LIMIT = 50


@dataclass
class PaginationParams:
    """Pagination state injected via FastAPI Depends.

    Caps `limit` at 200 to keep responses bounded regardless of caller intent.
    """
    skip: int = 0
    limit: int = DEFAULT_LIMIT

    @classmethod
    def from_query(
        cls,
        skip: int = Query(0, ge=0, description="Number of rows to skip"),
        limit: int = Query(
            DEFAULT_LIMIT, ge=1, le=MAX_LIMIT,
            description=f"Page size (max {MAX_LIMIT})",
        ),
    ) -> "PaginationParams":
        return cls(skip=skip, limit=limit)


async def count_query(db: AsyncSession, base: Select) -> int:
    """Run a COUNT(*) over the same WHERE clauses without ORDER BY / LIMIT."""
    # `base.order_by(None)` drops the ORDER BY so the count query is cheaper.
    # We don't strip the WHERE clauses — count must match the page contents.
    plain = base.order_by(None)
    count_stmt = select(func.count()).select_from(plain.subquery())
    r = await db.execute(count_stmt)
    return int(r.scalar() or 0)


async def paginate_query(
    db: AsyncSession,
    query: Select,
    params: PaginationParams,
    *,
    serializer: Optional[Callable[[Any], Any]] = None,
) -> dict:
    """Apply skip/limit, run the query + count, return the standard envelope."""
    total = await count_query(db, query)
    rows = (await db.execute(query.offset(params.skip).limit(params.limit))).scalars().all()
    items: Iterable[Any] = (serializer(r) for r in rows) if serializer else rows
    return {
        "items": list(items),
        "total": total,
        "skip": params.skip,
        "limit": params.limit,
    }
