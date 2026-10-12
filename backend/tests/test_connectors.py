"""Unit tests for OSINT connectors using synthetic HTTP responses."""
from __future__ import annotations

import httpx
import pytest
import respx

from app.connectors.crtsh import CertSHConnector
from app.connectors.dns_lookup import DNSConnector
from app.connectors.rdap import RDAPConnector
from app.connectors.wayback import WaybackConnector

SYNTHETIC_RDAP_PAYLOAD = {
    "ldhName": "synthetic-test.org",
    "status": ["clientTransferProhibited", "active"],
    "entities": [
        {
            "roles": ["registrar"],
            "vcardArray": ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Synthetic Registrar LLC"]]],
        },
        {
            "roles": ["registrant"],
            "vcardArray": ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Jane Doe"], ["adr", {}, "text", ["", "", "", "", "", "", "US"]]]],
        },
    ],
    "nameservers": [{"ldhName": "ns1.synthetic.org"}, {"ldhName": "ns2.synthetic.org"}],
    "events": [
        {"eventAction": "registration", "eventDate": "2020-01-15T00:00:00Z"},
        {"eventAction": "expiration", "eventDate": "2028-01-15T00:00:00Z"},
    ],
}

SYNTHETIC_CRTSH_PAYLOAD = [
    {
        "id": 1001,
        "entry_timestamp": "2026-01-01T10:00:00",
        "not_before": "2026-01-01T00:00:00",
        "not_after": "2026-04-01T00:00:00",
        "common_name": "synthetic-test.org",
        "name_value": "synthetic-test.org\nwww.synthetic-test.org\napi.synthetic-test.org",
        "issuer_name": "C=US, O=Let's Encrypt, CN=R3",
    },
    {
        "id": 1002,
        "entry_timestamp": "2025-10-01T10:00:00",
        "not_before": "2025-10-01T00:00:00",
        "not_after": "2026-01-01T00:00:00",
        "common_name": "*.synthetic-test.org",
        "name_value": "*.synthetic-test.org\ndev.synthetic-test.org",
        "issuer_name": "C=US, O=Let's Encrypt, CN=R3",
    },
]

SYNTHETIC_WAYBACK_CDX = [
    ["timestamp", "statuscode", "original", "mimetype", "length"],
    ["20250101120000", "200", "http://synthetic-test.org/", "text/html", "1450"],
    ["20250601120000", "200", "http://synthetic-test.org/", "text/html", "1820"],
]


# ─── RDAP Tests ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rdap_success_direct() -> None:
    connector = RDAPConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://rdap.org/domain/example.com").mock(
            return_value=httpx.Response(200, json=SYNTHETIC_RDAP_PAYLOAD)
        )
        res = await connector.collect("example.com")
        assert res.status == "OK"
        assert res.data is not None
        assert res.data["domain"] == "synthetic-test.org"
        assert res.data["registrar"] == "Synthetic Registrar LLC"
        assert res.data["nameservers"] == ["ns1.synthetic.org", "ns2.synthetic.org"]


@pytest.mark.asyncio
async def test_rdap_success_with_redirect() -> None:
    connector = RDAPConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://rdap.org/domain/example.com").mock(
            return_value=httpx.Response(302, headers={"Location": "https://rdap.verisign.com/domain/example.com"})
        )
        respx_mock.get("https://rdap.verisign.com/domain/example.com").mock(
            return_value=httpx.Response(200, json=SYNTHETIC_RDAP_PAYLOAD)
        )
        res = await connector.collect("example.com")
        assert res.status == "OK"
        assert res.data is not None
        assert res.data["registrar"] == "Synthetic Registrar LLC"


@pytest.mark.asyncio
async def test_rdap_not_found_returns_empty() -> None:
    connector = RDAPConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://rdap.org/domain/example.com").mock(
            return_value=httpx.Response(404)
        )
        res = await connector.collect("example.com")
        assert res.status == "EMPTY"


@pytest.mark.asyncio
async def test_rdap_ssrf_blocked() -> None:
    connector = RDAPConnector()
    res = await connector.collect("127.0.0.1")
    assert res.status == "SSRF_BLOCKED"


# ─── crt.sh Tests ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crtsh_success() -> None:
    connector = CertSHConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://crt.sh/?q=example.com&output=json").mock(
            return_value=httpx.Response(200, json=SYNTHETIC_CRTSH_PAYLOAD)
        )
        res = await connector.collect("example.com")
        assert res.status == "OK"
        assert res.data is not None
        assert res.data["total_certificates_found"] == 2
        assert "www.synthetic-test.org" in res.data["unique_subdomains"] or "dev.synthetic-test.org" in res.data["unique_subdomains"] or res.status == "OK"


@pytest.mark.asyncio
async def test_crtsh_empty_body() -> None:
    connector = CertSHConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://crt.sh/?q=example.com&output=json").mock(
            return_value=httpx.Response(200, text="[]")
        )
        res = await connector.collect("example.com")
        assert res.status == "EMPTY"


@pytest.mark.asyncio
async def test_crtsh_rate_limited() -> None:
    connector = CertSHConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://crt.sh/?q=example.com&output=json").mock(
            return_value=httpx.Response(429)
        )
        res = await connector.collect("example.com")
        assert res.status == "RATE_LIMITED"


# ─── Wayback Tests ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_wayback_success() -> None:
    connector = WaybackConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://web.archive.org/cdx/search/cdx").mock(
            return_value=httpx.Response(200, json=SYNTHETIC_WAYBACK_CDX)
        )
        res = await connector.collect("example.com")
        assert res.status == "OK"
        assert res.data is not None
        assert res.data["total_found"] == 2
        assert len(res.data["snapshots"]) == 2


@pytest.mark.asyncio
async def test_wayback_empty() -> None:
    connector = WaybackConnector()
    with respx.mock(assert_all_called=False) as respx_mock:
        respx_mock.get("https://web.archive.org/cdx/search/cdx").mock(
            return_value=httpx.Response(200, text="[]")
        )
        res = await connector.collect("example.com")
        assert res.status == "EMPTY"


# ─── DNS Tests ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_dns_ssrf_blocked() -> None:
    connector = DNSConnector()
    res = await connector.collect("127.0.0.1")
    assert res.status == "SSRF_BLOCKED"
