"""Domain unit tests for RefreshToken entity."""

import uuid
from datetime import UTC, datetime, timedelta

from app.domain.identity.entities import RefreshToken


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _make_token(**kwargs: object) -> RefreshToken:
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "token_hash": "somehash",
        "expires_at": _now() + timedelta(days=14),
        "revoked_at": None,
    }
    defaults.update(kwargs)
    return RefreshToken(**defaults)  # type: ignore[arg-type]


class TestRefreshTokenValidity:
    def test_valid_token_is_active(self) -> None:
        token = _make_token()
        assert token.is_valid(_now())

    def test_expired_token_is_invalid(self) -> None:
        token = _make_token(expires_at=_now() - timedelta(seconds=1))
        assert not token.is_valid(_now())

    def test_revoked_token_is_invalid(self) -> None:
        token = _make_token(revoked_at=_now() - timedelta(hours=1))
        assert not token.is_valid(_now())

    def test_revoked_and_not_expired_is_still_invalid(self) -> None:
        token = _make_token(
            revoked_at=_now() - timedelta(minutes=1),
            expires_at=_now() + timedelta(days=10),
        )
        assert not token.is_valid(_now())
