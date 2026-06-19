"""Domain unit tests for PasswordPolicy — no I/O."""

import pytest

from app.domain.identity.exceptions import PasswordTooShortError
from app.domain.identity.policies import PasswordPolicy


class TestPasswordLengthRule:
    def test_accepts_exactly_12_chars(self) -> None:
        PasswordPolicy.enforce_length("a" * 12)  # must not raise

    def test_accepts_more_than_12_chars(self) -> None:
        PasswordPolicy.enforce_length("supersecurepassword!")  # must not raise

    def test_rejects_11_chars(self) -> None:
        with pytest.raises(PasswordTooShortError):
            PasswordPolicy.enforce_length("short12345!")

    def test_rejects_empty(self) -> None:
        with pytest.raises(PasswordTooShortError):
            PasswordPolicy.enforce_length("")

    def test_error_message_mentions_minimum(self) -> None:
        with pytest.raises(PasswordTooShortError, match="12"):
            PasswordPolicy.enforce_length("tooshort")


class TestSha1Prefix:
    def test_returns_5_char_prefix_and_suffix(self) -> None:
        prefix, suffix = PasswordPolicy.sha1_prefix("password")
        assert len(prefix) == 5
        assert len(prefix) + len(suffix) == 40

    def test_prefix_is_uppercase_hex(self) -> None:
        prefix, _ = PasswordPolicy.sha1_prefix("any_password")
        assert prefix == prefix.upper()
        assert all(c in "0123456789ABCDEF" for c in prefix)

    def test_known_value(self) -> None:
        # SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
        prefix, suffix = PasswordPolicy.sha1_prefix("password")
        assert prefix == "5BAA6"
        assert suffix == "1E4C9B93F3F0682250B6CF8331B7EE68FD8"
