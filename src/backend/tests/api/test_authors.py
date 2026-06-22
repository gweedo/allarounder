"""Tests for admin and public author endpoints."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.domain.content.entities import Author
from app.domain.content.value_objects import Slug
from app.interfaces.api.admin.authors.router import get_author_repo as admin_get_author_repo
from app.interfaces.api.public.authors.router import get_article_repo as public_get_art_repo
from app.interfaces.api.public.authors.router import get_author_repo as public_get_author_repo
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


def _make_author(name: str = "Marco Rossi", slug: str = "marco-rossi") -> Author:
    return Author(
        id=uuid.uuid4(),
        name=name,
        slug=Slug(slug),
        created_at=datetime.now(tz=UTC),
        bio="Giornalista sportivo.",
        photo_url=None,
        links={},
    )


@pytest.fixture()
def mock_author_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def mock_art_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def client(
    mock_author_repo: MagicMock, mock_art_repo: MagicMock
) -> Generator[TestClient]:
    app.dependency_overrides[admin_get_author_repo] = lambda: mock_author_repo
    app.dependency_overrides[public_get_author_repo] = lambda: mock_author_repo
    app.dependency_overrides[public_get_art_repo] = lambda: mock_art_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Admin endpoints ───────────────────────────────────────────────────────────


class TestAdminAuthorList:
    def test_200_returns_authors(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        mock_author_repo.list_all.return_value = [_make_author("Marco Rossi", "marco-rossi")]
        resp = client.get("/api/admin/authors", cookies={"access_token": _make_token()})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "Marco Rossi"

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.get("/api/admin/authors")
        assert resp.status_code == 401

    def test_403_editor_cannot_list(self, client: TestClient) -> None:
        resp = client.get(
            "/api/admin/authors",
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403


class TestAdminAuthorCreate:
    def test_201_admin_can_create(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        mock_author_repo.add.return_value = None
        resp = client.post(
            "/api/admin/authors",
            json={"name": "Laura Bianchi", "bio": "Redattrice sportiva."},
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Laura Bianchi"

    def test_403_editor_cannot_create(self, client: TestClient) -> None:
        resp = client.post(
            "/api/admin/authors",
            json={"name": "X"},
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403


class TestAdminAuthorGet:
    def test_200_returns_author(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        author = _make_author()
        mock_author_repo.get_by_id.return_value = author
        resp = client.get(
            f"/api/admin/authors/{author.id}",
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Marco Rossi"

    def test_404_when_not_found(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        mock_author_repo.get_by_id.return_value = None
        resp = client.get(
            f"/api/admin/authors/{uuid.uuid4()}",
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 404


class TestAdminAuthorUpdate:
    def test_200_updates_author(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        author = _make_author()
        mock_author_repo.get_by_id.return_value = author
        mock_author_repo.save.return_value = None
        resp = client.put(
            f"/api/admin/authors/{author.id}",
            json={"name": "Marco Rossi Senior"},
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 200

    def test_404_when_not_found(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        mock_author_repo.get_by_id.return_value = None
        resp = client.put(
            f"/api/admin/authors/{uuid.uuid4()}",
            json={"name": "X"},
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 404


class TestAdminAuthorDelete:
    def test_204_admin_can_delete(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        author = _make_author()
        mock_author_repo.get_by_id.return_value = author
        mock_author_repo.delete.return_value = None
        resp = client.delete(
            f"/api/admin/authors/{author.id}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 204

    def test_404_when_not_found(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        mock_author_repo.get_by_id.return_value = None
        resp = client.delete(
            f"/api/admin/authors/{uuid.uuid4()}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 404


# ── Public endpoints ──────────────────────────────────────────────────────────


class TestPublicAuthorList:
    def test_200_returns_authors(self, client: TestClient, mock_author_repo: MagicMock) -> None:
        mock_author_repo.list_all.return_value = [_make_author("Marco Rossi", "marco-rossi")]
        resp = client.get("/api/authors")
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["slug"] == "marco-rossi"


class TestPublicAuthorWithArticles:
    def test_200_returns_author_and_articles(
        self, client: TestClient, mock_author_repo: MagicMock, mock_art_repo: MagicMock
    ) -> None:
        author = _make_author("Marco Rossi", "marco-rossi")
        mock_author_repo.get_by_slug.return_value = author
        mock_art_repo.list_published.return_value = ([], 0)
        resp = client.get("/api/authors/marco-rossi")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Marco Rossi"
        assert data["articles"] == []
        assert data["total"] == 0

    def test_404_when_author_not_found(
        self, client: TestClient, mock_author_repo: MagicMock
    ) -> None:
        mock_author_repo.get_by_slug.return_value = None
        resp = client.get("/api/authors/nonexistent")
        assert resp.status_code == 404
