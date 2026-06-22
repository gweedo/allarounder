"""Application layer tests using in-memory fakes — no I/O."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.application.identity.services import AuthService
from app.domain.identity.entities import RefreshToken, User
from app.domain.identity.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    PasswordTooShortError,
    TokenExpiredError,
    TokenRevokedError,
    UserInactiveError,
)
from app.domain.identity.value_objects import Email, UserRole

# ── In-memory fakes ──────────────────────────────────────────────────────────


class InMemoryUserRepo:
    def __init__(self) -> None:
        self._users: dict[uuid.UUID, User] = {}

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self._users.get(user_id)

    def get_by_email(self, email: Email) -> User | None:
        return next((u for u in self._users.values() if u.email == email), None)

    def save(self, user: User) -> None:
        self._users[user.id] = user

    def add(self, user: User) -> None:
        self._users[user.id] = user


class InMemoryRefreshTokenRepo:
    def __init__(self) -> None:
        self._tokens: dict[str, RefreshToken] = {}

    def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        return self._tokens.get(token_hash)

    def add(self, token: RefreshToken) -> None:
        self._tokens[token.token_hash] = token

    def revoke(self, token_id: uuid.UUID, now: datetime) -> None:
        for t in self._tokens.values():
            if t.id == token_id:
                t.revoked_at = now
                return

    def revoke_all_for_user(self, user_id: uuid.UUID, now: datetime) -> None:
        for t in self._tokens.values():
            if t.user_id == user_id:
                t.revoked_at = now


class FakeHasher:
    """Stores passwords as 'hashed:<plain>' for easy testing."""

    def hash(self, plain: str) -> str:
        return f"hashed:{plain}"

    def verify(self, plain: str, hashed: str) -> bool:
        return hashed == f"hashed:{plain}"


class FakeBreachedChecker:
    def __init__(self, breached: set[str] | None = None) -> None:
        self._breached: set[str] = breached or set()

    def is_breached(self, password: str) -> bool:
        return password in self._breached


class FakeTokenIssuer:
    def __init__(self) -> None:
        self._secret = "test-secret"
        self._algo = "HS256"

    def encode(self, payload: dict[str, object]) -> str:
        import jwt

        return jwt.encode(payload, self._secret, algorithm=self._algo)


# ── Fixtures ─────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _make_service(
    *,
    breached: set[str] | None = None,
) -> tuple[AuthService, InMemoryUserRepo, InMemoryRefreshTokenRepo]:
    user_repo = InMemoryUserRepo()
    token_repo = InMemoryRefreshTokenRepo()
    hasher = FakeHasher()
    checker = FakeBreachedChecker(breached)
    service = AuthService(
        user_repo=user_repo,
        token_repo=token_repo,
        password_hasher=hasher,
        breached_checker=checker,
        token_issuer=FakeTokenIssuer(),
        access_token_ttl=timedelta(minutes=30),
        refresh_token_ttl=timedelta(days=14),
    )
    return service, user_repo, token_repo


def _seed_user(
    repo: InMemoryUserRepo,
    *,
    email: str = "admin@example.com",
    plain_password: str = "verysecurepassword!",
    role: UserRole = UserRole.admin,
    is_active: bool = True,
    failed_login_count: int = 0,
    locked_until: datetime | None = None,
) -> User:
    user = User(
        id=uuid.uuid4(),
        email=Email(email),
        hashed_password=f"hashed:{plain_password}",
        role=role,
        is_active=is_active,
        created_at=_now(),
        failed_login_count=failed_login_count,
        locked_until=locked_until,
    )
    repo.add(user)
    return user


# ── Login tests ───────────────────────────────────────────────────────────────


class TestLogin:
    def test_returns_tokens_on_valid_credentials(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo)
        result = svc.login("admin@example.com", "verysecurepassword!", _now())
        assert result["access_token"]
        assert result["refresh_token"]

    def test_raises_on_unknown_email(self) -> None:
        svc, _, _ = _make_service()
        with pytest.raises(InvalidCredentialsError):
            svc.login("unknown@example.com", "anypassword123!", _now())

    def test_raises_on_wrong_password(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo)
        with pytest.raises(InvalidCredentialsError):
            svc.login("admin@example.com", "wrongpassword123!", _now())

    def test_raises_on_inactive_user(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, is_active=False)
        with pytest.raises(UserInactiveError):
            svc.login("admin@example.com", "verysecurepassword!", _now())

    def test_raises_on_locked_account(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(
            user_repo,
            locked_until=_now() + timedelta(minutes=5),
        )
        with pytest.raises(AccountLockedError):
            svc.login("admin@example.com", "verysecurepassword!", _now())

    def test_failed_login_increments_counter(self) -> None:
        svc, user_repo, _ = _make_service()
        user = _seed_user(user_repo)
        with pytest.raises(InvalidCredentialsError):
            svc.login("admin@example.com", "wrong!", _now())
        assert user.failed_login_count == 1

    def test_successful_login_resets_counter(self) -> None:
        svc, user_repo, _ = _make_service()
        user = _seed_user(user_repo, failed_login_count=5)
        svc.login("admin@example.com", "verysecurepassword!", _now())
        assert user.failed_login_count == 0

    def test_stores_refresh_token(self) -> None:
        svc, user_repo, token_repo = _make_service()
        _seed_user(user_repo)
        result = svc.login("admin@example.com", "verysecurepassword!", _now())
        stored = token_repo.get_by_hash(_hash_token(result["refresh_token"]))
        assert stored is not None

    def test_email_lookup_is_case_insensitive(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, email="admin@example.com")
        result = svc.login("ADMIN@EXAMPLE.COM", "verysecurepassword!", _now())
        assert result["access_token"]


# ── Refresh tests ─────────────────────────────────────────────────────────────


class TestRefresh:
    def test_returns_new_tokens_on_valid_refresh(self) -> None:
        svc, user_repo, token_repo = _make_service()
        _seed_user(user_repo)
        login_result = svc.login("admin@example.com", "verysecurepassword!", _now())
        refresh_result = svc.refresh(login_result["refresh_token"], _now())
        assert refresh_result["access_token"]
        assert refresh_result["refresh_token"]
        assert refresh_result["refresh_token"] != login_result["refresh_token"]

    def test_old_refresh_token_is_revoked_after_rotation(self) -> None:
        svc, user_repo, token_repo = _make_service()
        _seed_user(user_repo)
        now = _now()
        login_result = svc.login("admin@example.com", "verysecurepassword!", now)
        old_token = login_result["refresh_token"]
        svc.refresh(old_token, now)
        stored = token_repo.get_by_hash(_hash_token(old_token))
        assert stored is not None
        assert stored.revoked_at is not None

    def test_raises_on_expired_refresh_token(self) -> None:
        svc, user_repo, token_repo = _make_service()
        user = _seed_user(user_repo)
        past = _now() - timedelta(days=15)
        token = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token("expired-token"),
            expires_at=past,
        )
        token_repo.add(token)
        with pytest.raises(TokenExpiredError):
            svc.refresh("expired-token", _now())

    def test_raises_on_revoked_refresh_token(self) -> None:
        svc, user_repo, token_repo = _make_service()
        user = _seed_user(user_repo)
        token = RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token("revoked-token"),
            expires_at=_now() + timedelta(days=10),
            revoked_at=_now() - timedelta(hours=1),
        )
        token_repo.add(token)
        with pytest.raises(TokenRevokedError):
            svc.refresh("revoked-token", _now())

    def test_raises_on_unknown_refresh_token(self) -> None:
        svc, user_repo, _ = _make_service()
        with pytest.raises(TokenRevokedError):
            svc.refresh("unknown-token", _now())


# ── Logout tests ──────────────────────────────────────────────────────────────


class TestLogout:
    def test_revokes_refresh_token_on_logout(self) -> None:
        svc, user_repo, token_repo = _make_service()
        _seed_user(user_repo)
        now = _now()
        login_result = svc.login("admin@example.com", "verysecurepassword!", now)
        svc.logout(login_result["refresh_token"], now)
        stored = token_repo.get_by_hash(_hash_token(login_result["refresh_token"]))
        assert stored is not None
        assert stored.revoked_at is not None

    def test_logout_with_unknown_token_is_silent(self) -> None:
        svc, _, _ = _make_service()
        svc.logout("unknown-token", _now())  # must not raise


# ── Create admin tests ────────────────────────────────────────────────────────


class TestCreateAdmin:
    def test_creates_user_with_admin_role(self) -> None:
        svc, user_repo, _ = _make_service()
        svc.create_admin("newadmin@example.com", "SecureAdminPass!")
        user = user_repo.get_by_email(Email("newadmin@example.com"))
        assert user is not None
        assert user.role == UserRole.admin

    def test_rejects_short_password(self) -> None:
        svc, _, _ = _make_service()
        with pytest.raises(PasswordTooShortError):
            svc.create_admin("admin@example.com", "short")

    def test_rejects_breached_password(self) -> None:
        svc, _, _ = _make_service(breached={"password123456789"})
        with pytest.raises(ValueError, match="breached"):
            svc.create_admin("admin@example.com", "password123456789")


# ── Helpers ───────────────────────────────────────────────────────────────────


def _hash_token(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()
