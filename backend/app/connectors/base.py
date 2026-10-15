"""Base connector interface for LynceusVision."""

from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import get_settings
from app.schemas import ConnectorResult

settings = get_settings()

USER_AGENT = "LynceusVision/0.1 (OSINT research platform; contact: see project README)"

DEFAULT_TIMEOUT = httpx.Timeout(
    connect=settings.connector_timeout_connect,
    read=settings.connector_timeout_read,
    write=5.0,
    pool=5.0,
)


class ConnectorResponseTooLargeError(Exception):
    """Raised when a provider body exceeds the configured actual byte limit."""


async def get_limited_response(
    client: httpx.AsyncClient,
    url: str,
    *,
    params: dict[str, str] | None = None,
) -> httpx.Response:
    """Read a response incrementally, enforcing decompressed byte and total-time limits."""
    maximum = get_settings().connector_response_max_bytes
    chunks: list[bytes] = []
    received = 0
    async with asyncio.timeout(30):
        async with client.stream("GET", url, params=params) as response:
            async for chunk in response.aiter_bytes():
                received += len(chunk)
                if received > maximum:
                    raise ConnectorResponseTooLargeError(
                        f"Provider response exceeded {maximum} bytes"
                    )
                chunks.append(chunk)
            return httpx.Response(
                status_code=response.status_code,
                headers=response.headers,
                content=b"".join(chunks),
                request=response.request,
            )


def _make_client(base_url: str = "") -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=base_url,
        timeout=DEFAULT_TIMEOUT,
        follow_redirects=False,
        headers={"User-Agent": USER_AGENT},
        max_redirects=0,
    )


class BaseConnector(ABC):
    """All OSINT connectors implement this interface."""

    connector_id: str
    display_name: str
    description: str
    source_url: str

    @abstractmethod
    async def collect(self, query: str) -> ConnectorResult:
        """Run the connector and return a typed result."""
        ...

    def _result(
        self,
        query: str,
        status: str,
        data: dict[str, Any] | None,
        duration_ms: int,
        error: str | None = None,
    ) -> ConnectorResult:
        return ConnectorResult(
            connector_id=self.connector_id,
            status=status,  # type: ignore[arg-type]
            query=query,
            collected_at=datetime.now(UTC),
            duration_ms=duration_ms,
            data=data,
            error=error,
        )

    def _start_timer(self) -> float:
        return time.monotonic()

    def _elapsed_ms(self, start: float) -> int:
        return int((time.monotonic() - start) * 1000)
