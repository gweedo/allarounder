"""SQLAlchemy implementations of the identity repository interfaces."""

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.identity.entities import RefreshToken, User
from app.domain.identity.value_objects import Email, UserRole
from app.infrastructure.identity.models import RefreshTokenModel, UserModel


def _model_to_user(m: UserModel) -> User:
    return User(
        id=m.id,
        email=Email(m.email),
        hashed_password=m.hashed_password,
        role=UserRole(m.role),
        is_active=m.is_active,
        created_at=m.created_at,
        failed_login_count=m.failed_login_count,
        locked_until=m.locked_until,
    )


def _model_to_refresh_token(m: RefreshTokenModel) -> RefreshToken:
    return RefreshToken(
        id=m.id,
        user_id=m.user_id,
        token_hash=m.token_hash,
        expires_at=m.expires_at,
        revoked_at=m.revoked_at,
    )


class SqlUserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        m = self._session.get(UserModel, user_id)
        return _model_to_user(m) if m else None

    def get_by_email(self, email: Email) -> User | None:
        m = self._session.query(UserModel).filter_by(email=email.value).first()
        return _model_to_user(m) if m else None

    def save(self, user: User) -> None:
        m = self._session.get(UserModel, user.id)
        if m is None:
            return
        m.hashed_password = user.hashed_password
        m.role = user.role.value
        m.is_active = user.is_active
        m.failed_login_count = user.failed_login_count
        m.locked_until = user.locked_until

    def add(self, user: User) -> None:
        m = UserModel(
            id=user.id,
            email=user.email.value,
            hashed_password=user.hashed_password,
            role=user.role.value,
            is_active=user.is_active,
            created_at=user.created_at,
            failed_login_count=user.failed_login_count,
            locked_until=user.locked_until,
        )
        self._session.add(m)


class SqlRefreshTokenRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        m = (
            self._session.query(RefreshTokenModel)
            .filter_by(token_hash=token_hash)
            .first()
        )
        return _model_to_refresh_token(m) if m else None

    def add(self, token: RefreshToken) -> None:
        m = RefreshTokenModel(
            id=token.id,
            user_id=token.user_id,
            token_hash=token.token_hash,
            expires_at=token.expires_at,
            revoked_at=token.revoked_at,
        )
        self._session.add(m)

    def revoke(self, token_id: uuid.UUID, now: datetime) -> None:
        m = self._session.get(RefreshTokenModel, token_id)
        if m:
            m.revoked_at = now

    def revoke_all_for_user(self, user_id: uuid.UUID, now: datetime) -> None:
        (
            self._session.query(RefreshTokenModel)
            .filter_by(user_id=user_id, revoked_at=None)
            .update({"revoked_at": now})
        )
