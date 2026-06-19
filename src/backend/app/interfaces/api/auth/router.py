"""Auth endpoints: login, refresh, logout."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.application.identity.services import AuthService
from app.domain.identity.exceptions import (
    AccountLockedError,
    InvalidCredentialsError,
    TokenExpiredError,
    TokenRevokedError,
    UserInactiveError,
)
from app.interfaces.api.auth.dependencies import get_auth_service
from app.interfaces.api.auth.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/api/admin/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)

_ACCESS_MAX_AGE = 30 * 60          # 30 min in seconds
_REFRESH_MAX_AGE = 14 * 24 * 3600  # 14 days in seconds


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    response.set_cookie(
        "access_token",
        access_token,
        max_age=_ACCESS_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=_REFRESH_MAX_AGE,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/", httponly=True, secure=True, samesite="strict")
    response.delete_cookie("refresh_token", path="/", httponly=True, secure=True, samesite="strict")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    try:
        tokens = auth.login(body.email, body.password, _now())
    except AccountLockedError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked due to too many failed attempts",
        )
    except UserInactiveError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled"
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    _set_auth_cookies(response, tokens["access_token"], tokens["refresh_token"])
    return TokenResponse()


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(
    request: Request,
    response: Response,
    auth: Annotated[AuthService, Depends(get_auth_service)],
    refresh_token: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> TokenResponse:
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token"
        )
    try:
        tokens = auth.refresh(refresh_token, _now())
    except (TokenExpiredError, TokenRevokedError, InvalidCredentialsError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalid or expired",
        )
    _set_auth_cookies(response, tokens["access_token"], tokens["refresh_token"])
    return TokenResponse()


@router.post("/logout", response_model=TokenResponse)
async def logout(
    request: Request,
    response: Response,
    auth: Annotated[AuthService, Depends(get_auth_service)],
    refresh_token: Annotated[str | None, Cookie(alias="refresh_token")] = None,
) -> TokenResponse:
    if refresh_token is not None:
        auth.logout(refresh_token, _now())
    _clear_auth_cookies(response)
    return TokenResponse()
