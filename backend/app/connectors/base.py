"""Base connector interface for LynceusVision."""
from __future__ import annotations

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
