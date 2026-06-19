"""Domain unit tests for User entity and related value objects."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.identity.entities import User
from app.domain.identity.exceptions import AccountLockedError
from app.domain.identity.value_objects import Email, UserRole


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _make_user(**kwargs: object) -> User:
    defaults: dict[str, object] = {
        "id": uuid.uuid4(),
        "email": Email("test@example.com"),
        "hashed_password": "hashed",
        "role": UserRole.editor,
        "is_active": True,
        "created_at": _now(),
        "failed_login_count": 0,
        "locked_until": None,
    }
    defaults.update(kwargs)
    return User(**defaults)  # type: ignore[arg-type]


class TestEmail:
    def test_valid_email_accepted(self) -> None:
        e = Email("user@example.com")
        assert e.value == "user@example.com"

    def test_missing_at_raises(self) -> None:
        with pytest.raises(ValueError):
            Email("notanemail")

    def test_equality(self) -> None:
        assert Email("a@b.com") == Email("a@b.com")

    def test_case_insensitive_stored_lowercase(self) -> None:
        e = Email("User@EXAMPLE.COM")
        assert e.value == "user@example.com"


class TestUserRole:
    def test_admin_and_editor_exist(self) -> None:
        assert UserRole.admin
        assert UserRole.editor

    def test_string_values(self) -> None:
        assert UserRole.admin.value == "admin"
        assert UserRole.editor.value == "editor"


class TestUserLockout:
    def test_not_locked_by_default(self) -> None:
        user = _make_user()
        assert not user.is_locked(_now())

    def test_locked_when_locked_until_in_future(self) -> None:
        user = _make_user(locked_until=_now() + timedelta(minutes=5))
        assert user.is_locked(_now())

    def test_not_locked_when_locked_until_in_past(self) -> None:
        user = _make_user(locked_until=_now() - timedelta(seconds=1))
        assert not user.is_locked(_now())

    def test_record_failed_login_increments_count(self) -> None:
        user = _make_user()
        user.record_failed_login(_now())
        assert user.failed_login_count == 1

    def test_10th_failure_sets_lockout(self) -> None:
        user = _make_user(failed_login_count=9)
        now = _now()
        user.record_failed_login(now)
        assert user.failed_login_count == 10
        assert user.locked_until is not None
        assert user.locked_until > now

    def test_lockout_duration_is_5_minutes(self) -> None:
        user = _make_user(failed_login_count=9)
        now = _now()
        user.record_failed_login(now)
        delta = user.locked_until - now  # type: ignore[operator]
        assert timedelta(minutes=4, seconds=59) < delta <= timedelta(minutes=5)

    def test_reset_on_success_clears_count_and_lockout(self) -> None:
        user = _make_user(
            failed_login_count=5,
            locked_until=_now() + timedelta(minutes=3),
        )
        user.record_successful_login()
        assert user.failed_login_count == 0
        assert user.locked_until is None

    def test_raise_if_locked_on_login_attempt(self) -> None:
        user = _make_user(locked_until=_now() + timedelta(minutes=5))
        with pytest.raises(AccountLockedError):
            user.assert_not_locked(_now())

    def test_no_raise_if_not_locked(self) -> None:
        user = _make_user()
        user.assert_not_locked(_now())  # must not raise
