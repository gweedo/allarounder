"""Unit tests for Settings validation — Google SSO config gate."""

import pytest

from app.settings import Settings


class TestGoogleSsoConfigValidation:
    def test_disabled_by_default_with_no_config_required(self) -> None:
        settings = Settings(_env_file=None)  # type: ignore[call-arg]
        assert settings.google_sso_enabled is False

    def test_enabled_without_client_id_raises(self) -> None:
        with pytest.raises(ValueError, match="GOOGLE_CLIENT_ID"):
            Settings(  # type: ignore[call-arg]
                _env_file=None,
                google_sso_enabled=True,
                google_client_secret="secret",
                google_redirect_uri="https://example.com/callback",
            )

    def test_enabled_without_client_secret_raises(self) -> None:
        with pytest.raises(ValueError, match="GOOGLE_CLIENT_ID"):
            Settings(  # type: ignore[call-arg]
                _env_file=None,
                google_sso_enabled=True,
                google_client_id="client-id",
                google_redirect_uri="https://example.com/callback",
            )

    def test_enabled_without_redirect_uri_raises(self) -> None:
        with pytest.raises(ValueError, match="GOOGLE_CLIENT_ID"):
            Settings(  # type: ignore[call-arg]
                _env_file=None,
                google_sso_enabled=True,
                google_client_id="client-id",
                google_client_secret="secret",
            )

    def test_enabled_with_full_config_is_valid(self) -> None:
        settings = Settings(  # type: ignore[call-arg]
            _env_file=None,
            google_sso_enabled=True,
            google_client_id="client-id",
            google_client_secret="secret",
            google_redirect_uri="https://example.com/callback",
        )
        assert settings.google_sso_enabled is True
