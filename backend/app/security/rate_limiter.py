"""In-memory sliding window rate limiter for FastAPI."""

import time
from collections import defaultdict

from fastapi import HTTPException, status
from starlette.requests import Request

from app.config import get_settings


class RateLimiter:
    """Sliding-window request rate limiter per client IP."""

    def __init__(
        self, max_requests: int = 20, window_seconds: int = 60, name: str = "default"
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.name = name
        self._history: dict[str, list[float]] = defaultdict(list)

    async def __call__(self, request: Request) -> None:
        settings = get_settings()
        if settings.app_env == "testing":
            return

        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        # Clean old timestamps
        history = [ts for ts in self._history[client_ip] if ts > cutoff]
        if len(history) >= self.max_requests:
            msg = (
                f"Rate limit exceeded for {self.name}. "
                f"Maximum {self.max_requests} requests per {self.window_seconds}s."
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=msg,
                headers={"Retry-After": str(self.window_seconds)},
            )

        history.append(now)
        self._history[client_ip] = history

    def reset(self) -> None:
        self._history.clear()


auth_limiter = RateLimiter(max_requests=20, window_seconds=60, name="auth")
collect_limiter = RateLimiter(max_requests=30, window_seconds=60, name="collect")
