"""Infrastructure tests for HttpGoogleOidcClient.

id_token verification is tested against a locally generated RSA keypair (no
network calls to Google) by injecting a fake jwk_client whose
`get_signing_key_from_jwt` returns our test public key — this exercises the
exact signature/claims verification path used in production without depending
on Google's live JWKS endpoint.
"""

import time
from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.infrastructure.identity.google import GoogleTokenExchangeError, HttpGoogleOidcClient

_CLIENT_ID = "test-client-id.apps.googleusercontent.com"
_CLIENT_SECRET = "test-client-secret"
_REDIRECT_URI = "http://localhost:3000/api/admin/auth/google/callback"


@dataclass
class _FakeSigningKey:
    key: object


class _FakeJwkClient:
    def __init__(self, public_key: object) -> None:
        self._public_key = public_key

    def get_signing_key_from_jwt(self, token: str) -> _FakeSigningKey:
        return _FakeSigningKey(key=self._public_key)


@pytest.fixture(scope="module")
def rsa_keypair() -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return private_key, private_key.public_key()


def _make_id_token(
    private_key: rsa.RSAPrivateKey,
    *,
    sub: str = "google-sub-123",
    email: str = "editor@example.com",
    email_verified: bool = True,
    aud: str = _CLIENT_ID,
    iss: str = "https://accounts.google.com",
    nonce: str = "expected-nonce",
    exp_delta: int = 3600,
) -> str:
    now = int(time.time())
    payload = {
        "iss": iss,
        "aud": aud,
        "sub": sub,
        "email": email,
        "email_verified": email_verified,
        "nonce": nonce,
        "iat": now,
        "exp": now + exp_delta,
    }
    return jwt.encode(payload, private_key, algorithm="RS256")


def _client_with_token_response(
    jwk_client: _FakeJwkClient, id_token: str
) -> HttpGoogleOidcClient:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"id_token": id_token, "access_token": "unused"})

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    return HttpGoogleOidcClient(
        client_id=_CLIENT_ID,
        client_secret=_CLIENT_SECRET,
        redirect_uri=_REDIRECT_URI,
        jwk_client=jwk_client,  # type: ignore[arg-type]
        http_client=http_client,
    )


class TestBuildAuthorizationUrl:
    def test_url_points_at_google(self) -> None:
        client = HttpGoogleOidcClient(
            client_id=_CLIENT_ID, client_secret=_CLIENT_SECRET, redirect_uri=_REDIRECT_URI
        )
        url = client.build_authorization_url("state-1", "nonce-1", "challenge-1")
        parsed = urlparse(url)
        assert parsed.netloc == "accounts.google.com"
        assert parsed.path == "/o/oauth2/v2/auth"

    def test_url_contains_pkce_and_state_params(self) -> None:
        client = HttpGoogleOidcClient(
            client_id=_CLIENT_ID, client_secret=_CLIENT_SECRET, redirect_uri=_REDIRECT_URI
        )
        url = client.build_authorization_url("state-1", "nonce-1", "challenge-1")
        params = parse_qs(urlparse(url).query)
        assert params["client_id"] == [_CLIENT_ID]
        assert params["redirect_uri"] == [_REDIRECT_URI]
        assert params["response_type"] == ["code"]
        assert params["scope"] == ["openid email"]
        assert params["state"] == ["state-1"]
        assert params["nonce"] == ["nonce-1"]
        assert params["code_challenge"] == ["challenge-1"]
        assert params["code_challenge_method"] == ["S256"]


class TestExchangeCode:
    def test_valid_id_token_returns_identity(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        private_key, public_key = rsa_keypair
        id_token = _make_id_token(private_key, nonce="expected-nonce")
        client = _client_with_token_response(_FakeJwkClient(public_key), id_token)

        identity = client.exchange_code("auth-code", "verifier", "expected-nonce")

        assert identity.sub == "google-sub-123"
        assert identity.email == "editor@example.com"
        assert identity.email_verified is True

    def test_unverified_email_is_surfaced(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        private_key, public_key = rsa_keypair
        id_token = _make_id_token(private_key, email_verified=False, nonce="expected-nonce")
        client = _client_with_token_response(_FakeJwkClient(public_key), id_token)

        identity = client.exchange_code("auth-code", "verifier", "expected-nonce")

        assert identity.email_verified is False

    def test_wrong_audience_is_rejected(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        private_key, public_key = rsa_keypair
        id_token = _make_id_token(
            private_key, aud="someone-elses-client-id", nonce="expected-nonce"
        )
        client = _client_with_token_response(_FakeJwkClient(public_key), id_token)

        with pytest.raises(GoogleTokenExchangeError):
            client.exchange_code("auth-code", "verifier", "expected-nonce")

    def test_wrong_issuer_is_rejected(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        private_key, public_key = rsa_keypair
        id_token = _make_id_token(
            private_key, iss="https://evil.example.com", nonce="expected-nonce"
        )
        client = _client_with_token_response(_FakeJwkClient(public_key), id_token)

        with pytest.raises(GoogleTokenExchangeError):
            client.exchange_code("auth-code", "verifier", "expected-nonce")

    def test_expired_token_is_rejected(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        private_key, public_key = rsa_keypair
        id_token = _make_id_token(private_key, exp_delta=-3600, nonce="expected-nonce")
        client = _client_with_token_response(_FakeJwkClient(public_key), id_token)

        with pytest.raises(GoogleTokenExchangeError):
            client.exchange_code("auth-code", "verifier", "expected-nonce")

    def test_nonce_mismatch_is_rejected(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        private_key, public_key = rsa_keypair
        id_token = _make_id_token(private_key, nonce="actual-nonce")
        client = _client_with_token_response(_FakeJwkClient(public_key), id_token)

        with pytest.raises(GoogleTokenExchangeError, match="nonce"):
            client.exchange_code("auth-code", "verifier", "expected-nonce-that-differs")

    def test_signature_from_wrong_key_is_rejected(
        self, rsa_keypair: tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]
    ) -> None:
        private_key, _ = rsa_keypair
        other_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        id_token = _make_id_token(private_key, nonce="expected-nonce")
        # Verify against the *other* keypair's public key — signature must not validate.
        client = _client_with_token_response(
            _FakeJwkClient(other_private_key.public_key()), id_token
        )

        with pytest.raises(GoogleTokenExchangeError):
            client.exchange_code("auth-code", "verifier", "expected-nonce")

    def test_token_endpoint_http_error_is_wrapped(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(400, json={"error": "invalid_grant"})

        http_client = httpx.Client(transport=httpx.MockTransport(handler))
        client = HttpGoogleOidcClient(
            client_id=_CLIENT_ID,
            client_secret=_CLIENT_SECRET,
            redirect_uri=_REDIRECT_URI,
            http_client=http_client,
        )

        with pytest.raises(GoogleTokenExchangeError):
            client.exchange_code("bad-code", "verifier", "nonce")

    def test_missing_id_token_in_response_is_rejected(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"access_token": "unused"})

        http_client = httpx.Client(transport=httpx.MockTransport(handler))
        client = HttpGoogleOidcClient(
            client_id=_CLIENT_ID,
            client_secret=_CLIENT_SECRET,
            redirect_uri=_REDIRECT_URI,
            http_client=http_client,
        )

        with pytest.raises(GoogleTokenExchangeError, match="id_token"):
            client.exchange_code("auth-code", "verifier", "nonce")
