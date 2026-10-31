from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings

# One engine (and one connection pool) per process, created at import time.
engine = create_async_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,  # detect dead connections (e.g. after Postgres restarts)
    pool_timeout=5,      # wait at most 5 s for a free connection
    connect_args={
        "timeout": 5,                                       # give up connecting after 5 s
        "server_settings": {"statement_timeout": "5000"},  # Postgres stops any query over 5 s
    },
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session():
    """FastAPI dependency: one session per request, always closed afterwards."""
    async with SessionLocal() as session:
        yield session