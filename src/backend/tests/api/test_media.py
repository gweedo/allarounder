"""Tests for POST /api/admin/media/sas."""

import base64
import uuid
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.main import app
from app.settings import get_settings

_settings = get_settings()
_SECRET = _settings.jwt_secret_key
_ALGO = _settings.jwt_algorithm

# Realistic magic bytes for various types
_JPEG_MAGIC = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * 490
)
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 490
_SVG_MAGIC = b"<svg xmlns='http://www.w3.org/2000/svg'>" + b"\x00" * 472
_TEXT_MAGIC = b"hello world" + b"\x00" * 500


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
def client() -> Generator[TestClient, None, None]:
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _sas_body(preview: bytes, size: int = 512, filename: str = "image.jpg") -> dict[str, object]:
    return {
        "filename": filename,
        "size": size,
        "preview": base64.b64encode(preview).decode(),
    }


class TestSasEndpoint:
    def test_401_without_token(self, client: TestClient) -> None:
        body = _sas_body(_JPEG_MAGIC)
        resp = client.post("/api/admin/media/sas", json=body)
        assert resp.status_code == 401

    def test_422_file_too_large(self, client: TestClient) -> None:
        token = _make_token()
        body = _sas_body(_JPEG_MAGIC, size=11 * 1024 * 1024)
        resp = client.post("/api/admin/media/sas", json=body, cookies={"access_token": token})
        assert resp.status_code == 422
        assert "too large" in resp.json()["detail"].lower()

    def test_422_svg_rejected(self, client: TestClient) -> None:
        token = _make_token()
        body = _sas_body(_SVG_MAGIC)
        resp = client.post("/api/admin/media/sas", json=body, cookies={"access_token": token})
        assert resp.status_code == 422

    def test_422_unknown_file_type(self, client: TestClient) -> None:
        token = _make_token()
        body = _sas_body(_TEXT_MAGIC)
        resp = client.post("/api/admin/media/sas", json=body, cookies={"access_token": token})
        assert resp.status_code == 422

    def test_200_jpeg_returns_sas_and_blob_url(self, client: TestClient) -> None:
        token = _make_token()
        body = _sas_body(_JPEG_MAGIC)
        with patch(
            "app.interfaces.api.admin.media.router.generate_sas",
            return_value=("https://storage.example.com/sas?sig=abc", "https://cdn.allarounder.it/images/img.jpg"),
        ):
            resp = client.post("/api/admin/media/sas", json=body, cookies={"access_token": token})
        assert resp.status_code == 200
        data = resp.json()
        assert "sas_url" in data
        assert "blob_url" in data
        assert "cdn.allarounder.it" in data["blob_url"]

    def test_200_png_accepted(self, client: TestClient) -> None:
        token = _make_token()
        body = _sas_body(_PNG_MAGIC, filename="image.png")
        with patch(
            "app.interfaces.api.admin.media.router.generate_sas",
            return_value=("https://storage.example.com/sas?sig=abc", "https://cdn.allarounder.it/images/img.png"),
        ):
            resp = client.post("/api/admin/media/sas", json=body, cookies={"access_token": token})
        assert resp.status_code == 200

    def test_503_when_storage_unavailable(self, client: TestClient) -> None:
        token = _make_token()
        body = _sas_body(_JPEG_MAGIC)
        with patch(
            "app.interfaces.api.admin.media.router.generate_sas",
            side_effect=Exception("connection refused"),
        ):
            resp = client.post("/api/admin/media/sas", json=body, cookies={"access_token": token})
        assert resp.status_code == 503
