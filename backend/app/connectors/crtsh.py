"""Certificate Transparency connector — queries crt.sh for certificate records.

API documentation: https://crt.sh/ (JSON API)
Terms: Public CT log data, free for research use.
"""

from __future__ import annotations

import logging
from typing import Any

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

CRTSH_URL = "https://crt.sh/?q={domain}&output=json"
MAX_CERTS = 200  # Limit results to avoid huge payloads


class CertSHConnector(BaseConnector):
    connector_id = "crtsh"
    display_name = "Certificate Transparency (crt.sh)"
    description = (
        "Queries crt.sh for SSL/TLS certificates issued for a domain, "
        "including wildcard certificates. Useful for subdomain discovery "
        "and certificate history."
    )
    source_url = "https://crt.sh"

    async def collect(self, query: str) -> ConnectorResult:
        domain = clean_target_host(query)
        start = self._start_timer()

        # SSRF / target validation
        try:
            await validate_target_async(domain)
        except SSRFBlockedError as exc:
            return self._result(query, "SSRF_BLOCKED", None, self._elapsed_ms(start), str(exc))

        url = CRTSH_URL.format(domain=domain)
        try:
            async with _make_client() as client:
                response = await get_limited_response(client, url)
        except ConnectorResponseTooLargeError as exc:
            return self._result(
                query, "RESPONSE_TOO_LARGE", None, self._elapsed_ms(start), str(exc)
            )
        except TimeoutError:
            return self._result(
                query, "TIMEOUT", None, self._elapsed_ms(start), "Total request time exceeded"
            )
        except httpx.TimeoutException:
            logger.warning("crt.sh provider timed out")
            return self._result(
                query, "TIMEOUT", None, self._elapsed_ms(start), "Request timed out"
            )
        except httpx.RequestError as exc:
            return self._result(query, "PROVIDER_ERROR", None, self._elapsed_ms(start), str(exc))

        elapsed = self._elapsed_ms(start)

        if response.status_code == 429:
            return self._result(query, "RATE_LIMITED", None, elapsed, "Rate limited by crt.sh")
        if response.status_code != 200:
            return self._result(
                query, "PROVIDER_ERROR", None, elapsed, f"HTTP {response.status_code}"
            )

        # Distinguish truly empty body vs invalid JSON
        text = response.text.strip()
        if not text or text == "[]":
            return self._result(query, "EMPTY", None, elapsed)

        try:
            raw = response.json()
        except Exception as exc:
            return self._result(
                query, "PROVIDER_ERROR", None, elapsed, f"Invalid JSON received from crt.sh: {exc}"
            )

        if not isinstance(raw, list):
            return self._result(
                query, "PROVIDER_ERROR", None, elapsed, "Unexpected response format from crt.sh"
            )

        if not raw:
            return self._result(query, "EMPTY", None, elapsed)

        # Deduplicate by common_name + name_value
        seen: set[str] = set()
        certs: list[dict[str, Any]] = []
        for cert in raw[:MAX_CERTS]:
            key = f"{cert.get('common_name', '')}|{cert.get('name_value', '')}"
            if key not in seen:
                seen.add(key)
                certs.append(
                    {
                        "id": cert.get("id"),
                        "logged_at": cert.get("entry_timestamp"),
                        "not_before": cert.get("not_before"),
                        "not_after": cert.get("not_after"),
                        "common_name": cert.get("common_name"),
                        "san": [
                            n.strip()
                            for n in (cert.get("name_value") or "").split("\n")
                            if n.strip()
                        ],
                        "issuer": cert.get("issuer_name"),
                    }
                )

        # Extract unique subdomains from SANs
        subdomains: set[str] = set()
        for cert in certs:
            for san in cert.get("san", []):
                san_clean = san.lower()
                if san_clean.startswith("*."):
                    san_clean = san_clean[2:]
                if san_clean.endswith(f".{domain}") or san_clean == domain:
                    subdomains.add(san_clean)

        normalized = {
            "domain": domain,
            "total_certificates_found": len(raw),
            "certificates": certs,
            "unique_subdomains": sorted(subdomains),
            "_source": "crt.sh",
        }
        return self._result(query, "OK", normalized, elapsed)
