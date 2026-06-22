"""API tests for publish/archive/update admin endpoints and public article endpoints."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.domain.content.entities import Article
from app.domain.content.value_objects import Body, PublicationStatus, Slug
from app.interfaces.api.admin.articles.router import get_article_repo as admin_get_repo
from app.interfaces.api.admin.articles.router import get_guest_repo as admin_get_guest_repo
from app.interfaces.api.admin.articles.router import get_tag_repo as admin_get_tag_repo
from app.interfaces.api.public.articles.router import get_article_repo as public_get_repo
from app.interfaces.api.public.articles.router import get_author_repo as public_get_author_repo
from app.interfaces.api.public.articles.router import get_category_repo as public_get_cat_repo
from app.interfaces.api.public.articles.router import get_guest_repo as public_get_guest_repo
from app.interfaces.api.public.articles.router import get_tag_repo as public_get_tag_repo
from app.main import app
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm


def _make_token(role: str = "editor", user_id: str | None = None) -> str:
    now = datetime.now(tz=UTC)
    payload = {
        "sub": user_id or str(uuid.uuid4()),
        "email": "user@example.com",
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=30),
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGO)


def _make_article(status: PublicationStatus = PublicationStatus.draft) -> Article:
    now = datetime.now(tz=UTC)
    return Article(
        id=uuid.uuid4(),
        title="Test Article",
        slug=Slug("test-article"),
        body=Body("corpo dell'articolo"),
        status=status,
        author_id=uuid.uuid4(),
        created_at=now,
        updated_at=now,
        publish_at=now if status == PublicationStatus.published else None,
        slug_locked=status == PublicationStatus.published,
    )


@pytest.fixture()
def mock_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def mock_tag_repo() -> MagicMock:
    m = MagicMock()
    m.get_by_article.return_value = []
    return m


@pytest.fixture()
def client(mock_repo: MagicMock, mock_tag_repo: MagicMock) -> Generator[TestClient]:
    mock_guest_repo = MagicMock()
    mock_guest_repo.get_by_article.return_value = []
    app.dependency_overrides[admin_get_repo] = lambda: mock_repo
    app.dependency_overrides[admin_get_tag_repo] = lambda: mock_tag_repo
    app.dependency_overrides[admin_get_guest_repo] = lambda: mock_guest_repo
    app.dependency_overrides[public_get_repo] = lambda: mock_repo
    app.dependency_overrides[public_get_cat_repo] = lambda: MagicMock()
    app.dependency_overrides[public_get_tag_repo] = lambda: mock_tag_repo
    app.dependency_overrides[public_get_author_repo] = lambda: MagicMock()
    app.dependency_overrides[public_get_guest_repo] = lambda: mock_guest_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── PUT /api/admin/articles/{id} ─────────────────────────────────────────────


class TestUpdateArticle:
    def test_200_updates_draft(self, client: TestClient, mock_repo: MagicMock) -> None:
        article = _make_article()
        mock_repo.get_by_id.return_value = article
        token = _make_token()
        resp = client.put(
            f"/api/admin/articles/{article.id}",
            json={"title": "Nuovo Titolo"},
            cookies={"access_token": token},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Nuovo Titolo"

    def test_404_on_not_found(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.get_by_id.return_value = None
        token = _make_token()
        resp = client.put(
            f"/api/admin/articles/{uuid.uuid4()}",
            json={"title": "X"},
            cookies={"access_token": token},
        )
        assert resp.status_code == 404

    def test_422_on_locked_slug(self, client: TestClient, mock_repo: MagicMock) -> None:
        article = _make_article(PublicationStatus.published)
        mock_repo.get_by_id.return_value = article
        token = _make_token()
        resp = client.put(
            f"/api/admin/articles/{article.id}",
            json={"slug": "altra-slug"},
            cookies={"access_token": token},
        )
        assert resp.status_code == 422

    def test_401_without_token(self, client: TestClient, mock_repo: MagicMock) -> None:
        resp = client.put(f"/api/admin/articles/{uuid.uuid4()}", json={"title": "X"})
        assert resp.status_code == 401


# ── POST /api/admin/articles/{id}/publish ────────────────────────────────────


class TestPublishEndpoint:
    def test_200_publishes_draft(self, client: TestClient, mock_repo: MagicMock) -> None:
        article = _make_article()
        mock_repo.get_by_id.return_value = article
        token = _make_token()
        resp = client.post(
            f"/api/admin/articles/{article.id}/publish",
            cookies={"access_token": token},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"
        assert resp.json()["slug_locked"] is True

    def test_404_on_not_found(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.get_by_id.return_value = None
        token = _make_token()
        resp = client.post(
            f"/api/admin/articles/{uuid.uuid4()}/publish",
            cookies={"access_token": token},
        )
        assert resp.status_code == 404

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.post(f"/api/admin/articles/{uuid.uuid4()}/publish")
        assert resp.status_code == 401


# ── POST /api/admin/articles/{id}/archive ────────────────────────────────────


class TestArchiveEndpoint:
    def test_200_archives_article(self, client: TestClient, mock_repo: MagicMock) -> None:
        article = _make_article()
        mock_repo.get_by_id.return_value = article
        token = _make_token()
        resp = client.post(
            f"/api/admin/articles/{article.id}/archive",
            cookies={"access_token": token},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "archived"

    def test_404_on_not_found(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.get_by_id.return_value = None
        token = _make_token()
        resp = client.post(
            f"/api/admin/articles/{uuid.uuid4()}/archive",
            cookies={"access_token": token},
        )
        assert resp.status_code == 404

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.post(f"/api/admin/articles/{uuid.uuid4()}/archive")
        assert resp.status_code == 401


# ── GET /api/articles ─────────────────────────────────────────────────────────


class TestPublicListArticles:
    def test_200_returns_published_articles(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        article = _make_article(PublicationStatus.published)
        mock_repo.list_published.return_value = ([article], 1)
        resp = client.get("/api/articles")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["slug"] == "test-article"

    def test_200_empty_when_no_published(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        mock_repo.list_published.return_value = ([], 0)
        resp = client.get("/api/articles")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_passes_before_timestamp_to_repo(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        mock_repo.list_published.return_value = ([], 0)
        client.get("/api/articles")
        call_kwargs = mock_repo.list_published.call_args.kwargs
        assert isinstance(call_kwargs["before"], datetime)


# ── GET /api/articles/{slug} ─────────────────────────────────────────────────


class TestPublicGetArticle:
    def test_200_returns_published_article(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        article = _make_article(PublicationStatus.published)
        mock_repo.get_by_slug.return_value = article
        resp = client.get("/api/articles/test-article")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Test Article"

    def test_404_when_draft(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.get_by_slug.return_value = _make_article(PublicationStatus.draft)
        resp = client.get("/api/articles/test-article")
        assert resp.status_code == 404

    def test_404_when_not_found(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.get_by_slug.return_value = None
        resp = client.get("/api/articles/no-such-article")
        assert resp.status_code == 404

    def test_404_when_future_publish_at(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        now = datetime.now(tz=UTC)
        article = Article(
            id=uuid.uuid4(),
            title="Future",
            slug=Slug("future-article"),
            body=Body(""),
            status=PublicationStatus.published,
            author_id=uuid.uuid4(),
            created_at=now,
            updated_at=now,
            publish_at=now + timedelta(days=1),
            slug_locked=True,
        )
        mock_repo.get_by_slug.return_value = article
        resp = client.get("/api/articles/future-article")
        assert resp.status_code == 404

    def test_spotify_url_present_in_response(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        now = datetime.now(tz=UTC)
        article = Article(
            id=uuid.uuid4(),
            title="Con Spotify",
            slug=Slug("con-spotify"),
            body=Body(""),
            status=PublicationStatus.published,
            author_id=uuid.uuid4(),
            created_at=now,
            updated_at=now,
            publish_at=now,
            slug_locked=True,
            spotify_url="https://open.spotify.com/episode/abc123",
        )
        mock_repo.get_by_slug.return_value = article
        resp = client.get("/api/articles/con-spotify")
        assert resp.status_code == 200
        assert resp.json()["spotify_url"] == "https://open.spotify.com/episode/abc123"
