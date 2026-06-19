"""FastAPI dependency providers for auth and RBAC."""

from collections.abc import Generator
from datetime import timedelta
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.application.identity.services import AuthService
from app.infrastructure.database import get_session_factory
from app.infrastructure.identity.hibp import HibpBreachedPasswordChecker
from app.infrastructure.identity.password import Argon2PasswordHasher
from app.infrastructure.identity.repositories import SqlRefreshTokenRepository, SqlUserRepository
from app.infrastructure.identity.tokens import JoseTokenIssuer
from app.settings import Settings, get_settings

_hasher = Argon2PasswordHasher()
_hibp = HibpBreachedPasswordChecker()


def get_db_session() -> Generator[Session, None, None]:
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_auth_service(
    session: Annotated[Session, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    return AuthService(
        user_repo=SqlUserRepository(session),
        token_repo=SqlRefreshTokenRepository(session),
        password_hasher=_hasher,
        breached_checker=_hibp,
        token_issuer=JoseTokenIssuer(settings.jwt_secret_key, settings.jwt_algorithm),
        access_token_ttl=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        refresh_token_ttl=timedelta(days=settings.jwt_refresh_token_expire_days),
    )


def get_token_from_cookie(
    access_token: Annotated[str | None, Cookie(alias="access_token")] = None,
) -> str:
    if access_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    return access_token


def _decode_token(token: str, settings: Settings) -> dict[str, object]:
    try:
        return jwt.decode(  # type: ignore[no-any-return]
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )


class CurrentUser:
    def __init__(self, user_id: str, email: str, role: str) -> None:
        self.user_id = user_id
        self.email = email
        self.role = role


def get_current_user(
    token: Annotated[str, Depends(get_token_from_cookie)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    payload = _decode_token(token, settings)
    return CurrentUser(
        user_id=str(payload["sub"]),
        email=str(payload["email"]),
        role=str(payload["role"]),
    )


def require_admin(
    current: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if current.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return current


def require_editor(
    current: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if current.role not in ("admin", "editor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Editor access required"
        )
    return current
