"""Application layer tests for AuthService.login_with_google — in-memory fakes only."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.application.identity.protocols import OidcIdentity
from app.application.identity.services import AuthService
from app.domain.identity.entities import User
from app.domain.identity.exceptions import (
    GoogleAccountMismatchError,
    InvalidCredentialsError,
    UserInactiveError,
)
from app.domain.identity.value_objects import Email, UserRole
from tests.application.test_auth_service import (
    FakeBreachedChecker,
    FakeHasher,
    FakeTokenIssuer,
    InMemoryRefreshTokenRepo,
    InMemoryUserRepo,
)


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _make_service() -> tuple[AuthService, InMemoryUserRepo, InMemoryRefreshTokenRepo]:
    user_repo = InMemoryUserRepo()
    token_repo = InMemoryRefreshTokenRepo()
    service = AuthService(
        user_repo=user_repo,
        token_repo=token_repo,
        password_hasher=FakeHasher(),
        breached_checker=FakeBreachedChecker(),
        token_issuer=FakeTokenIssuer(),
        access_token_ttl=timedelta(minutes=30),
        refresh_token_ttl=timedelta(days=14),
    )
    return service, user_repo, token_repo


def _seed_user(
    repo: InMemoryUserRepo,
    *,
    email: str = "editor@example.com",
    is_active: bool = True,
    google_sub: str | None = None,
) -> User:
    user = User(
        id=uuid.uuid4(),
        email=Email(email),
        hashed_password="hashed:unused",
        role=UserRole.editor,
        is_active=is_active,
        created_at=_now(),
        google_sub=google_sub,
    )
    repo.add(user)
    return user


class TestLoginWithGoogle:
    def test_known_sub_happy_path_issues_tokens(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, google_sub="sub-123")
        identity = OidcIdentity(sub="sub-123", email="editor@example.com", email_verified=True)

        result = svc.login_with_google(identity, _now())

        assert result["access_token"]
        assert result["refresh_token"]
        assert result["persistent"] is True

    def test_first_login_links_by_email_and_persists_sub(self) -> None:
        svc, user_repo, _ = _make_service()
        user = _seed_user(user_repo, email="editor@example.com", google_sub=None)
        identity = OidcIdentity(sub="new-sub-456", email="editor@example.com", email_verified=True)

        result = svc.login_with_google(identity, _now())

        assert result["access_token"]
        stored = user_repo.get_by_id(user.id)
        assert stored is not None
        assert stored.google_sub == "new-sub-456"

    def test_first_login_email_match_is_case_insensitive(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, email="editor@example.com", google_sub=None)
        identity = OidcIdentity(sub="sub-789", email="EDITOR@EXAMPLE.COM", email_verified=True)

        result = svc.login_with_google(identity, _now())

        assert result["access_token"]

    def test_unknown_email_is_rejected_no_signup(self) -> None:
        svc, _, _ = _make_service()
        identity = OidcIdentity(sub="sub-1", email="nobody@example.com", email_verified=True)

        with pytest.raises(InvalidCredentialsError):
            svc.login_with_google(identity, _now())

    def test_inactive_user_is_rejected(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, google_sub="sub-1", is_active=False)
        identity = OidcIdentity(sub="sub-1", email="editor@example.com", email_verified=True)

        with pytest.raises(UserInactiveError):
            svc.login_with_google(identity, _now())

    def test_inactive_user_found_by_email_first_login_is_rejected(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, google_sub=None, is_active=False)
        identity = OidcIdentity(sub="sub-1", email="editor@example.com", email_verified=True)

        with pytest.raises(UserInactiveError):
            svc.login_with_google(identity, _now())

    def test_unverified_email_is_rejected(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, google_sub="sub-1")
        identity = OidcIdentity(sub="sub-1", email="editor@example.com", email_verified=False)

        with pytest.raises(InvalidCredentialsError):
            svc.login_with_google(identity, _now())

    def test_sub_mismatch_surfaces_google_account_mismatch_error(self) -> None:
        svc, user_repo, _ = _make_service()
        _seed_user(user_repo, email="editor@example.com", google_sub="existing-sub")
        # Same email, but a *different* Google account is trying to log in as it —
        # this can happen if a user's Google account was recreated/migrated.
        identity = OidcIdentity(
            sub="different-sub", email="editor@example.com", email_verified=True
        )

        # Not found by sub (existing-sub != different-sub), falls back to email lookup,
        # which finds the user already linked to a different sub.
        with pytest.raises(GoogleAccountMismatchError):
            svc.login_with_google(identity, _now())

    def test_persistent_is_always_true_for_sso(self) -> None:
        svc, user_repo, token_repo = _make_service()
        _seed_user(user_repo, google_sub="sub-1")
        identity = OidcIdentity(sub="sub-1", email="editor@example.com", email_verified=True)

        result = svc.login_with_google(identity, _now())

        assert result["persistent"] is True
