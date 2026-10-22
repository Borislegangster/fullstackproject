"""Générateur CRUD sécurisé pour les ressources simples (référentiels, sous-entités).

Chaque routeur généré applique : permissions RBAC (lecture/écriture), cloisonnement ABAC par projet
(si la ressource porte un `project_id` ou se rattache à un parent projet), pagination/tri/recherche,
validation Pydantic dérivée du modèle, audit « business » avec diff minimisée, suppression logique
lorsque le modèle la supporte. Les workflows métier complexes ont leurs propres routeurs.
"""

import uuid
from collections.abc import Callable
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, create_model
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core import audit
from app.core.access import Access, get_access
from app.core.database import get_db
from app.core.errors import BusinessRuleError, NotFound
from app.core.pagination import PageParams, paginate
from app.core.utils import utcnow

_SYSTEM_FIELDS = {"id", "created_at", "updated_at", "deleted_at", "version"}
_schema_cache: dict[tuple[Any, ...], type[BaseModel]] = {}


def _python_type(column: Any) -> Any:
    from sqlalchemy.types import JSON

    if isinstance(column.type, JSON):
        return Any
    try:
        py = column.type.python_type
    except NotImplementedError:
        py = Any
    if py is dict:
        return dict[str, Any]
    if py is list:
        return list[Any]
    return py


def model_schema(
    model: Any,
    *,
    name: str,
    exclude: set[str] | None = None,
    include: set[str] | None = None,
    partial: bool = False,
    output: bool = False,
    optional: set[str] | None = None,
) -> type[BaseModel]:
    """Crée un schéma Pydantic depuis les colonnes d'un modèle SQLAlchemy.

    ``optional`` : colonnes obligatoires en base mais facultatives à la saisie (complétées par le serveur, ex. slug).
    """
    key = (model, name, frozenset(exclude or ()), frozenset(include or ()), partial, output, frozenset(optional or ()))
    if key in _schema_cache:
        return _schema_cache[key]
    exclude = set(exclude or set())
    fields: dict[str, Any] = {}
    for column in model.__table__.columns:
        cname = column.key
        if include is not None and cname not in include:
            continue
        if cname in exclude or (not output and cname in _SYSTEM_FIELDS):
            continue
        py = _python_type(column)
        length = getattr(column.type, "length", None)
        if not output and py is str and length:
            # Longueur de la colonne : message clair à la saisie (« 20 caractères maximum ») au lieu d'une erreur base.
            py = Annotated[str, Field(max_length=length)]
        if output or partial or (optional and cname in optional):
            fields[cname] = (py | None, None)
            continue
        has_default = column.default is not None or column.server_default is not None
        if column.nullable or has_default:
            default: Any = None
            if column.default is not None and getattr(column.default, "is_scalar", False):
                default = column.default.arg
            elif column.default is not None and getattr(column.default, "is_callable", False):
                fields[cname] = (py | None, None)
                continue
            fields[cname] = (py | None, default)
        else:
            fields[cname] = (py, ...)
    config = ConfigDict(from_attributes=True, extra="forbid" if not output else "ignore")
    schema = create_model(name, __config__=config, **fields)  # type: ignore[call-overload]
    _schema_cache[key] = schema
    return schema


def serialize(obj: Any, out_schema: type[BaseModel] | None = None) -> dict[str, Any]:
    if out_schema is not None:
        return out_schema.model_validate(obj).model_dump()
    data: dict[str, Any] = {}
    for column in obj.__table__.columns:
        value = getattr(obj, column.key)
        data[column.key] = value
    return data


def apply_changes(obj: Any, values: dict[str, Any], *, forbidden: set[str] | None = None) -> dict[str, Any]:
    before = audit.snapshot(obj)
    for key, value in values.items():
        if forbidden and key in forbidden:
            continue
        if hasattr(obj, key):
            setattr(obj, key, value)
    return audit.diff_dicts(before, audit.snapshot(obj))


