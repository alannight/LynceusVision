"""DNS connector — resolves common record types using dnspython.

Resolves records against the system resolver.
"""
from __future__ import annotations

import logging

import dns.asyncresolver
import dns.exception
import dns.resolver

from app.connectors.base import BaseConnector
from app.schemas import ConnectorResult
from app.security import SSRFBlockedError, clean_target_host, validate_target

logger = logging.getLogger(__name__)

RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]


class DNSConnector(BaseConnector):
    connector_id = "dns"
    display_name = "DNS Record Lookup"
    description = (
        "Resolves A, AAAA, MX, NS, TXT, CNAME, and SOA records for a domain "
        "using the system resolver. No external API required."
    )
    source_url = "https://www.iana.org/domains"

    async def collect(self, query: str) -> ConnectorResult:
        domain = clean_target_host(query)
        start = self._start_timer()

        # Target and SSRF validation
        try:
            validate_target(domain)
        except SSRFBlockedError as exc:
            return self._result(query, "SSRF_BLOCKED", None, self._elapsed_ms(start), str(exc))

        results: dict[str, list[str]] = {}
        errors: dict[str, str] = {}

        resolver = dns.asyncresolver.Resolver()
        resolver.lifetime = 10.0

        for rtype in RECORD_TYPES:
            try:
                answers = await resolver.resolve(domain, rtype)
                results[rtype] = [str(r) for r in answers]
            except dns.resolver.NXDOMAIN:
                errors[rtype] = "NXDOMAIN"
                break  # Domain does not exist — no point querying other types
            except dns.resolver.NoAnswer:
                results[rtype] = []
            except dns.exception.Timeout:
                errors[rtype] = "TIMEOUT"
            except dns.exception.DNSException as exc:
                errors[rtype] = str(exc)

        elapsed = self._elapsed_ms(start)

        if "NXDOMAIN" in errors.values():
            return self._result(
                query, "EMPTY", None, elapsed, f"Domain {domain!r} does not exist (NXDOMAIN)"
            )

        has_data = any(len(v) > 0 for v in results.values())
        status = "OK" if has_data else "EMPTY"

        normalized = {
            "domain": domain,
            "records": results,
            "errors": errors,
            "_source": "system resolver (dnspython)",
        }

        return self._result(query, status, normalized, elapsed)
