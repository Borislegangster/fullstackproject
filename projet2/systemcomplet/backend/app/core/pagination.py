"""Pagination, tri et recherche normalisés (§19.2 : pagination, filtres, tri)."""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from typing import Any, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError

T = TypeVar("T")


class PageParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, le=100_000),
        page_size: int = Query(25, ge=1, le=200),
        sort: str | None = Query(None, max_length=60, description="champ ou -champ (décroissant)"),
        q: str | None = Query(None, max_length=200, description="recherche texte"),
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.sort = sort
        self.q = q.strip() if q else None


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


def apply_search(stmt: Select[Any], q: str | None, columns: Sequence[Any]) -> Select[Any]:
    if not q or not columns:
        return stmt
    pattern = f"%{q}%"
    return stmt.where(or_(*[col.ilike(pattern) for col in columns]))


def apply_sort(stmt: Select[Any], sort: str | None, allowed: dict[str, Any], default: Any = None) -> Select[Any]:
    if sort:
        desc = sort.startswith("-")
        key = sort.lstrip("-+")
        column = allowed.get(key)
        if column is None:
            raise AppError(f"Tri non supporté : {key}", code="INVALID_SORT", details={"allowed": sorted(allowed)})
        return stmt.order_by(column.desc().nullslast() if desc else column.asc().nullsfirst())
    if default is not None:
        return stmt.order_by(default)
    return stmt


def paginate(
    db: Session,
    stmt: Select[Any],
    params: PageParams,
    *,
    sort_fields: dict[str, Any] | None = None,
    default_sort: Any = None,
    search_columns: Sequence[Any] = (),
    transform: Callable[[Any], Any] | None = None,
    scalars: bool = True,
) -> dict[str, Any]:
    stmt = apply_search(stmt, params.q, search_columns)
    total = db.execute(select(func.count()).select_from(stmt.order_by(None).subquery())).scalar_one()
    stmt = apply_sort(stmt, params.sort, sort_fields or {}, default_sort)
    stmt = stmt.limit(params.page_size).offset((params.page - 1) * params.page_size)
    result = db.execute(stmt)
    rows = list(result.scalars().unique()) if scalars else list(result.all())
    items = [transform(r) for r in rows] if transform else rows
    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": math.ceil(total / params.page_size) if params.page_size else 1,
    }
