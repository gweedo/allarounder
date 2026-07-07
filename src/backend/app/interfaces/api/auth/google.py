"""Google OIDC login/callback endpoints.

Both routes 404 when `google_sso_enabled` is off, via `_require_google_sso_enabled`
below — this keeps the feature mergeable and deployable before the Google Cloud
project / OAuth client actually exists (ADR-0017).
"""

import base64
import hashlib
import secrets
from typing import Annotated

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse, RedirectResponse

from app.application.identity.protocols import GoogleOidcClient
from app.application.identity.services import AuthService
from app.domain.identity.exceptions import (
    GoogleAccountMismatchError,
    InvalidCredentialsError,
    UserInactiveError,
)
from app.infrastructure.identity.google import GoogleTokenExchangeError, HttpGoogleOidcClient
from app.infrastructure.identity.tokens import JwtTokenIssuer
from app.interfaces.api.auth.dependencies import get_auth_service
from app.interfaces.api.auth.router import _now, _set_auth_cookies
from app.settings import Settings, get_settings

router = APIRouter(prefix="/api/admin/auth/google", tags=["auth"])

_OAUTH_STATE_COOKIE = "oauth_state"
_OAUTH_STATE_MAX_AGE = 10 * 60  # 10 minutes
_LOGIN_PAGE = "/admin/login"


def _require_google_sso_enabled(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Settings:
    if not settings.google_sso_enabled:
        # 404, not 403: when the feature is off there is nothing here to be
        # forbidden from — the Google Cloud project may not even exist yet.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return settings


def get_google_oidc_client(
    settings: Annotated[Settings, Depends(get_settings)],
) -> GoogleOidcClient:
    """FastAPI dependency provider — overridden with a fake in API tests so the
    routes never touch the network or a real Google client secret."""
    return HttpGoogleOidcClient(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri,
    )


def _code_challenge(verifier: str) -> str:
    """PKCE S256: base64url(sha256(verifier)), no padding."""
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _clear_state_cookie(response: Response) -> Response:
    response.delete_cookie(
        _OAUTH_STATE_COOKIE, path="/", httponly=True, secure=True, samesite="lax"
    )
    return response


def _error_redirect() -> RedirectResponse:
    return RedirectResponse(url=f"{_LOGIN_PAGE}?sso=error", status_code=status.HTTP_302_FOUND)


def _bad_request(detail: str) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": detail})


@router.get("/login")
async def google_login(
    settings: Annotated[Settings, Depends(_require_google_sso_enabled)],
    oidc: Annotated[GoogleOidcClient, Depends(get_google_oidc_client)],
) -> RedirectResponse:
    state = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    code_verifier = secrets.token_urlsafe(64)

    authorization_url = oidc.build_authorization_url(state, nonce, _code_challenge(code_verifier))

    # Sign the state/nonce/verifier bundle with the existing JWT issuer rather than
    # inventing a new crypto path — this cookie never needs decoding by anything
    # but this backend, so a signed JWT is a convenient tamper-evident envelope.
    issuer = JwtTokenIssuer(settings.jwt_secret_key, settings.jwt_algorithm)
    signed_state = issuer.encode(
        {"state": state, "nonce": nonce, "code_verifier": code_verifier}
    )

    redirect = RedirectResponse(url=authorization_url, status_code=status.HTTP_302_FOUND)
    # samesite=lax — NOT strict like the auth cookies. The callback below arrives as
    # a top-level cross-site navigation from accounts.google.com; a `strict` cookie
    # is never sent on a cross-site navigation, so a strict oauth_state cookie would
    # never reach the callback and state verification would always fail. `lax` still
    # sends the cookie on top-level GET navigations (exactly this case) while still
    # withholding it from cross-site subresource/XHR requests.
    redirect.set_cookie(
        _OAUTH_STATE_COOKIE,
        signed_state,
        max_age=_OAUTH_STATE_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return redirect


@router.get("/callback")
async def google_callback(
    settings: Annotated[Settings, Depends(_require_google_sso_enabled)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
    oidc: Annotated[GoogleOidcClient, Depends(get_google_oidc_client)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    oauth_state: Annotated[str | None, Cookie(alias="oauth_state")] = None,
) -> Response:
    if error is not None:
        # Google-side error (e.g. the writer clicked "Cancel" -> error=access_denied).
        return _clear_state_cookie(_error_redirect())

    if oauth_state is None or state is None or code is None:
        return _clear_state_cookie(_bad_request("Missing OAuth state or authorization code"))

    try:
        payload = jwt.decode(
            oauth_state, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return _clear_state_cookie(_bad_request("Invalid OAuth state"))

    if not secrets.compare_digest(str(payload.get("state", "")), state):
        return _clear_state_cookie(_bad_request("OAuth state mismatch"))

    try:
        identity = oidc.exchange_code(code, payload["code_verifier"], payload["nonce"])
    except GoogleTokenExchangeError:
        return _clear_state_cookie(_error_redirect())

    try:
        tokens = auth.login_with_google(identity, _now())
    except (InvalidCredentialsError, UserInactiveError, GoogleAccountMismatchError):
        return _clear_state_cookie(_error_redirect())

    redirect = RedirectResponse(
        url=f"{_LOGIN_PAGE}?sso=success", status_code=status.HTTP_302_FOUND
    )
    # These are the normal samesite=strict auth cookies (_set_auth_cookies, shared
    # with the password login flow). Set-Cookie on a response is not itself subject
    # to SameSite — only whether the cookie is *sent* on a later request is — so the
    # browser stores them here even though this response is part of a cross-site
    # redirect chain from Google. The login page then does a same-site client-side
    # navigation to /admin, which *does* send them, completing the sign-in.
    _set_auth_cookies(redirect, tokens["access_token"], tokens["refresh_token"], True)
    return _clear_state_cookie(redirect)
