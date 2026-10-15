from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest

from app.connectors import base
from app.connectors.base import ConnectorResponseTooLargeError, get_limited_response


@pytest.mark.asyncio
async def test_actual_stream_bytes_are_limited(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        base, "get_settings", lambda: SimpleNamespace(connector_response_max_bytes=8)
    )

    async def handler(_request: httpx.Request) -> httpx.Response:
        # No Content-Length header: enforcement must count bytes as streamed.
        return httpx.Response(200, content=b"0123456789")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(ConnectorResponseTooLargeError):
            await get_limited_response(client, "https://provider.example/data")


@pytest.mark.asyncio
async def test_response_within_stream_limit_is_returned_complete(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        base, "get_settings", lambda: SimpleNamespace(connector_response_max_bytes=16)
    )

    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"complete")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        response = await get_limited_response(client, "https://provider.example/data")
    assert response.content == b"complete"
