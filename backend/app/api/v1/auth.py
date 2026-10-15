"""Account registration and login endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, computed_field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import User
from app.security.auth import create_access_token, password_hash

router = APIRouter(prefix="/auth", tags=["Authentication"])


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=128, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=12, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    expires_in: int = 1800

    @computed_field
    @property
    def token_type(self) -> str:
        return "bearer"


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
async def register(
    body: Credentials,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    existing = await db.scalar(select(User).where(User.username == body.username))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Account unavailable")
    user = User(username=body.username, password_hash=password_hash.hash(body.password))
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Account unavailable") from None
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(body: Credentials, db: Annotated[AsyncSession, Depends(get_db)]) -> TokenResponse:
    user = await db.scalar(select(User).where(User.username == body.username))
    if user is None or not password_hash.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return TokenResponse(access_token=create_access_token(user.id))
