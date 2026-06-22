"""Unit tests for real-IP resolution behind Azure Front Door."""

from unittest.mock import MagicMock, patch

from app.main import _get_real_ip


def _make_request(forwarded_for: str | None = None, client_host: str = "10.0.0.1") -> MagicMock:
    request = MagicMock()
    request.client.host = client_host
    headers: dict[str, str] = {}
    if forwarded_for is not None:
        headers["X-Forwarded-For"] = forwarded_for
    request.headers = headers
    return request


class TestGetRealIp:
    def test_returns_direct_ip_when_trust_disabled(self) -> None:
        request = _make_request(forwarded_for="1.2.3.4", client_host="10.0.0.1")
        with patch("app.main.settings") as mock_settings:
            mock_settings.trust_forwarded_for = False
            mock_settings.cors_allowed_origins = "http://localhost:3000"
            result = _get_real_ip(request)
        assert result == "10.0.0.1"

    def test_returns_forwarded_ip_when_trust_enabled(self) -> None:
        request = _make_request(forwarded_for="1.2.3.4, 10.0.0.1", client_host="10.0.0.1")
        with patch("app.main.settings") as mock_settings:
            mock_settings.trust_forwarded_for = True
            result = _get_real_ip(request)
        assert result == "1.2.3.4"

    def test_falls_back_to_direct_ip_when_header_absent(self) -> None:
        request = _make_request(forwarded_for=None, client_host="10.0.0.1")
        with patch("app.main.settings") as mock_settings:
            mock_settings.trust_forwarded_for = True
            result = _get_real_ip(request)
        assert result == "10.0.0.1"

    def test_strips_whitespace_from_forwarded_ip(self) -> None:
        request = _make_request(forwarded_for="  5.6.7.8  , 10.0.0.1")
        with patch("app.main.settings") as mock_settings:
            mock_settings.trust_forwarded_for = True
            result = _get_real_ip(request)
        assert result == "5.6.7.8"
