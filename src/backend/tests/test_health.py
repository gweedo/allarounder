from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.interfaces.api.auth.dependencies import get_db_session
from app.main import app


def _ok_session():
    yield MagicMock()


def _failing_session():
    mock = MagicMock()
    mock.execute.side_effect = Exception("connection refused")
    yield mock


def test_health_returns_ok():
    app.dependency_overrides[get_db_session] = _ok_session
    client = TestClient(app)
    response = client.get("/api/health")
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_returns_503_when_db_unreachable():
    app.dependency_overrides[get_db_session] = _failing_session
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/health")
    app.dependency_overrides.clear()
    assert response.status_code == 503
