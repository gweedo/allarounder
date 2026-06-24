from functools import lru_cache
from typing import Any

from sqlalchemy import Engine, create_engine, event, pool
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.settings import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache(maxsize=1)
def _get_azure_credential() -> Any:
    from azure.identity import DefaultAzureCredential

    return DefaultAzureCredential()


def _get_entra_pg_token() -> str:
    return str(
        _get_azure_credential().get_token(
            "https://ossrdbms-aad.database.windows.net/.default"
        ).token
    )


def _make_engine(null_pool: bool = False) -> Engine:
    settings = get_settings()
    kwargs: dict[str, Any] = {"echo": settings.app_env == "development"}
    if null_pool:
        kwargs["poolclass"] = pool.NullPool
    else:
        # The pooled engine is long-lived; Azure PostgreSQL drops idle
        # connections, so validate on checkout and recycle before the server
        # would. pre_ping reconnects transparently, re-firing the do_connect
        # token listener.
        kwargs["pool_pre_ping"] = True
        kwargs["pool_recycle"] = 1800
    engine = create_engine(settings.database_url, **kwargs)
    if settings.azure_use_managed_identity:
        # Inject a fresh Entra token on every new psycopg connection.
        # Azure Identity caches tokens internally and refreshes before expiry.
        @event.listens_for(engine, "do_connect")
        def _provide_entra_token(
            dialect: Any, conn_rec: Any, cargs: Any, cparams: Any
        ) -> None:
            cparams["password"] = _get_entra_pg_token()
    return engine


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Shared pooled engine for the web app — cached so the pool is never recreated."""
    return _make_engine(null_pool=False)


def get_migration_engine() -> Engine:
    """NullPool engine for one-shot processes (Alembic, bootstrap CLI).

    Uses exactly one connection and releases it immediately — safe to call
    when max_connections is under pressure.
    """
    return _make_engine(null_pool=True)


def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)
