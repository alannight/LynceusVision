"""Pytest fixtures for LynceusVision backend tests."""
from __future__ import annotations

from collections.abc import AsyncGenerator

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app
from app.models.models import Source


@pytest.fixture
async def test_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated in-memory SQLite database session for unit tests."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async with session_maker() as session:
        # Seed test sources
        sources = [
            Source(id="rdap", display_name="RDAP Domain Lookup"),
            Source(id="dns", display_name="DNS Record Lookup"),
            Source(id="crtsh", display_name="Certificate Transparency (crt.sh)"),
            Source(id="wayback", display_name="Wayback Machine"),
        ]
        session.add_all(sources)
        await session.commit()
        yield session

    await engine.dispose()


@pytest.fixture
async def client(test_db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provide an HTTP test client connected to FastAPI app with overridden DB session."""
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