def _coerce_filter(column: Any, raw: str) -> Any:
    py = _python_type(column)
    try:
        if py is uuid.UUID:
            return uuid.UUID(raw)
        if py is bool:
            return raw.lower() in ("1", "true", "oui", "yes")
        if py is int:
            return int(raw)
        if py is Decimal:
            return Decimal(raw)
        if py is date:
            return date.fromisoformat(raw)
        if py is datetime:
            return datetime.fromisoformat(raw)
        if py is time:
            return time.fromisoformat(raw)
    except (ValueError, TypeError) as exc:
        raise BusinessRuleError(f"Filtre invalide pour {column.key}", code="INVALID_FILTER") from exc
    return raw


def make_crud_router(
    model: Any,
    *,
    prefix: str,
    tags: list[str],
    module: str,
    read_perm: str,
    write_perm: str,
    delete_perm: str | None = None,
    label: str = "Ressource",
    project_attr: str | None = None,
    parent_project: Callable[[Session, Any], uuid.UUID | None] | None = None,
    filters: list[str] | None = None,
    search: list[str] | None = None,
    sort: list[str] | None = None,
    default_sort: str | None = None,
    exclude_in: set[str] | None = None,
    optional_in: set[str] | None = None,
    exclude_out: set[str] | None = None,
    readonly_fields: set[str] | None = None,
    before_create: Callable[[Session, Any, Access, dict[str, Any]], None] | None = None,
    before_update: Callable[[Session, Any, Access, dict[str, Any]], None] | None = None,
    after_change: Callable[[Session, Any, Access, str], None] | None = None,
    base_query: Callable[[Select[Any], Access], Select[Any]] | None = None,
    allow_delete: bool = True,
    creator_attr: str | None = None,
) -> APIRouter:
    name = model.__name__
    exclude_in = set(exclude_in or set()) | ({creator_attr} if creator_attr else set())
    create_schema = model_schema(model, name=f"{name}Create", exclude=exclude_in, optional=optional_in)
    update_schema = model_schema(model, name=f"{name}Update", exclude=exclude_in, partial=True)
    out_schema = model_schema(model, name=f"{name}Out", exclude=exclude_out, output=True)
    router = APIRouter(prefix=prefix, tags=tags)
    cols = model.__table__.columns
    soft_delete = "deleted_at" in cols
    filter_names = [f for f in (filters or []) if f in cols]
    readonly = set(readonly_fields or set())

    def _project_of(db: Session, obj: Any) -> uuid.UUID | None:
        if project_attr:
            return getattr(obj, project_attr, None)
        if parent_project:
            return parent_project(db, obj)
        return None

    def _check(db: Session, access: Access, obj: Any) -> None:
        pid = _project_of(db, obj)
        if (project_attr or parent_project) and pid is not None:
            access.require_project(pid)
        elif (project_attr or parent_project) and pid is None and not access.p.is_internal:
            raise NotFound(f"{label} introuvable")

    def _load(db: Session, access: Access, obj_id: uuid.UUID) -> Any:
        obj = db.get(model, obj_id)
        if obj is None or (soft_delete and obj.deleted_at is not None):
            raise NotFound(f"{label} introuvable")
        _check(db, access, obj)
        return obj

    @router.get("", summary=f"Lister — {label}")
    def list_items(
        params: PageParams = Depends(),
        db: Session = Depends(get_db),
        access: Access = Depends(get_access),
        filter_values: dict[str, str | None] = Depends(_filter_dependency(filter_names)),
    ) -> dict[str, Any]:
        access.require(read_perm)
        stmt = select(model)
        if soft_delete:
            stmt = stmt.where(model.deleted_at.is_(None))
        if project_attr:
            stmt = access.filter_by_project(stmt, getattr(model, project_attr))
        if base_query:
            stmt = base_query(stmt, access)
        for fname, raw in filter_values.items():
            if raw not in (None, ""):
                column = cols[fname]
                stmt = stmt.where(getattr(model, fname) == _coerce_filter(column, str(raw)))
        sort_fields = {s: getattr(model, s) for s in (sort or []) if s in cols}
        default = (
            getattr(model, default_sort)
            if default_sort and default_sort in cols
            else (model.created_at.desc() if "created_at" in cols else None)
        )
        return paginate(
            db,
            stmt,
            params,
            sort_fields=sort_fields,
            default_sort=default,
            search_columns=[getattr(model, s) for s in (search or []) if s in cols],
            transform=lambda o: serialize(o, out_schema),
        )

    @router.get("/{item_id}", summary=f"Détail — {label}")
    def get_item(
        item_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
    ) -> dict[str, Any]:
        access.require(read_perm)
        return serialize(_load(db, access, item_id), out_schema)

    @router.post("", status_code=201, summary=f"Créer — {label}")
    def create_item(
        payload: create_schema,
        db: Session = Depends(get_db),  # type: ignore[valid-type]
        access: Access = Depends(get_access),
    ) -> dict[str, Any]:
        access.require(write_perm)
        values = payload.model_dump(exclude_unset=False)  # type: ignore[attr-defined]
        if project_attr and values.get(project_attr):
            access.require_project(values[project_attr])
        obj = model(**{k: v for k, v in values.items() if v is not None or cols[k].nullable})
        if creator_attr:
            setattr(obj, creator_attr, access.p.id)
        if before_create:
            before_create(db, obj, access, values)
        if parent_project and not project_attr:
            pid = parent_project(db, obj)
            if pid is not None:
                access.require_project(pid)
        db.add(obj)
        db.flush()
        audit.record(
            db,
            family="business",
            module=module,
            action="CREATE",
            resource_type=model.__tablename__,
            resource_id=obj.id,
            project_id=_project_of(db, obj),
            diff=audit.diff_dicts({}, values),
        )
        if after_change:
            after_change(db, obj, access, "create")
        db.commit()
        db.refresh(obj)
        return serialize(obj, out_schema)

    @router.patch("/{item_id}", summary=f"Modifier — {label}")
    def update_item(
        item_id: uuid.UUID,
        payload: update_schema,
        db: Session = Depends(get_db),  # type: ignore[valid-type]
        access: Access = Depends(get_access),
    ) -> dict[str, Any]:
        access.require(write_perm)
        obj = _load(db, access, item_id)
        values = payload.model_dump(exclude_unset=True)  # type: ignore[attr-defined]
        values = {k: v for k, v in values.items() if k not in readonly}
        if project_attr and project_attr in values and values[project_attr]:
            access.require_project(values[project_attr])
        if before_update:
            before_update(db, obj, access, values)
        diff = apply_changes(obj, values)
        db.flush()
        if diff:
            audit.record(
                db,
                family="business",
                module=module,
                action="UPDATE",
                resource_type=model.__tablename__,
                resource_id=obj.id,
                project_id=_project_of(db, obj),
                diff=diff,
            )
        if after_change:
            after_change(db, obj, access, "update")
        db.commit()
        db.refresh(obj)
        return serialize(obj, out_schema)

    if allow_delete:

        @router.delete("/{item_id}", summary=f"Supprimer — {label}")
        def delete_item(
            item_id: uuid.UUID, db: Session = Depends(get_db), access: Access = Depends(get_access)
        ) -> dict[str, str]:
            access.require(delete_perm or write_perm)
            obj = _load(db, access, item_id)
            pid = _project_of(db, obj)
            if soft_delete:
                obj.deleted_at = utcnow()
            else:
                db.delete(obj)
            audit.record(
                db,
                family="business",
                module=module,
                action="DELETE",
                resource_type=model.__tablename__,
                resource_id=item_id,
                project_id=pid,
                criticality="MEDIUM",
            )
            if after_change:
                after_change(db, obj, access, "delete")
            db.commit()
            return {"status": "deleted"}

    return router


def _filter_dependency(names: list[str]) -> Callable[..., dict[str, str | None]]:
    """Dépendance générant des paramètres de requête optionnels pour chaque filtre."""
    import inspect

    params = [
        inspect.Parameter(n, inspect.Parameter.KEYWORD_ONLY, default=Query(None), annotation=str | None) for n in names
    ]

    def dependency(**kwargs: str | None) -> dict[str, str | None]:
        return kwargs

    dependency.__signature__ = inspect.Signature(params)  # type: ignore[attr-defined]
    return dependency
