from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Predictable names for indexes and constraints (e.g. uq_users_email).
# Without this, Postgres invents names and later migrations can't reliably find them.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Every table class inherits from this."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)