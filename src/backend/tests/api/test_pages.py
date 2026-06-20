"""Tests for admin and public pages endpoints."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.domain.content.entities import StaticPage
from app.domain.content.value_objects import Slug
from app.interfaces.api.admin.pages.router import get_page_repo as admin_get_page_repo
from app.interfaces.api.public.pages.router import get_page_repo as public_get_page_repo
from app.main import app
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm


def _make_token(role: str = "admin") -> str:
    now = datetime.now(tz=UTC)
    return jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "email": "user@example.com",
            "role": role,
            "iat": now,
            "exp": now + timedelta(minutes=30),
        },
        _SECRET,
        algorithm=_ALGO,
    )


def _make_page(
    slug: str = "chi-siamo",
    title: str = "Chi siamo",
) -> StaticPage:
    return StaticPage(
        id=uuid.uuid4(),
        title=title,
        slug=Slug(slug),
        body="## Chi siamo\n\nTesto della pagina.",
        updated_at=datetime.now(tz=UTC),
        meta_title="Chi siamo — Allarounder",
        meta_description="Scopri chi siamo.",
    )


@pytest.fixture()
def mock_page_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def client(mock_page_repo: MagicMock) -> Generator[TestClient, None, None]:
    app.dependency_overrides[admin_get_page_repo] = lambda: mock_page_repo
    app.dependency_overrides[public_get_page_repo] = lambda: mock_page_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Admin endpoints ───────────────────────────────────────────────────────────


class TestAdminPageList:
    def test_200_returns_pages(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        mock_page_repo.list_all.return_value = [
            _make_page("chi-siamo", "Chi siamo"),
            _make_page("contatti", "Contatti"),
        ]
        resp = client.get("/api/admin/pages", cookies={"access_token": _make_token()})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["items"][0]["slug"] == "chi-siamo"

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.get("/api/admin/pages")
        assert resp.status_code == 401

    def test_403_editor_cannot_list(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        mock_page_repo.list_all.return_value = []
        resp = client.get(
            "/api/admin/pages",
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403


class TestAdminPageGet:
    def test_200_returns_page(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        page = _make_page()
        mock_page_repo.get_by_id.return_value = page
        resp = client.get(
            f"/api/admin/pages/{page.id}",
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 200
        assert resp.json()["slug"] == "chi-siamo"

    def test_404_when_not_found(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        mock_page_repo.get_by_id.return_value = None
        resp = client.get(
            f"/api/admin/pages/{uuid.uuid4()}",
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 404

    def test_403_editor_cannot_get(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        resp = client.get(
            f"/api/admin/pages/{uuid.uuid4()}",
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403


class TestAdminPageUpdate:
    def test_200_admin_can_update(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        page = _make_page()
        mock_page_repo.get_by_id.return_value = page
        mock_page_repo.save.return_value = None
        resp = client.put(
            f"/api/admin/pages/{page.id}",
            json={"body": "Nuovo testo.", "meta_title": "Nuovo titolo"},
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 200
        assert resp.json()["slug"] == "chi-siamo"

    def test_404_when_not_found(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        mock_page_repo.get_by_id.return_value = None
        resp = client.put(
            f"/api/admin/pages/{uuid.uuid4()}",
            json={"body": "Testo"},
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 404

    def test_403_editor_cannot_update(
        self, client: TestClient, mock_page_repo: MagicMock
    ) -> None:
        page = _make_page()
        mock_page_repo.get_by_id.return_value = page
        resp = client.put(
            f"/api/admin/pages/{page.id}",
            json={"body": "Testo"},
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.put(f"/api/admin/pages/{uuid.uuid4()}", json={"body": "x"})
        assert resp.status_code == 401


# ── Public endpoints ──────────────────────────────────────────────────────────


class TestPublicPageGet:
    def test_200_returns_page(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        page = _make_page("chi-siamo", "Chi siamo")
        mock_page_repo.get_by_slug.return_value = page
        resp = client.get("/api/pages/chi-siamo")
        assert resp.status_code == 200
        data = resp.json()
        assert data["slug"] == "chi-siamo"
        assert data["title"] == "Chi siamo"
        assert "body" in data

    def test_404_when_not_found(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        mock_page_repo.get_by_slug.return_value = None
        resp = client.get("/api/pages/nonexistent")
        assert resp.status_code == 404

    def test_no_auth_required(self, client: TestClient, mock_page_repo: MagicMock) -> None:
        page = _make_page("contatti", "Contatti")
        mock_page_repo.get_by_slug.return_value = page
        resp = client.get("/api/pages/contatti")
        assert resp.status_code == 200
