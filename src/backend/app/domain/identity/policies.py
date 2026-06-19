import hashlib

from app.domain.identity.exceptions import PasswordTooShortError

_MIN_LENGTH = 12


class PasswordPolicy:
    @staticmethod
    def enforce_length(password: str) -> None:
        if len(password) < _MIN_LENGTH:
            raise PasswordTooShortError(
                f"Password must be at least {_MIN_LENGTH} characters long."
            )

    @staticmethod
    def sha1_prefix(password: str) -> tuple[str, str]:
        digest = hashlib.sha1(password.encode()).hexdigest().upper()
        return digest[:5], digest[5:]
