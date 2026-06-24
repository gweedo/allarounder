import os
from logging.config import fileConfig

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from app.infrastructure.database import Base, get_migration_engine  # noqa: E402

target_metadata = Base.metadata


def _get_url() -> str:
    return os.environ.get(
        "DATABASE_URL",
        config.get_main_option("sqlalchemy.url", ""),
    )


def run_migrations_offline() -> None:
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Use get_migration_engine() so the Azure AD token do_connect listener is
    # registered when AZURE_USE_MANAGED_IDENTITY=true (engine_from_config bypasses
    # it, causing "no password supplied" against AD-only PostgreSQL). NullPool keeps
    # this one-shot process to a single connection instead of a 5-connection pool.
    connectable = get_migration_engine()
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
