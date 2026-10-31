import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_refresh_token,
    verify_password,
)
from app.models.user import User
from app.repositories import token_repo, user_repo


class EmailTakenError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class InvalidRefreshTokenError(Exception):
    pass


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str  # raw value: goes into the cookie, never into the database


async def register_user(session: AsyncSession, email: str, password: str) -> User:
    email = email.strip().lower()

    # Hashing takes ~50 ms of CPU. Running it in a thread keeps the async event loop
    # free to serve other requests meanwhile.
    password_hash = await run_in_threadpool(hash_password, password)

    # No "does this email exist?" check first: two requests could both see "no".
    # The UNIQUE constraint in PostgreSQL is the real guard; we just translate its error.
    try:
        user = await user_repo.create_user(session, email, password_hash)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "uq_users_email" in str(exc.orig):
            raise EmailTakenError from exc
        raise
    return user


async def _issue_tokens(session: AsyncSession, user: User, family_id: uuid.UUID) -> TokenPair:
    refresh = new_refresh_token()
    await token_repo.create(
        session,
        user_id=user.id,
        token_hash=hash_token(refresh),
        family_id=family_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_days),
    )
    return TokenPair(access_token=create_access_token(user.id, user.role), refresh_token=refresh)


async def login(session: AsyncSession, email: str, password: str) -> TokenPair:
    user = await user_repo.get_user_by_email(session, email.strip().lower())

    # Always verify, even if the user doesn't exist, so both cases take the same time.
    ok = await run_in_threadpool(verify_password, user.password_hash if user else None, password)
    if not user or not ok:
        raise InvalidCredentialsError  # same error for "no such email" and "wrong password"

    tokens = await _issue_tokens(session, user, family_id=uuid.uuid4())  # new login = new family
    await session.commit()
    return tokens


async def refresh(session: AsyncSession, raw_token: str | None) -> TokenPair:
    """Rotation: each refresh token works exactly once and is replaced by a new one."""
    if not raw_token:
        raise InvalidRefreshTokenError

    stored = await token_repo.get_by_hash_for_update(session, hash_token(raw_token))
    if stored is None:
        raise InvalidRefreshTokenError

    if stored.revoked_at is not None:
        # An already-used token came back: someone may have stolen it.
        # Log out every session from that login, to be safe.
        await token_repo.revoke_family(session, stored.family_id)
        await session.commit()
        raise InvalidRefreshTokenError

    if stored.expires_at <= datetime.now(timezone.utc):
        raise InvalidRefreshTokenError

    user = await user_repo.get_user_by_id(session, stored.user_id)
    if user is None:
        raise InvalidRefreshTokenError

    stored.revoked_at = datetime.now(timezone.utc)  # use it up
    tokens = await _issue_tokens(session, user, family_id=stored.family_id)
    await session.commit()
    return tokens


async def logout(session: AsyncSession, raw_token: str | None) -> None:
    if not raw_token:
        return
    stored = await token_repo.get_by_hash_for_update(session, hash_token(raw_token))
    if stored is not None:
        await token_repo.revoke_family(session, stored.family_id)
        await session.commit()
