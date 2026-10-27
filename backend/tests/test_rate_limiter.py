"""Unit tests for rate limiting functionality."""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError

from app.security.rate_limiter import RateLimiter


class MockClient:
    def __init__(self, host: str = "127.0.0.1") -> None:
        self.host = host


class MockRequest:
    def __init__(self, host: str = "127.0.0.1") -> None:
        self.client = MockClient(host)


class MockRedis:
    def __init__(self, result: list[int] | None = None, error: Exception | None = None) -> None:
        self.result = result or [1, 0]
        self.error = error
        self.calls: list[tuple[object, ...]] = []

    async def eval(self, *args: object) -> list[int]:
        self.calls.append(args)
        if self.error is not None:
            raise self.error
        return self.result


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


@pytest.mark.asyncio
async def test_rate_limiter_uses_shared_redis_store(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "rate_limit_redis_url", "redis://:test@redis/0")
    redis = MockRedis()
    monkeypatch.setattr("app.security.rate_limiter._redis_client", lambda _url: redis)

    limiter = RateLimiter(max_requests=2, window_seconds=60, name="shared")
    await limiter(MockRequest("3.3.3.3"))

    assert len(redis.calls) == 1
    assert redis.calls[0][2] == "lynceusvision:rate:shared:3.3.3.3"


@pytest.mark.asyncio
async def test_rate_limiter_rejects_redis_limit_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "rate_limit_redis_url", "redis://:test@redis/0")
    redis = MockRedis(result=[0, 1_900_000_000_000])
    monkeypatch.setattr("app.security.rate_limiter._redis_client", lambda _url: redis)

    with pytest.raises(HTTPException) as exc_info:
        await RateLimiter(max_requests=1, window_seconds=60, name="shared")(MockRequest())

    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_rate_limiter_fails_closed_when_redis_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "rate_limit_redis_url", "redis://:test@redis/0")
    redis = MockRedis(error=RedisConnectionError("offline"))
    monkeypatch.setattr("app.security.rate_limiter._redis_client", lambda _url: redis)

    with pytest.raises(HTTPException) as exc_info:
        await RateLimiter(max_requests=1, window_seconds=60, name="shared")(MockRequest())

    assert exc_info.value.status_code == 503
