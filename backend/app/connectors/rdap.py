"""RDAP connector — queries rdap.org for domain registration data.

API documentation: https://www.rdap.org/
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

RDAP_BOOTSTRAP_URL = "https://rdap.org/domain/{domain}"


class RDAPConnector(BaseConnector):
    connector_id = "rdap"
    display_name = "RDAP Domain Lookup"
    description = (
        "Queries the RDAP (Registration Data Access Protocol) bootstrap service "
        "for domain registration information including registrar, registrant, "
        "nameservers, and lifecycle dates."
    )
    source_url = "https://rdap.org"

    async def collect(self, query: str) -> ConnectorResult:
        domain = clean_target_host(query)
        start = self._start_timer()

        # SSRF validation: resolve the domain to confirm it's not private
        try:
            await validate_target_async(domain)
        except SSRFBlockedError as exc:
            return self._result(query, "SSRF_BLOCKED", None, self._elapsed_ms(start), str(exc))

        url = RDAP_BOOTSTRAP_URL.format(domain=domain)
        response = None

        try:
            async with _make_client() as client:
                # Never follow provider redirects: DNS validation followed by a
                # second resolver lookup is vulnerable to rebinding.
                response = await get_limited_response(client, url)
        except ConnectorResponseTooLargeError as exc:
            return self._result(
                query, "RESPONSE_TOO_LARGE", None, self._elapsed_ms(start), str(exc)
            )
        except (httpx.TimeoutException, TimeoutError):
            logger.warning("RDAP provider timed out")
            return self._result(
                query, "TIMEOUT", None, self._elapsed_ms(start), "Request timed out"
            )
        except httpx.RequestError as exc:
            logger.error("RDAP request failed (%s)", type(exc).__name__)
            return self._result(query, "PROVIDER_ERROR", None, self._elapsed_ms(start), str(exc))

        elapsed = self._elapsed_ms(start)

        if response is None:
            return self._result(query, "PROVIDER_ERROR", None, elapsed, "No response received")

        if response.status_code == 404:
            return self._result(query, "EMPTY", None, elapsed, "Domain not found in RDAP")
        if response.status_code == 429:
            return self._result(query, "RATE_LIMITED", None, elapsed, "Rate limited by RDAP")
        if response.status_code != 200:
            return self._result(
                query,
                "PROVIDER_ERROR",
                None,
                elapsed,
                f"HTTP {response.status_code}",
            )

        try:
            raw = response.json()
        except Exception as exc:
            return self._result(query, "PROVIDER_ERROR", None, elapsed, f"JSON decode error: {exc}")

        normalized = _normalize_rdap(raw)
        return self._result(query, "OK", normalized, elapsed)


def _normalize_rdap(raw: dict[str, Any]) -> dict[str, Any]:
    """Extract the most useful RDAP fields into a flat normalized structure."""
    events: dict[str, str] = {}
    for ev in raw.get("events", []):
        events[ev.get("eventAction", "unknown")] = ev.get("eventDate", "")

    nameservers = [ns.get("ldhName", "").lower() for ns in raw.get("nameservers", [])]

    registrar = None
    registrant_name = None
    registrant_org = None
    registrant_country = None

    for entity in raw.get("entities", []):
        roles = entity.get("roles", [])
        vcard = entity.get("vcardArray", [None, []])[1]
        fn = (
            next(
                (entry[3] for entry in vcard if isinstance(entry, list) and entry[0] == "fn"),
                None,
            )
            if vcard
            else None
        )
        org_val = (
            next(
                (entry[3] for entry in vcard if isinstance(entry, list) and entry[0] == "org"),
                None,
            )
            if vcard
            else None
        )
        adr_val = (
            next(
                (entry[3] for entry in vcard if isinstance(entry, list) and entry[0] == "adr"),
                None,
            )
            if vcard
            else None
        )
        country = adr_val[6] if isinstance(adr_val, list) and len(adr_val) > 6 else None

        if "registrar" in roles:
            registrar = fn or org_val
        if "registrant" in roles:
            registrant_name = fn
            registrant_org = org_val
            registrant_country = country

    return {
        "domain": raw.get("ldhName", "").lower(),
        "status": raw.get("status", []),
        "registrar": registrar,
        "registrant_name": registrant_name,
        "registrant_org": registrant_org,
        "registrant_country": registrant_country,
        "nameservers": nameservers,
        "registered": events.get("registration"),
        "updated": events.get("last changed"),
        "expires": events.get("expiration"),
        "rdap_url": raw.get("links", [{}])[0].get("value") if raw.get("links") else None,
        "_source": "rdap.org",
    }
