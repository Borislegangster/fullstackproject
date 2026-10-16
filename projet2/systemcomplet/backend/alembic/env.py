"""Environnement Alembic : métadonnées de tous les modules, URL issue de la configuration."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.models_registry import metadata

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

config.set_main_option("sqlalchemy.url", get_settings().DATABASE_URL.replace("%", "%%"))
target_metadata = metadata


def render_item(type_: str, obj: object, autogen_context: object) -> str | bool:
    """Les colonnes chiffrées (EncryptedString) sont stockées en TEXT."""
    from app.core.security import EncryptedString

    if type_ == "type" and isinstance(obj, EncryptedString):
        return "sa.Text()"
    return False


def include_object(obj: object, name: str | None, type_: str, reflected: bool, compare_to: object) -> bool:
    """Index plein texte (GIN to_tsvector) gérés à la main dans la migration 0002 : hors autogénération."""
    return not (type_ == "index" and reflected and compare_to is None and (name or "").endswith("_fts"))


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_item=render_item,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_item=render_item,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
