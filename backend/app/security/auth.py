"""Password-based accounts and short-lived bearer access tokens."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.models import User

password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)
_development_signing_key = secrets.token_urlsafe(48)


def signing_key() -> str:
    configured = get_settings().app_secret_key
    return configured or _development_signing_key


def create_access_token(user_id: str) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=30)},
        signing_key(),
        algorithm="HS256",
    )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        token = credentials.credentials
        payload = jwt.decode(token, signing_key(), algorithms=["HS256"])
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            raise unauthorized
    except (jwt.PyJWTError, ValueError):
        raise unauthorized from None
    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise unauthorized
    return user
