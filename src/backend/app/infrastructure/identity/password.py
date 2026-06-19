"""Argon2 implementation of PasswordHasher."""

from argon2 import PasswordHasher as Argon2Hasher
from argon2.exceptions import VerifyMismatchError

_hasher = Argon2Hasher()


class Argon2PasswordHasher:
    def hash(self, plain: str) -> str:
        return _hasher.hash(plain)

    def verify(self, plain: str, hashed: str) -> bool:
        try:
            return _hasher.verify(hashed, plain)
        except VerifyMismatchError:
            return False
