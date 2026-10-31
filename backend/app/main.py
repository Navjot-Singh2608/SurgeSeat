import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.db import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # On shutdown, close all pooled connections cleanly.
    await engine.dispose()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    """Liveness: the process is up. Never checks dependencies,
    otherwise a database outage would make every instance look dead."""
    return {"status": "ok"}


async def _check_postgres() -> None:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


@app.get("/ready")
async def ready():
    """Readiness: can this instance serve real traffic right now?
    Load balancers use this to decide whether to send requests here."""
    try:
        await asyncio.wait_for(_check_postgres(), timeout=2)
    except Exception:
        return JSONResponse(status_code=503, content={"status": "unavailable", "postgres": "down"})
    return {"status": "ready", "postgres": "up"}