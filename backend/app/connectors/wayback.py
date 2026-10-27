"""Wayback Machine connector — queries the CDX Server API for page snapshots.

API documentation: https://github.com/internetarchive/wayback-machine-availability-api
CDX API: https://web.archive.org/cdx/search/cdx
"""

from __future__ import annotations

import logging
import urllib.parse

import httpx

from app.connectors.base import (
    BaseConnector,
    ConnectorResponseTooLargeError,
    _make_client,
    get_limited_response,
)
from app.schemas import ConnectorResult
from app.security import SSRFBlockedError, clean_target_host, validate_target_async

logger = logging.getLogger(__name__)

CDX_URL = "https://web.archive.org/cdx/search/cdx"
MAX_SNAPSHOTS = 50


class WaybackConnector(BaseConnector):
    connector_id = "wayback"
    display_name = "Wayback Machine"
    description = (
        "Queries the Internet Archive Wayback Machine CDX API for historical "
        "page snapshots. Returns capture timestamps, status codes, and archive URLs."
    )
    source_url = "https://web.archive.org"

    async def collect(self, query: str) -> ConnectorResult:
        target = clean_target_host(query)
        start = self._start_timer()

        # SSRF validation
        try:
            await validate_target_async(target)
        except SSRFBlockedError as exc:
            return self._result(query, "SSRF_BLOCKED", None, self._elapsed_ms(start), str(exc))

        params = {
            "url": target,
            "output": "json",
            "limit": str(MAX_SNAPSHOTS),
            "fl": "timestamp,statuscode,original,mimetype,length",
            "collapse": "timestamp:8",  # one result per day
        }
        full_url = f"{CDX_URL}?{urllib.parse.urlencode(params)}"

        try:
            async with _make_client() as client:
                response = await get_limited_response(client, full_url)
        except ConnectorResponseTooLargeError as exc:
            return self._result(
                query, "RESPONSE_TOO_LARGE", None, self._elapsed_ms(start), str(exc)
            )
        except TimeoutError:
            return self._result(
                query, "TIMEOUT", None, self._elapsed_ms(start), "Total request time exceeded"
            )
        except httpx.TimeoutException:
            logger.warning("Wayback CDX provider timed out")
            return self._result(
                query, "TIMEOUT", None, self._elapsed_ms(start), "Request timed out"
            )
        except httpx.RequestError as exc:
            return self._result(query, "PROVIDER_ERROR", None, self._elapsed_ms(start), str(exc))

        elapsed = self._elapsed_ms(start)

        if response.status_code == 429:
            return self._result(query, "RATE_LIMITED", None, elapsed, "Rate limited by archive.org")
        if response.status_code != 200:
            return self._result(
                query, "PROVIDER_ERROR", None, elapsed, f"HTTP {response.status_code}"
            )

        text = response.text.strip()
        if not text or text == "[]":
            return self._result(query, "EMPTY", None, elapsed)

        try:
            rows = response.json()
        except Exception as exc:
            return self._result(
                query, "PROVIDER_ERROR", None, elapsed, f"Invalid JSON received from CDX API: {exc}"
            )

        if not isinstance(rows, list) or len(rows) < 2:
            return self._result(query, "EMPTY", None, elapsed)

        # First row is field names
        fields = rows[0]
        snapshots = []
        for row in rows[1:]:
            entry = dict(zip(fields, row, strict=False))
            ts = entry.get("timestamp", "")
            snapshots.append(
                {
                    "timestamp": f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}T{ts[8:10]}:{ts[10:12]}:{ts[12:14]}Z"
                    if len(ts) >= 14
                    else ts,
                    "status_code": entry.get("statuscode"),
                    "original_url": entry.get("original"),
                    "mime_type": entry.get("mimetype"),
                    "length_bytes": int(entry.get("length", 0) or 0),
                    "archive_url": f"https://web.archive.org/web/{ts}/{entry.get('original', '')}",
                }
            )

        first_ts = snapshots[0]["timestamp"] if snapshots else None
        last_ts = snapshots[-1]["timestamp"] if snapshots else None

        normalized = {
            "target": target,
            "total_found": len(rows) - 1,
            "first_seen": first_ts,
            "last_seen": last_ts,
            "snapshots": snapshots,
            "_source": "web.archive.org CDX API",
        }
        return self._result(query, "OK", normalized, elapsed)
