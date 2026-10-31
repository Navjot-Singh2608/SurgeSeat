import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

# ---------- Passwords ----------
# Argon2id: the current recommended password hashing algorithm.
# It is deliberately slow and memory-hungry so stolen hashes are expensive to crack.
_hasher = PasswordHasher()

# Used when the email doesn't exist, so a wrong email takes as long as a wrong password.
# Otherwise attackers could time responses to discover which emails are registered.
_DUMMY_HASH = _hasher.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, InvalidHashError):
        return False


# ---------- Access tokens (JWT) ----------
# Short-lived and self-contained: any API instance can check it with the secret,
# without a database lookup. This is what keeps the API stateless.
def create_access_token(user_id: uuid.UUID, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError if the token is invalid, tampered with or expired."""
    payload = jwt.decode(token, settings.jwt_secret,
                         algorithms=[settings.jwt_algorithm])
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("not an access token")
    return payload


# ---------- Refresh tokens ----------
# A long random string (not a JWT). Only its SHA-256 hash is stored, so a database
# leak doesn't expose usable tokens. SHA-256 is fine here (unlike passwords) because
# the token is already random and unguessable.
def new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
