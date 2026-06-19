"""Protocols for external dependencies injected into the application layer."""

from typing import Any, Protocol


class PasswordHasher(Protocol):
    def hash(self, plain: str) -> str: ...
    def verify(self, plain: str, hashed: str) -> bool: ...


class BreachedPasswordChecker(Protocol):
    def is_breached(self, password: str) -> bool: ...


class TokenIssuer(Protocol):
    def encode(self, payload: dict[str, Any]) -> str: ...
