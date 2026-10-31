import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken


async def create(
    session: AsyncSession, user_id: uuid.UUID, token_hash: str, family_id: uuid.UUID, expires_at: datetime
) -> None:
    session.add(
        RefreshToken(user_id=user_id, token_hash=token_hash, family_id=family_id, expires_at=expires_at)
    )
    await session.flush()


async def get_by_hash_for_update(session: AsyncSession, token_hash: str) -> RefreshToken | None:
    # FOR UPDATE locks the row: if two requests use the same token at the same moment,
    # the second one waits and then sees it already revoked.
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
    )
    return result.scalar_one_or_none()


async def revoke_family(session: AsyncSession, family_id: uuid.UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
