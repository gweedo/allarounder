"""Tests for preview-token admin endpoint and public preview endpoint."""

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
from app.interfaces.api.preview.router import get_article_repo as preview_get_repo
from app.main import app
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm


def _make_token(role: str = "editor") -> str:
    now = datetime.now(tz=UTC)
    payload = {
        "sub": str(uuid.uuid4()),
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
        title="Articolo di Test",
        slug=Slug("articolo-di-test"),
        body=Body("corpo"),
        status=status,
        author_id=uuid.uuid4(),
        created_at=now,
        updated_at=now,
    )


@pytest.fixture()
def mock_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def client(mock_repo: MagicMock) -> Generator[TestClient]:
    app.dependency_overrides[admin_get_repo] = lambda: mock_repo
    app.dependency_overrides[preview_get_repo] = lambda: mock_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── POST /api/admin/articles/{id}/preview-token ───────────────────────────────


class TestGeneratePreviewToken:
    def test_200_returns_preview_url(self, client: TestClient, mock_repo: MagicMock) -> None:
        article = _make_article()
        mock_repo.get_by_id.return_value = article
        token = _make_token()
        resp = client.post(
            f"/api/admin/articles/{article.id}/preview-token",
            cookies={"access_token": token},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "preview_url" in data
        assert data["preview_url"].startswith("/preview/articles/")

    def test_each_call_regenerates_token(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        article = _make_article()
        mock_repo.get_by_id.return_value = article
        token = _make_token()
        resp1 = client.post(
            f"/api/admin/articles/{article.id}/preview-token",
            cookies={"access_token": token},
        )
        resp2 = client.post(
            f"/api/admin/articles/{article.id}/preview-token",
            cookies={"access_token": token},
        )
        assert resp1.json()["preview_url"] != resp2.json()["preview_url"]

    def test_404_on_not_found(self, client: TestClient, mock_repo: MagicMock) -> None:
        mock_repo.get_by_id.return_value = None
        token = _make_token()
        resp = client.post(
            f"/api/admin/articles/{uuid.uuid4()}/preview-token",
            cookies={"access_token": token},
        )
        assert resp.status_code == 404

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.post(f"/api/admin/articles/{uuid.uuid4()}/preview-token")
        assert resp.status_code == 401


# ── GET /api/preview/articles/{token} ────────────────────────────────────────


class TestPreviewEndpoint:
    def test_200_returns_draft_article(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        preview_token = uuid.uuid4()
        article = _make_article()
        article.preview_token = preview_token
        mock_repo.get_by_preview_token.return_value = article
        resp = client.get(f"/api/preview/articles/{preview_token}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Articolo di Test"

    def test_404_when_token_not_found(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        mock_repo.get_by_preview_token.return_value = None
        resp = client.get(f"/api/preview/articles/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_404_when_preview_token_is_null(
        self, client: TestClient, mock_repo: MagicMock
    ) -> None:
        article = _make_article(PublicationStatus.published)
        article.preview_token = None
        mock_repo.get_by_preview_token.return_value = article
        resp = client.get(f"/api/preview/articles/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_no_auth_required(self, client: TestClient, mock_repo: MagicMock) -> None:
        preview_token = uuid.uuid4()
        article = _make_article()
        article.preview_token = preview_token
        mock_repo.get_by_preview_token.return_value = article
        resp = client.get(f"/api/preview/articles/{preview_token}")
        assert resp.status_code == 200
