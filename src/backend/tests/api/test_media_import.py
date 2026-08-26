"""Tests for POST /api/admin/media/import."""

import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import httpx
import jwt
import pytest
from fastapi.testclient import TestClient

from app.infrastructure.media.blob_storage import import_external_image
from app.main import app
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm

# Reuse the same realistic magic bytes as test_media.py.
_JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * 490
)
_TEXT_BYTES = b"hello world, not an image" + b"\x00" * 480


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


@pytest.fixture()
def client() -> Generator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _mock_stream_response(
    status_code: int = 200,
    headers: dict[str, str] | None = None,
    chunks: list[bytes] | None = None,
) -> MagicMock:
    """Build a mock standing in for the `with httpx.stream(...) as response:` context manager."""
    response = MagicMock()
    response.status_code = status_code
    response.headers = headers or {}
    response.iter_bytes.return_value = chunks or []
    cm = MagicMock()
    cm.__enter__.return_value = response
    cm.__exit__.return_value = False
    return cm


def _import_body(url: str = "https://lh7-us.googleusercontent.com/abc") -> dict[str, str]:
    return {"url": url}


class TestImportEndpoint:
    def test_401_without_token(self, client: TestClient) -> None:
        resp = client.post("/api/admin/media/import", json=_import_body())
        assert resp.status_code == 401

    def test_200_happy_path_returns_blob_url(self, client: TestClient) -> None:
        token = _make_token()
        stream_cm = _mock_stream_response(
            status_code=200,
            headers={"content-length": str(len(_JPEG_BYTES))},
            chunks=[_JPEG_BYTES],
        )
        with (
            patch(
                "app.infrastructure.media.blob_storage.httpx.stream",
                return_value=stream_cm,
            ),
            patch(
                "app.infrastructure.media.blob_storage.generate_sas",
                return_value=(
                    "https://storage.example.com/sas?sig=abc",
                    "https://cdn.allarounder.it/images/imported.jpg",
                ),
            ),
            patch(
                "app.infrastructure.media.blob_storage.httpx.put",
                return_value=httpx.Response(201, request=httpx.Request("PUT", "https://storage.example.com")),
            ),
        ):
            resp = client.post(
                "/api/admin/media/import",
                json=_import_body(),
                cookies={"access_token": token},
            )
        assert resp.status_code == 200
        assert resp.json() == {"blob_url": "https://cdn.allarounder.it/images/imported.jpg"}

    def test_422_oversized_content_length_without_downloading_body(
        self, client: TestClient
    ) -> None:
        token = _make_token()
        stream_cm = _mock_stream_response(
            status_code=200,
            headers={"content-length": str(11 * 1024 * 1024)},
        )
        with patch(
            "app.infrastructure.media.blob_storage.httpx.stream",
            return_value=stream_cm,
        ):
            resp = client.post(
                "/api/admin/media/import",
                json=_import_body(),
                cookies={"access_token": token},
            )
        assert resp.status_code == 422
        assert "too large" in resp.json()["detail"].lower()
        # The oversized Content-Length must short-circuit before any body
        # bytes are read.
        stream_cm.__enter__.return_value.iter_bytes.assert_not_called()

    def test_422_non_image_bytes(self, client: TestClient) -> None:
        token = _make_token()
        stream_cm = _mock_stream_response(
            status_code=200,
            headers={"content-length": str(len(_TEXT_BYTES))},
            chunks=[_TEXT_BYTES],
        )
        with patch(
            "app.infrastructure.media.blob_storage.httpx.stream",
            return_value=stream_cm,
        ):
            resp = client.post(
                "/api/admin/media/import",
                json=_import_body(),
                cookies={"access_token": token},
            )
        assert resp.status_code == 422

    def test_502_upstream_404(self, client: TestClient) -> None:
        token = _make_token()
        stream_cm = _mock_stream_response(status_code=404)
        with patch(
            "app.infrastructure.media.blob_storage.httpx.stream",
            return_value=stream_cm,
        ):
            resp = client.post(
                "/api/admin/media/import",
                json=_import_body(),
                cookies={"access_token": token},
            )
        assert resp.status_code == 502

    def test_502_upstream_connection_error(self, client: TestClient) -> None:
        token = _make_token()
        with patch(
            "app.infrastructure.media.blob_storage.httpx.stream",
            side_effect=httpx.ConnectError("connection refused"),
        ):
            resp = client.post(
                "/api/admin/media/import",
                json=_import_body(),
                cookies={"access_token": token},
            )
        assert resp.status_code == 502

    def test_503_when_blob_upload_fails(self, client: TestClient) -> None:
        token = _make_token()
        stream_cm = _mock_stream_response(
            status_code=200,
            headers={"content-length": str(len(_JPEG_BYTES))},
            chunks=[_JPEG_BYTES],
        )
        with (
            patch(
                "app.infrastructure.media.blob_storage.httpx.stream",
                return_value=stream_cm,
            ),
            patch(
                "app.infrastructure.media.blob_storage.generate_sas",
                return_value=(
                    "https://storage.example.com/sas?sig=abc",
                    "https://cdn.allarounder.it/images/imported.jpg",
                ),
            ),
            patch(
                "app.infrastructure.media.blob_storage.httpx.put",
                side_effect=httpx.ConnectError("connection refused"),
            ),
        ):
            resp = client.post(
                "/api/admin/media/import",
                json=_import_body(),
                cookies={"access_token": token},
            )
        assert resp.status_code == 503

    def test_503_when_sas_generation_fails(self, client: TestClient) -> None:
        token = _make_token()
        stream_cm = _mock_stream_response(
            status_code=200,
            headers={"content-length": str(len(_JPEG_BYTES))},
            chunks=[_JPEG_BYTES],
        )
        with (
            patch(
                "app.infrastructure.media.blob_storage.httpx.stream",
                return_value=stream_cm,
            ),
            patch(
                "app.infrastructure.media.blob_storage.generate_sas",
                side_effect=Exception("connection refused"),
            ),
        ):
            resp = client.post(
                "/api/admin/media/import",
                json=_import_body(),
                cookies={"access_token": token},
            )
        assert resp.status_code == 503


class TestImportExternalImageUnit:
    """Direct unit coverage for the scheme guard, which the ImportRequest's
    HttpUrl field already enforces at the API boundary (only http/https parse
    successfully there) — kept as defense in depth for any other caller."""

    def test_rejects_non_http_scheme(self) -> None:
        with pytest.raises(ValueError, match="http/https"):
            import_external_image(url="ftp://example.com/image.jpg", settings=_settings)
