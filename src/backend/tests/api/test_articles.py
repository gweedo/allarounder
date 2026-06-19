"""API-layer tests for article admin endpoints using real JWTs and mocked repo."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.domain.content.entities import Article
from app.domain.content.value_objects import Body, PublicationStatus, Slug
from app.interfaces.api.admin.articles.router import get_article_repo
from app.main import app
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm


def _make_token(role: str, user_id: str | None = None, expired: bool = False) -> str:
    now = datetime.now(tz=UTC)
    exp = now - timedelta(hours=1) if expired else now + timedelta(minutes=30)
    payload = {
        "sub": user_id or str(uuid.uuid4()),
        "email": "user@example.com",
        "role": role,
        "iat": now,
        "exp": exp,
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGO)


def _make_article(author_id: uuid.UUID | None = None) -> Article:
    now = datetime.now(tz=UTC)
    return Article(
        id=uuid.uuid4(),
        title="Test Article",
        slug=Slug("test-article"),
        body=Body(""),
        status=PublicationStatus.draft,
        author_id=author_id or uuid.uuid4(),
        created_at=now,
        updated_at=now,
        publish_at=None,
    )


@pytest.fixture()
def mock_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def client(mock_repo: MagicMock) -> Generator[TestClient, None, None]:
    app.dependency_overrides[get_article_repo] = lambda: mock_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── POST /api/admin/articles ─────────────────────────────────────────────────


class TestCreateArticle:
    def test_201_creates_draft(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.add.return_value = None
        token = _make_token("editor")
        resp = client.post(
            "/api/admin/articles",
            json={"title": "Il mio articolo"},
            cookies={"access_token": token},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "draft"
        assert data["slug"] == "il-mio-articolo"
        assert data["title"] == "Il mio articolo"

    def test_201_auto_slug_strips_accents(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.add.return_value = None
        token = _make_token("editor")
        resp = client.post(
            "/api/admin/articles",
            json={"title": "Caffè e Salute"},
            cookies={"access_token": token},
        )
        assert resp.status_code == 201
        assert resp.json()["slug"] == "caffe-e-salute"

    def test_201_admin_can_create(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.add.return_value = None
        token = _make_token("admin")
        resp = client.post(
            "/api/admin/articles",
            json={"title": "Admin Article"},
            cookies={"access_token": token},
        )
        assert resp.status_code == 201

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.post("/api/admin/articles", json={"title": "Test"})
        assert resp.status_code == 401

    def test_401_with_expired_token(self, client: TestClient) -> None:
        token = _make_token("editor", expired=True)
        resp = client.post(
            "/api/admin/articles",
            json={"title": "Test"},
            cookies={"access_token": token},
        )
        assert resp.status_code == 401

    def test_422_on_missing_title(self, client: TestClient) -> None:
        token = _make_token("editor")
        resp = client.post(
            "/api/admin/articles",
            json={},
            cookies={"access_token": token},
        )
        assert resp.status_code == 422


# ── GET /api/admin/articles ──────────────────────────────────────────────────


class TestListArticles:
    def test_200_returns_paginated_list(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        article = _make_article()
        mock_repo.list.return_value = ([article], 1)
        token = _make_token("editor")
        resp = client.get("/api/admin/articles", cookies={"access_token": token})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Test Article"

    def test_editor_filters_by_own_author_id(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        author_id = str(uuid.uuid4())
        mock_repo.list.return_value = ([], 0)
        token = _make_token("editor", user_id=author_id)
        client.get("/api/admin/articles", cookies={"access_token": token})
        call_kwargs = mock_repo.list.call_args.kwargs
        assert call_kwargs["author_id"] == uuid.UUID(author_id)

    def test_admin_sees_all_no_author_filter(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        mock_repo.list.return_value = ([], 0)
        token = _make_token("admin")
        client.get("/api/admin/articles", cookies={"access_token": token})
        call_kwargs = mock_repo.list.call_args.kwargs
        assert call_kwargs["author_id"] is None

    def test_status_filter_passed_to_repo(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        mock_repo.list.return_value = ([], 0)
        token = _make_token("editor")
        client.get(
            "/api/admin/articles?status=draft", cookies={"access_token": token}
        )
        call_kwargs = mock_repo.list.call_args.kwargs
        assert call_kwargs["status"] == PublicationStatus.draft

    def test_422_on_invalid_status(self, client: TestClient, mock_repo: MagicMock) -> None:
        token = _make_token("editor")
        resp = client.get(
            "/api/admin/articles?status=invalid", cookies={"access_token": token}
        )
        assert resp.status_code == 422

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.get("/api/admin/articles")
        assert resp.status_code == 401
