"""Tests for admin and public tag endpoints."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.domain.content.entities import Tag
from app.domain.content.value_objects import Slug
from app.interfaces.api.admin.tags.router import get_tag_repo as admin_get_tag_repo
from app.interfaces.api.public.tags.router import get_article_repo as public_get_art_repo
from app.interfaces.api.public.tags.router import get_tag_repo as public_get_tag_repo
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


def _make_tag(name: str = "calcio", slug: str = "calcio") -> Tag:
    return Tag(id=uuid.uuid4(), name=name, slug=Slug(slug))


@pytest.fixture()
def mock_tag_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def mock_art_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def client(mock_tag_repo: MagicMock, mock_art_repo: MagicMock) -> Generator[TestClient, None, None]:
    app.dependency_overrides[admin_get_tag_repo] = lambda: mock_tag_repo
    app.dependency_overrides[public_get_tag_repo] = lambda: mock_tag_repo
    app.dependency_overrides[public_get_art_repo] = lambda: mock_art_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Admin endpoints ───────────────────────────────────────────────────────────


class TestAdminTagList:
    def test_200_returns_tags(self, client: TestClient, mock_tag_repo: MagicMock) -> None:
        mock_tag_repo.list_all.return_value = [
            _make_tag("calcio", "calcio"),
            _make_tag("sport", "sport"),
        ]
        resp = client.get("/api/admin/tags", cookies={"access_token": _make_token()})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2
        assert data["items"][0]["name"] == "calcio"

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.get("/api/admin/tags")
        assert resp.status_code == 401


class TestAdminTagDelete:
    def test_204_admin_can_delete(self, client: TestClient, mock_tag_repo: MagicMock) -> None:
        tag = _make_tag()
        mock_tag_repo.get_by_id.return_value = tag
        mock_tag_repo.delete.return_value = None
        resp = client.delete(
            f"/api/admin/tags/{tag.id}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 204

    def test_403_editor_cannot_delete(self, client: TestClient) -> None:
        resp = client.delete(
            f"/api/admin/tags/{uuid.uuid4()}",
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 403

    def test_404_when_not_found(self, client: TestClient, mock_tag_repo: MagicMock) -> None:
        mock_tag_repo.get_by_id.return_value = None
        resp = client.delete(
            f"/api/admin/tags/{uuid.uuid4()}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 404


# ── Public endpoints ──────────────────────────────────────────────────────────


class TestPublicTagList:
    def test_200_returns_all_tags(self, client: TestClient, mock_tag_repo: MagicMock) -> None:
        mock_tag_repo.list_all.return_value = [_make_tag("calcio", "calcio")]
        resp = client.get("/api/tags")
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["name"] == "calcio"


class TestPublicTagWithArticles:
    def test_200_returns_tag_and_articles(
        self, client: TestClient, mock_tag_repo: MagicMock, mock_art_repo: MagicMock
    ) -> None:
        tag = _make_tag("calcio", "calcio")
        mock_tag_repo.get_by_slug.return_value = tag
        mock_art_repo.list_published.return_value = ([], 0)
        resp = client.get("/api/tags/calcio")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "calcio"
        assert data["articles"] == []
        assert data["total"] == 0

    def test_404_when_tag_not_found(self, client: TestClient, mock_tag_repo: MagicMock) -> None:
        mock_tag_repo.get_by_slug.return_value = None
        resp = client.get("/api/tags/nonexistent")
        assert resp.status_code == 404
