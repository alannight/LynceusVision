"""Unit tests for rate limiting functionality."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.security.rate_limiter import RateLimiter


class MockClient:
    def __init__(self, host: str = "127.0.0.1") -> None:
        self.host = host


class MockRequest:
    def __init__(self, host: str = "127.0.0.1") -> None:
        self.client = MockClient(host)


@pytest.mark.asyncio
async def test_rate_limiter_allows_under_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "app_env", "production")
    limiter = RateLimiter(max_requests=3, window_seconds=60, name="test")
    req = MockRequest("1.1.1.1")
    await limiter(req)
    await limiter(req)
    await limiter(req)


@pytest.mark.asyncio
async def test_rate_limiter_blocks_over_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "app_env", "production")
    limiter = RateLimiter(max_requests=2, window_seconds=60, name="test")
    req = MockRequest("2.2.2.2")
    await limiter(req)
    await limiter(req)
    with pytest.raises(HTTPException) as exc_info:
        await limiter(req)
    assert exc_info.value.status_code == 429
    assert "Retry-After" in exc_info.value.headers


@pytest.mark.asyncio
async def test_rate_limiter_isolates_by_ip(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "app_env", "production")
    limiter = RateLimiter(max_requests=1, window_seconds=60, name="test")
    req1 = MockRequest("10.10.10.10")
    req2 = MockRequest("20.20.20.20")
    await limiter(req1)
    # Different IP should succeed
    await limiter(req2)
    # Repeated IP should fail
    with pytest.raises(HTTPException):
        await limiter(req1)
