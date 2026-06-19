"""JWT token issuer — infrastructure implementation of TokenIssuer."""

from typing import Any

from jose import jwt


class JoseTokenIssuer:
    def __init__(self, secret: str, algorithm: str) -> None:
        self._secret = secret
        self._algo = algorithm

    def encode(self, payload: dict[str, Any]) -> str:
        token: str = jwt.encode(payload, self._secret, algorithm=self._algo)
        return token
