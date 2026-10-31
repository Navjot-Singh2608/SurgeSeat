from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.core.db import get_session
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenOut, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
COOKIE_PATH = "/api/v1/auth"  # the browser only sends the cookie to auth endpoints


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        max_age=settings.refresh_token_days * 24 * 3600,
        httponly=True,        # JavaScript can't read it, so injected scripts can't steal it
        secure=settings.cookie_secure,  # HTTPS only (in production)
        samesite="strict",    # not sent on requests from other websites (CSRF protection)
        path=COOKIE_PATH,
    )


def _token_response(response: Response, tokens: auth_service.TokenPair) -> TokenOut:
    _set_refresh_cookie(response, tokens.refresh_token)
    return TokenOut(access_token=tokens.access_token, expires_in=settings.access_token_minutes * 60)


def _invalid_session() -> JSONResponse:
    # Returned (not raised) so the "delete cookie" instruction reaches the browser.
    resp = JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": {"code": "UNAUTHORIZED", "message": "Session expired. Please log in again."}},
    )
    resp.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
    return resp


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    try:
        return await auth_service.register_user(session, body.email, body.password)
    except auth_service.EmailTakenError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_TAKEN", "message": "An account with this email already exists."},
        )


@router.post("/login", response_model=TokenOut)
async def login(body: LoginRequest, response: Response, session: AsyncSession = Depends(get_session)):
    try:
        tokens = await auth_service.login(session, body.email, body.password)
    except auth_service.InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Incorrect email or password."},
        )
    return _token_response(response, tokens)


@router.post("/refresh", response_model=TokenOut, responses={401: {"description": "Invalid or expired session"}})
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
):
    try:
        tokens = await auth_service.refresh(session, refresh_token)
    except auth_service.InvalidRefreshTokenError:
        return _invalid_session()
    return _token_response(response, tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
):
    await auth_service.logout(session, refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user
