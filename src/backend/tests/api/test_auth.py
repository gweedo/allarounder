"""API-layer tests for auth endpoints using an in-memory AuthService override."""

from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.application.identity.services import AuthService
from app.domain.identity.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    TokenExpiredError,
    TokenRevokedError,
    UserInactiveError,
)
from app.interfaces.api.auth.dependencies import get_auth_service
from app.main import app


def _now() -> datetime:
    return datetime.now(tz=UTC)


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture()
def mock_auth_service() -> MagicMock:
    return MagicMock(spec=AuthService)


@pytest.fixture()
def client(mock_auth_service: MagicMock) -> Generator[TestClient]:
    app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Login ─────────────────────────────────────────────────────────────────────


class TestLogin:
    def test_200_and_sets_cookies_on_valid_credentials(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login.return_value = {
            "access_token": "access.jwt.token",
            "refresh_token": "raw-refresh-token",
        }
        resp = client.post(
            "/api/admin/auth/login",
            json={"email": "admin@example.com", "password": "securepassword!"},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.cookies
        assert "refresh_token" in resp.cookies

    def test_401_on_invalid_credentials(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login.side_effect = InvalidCredentialsError("bad creds")
        resp = client.post(
            "/api/admin/auth/login",
            json={"email": "admin@example.com", "password": "wrongpassword!"},
        )
        assert resp.status_code == 401

    def test_403_on_inactive_user(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login.side_effect = UserInactiveError("disabled")
        resp = client.post(
            "/api/admin/auth/login",
            json={"email": "admin@example.com", "password": "anypassword123!"},
        )
        assert resp.status_code == 403

    def test_429_on_locked_account(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login.side_effect = AccountLockedError("locked")
        resp = client.post(
            "/api/admin/auth/login",
            json={"email": "admin@example.com", "password": "anypassword123!"},
        )
        assert resp.status_code == 429

    def test_422_on_missing_fields(self, client: TestClient) -> None:
        resp = client.post("/api/admin/auth/login", json={})
        assert resp.status_code == 422


# ── Refresh ───────────────────────────────────────────────────────────────────


class TestRefresh:
    def test_200_and_rotates_cookies_on_valid_token(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.refresh.return_value = {
            "access_token": "new.access.token",
            "refresh_token": "new-refresh-token",
        }
        resp = client.post(
            "/api/admin/auth/refresh",
            cookies={"refresh_token": "old-refresh-token"},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.cookies

    def test_401_when_no_refresh_cookie(self, client: TestClient) -> None:
        resp = client.post("/api/admin/auth/refresh")
        assert resp.status_code == 401

    def test_401_on_expired_token(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.refresh.side_effect = TokenExpiredError("expired")
        resp = client.post(
            "/api/admin/auth/refresh",
            cookies={"refresh_token": "expired-token"},
        )
        assert resp.status_code == 401

    def test_401_on_revoked_token(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.refresh.side_effect = TokenRevokedError("revoked")
        resp = client.post(
            "/api/admin/auth/refresh",
            cookies={"refresh_token": "revoked-token"},
        )
        assert resp.status_code == 401


# ── Logout ────────────────────────────────────────────────────────────────────


class TestLogout:
    def test_200_and_clears_cookies(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.logout.return_value = None
        resp = client.post(
            "/api/admin/auth/logout",
            cookies={"refresh_token": "some-refresh-token"},
        )
        assert resp.status_code == 200
        # Both cookies should be deleted (max-age=0 or expired)
        assert resp.cookies.get("access_token") is None or resp.cookies.get("access_token") == ""
        assert resp.cookies.get("refresh_token") is None or resp.cookies.get("refresh_token") == ""

    def test_200_even_without_refresh_cookie(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.logout.return_value = None
        resp = client.post("/api/admin/auth/logout")
        assert resp.status_code == 200
