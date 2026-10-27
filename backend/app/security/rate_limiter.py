"""Shared Redis sliding-window limiter with a bounded local development fallback."""

import logging
import math
import secrets
import time
from collections import defaultdict
from typing import Any

from fastapi import HTTPException, status
from starlette.requests import Request

from app.config import get_settings

logger = logging.getLogger(__name__)

_MAX_LOCAL_CLIENTS = 4096
_REDIS_CLIENTS: dict[str, Any] = {}
_SLIDING_WINDOW_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local maximum = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count >= maximum then
  local first = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  return {0, tonumber(first[2])}
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, window)
return {1, 0}
"""


def _redis_client(url: str) -> Any:
    client = _REDIS_CLIENTS.get(url)
    if client is None:
        from redis.asyncio import Redis

        client = Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        _REDIS_CLIENTS[url] = client
    return client


async def close_rate_limit_clients() -> None:
    clients = list(_REDIS_CLIENTS.values())
    _REDIS_CLIENTS.clear()
    for client in clients:
        try:
            await client.aclose()
        except Exception as exc:
            logger.warning("Could not close rate-limit client (%s)", type(exc).__name__)


class RateLimiter:
    """Sliding-window request rate limiter per client IP."""

    def __init__(
        self, max_requests: int = 20, window_seconds: int = 60, name: str = "default"
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.name = name
        self._history: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = 0.0

    def _too_many_requests(self, retry_after: int | None = None) -> HTTPException:
        seconds = retry_after or self.window_seconds
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Rate limit exceeded for {self.name}. "
                f"Maximum {self.max_requests} requests per {self.window_seconds}s."
            ),
            headers={"Retry-After": str(seconds)},
        )

    async def _check_redis(self, request: Request, redis_url: str) -> None:
        from redis.exceptions import RedisError

        client_ip = request.client.host if request.client else "unknown"
        now_ms = int(time.time() * 1000)
        window_ms = self.window_seconds * 1000
        try:
            allowed, oldest = await _redis_client(redis_url).eval(
                _SLIDING_WINDOW_SCRIPT,
                1,
                f"lynceusvision:rate:{self.name}:{client_ip}",
                now_ms,
                window_ms,
                self.max_requests,
                secrets.token_hex(12),
            )
        except RedisError as exc:
            logger.error("Rate-limit store unavailable (%s)", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Request protection is temporarily unavailable",
                headers={"Retry-After": "5"},
            ) from None
        if not allowed:
            retry_after = max(1, math.ceil((int(oldest) + window_ms - now_ms) / 1000))
            raise self._too_many_requests(retry_after)

    async def __call__(self, request: Request) -> None:
        settings = get_settings()
        if settings.app_env == "testing":
            return

        if settings.rate_limit_redis_url:
            await self._check_redis(request, settings.rate_limit_redis_url)
            return

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        if now - self._last_cleanup >= self.window_seconds:
            expired = [
                ip for ip, timestamps in self._history.items()
                if not timestamps or timestamps[-1] <= cutoff
            ]
            for ip in expired:
                del self._history[ip]
            self._last_cleanup = now

        if client_ip not in self._history and len(self._history) >= _MAX_LOCAL_CLIENTS:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Local rate-limit capacity reached",
                headers={"Retry-After": str(self.window_seconds)},
            )

        # Clean old timestamps
        history = [ts for ts in self._history.get(client_ip, []) if ts > cutoff]
        if len(history) >= self.max_requests:
            raise self._too_many_requests()

        history.append(now)
        self._history[client_ip] = history

    def reset(self) -> None:
        self._history.clear()


auth_limiter = RateLimiter(max_requests=20, window_seconds=60, name="auth")
collect_limiter = RateLimiter(max_requests=30, window_seconds=60, name="collect")
