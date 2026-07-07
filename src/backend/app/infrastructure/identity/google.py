"""Google OIDC client — infrastructure implementation of GoogleOidcClient.

Token exchange and id_token verification are kept together deliberately: both
are one infrastructure concern (talk to Google, verify what it hands back).
The application layer only ever sees an already-verified OidcIdentity — it
never touches a raw id_token or JWKS endpoint.
"""

from urllib.parse import urlencode

import httpx
import jwt
from jwt import PyJWKClient

from app.application.identity.protocols import OidcIdentity

AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_VALID_ISSUERS = ("https://accounts.google.com", "accounts.google.com")


class GoogleTokenExchangeError(Exception):
    """Raised when Google's token endpoint call or id_token verification fails."""


class HttpGoogleOidcClient:
    def __init__(
        self,
        *,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        jwk_client: PyJWKClient | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri
        # Injectable for tests — real signature verification against Google's live
        # JWKS endpoint would make unit tests dependent on the network.
        self._jwk_client = jwk_client or PyJWKClient(JWKS_URL)
        self._http = http_client or httpx.Client(timeout=10.0)

    def build_authorization_url(self, state: str, nonce: str, code_challenge: str) -> str:
        params = {
            "client_id": self._client_id,
            "redirect_uri": self._redirect_uri,
            "response_type": "code",
            "scope": "openid email",
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return f"{AUTHORIZATION_ENDPOINT}?{urlencode(params)}"

    def exchange_code(self, code: str, code_verifier: str, nonce: str) -> OidcIdentity:
        try:
            response = self._http.post(
                TOKEN_ENDPOINT,
                data={
                    "code": code,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "redirect_uri": self._redirect_uri,
                    "grant_type": "authorization_code",
                    "code_verifier": code_verifier,
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise GoogleTokenExchangeError(f"Token exchange request failed: {exc}") from exc

        id_token = response.json().get("id_token")
        if not id_token:
            raise GoogleTokenExchangeError("Token response did not contain an id_token")

        return self._verify_id_token(id_token, nonce)

    def _verify_id_token(self, id_token: str, expected_nonce: str) -> OidcIdentity:
        try:
            signing_key = self._jwk_client.get_signing_key_from_jwt(id_token)
            claims = jwt.decode(
                id_token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self._client_id,
                options={"require": ["exp", "iat", "sub"]},
            )
        except jwt.PyJWTError as exc:
            raise GoogleTokenExchangeError(f"id_token signature/claims invalid: {exc}") from exc

        if claims.get("iss") not in _VALID_ISSUERS:
            raise GoogleTokenExchangeError(f"Unexpected id_token issuer: {claims.get('iss')!r}")

        if claims.get("nonce") != expected_nonce:
            raise GoogleTokenExchangeError("id_token nonce does not match — possible replay")

        return OidcIdentity(
            sub=str(claims["sub"]),
            email=str(claims.get("email", "")),
            email_verified=bool(claims.get("email_verified", False)),
        )
