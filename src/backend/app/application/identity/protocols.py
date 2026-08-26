"""Protocols for external dependencies injected into the application layer."""

from dataclasses import dataclass
from typing import Any, Protocol


class PasswordHasher(Protocol):
    def hash(self, plain: str) -> str: ...
    def verify(self, plain: str, hashed: str) -> bool: ...


class BreachedPasswordChecker(Protocol):
    def is_breached(self, password: str) -> bool: ...


class TokenIssuer(Protocol):
    def encode(self, payload: dict[str, Any]) -> str: ...


@dataclass(frozen=True)
class OidcIdentity:
    """The verified result of a completed OIDC authorization-code exchange."""

    sub: str
    email: str
    email_verified: bool


class GoogleOidcClient(Protocol):
    """Talks to Google's OIDC endpoints. Token exchange and id_token signature/claim
    verification are kept as a single infrastructure concern behind this protocol —
    the application layer only ever sees an already-verified OidcIdentity."""

    def build_authorization_url(self, state: str, nonce: str, code_challenge: str) -> str: ...
    def exchange_code(self, code: str, code_verifier: str, nonce: str) -> OidcIdentity: ...
