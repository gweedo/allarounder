import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.domain.identity.exceptions import AccountLockedError, GoogleAccountMismatchError
from app.domain.identity.value_objects import Email, UserRole

_LOCKOUT_THRESHOLD = 10
_LOCKOUT_DURATION = timedelta(minutes=5)


@dataclass
class User:
    id: uuid.UUID
    email: Email
    hashed_password: str
    role: UserRole
    is_active: bool
    created_at: datetime
    failed_login_count: int = field(default=0)
    locked_until: datetime | None = field(default=None)
    google_sub: str | None = field(default=None)

    def link_google(self, sub: str) -> None:
        """Link this user to a Google account subject identifier.

        Idempotent when the sub already matches (repeated logins). Raises if
        the account is already linked to a *different* Google account — that
        would silently hijack the login to a different Google identity.
        """
        if self.google_sub is not None and self.google_sub != sub:
            raise GoogleAccountMismatchError(
                f"User {self.email.value} is already linked to a different Google account"
            )
        self.google_sub = sub

    def is_locked(self, now: datetime) -> bool:
        if self.locked_until is None:
            return False
        return now < self.locked_until

    def assert_not_locked(self, now: datetime) -> None:
        if self.is_locked(now):
            locked_str = self.locked_until.isoformat() if self.locked_until else "?"
            raise AccountLockedError(f"Account locked until {locked_str}")

    def record_failed_login(self, now: datetime) -> None:
        self.failed_login_count += 1
        if self.failed_login_count >= _LOCKOUT_THRESHOLD:
            self.locked_until = now + _LOCKOUT_DURATION

    def record_successful_login(self) -> None:
        self.failed_login_count = 0
        self.locked_until = None


@dataclass
class RefreshToken:
    id: uuid.UUID
    user_id: uuid.UUID
    token_hash: str
    expires_at: datetime
    revoked_at: datetime | None = field(default=None)
    persistent: bool = field(default=True)

    def is_valid(self, now: datetime) -> bool:
        return self.revoked_at is None and now < self.expires_at
