"""Tests for admin and public guest endpoints."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi.testclient import TestClient

from app.domain.content.entities import Guest
from app.domain.content.value_objects import Slug
from app.interfaces.api.admin.guests.router import get_guest_repo as admin_get_guest_repo
from app.interfaces.api.public.guests.router import get_article_repo as public_get_art_repo
from app.interfaces.api.public.guests.router import get_guest_repo as public_get_guest_repo
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


def _make_guest(name: str = "Mario Bianchi", slug: str = "mario-bianchi") -> Guest:
    return Guest(
        id=uuid.uuid4(),
        name=name,
        slug=Slug(slug),
        created_at=datetime.now(tz=UTC),
        bio="Ospite del podcast.",
        photo_url=None,
        links={},
    )


@pytest.fixture()
def mock_guest_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def mock_art_repo() -> MagicMock:
    return MagicMock()


@pytest.fixture()
def client(
    mock_guest_repo: MagicMock, mock_art_repo: MagicMock
) -> Generator[TestClient, None, None]:
    app.dependency_overrides[admin_get_guest_repo] = lambda: mock_guest_repo
    app.dependency_overrides[public_get_guest_repo] = lambda: mock_guest_repo
    app.dependency_overrides[public_get_art_repo] = lambda: mock_art_repo
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Admin endpoints ───────────────────────────────────────────────────────────


class TestAdminGuestList:
    def test_200_returns_guests(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.list_all.return_value = [_make_guest()]
        resp = client.get("/api/admin/guests", cookies={"access_token": _make_token()})
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["name"] == "Mario Bianchi"

    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.get("/api/admin/guests")
        assert resp.status_code == 401

    def test_200_editor_can_list(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.list_all.return_value = []
        resp = client.get(
            "/api/admin/guests",
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 200


class TestAdminGuestCreate:
    def test_201_admin_can_create(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.add.return_value = None
        resp = client.post(
            "/api/admin/guests",
            json={"name": "Laura Rossi", "bio": "Atleta professionista."},
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Laura Rossi"

    def test_201_editor_can_create(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.add.return_value = None
        resp = client.post(
            "/api/admin/guests",
            json={"name": "Luca Verdi"},
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 201

    def test_401_unauthenticated(self, client: TestClient) -> None:
        resp = client.post("/api/admin/guests", json={"name": "X"})
        assert resp.status_code == 401


class TestAdminGuestGet:
    def test_200_returns_guest(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        guest = _make_guest()
        mock_guest_repo.get_by_id.return_value = guest
        resp = client.get(
            f"/api/admin/guests/{guest.id}",
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Mario Bianchi"

    def test_404_when_not_found(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.get_by_id.return_value = None
        resp = client.get(
            f"/api/admin/guests/{uuid.uuid4()}",
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 404


class TestAdminGuestUpdate:
    def test_200_updates_guest(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        guest = _make_guest()
        mock_guest_repo.get_by_id.return_value = guest
        mock_guest_repo.save.return_value = None
        resp = client.put(
            f"/api/admin/guests/{guest.id}",
            json={"name": "Mario Bianchi Jr"},
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 200

    def test_404_when_not_found(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.get_by_id.return_value = None
        resp = client.put(
            f"/api/admin/guests/{uuid.uuid4()}",
            json={"name": "X"},
            cookies={"access_token": _make_token()},
        )
        assert resp.status_code == 404

    def test_200_editor_can_update(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        guest = _make_guest()
        mock_guest_repo.get_by_id.return_value = guest
        mock_guest_repo.save.return_value = None
        resp = client.put(
            f"/api/admin/guests/{guest.id}",
            json={"bio": "Nuovo bio."},
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 200


class TestAdminGuestDelete:
    def test_204_admin_can_delete(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        guest = _make_guest()
        mock_guest_repo.get_by_id.return_value = guest
        mock_guest_repo.delete.return_value = None
        resp = client.delete(
            f"/api/admin/guests/{guest.id}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 204

    def test_204_editor_can_delete(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        guest = _make_guest()
        mock_guest_repo.get_by_id.return_value = guest
        mock_guest_repo.delete.return_value = None
        resp = client.delete(
            f"/api/admin/guests/{guest.id}",
            cookies={"access_token": _make_token(role="editor")},
        )
        assert resp.status_code == 204

    def test_404_when_not_found(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.get_by_id.return_value = None
        resp = client.delete(
            f"/api/admin/guests/{uuid.uuid4()}",
            cookies={"access_token": _make_token(role="admin")},
        )
        assert resp.status_code == 404


# ── Public endpoints ──────────────────────────────────────────────────────────


class TestPublicGuestList:
    def test_200_returns_guests(self, client: TestClient, mock_guest_repo: MagicMock) -> None:
        mock_guest_repo.list_all.return_value = [_make_guest("Mario Bianchi", "mario-bianchi")]
        resp = client.get("/api/guests")
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1
        assert resp.json()["items"][0]["slug"] == "mario-bianchi"


class TestPublicGuestWithArticles:
    def test_200_returns_guest_and_articles(
        self, client: TestClient, mock_guest_repo: MagicMock, mock_art_repo: MagicMock
    ) -> None:
        guest = _make_guest("Mario Bianchi", "mario-bianchi")
        mock_guest_repo.get_by_slug.return_value = guest
        mock_art_repo.list_published_by_guest.return_value = ([], 0)
        resp = client.get("/api/guests/mario-bianchi")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Mario Bianchi"
        assert data["articles"] == []
        assert data["total"] == 0

    def test_404_when_guest_not_found(
        self, client: TestClient, mock_guest_repo: MagicMock
    ) -> None:
        mock_guest_repo.get_by_slug.return_value = None
        resp = client.get("/api/guests/nonexistent")
        assert resp.status_code == 404
