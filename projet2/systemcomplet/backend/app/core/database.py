"""Accès PostgreSQL (SQLAlchemy 2.0, mode synchrone + psycopg 3).

PostgreSQL est l'unique source de vérité transactionnelle (règle non négociable n°2).
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Numeric,
    String,
    Text,
    Uuid,
    create_engine,
    event,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import settings
from app.core.utils import utcnow

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# JSONB sur PostgreSQL (JSON générique ailleurs, utile pour les outils hors ligne).
JSONType = JSON().with_variant(JSONB(), "postgresql")
Money = Numeric(18, 2)
Quantity = Numeric(18, 3)
Percent = Numeric(7, 3)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {
        uuid.UUID: Uuid,
        datetime: DateTime(timezone=True),
        Decimal: Money,
        dict[str, Any]: JSONType,
        list[Any]: JSONType,
        str: String(255),
        int: Integer,
        bool: Boolean,
    }


class UUIDPk:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)


class Timestamps:
    # Horodatage applicatif (microseconde, distinct par ligne) : chronologies ordonnées même dans une transaction.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), onupdate=utcnow, nullable=False
    )


class SoftDelete:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Versioned:
    """`version` = « version serveur connue » (synchronisation hors ligne, détection de conflit).

    Incrémentée automatiquement à chaque mise à jour (écouteur `before_update`).
    """

    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")


@event.listens_for(Versioned, "before_update", propagate=True)
def _bump_version(mapper: Any, connection: Any, target: Versioned) -> None:
    target.version = (target.version or 0) + 1


def fk(
    target: str,
    *,
    nullable: bool = True,
    ondelete: str | None = "SET NULL",
    index: bool = True,
    use_alter: bool = False,
) -> Any:
    """Raccourci de clé étrangère UUID (`use_alter` pour rompre les dépendances circulaires)."""
    if not nullable and ondelete == "SET NULL":
        ondelete = "RESTRICT"
    return mapped_column(
        Uuid, ForeignKey(target, ondelete=ondelete, use_alter=use_alter), nullable=nullable, index=index
    )


def text_col(nullable: bool = True) -> Any:
    return mapped_column(Text, nullable=nullable)


def str_col(
    length: int = 255,
    *,
    nullable: bool = True,
    index: bool = False,
    unique: bool = False,
    default: Any = None,
    choices: tuple[str, ...] | None = None,
) -> Any:
    """Colonne texte ; `choices` : valeurs autorisées (liste de choix à la saisie, autre valeur refusée)."""
    return mapped_column(
        String(length),
        nullable=nullable,
        index=index,
        unique=unique,
        default=default,
        info={"choices": choices} if choices else {},
    )


def money_col(*, nullable: bool = False, default: Any = Decimal("0")) -> Any:
    return mapped_column(Money, nullable=nullable, default=default, server_default="0" if default is not None else None)


def qty_col(*, nullable: bool = False, default: Any = Decimal("0")) -> Any:
    return mapped_column(
        Quantity, nullable=nullable, default=default, server_default="0" if default is not None else None
    )


def json_col(default: Any = dict, *, nullable: bool = False) -> Any:
    return mapped_column(JSONType, nullable=nullable, default=default)


def bool_col(default: bool = False) -> Any:
    return mapped_column(Boolean, nullable=False, default=default, server_default="true" if default else "false")


def int_col(default: int | None = 0, *, nullable: bool = False) -> Any:
    return mapped_column(
        Integer, nullable=nullable, default=default, server_default=str(default) if default is not None else None
    )


def bigint_col(default: int | None = 0, *, nullable: bool = False) -> Any:
    return mapped_column(
        BigInteger, nullable=nullable, default=default, server_default=str(default) if default is not None else None
    )


def dt_col(*, nullable: bool = True, index: bool = False) -> Any:
    return mapped_column(DateTime(timezone=True), nullable=nullable, index=index)


engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    echo=settings.DB_ECHO,
    future=True,
    connect_args={"options": "-c timezone=GMT"},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def get_db() -> Iterator[Session]:
    """Dépendance FastAPI : une session par requête, commit explicite dans les services."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transaction explicite pour les jobs et scripts."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
