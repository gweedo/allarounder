"""Tests for admin and public category endpoints."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.domain.content.entities import Category
from app.domain.content.value_objects import Slug
from app.interfaces.api.admin.categories.router import get_category_repo as admin_get_cat_repo
from app.interfaces.api.public.categories.router import get_article_repo as public_get_art_repo
from app.interfaces.api.public.categories.router import get_category_repo as public_get_cat_repo
from app.main import app
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm


def _make_token(role: str = "editor") -> str:
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


def _make_category(name: str = "Test", slug: str = "test") -> Category:
    return Category(id=uuid.uuid4(), name=name, slug=Slug(slug), description=f"Desc: {name}")


@pytest.fixture()
def mock_cat_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def mock_art_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def client(mock_cat_repo: MagicMock, mock_art_repo: MagicMock) -> Generator[TestClient, None, None]:
    app.dependency_overrides[admin_get_cat_repo] = lambda: mock_cat_repo
    app.dependency_overrides[public_get_cat_repo] = lambda: mock_cat_repo
    app.dependency_overrides[public_get_art_repo] = lambda: mock_art_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Admin endpoints ───────────────────────────────────────────────────────────


class TestAdminCategoryList:
    def test_200_returns_categories(self, client: TestClient, mock_cat_repo: MagicMock) -> None:
        cats = [_make_category("Interviste", "interviste"), _make_category("Analisi", "analisi")]
        mock_cat_repo.list_all.return_value = cats
        resp = client.get(
            "/api/admin/categories", cookies={"access_token": _make_token()}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["items"][0]["slug"] == "interviste"

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.get("/api/admin/categories")
        assert resp.status_code == 401


class TestAdminCategoryCreate:
    def test_201_admin_can_create(self, client: TestClient, mock_cat_repo: MagicMock) -> None:
        mock_cat_repo.add.return_value = None
        mock_cat_repo.list_all.return_value = []
        resp = client.post(
            "/api/admin/categories",
            json={"name": "Nuova", "description": "desc"},
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Nuova"

    def test_403_editor_cannot_create(self, client: TestClient) -> None:
        resp = client.post(
            "/api/admin/categories",
            json={"name": "X"},
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403


class TestAdminCategoryDelete:
    def test_204_admin_can_delete(self, client: TestClient, mock_cat_repo: MagicMock) -> None:
        cat = _make_category()
        mock_cat_repo.get_by_id.return_value = cat
        mock_cat_repo.delete.return_value = None
        resp = client.delete(
            f"/api/admin/categories/{cat.id}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 204

    def test_403_editor_cannot_delete(self, client: TestClient, mock_cat_repo: MagicMock) -> None:
        resp = client.delete(
            f"/api/admin/categories/{uuid.uuid4()}",
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403

    def test_404_when_not_found(self, client: TestClient, mock_cat_repo: MagicMock) -> None:
        mock_cat_repo.get_by_id.return_value = None
        resp = client.delete(
            f"/api/admin/categories/{uuid.uuid4()}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 404


# ── Public endpoints ──────────────────────────────────────────────────────────


class TestPublicCategoryList:
    def test_200_returns_all_categories(
        self, client: TestClient, mock_cat_repo: MagicMock
    ) -> None:
        cats = [_make_category("Interviste", "interviste")]
        mock_cat_repo.list_all.return_value = cats
        resp = client.get("/api/categories")
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["name"] == "Interviste"


class TestPublicCategoryWithArticles:
    def test_200_returns_category_and_articles(
        self, client: TestClient, mock_cat_repo: MagicMock, mock_art_repo: MagicMock
    ) -> None:
        cat = _make_category("Interviste", "interviste")
        mock_cat_repo.get_by_slug.return_value = cat
        mock_art_repo.list_published.return_value = ([], 0)
        resp = client.get("/api/categories/interviste")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Interviste"
        assert data["articles"] == []
        assert data["total"] == 0

    def test_404_when_category_not_found(
        self, client: TestClient, mock_cat_repo: MagicMock, mock_art_repo: MagicMock
    ) -> None:
        mock_cat_repo.get_by_slug.return_value = None
        resp = client.get("/api/categories/nonexistent")
        assert resp.status_code == 404
