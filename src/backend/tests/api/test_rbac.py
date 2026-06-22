"""RBAC tests: verify require_admin and require_editor dependency behavior."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.interfaces.api.auth.dependencies import (
    CurrentUser,
    require_admin,
    require_editor,
)
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm


def _make_token(role: str, expired: bool = False) -> str:
    now = datetime.now(tz=UTC)
    exp = now - timedelta(hours=1) if expired else now + timedelta(minutes=30)
    payload = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "email": "user@example.com",
        "role": role,
        "iat": now,
        "exp": exp,
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGO)


# Minimal test app wired with the dependencies
_test_app = FastAPI()


@_test_app.get("/admin-only")
def admin_only(user: Annotated[CurrentUser, Depends(require_admin)]) -> dict[str, str]:
    return {"role": user.role}


@_test_app.get("/editor-or-admin")
def editor_route(user: Annotated[CurrentUser, Depends(require_editor)]) -> dict[str, str]:
    return {"role": user.role}


@pytest.fixture()
def rbac_client() -> TestClient:
    return TestClient(_test_app, raise_server_exceptions=False)


class TestRequireAdmin:
    def test_admin_token_allowed(self, rbac_client: TestClient) -> None:
        token = _make_token("admin")
        resp = rbac_client.get(
            "/admin-only", cookies={"access_token": token}
        )
        assert resp.status_code == 200
        assert resp.json() == {"role": "admin"}

    def test_editor_token_forbidden(self, rbac_client: TestClient) -> None:
        token = _make_token("editor")
        resp = rbac_client.get(
            "/admin-only", cookies={"access_token": token}
        )
        assert resp.status_code == 403

    def test_no_cookie_unauthorized(self, rbac_client: TestClient) -> None:
        resp = rbac_client.get("/admin-only")
        assert resp.status_code == 401

    def test_expired_token_unauthorized(self, rbac_client: TestClient) -> None:
        token = _make_token("admin", expired=True)
        resp = rbac_client.get(
            "/admin-only", cookies={"access_token": token}
        )
        assert resp.status_code == 401


class TestRequireEditor:
    def test_editor_token_allowed(self, rbac_client: TestClient) -> None:
        token = _make_token("editor")
        resp = rbac_client.get(
            "/editor-or-admin", cookies={"access_token": token}
        )
        assert resp.status_code == 200

    def test_admin_token_also_allowed(self, rbac_client: TestClient) -> None:
        token = _make_token("admin")
        resp = rbac_client.get(
            "/editor-or-admin", cookies={"access_token": token}
        )
        assert resp.status_code == 200
