"""Pytest fixtures for LynceusVision backend tests."""

from __future__ import annotations

import ipaddress
from collections.abc import AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app
from app.models.models import Source, User
from app.security.auth import create_access_token
from app.security.ssrf import SSRFBlockedError, _is_ip_blocked


@pytest.fixture(autouse=True)
def mock_connector_target_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    """Avoid external DNS in connector tests while retaining literal-IP checks."""

    async def validate(target: str) -> str:
        try:
            address = ipaddress.ip_address(target)
        except ValueError:
            return target
        if _is_ip_blocked(address):
            raise SSRFBlockedError("private test address")
        return target

    for module_name in (
        "app.connectors.rdap",
        "app.connectors.dns_lookup",
        "app.connectors.crtsh",
        "app.connectors.wayback",
    ):
        module = __import__(module_name, fromlist=["validate_target_async"])
        monkeypatch.setattr(module, "validate_target_async", validate)


@pytest_asyncio.fixture
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
        unused_test_hash = "test-only-hash"
        test_user = User(username="test-account", password_hash=unused_test_hash)
        session.add(test_user)
        await session.flush()
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


@pytest_asyncio.fixture
async def client(test_db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provide an HTTP test client connected to FastAPI app with overridden DB session."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield test_db_session

    app.dependency_overrides[get_db] = override_get_db
    test_user = await test_db_session.scalar(select(User).where(User.username == "test-account"))
    assert test_user is not None

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {create_access_token(test_user.id)}"},
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
