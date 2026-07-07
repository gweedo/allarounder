"""API-layer tests for Google OIDC login/callback endpoints.

The real HttpGoogleOidcClient and Settings are swapped out via dependency
overrides — these tests never touch the network or Google.
"""

from collections.abc import Generator
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.application.identity.protocols import OidcIdentity
from app.application.identity.services import AuthService
from app.domain.identity.exceptions import (
    GoogleAccountMismatchError,
    InvalidCredentialsError,
    UserInactiveError,
)
from app.infrastructure.identity.google import GoogleTokenExchangeError, HttpGoogleOidcClient
from app.interfaces.api.auth.dependencies import get_auth_service
from app.interfaces.api.auth.google import get_google_oidc_client
from app.main import app
from app.settings import Settings, get_settings


def _now() -> datetime:
    return datetime.now(tz=UTC)


class TestGetGoogleOidcClientDependency:
    """Covers the (overridden-in-every-other-test) real dependency provider."""

    def test_builds_real_http_client_from_settings(self) -> None:
        settings = Settings(
            _env_file=None,  # type: ignore[call-arg]
            google_sso_enabled=True,
            google_client_id="real-client-id",
            google_client_secret="real-client-secret",
            google_redirect_uri="https://allarounder.it/api/admin/auth/google/callback",
        )
        client = get_google_oidc_client(settings)
        assert isinstance(client, HttpGoogleOidcClient)


class FakeOidcClient:
    def __init__(
        self,
        *,
        identity: OidcIdentity | None = None,
        raise_on_exchange: Exception | None = None,
    ) -> None:
        self._identity = identity
        self._raise_on_exchange = raise_on_exchange
        self.exchange_calls: list[tuple[str, str, str]] = []

    def build_authorization_url(self, state: str, nonce: str, code_challenge: str) -> str:
        return f"https://accounts.google.com/o/oauth2/v2/auth?state={state}&nonce={nonce}"

    def exchange_code(self, code: str, code_verifier: str, nonce: str) -> OidcIdentity:
        self.exchange_calls.append((code, code_verifier, nonce))
        if self._raise_on_exchange is not None:
            raise self._raise_on_exchange
        assert self._identity is not None
        return self._identity


_ENABLED_SETTINGS = Settings(
    _env_file=None,  # type: ignore[call-arg]
    google_sso_enabled=True,
    google_client_id="test-client-id",
    google_client_secret="test-client-secret",
    google_redirect_uri="http://localhost:3000/api/admin/auth/google/callback",
)

_DISABLED_SETTINGS = Settings(_env_file=None)  # type: ignore[call-arg]


@pytest.fixture()
def mock_auth_service() -> MagicMock:
    return MagicMock(spec=AuthService)


@pytest.fixture()
def fake_oidc_client() -> FakeOidcClient:
    return FakeOidcClient(
        identity=OidcIdentity(sub="google-sub-1", email="editor@example.com", email_verified=True)
    )


