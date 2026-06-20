from functools import lru_cache
from typing import Any

from sqlalchemy import Engine, create_engine, event
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


def get_engine() -> Engine:
    settings = get_settings()
    engine = create_engine(settings.database_url, echo=settings.app_env == "development")

    if settings.azure_use_managed_identity:
        # Inject a fresh Entra token on every new psycopg connection.
        # Azure Identity caches tokens internally and refreshes before expiry.
        @event.listens_for(engine, "do_connect")
        def _provide_entra_token(
            dialect: Any, conn_rec: Any, cargs: Any, cparams: Any
        ) -> None:
            cparams["password"] = _get_entra_pg_token()

    return engine


def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)
