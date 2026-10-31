import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    """What the client sends to POST /auth/register."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """What the client sends to POST /auth/login."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenOut(BaseModel):
    """Returned by login and refresh. The refresh token is NOT here: it goes in a cookie."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class UserOut(BaseModel):
    """What the API returns. Never includes password_hash."""

    # allow building it from a User row
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    role: str