@pytest.fixture()
def client(
    mock_auth_service: MagicMock, fake_oidc_client: FakeOidcClient
) -> Generator[TestClient]:
    app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
    app.dependency_overrides[get_settings] = lambda: _ENABLED_SETTINGS
    app.dependency_overrides[get_google_oidc_client] = lambda: fake_oidc_client
    # base_url must be https:// — the oauth_state and auth cookies are all Secure,
    # and httpx's cookie jar (correctly) withholds Secure cookies from http:// requests,
    # which would break the state-cookie round trip the callback tests rely on.
    with TestClient(app, raise_server_exceptions=False, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def disabled_client(mock_auth_service: MagicMock) -> Generator[TestClient]:
    app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
    app.dependency_overrides[get_settings] = lambda: _DISABLED_SETTINGS
    with TestClient(app, raise_server_exceptions=False, base_url="https://testserver") as c:
        yield c
    app.dependency_overrides.clear()


# ── Feature flag ──────────────────────────────────────────────────────────────


class TestFeatureFlagged:
    def test_login_route_404_when_disabled(self, disabled_client: TestClient) -> None:
        resp = disabled_client.get(
            "/api/admin/auth/google/login", follow_redirects=False
        )
        assert resp.status_code == 404

    def test_callback_route_404_when_disabled(self, disabled_client: TestClient) -> None:
        resp = disabled_client.get(
            "/api/admin/auth/google/callback",
            params={"code": "x", "state": "y"},
            follow_redirects=False,
        )
        assert resp.status_code == 404


# ── /login ────────────────────────────────────────────────────────────────────


class TestGoogleLogin:
    def test_302_redirects_to_google(self, client: TestClient) -> None:
        resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        assert resp.status_code == 302
        assert resp.headers["location"].startswith("https://accounts.google.com/")

    def test_sets_state_cookie_with_samesite_lax(self, client: TestClient) -> None:
        resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        set_cookie_headers = resp.headers.get_list("set-cookie")
        state_cookie = next(h for h in set_cookie_headers if h.startswith("oauth_state="))
        assert "SameSite=lax" in state_cookie or "samesite=lax" in state_cookie.lower()
        assert "HttpOnly" in state_cookie
        assert "Secure" in state_cookie
        # Must NOT be strict — the callback is a cross-site navigation from Google.
        assert "samesite=strict" not in state_cookie.lower()


# ── /callback ─────────────────────────────────────────────────────────────────


class TestGoogleCallback:
    def test_missing_state_cookie_is_400(self, client: TestClient) -> None:
        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": "some-state"},
            follow_redirects=False,
        )
        assert resp.status_code == 400

    def test_corrupted_state_cookie_is_400(self, client: TestClient) -> None:
        client.cookies.set("oauth_state", "not-a-valid-jwt")
        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": "some-state"},
            follow_redirects=False,
        )
        assert resp.status_code == 400

    def test_mismatched_state_is_400(self, client: TestClient) -> None:
        login_resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        assert login_resp.status_code == 302
        # The client's cookie jar now holds the real oauth_state cookie from /login;
        # supply a *different* state query param to simulate tampering.
        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": "not-the-real-state"},
            follow_redirects=False,
        )
        assert resp.status_code == 400

    def test_google_error_param_redirects_to_login_with_error(self, client: TestClient) -> None:
        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"error": "access_denied"},
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert resp.headers["location"] == "/admin/login?sso=error"

    def test_happy_path_sets_auth_cookies_and_redirects_success(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login_with_google.return_value = {
            "access_token": "access.jwt.token",
            "refresh_token": "raw-refresh-token",
            "persistent": True,
        }
        login_resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        # Extract the real `state` query param FastAPI generated in the redirect
        # target so the callback request looks like a genuine round trip.
        location = login_resp.headers["location"]
        real_state = location.split("state=")[1].split("&")[0]

        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": real_state},
            follow_redirects=False,
        )

        assert resp.status_code == 302
        assert resp.headers["location"] == "/admin/login?sso=success"
        set_cookie_headers = resp.headers.get_list("set-cookie")
        assert any(h.startswith("access_token=") for h in set_cookie_headers)
        assert any(h.startswith("refresh_token=") for h in set_cookie_headers)

    def test_happy_path_clears_oauth_state_cookie(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login_with_google.return_value = {
            "access_token": "access.jwt.token",
            "refresh_token": "raw-refresh-token",
            "persistent": True,
        }
        login_resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        real_state = login_resp.headers["location"].split("state=")[1].split("&")[0]

        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": real_state},
            follow_redirects=False,
        )
        set_cookie_headers = resp.headers.get_list("set-cookie")
        state_cookie = next(h for h in set_cookie_headers if h.startswith("oauth_state="))
        assert 'oauth_state=""' in state_cookie or "Max-Age=0" in state_cookie

    def test_unknown_email_redirects_to_login_with_error_and_no_auth_cookies(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login_with_google.side_effect = InvalidCredentialsError(
            "no account registered"
        )
        login_resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        real_state = login_resp.headers["location"].split("state=")[1].split("&")[0]

        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": real_state},
            follow_redirects=False,
        )

        assert resp.status_code == 302
        assert resp.headers["location"] == "/admin/login?sso=error"
        set_cookie_headers = resp.headers.get_list("set-cookie")
        assert not any(h.startswith("access_token=") for h in set_cookie_headers)
        assert not any(h.startswith("refresh_token=") for h in set_cookie_headers)

    def test_inactive_user_redirects_to_login_with_error(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login_with_google.side_effect = UserInactiveError("disabled")
        login_resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        real_state = login_resp.headers["location"].split("state=")[1].split("&")[0]

        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": real_state},
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert resp.headers["location"] == "/admin/login?sso=error"

    def test_account_mismatch_redirects_to_login_with_error(
        self, client: TestClient, mock_auth_service: MagicMock
    ) -> None:
        mock_auth_service.login_with_google.side_effect = GoogleAccountMismatchError("mismatch")
        login_resp = client.get("/api/admin/auth/google/login", follow_redirects=False)
        real_state = login_resp.headers["location"].split("state=")[1].split("&")[0]

        resp = client.get(
            "/api/admin/auth/google/callback",
            params={"code": "auth-code", "state": real_state},
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert resp.headers["location"] == "/admin/login?sso=error"

    def test_token_exchange_failure_redirects_to_login_with_error(
        self, mock_auth_service: MagicMock
    ) -> None:
        failing_client = FakeOidcClient(raise_on_exchange=GoogleTokenExchangeError("boom"))
        app.dependency_overrides[get_auth_service] = lambda: mock_auth_service
        app.dependency_overrides[get_settings] = lambda: _ENABLED_SETTINGS
        app.dependency_overrides[get_google_oidc_client] = lambda: failing_client
        with TestClient(app, raise_server_exceptions=False, base_url="https://testserver") as c:
            login_resp = c.get("/api/admin/auth/google/login", follow_redirects=False)
            real_state = login_resp.headers["location"].split("state=")[1].split("&")[0]

            resp = c.get(
                "/api/admin/auth/google/callback",
                params={"code": "auth-code", "state": real_state},
                follow_redirects=False,
            )
        app.dependency_overrides.clear()
        assert resp.status_code == 302
        assert resp.headers["location"] == "/admin/login?sso=error"
