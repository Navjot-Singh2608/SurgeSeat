from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All configuration comes from environment variables.
    The same image can run anywhere (laptop, 3 replicas, Kubernetes) without code changes."""

    app_name: str = "SurgeSeat API"
    database_url: str  # required: the app refuses to start without it

    # Connection pool per API instance.
    # Total connections = (pool_size + max_overflow) x number of instances,
    # and that must stay below PostgreSQL's max_connections (default 100).
    db_pool_size: int = 10
    db_max_overflow: int = 5


settings = Settings()