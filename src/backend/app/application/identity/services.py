"""AuthService: login, refresh, logout, and admin bootstrap use cases."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from app.application.identity.protocols import (
    BreachedPasswordChecker,
    PasswordHasher,
    TokenIssuer,
)
from app.domain.identity.entities import RefreshToken, User
from app.domain.identity.exceptions import (
    InvalidCredentialsError,
    TokenExpiredError,
    TokenRevokedError,
    UserInactiveError,
)
from app.domain.identity.policies import PasswordPolicy
from app.domain.identity.repositories import RefreshTokenRepository, UserRepository
from app.domain.identity.value_objects import Email, UserRole


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class AuthService:
    def __init__(
        self,
        *,
        user_repo: UserRepository,
        token_repo: RefreshTokenRepository,
        password_hasher: PasswordHasher,
        breached_checker: BreachedPasswordChecker,
        token_issuer: TokenIssuer,
        access_token_ttl: timedelta,
        refresh_token_ttl: timedelta,
    ) -> None:
        self._users = user_repo
        self._tokens = token_repo
        self._hasher = password_hasher
        self._hibp = breached_checker
        self._issuer = token_issuer
        self._access_ttl = access_token_ttl
        self._refresh_ttl = refresh_token_ttl

    # ── Public use cases ─────────────────────────────────────────────────────

    def login(self, email: str, password: str, now: datetime) -> dict[str, str]:
        try:
            normalised_email = Email(email)
        except ValueError:
            raise InvalidCredentialsError("Invalid credentials")

        user = self._users.get_by_email(normalised_email)
        if user is None:
            raise InvalidCredentialsError("Invalid credentials")

        user.assert_not_locked(now)

        if not user.is_active:
            raise UserInactiveError("Account is disabled")

        if not self._hasher.verify(password, user.hashed_password):
            user.record_failed_login(now)
            self._users.save(user)
            raise InvalidCredentialsError("Invalid credentials")

        user.record_successful_login()
        self._users.save(user)

        return self._issue_tokens(user, now)

    def refresh(self, raw_token: str, now: datetime) -> dict[str, str]:
        token_hash = _hash_token(raw_token)
        stored = self._tokens.get_by_hash(token_hash)

        if stored is None:
            raise TokenRevokedError("Token not found or already revoked")

        if stored.revoked_at is not None:
            raise TokenRevokedError("Refresh token has been revoked")

        if now >= stored.expires_at:
            raise TokenExpiredError("Refresh token has expired")

        # Rotate: revoke old, issue new
        self._tokens.revoke(stored.id, now)

        user = self._users.get_by_id(stored.user_id)
        if user is None or not user.is_active:
            raise InvalidCredentialsError("User not found or disabled")

        return self._issue_tokens(user, now)

    def logout(self, raw_token: str, now: datetime) -> None:
        token_hash = _hash_token(raw_token)
        stored = self._tokens.get_by_hash(token_hash)
        if stored is not None:
            self._tokens.revoke(stored.id, now)

    def create_admin(self, email: str, plain_password: str) -> User:
        PasswordPolicy.enforce_length(plain_password)
        if self._hibp.is_breached(plain_password):
            raise ValueError("Password is breached — choose a different one")

        hashed = self._hasher.hash(plain_password)
        user = User(
            id=uuid.uuid4(),
            email=Email(email),
            hashed_password=hashed,
            role=UserRole.admin,
            is_active=True,
            created_at=datetime.now(tz=UTC),
        )
        self._users.add(user)
        return user

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _issue_tokens(self, user: User, now: datetime) -> dict[str, str]:
        access_token = self._make_jwt(user, now)
        raw_refresh, refresh_entity = self._make_refresh_token(user, now)
        self._tokens.add(refresh_entity)
        return {"access_token": access_token, "refresh_token": raw_refresh}

    def _make_jwt(self, user: User, now: datetime) -> str:
        payload: dict[str, Any] = {
            "sub": str(user.id),
            "email": user.email.value,
            "role": user.role.value,
            "iat": now,
            "exp": now + self._access_ttl,
        }
        return self._issuer.encode(payload)

    def _make_refresh_token(
        self, user: User, now: datetime
    ) -> tuple[str, RefreshToken]:
        raw = secrets.token_urlsafe(32)
        entity = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token(raw),
            expires_at=now + self._refresh_ttl,
        )
        return raw, entity
