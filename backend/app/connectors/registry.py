"""Connector registry — central registry of all enabled OSINT connectors."""

from __future__ import annotations

from app.connectors.base import BaseConnector
from app.connectors.crtsh import CertSHConnector
from app.connectors.dns_lookup import DNSConnector
from app.connectors.rdap import RDAPConnector
from app.connectors.wayback import WaybackConnector

_REGISTRY: dict[str, BaseConnector] = {
    "rdap": RDAPConnector(),
    "dns": DNSConnector(),
    "crtsh": CertSHConnector(),
    "wayback": WaybackConnector(),
}

# Source metadata for DB seeding
CONNECTOR_METADATA: list[dict] = [
    {
        "id": "rdap",
        "display_name": "RDAP Domain Lookup",
        "description": (
            "Registration Data Access Protocol — domain registrar, nameservers, lifecycle dates."
        ),
        "source_url": "https://rdap.org",
    },
    {
        "id": "dns",
        "display_name": "DNS Record Lookup",
        "description": "Resolves A, AAAA, MX, NS, TXT, CNAME, SOA records via system resolver.",
        "source_url": "https://www.iana.org/domains",
    },
    {
        "id": "crtsh",
        "display_name": "Certificate Transparency (crt.sh)",
        "description": "SSL/TLS certificate history and subdomain discovery via crt.sh.",
        "source_url": "https://crt.sh",
    },
    {
        "id": "wayback",
        "display_name": "Wayback Machine",
        "description": "Internet Archive historical snapshots via CDX API.",
        "source_url": "https://web.archive.org",
    },
]


def get_connector(connector_id: str) -> BaseConnector | None:
    return _REGISTRY.get(connector_id)


def get_all_connectors() -> list[BaseConnector]:
    return list(_REGISTRY.values())


def get_connector_ids() -> list[str]:
    return list(_REGISTRY.keys())
