"""SSRF protection for LynceusVision connectors.

Validates that a hostname/IP is not a private, reserved, loopback,
link-local, or cloud metadata address before any outbound request is made.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import socket
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)

# Private and reserved CIDR blocks to block
_BLOCKED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    # RFC 1918 private IPv4
    ipaddress.IPv4Network("10.0.0.0/8"),
    ipaddress.IPv4Network("172.16.0.0/12"),
    ipaddress.IPv4Network("192.168.0.0/16"),
    # Loopback
    ipaddress.IPv4Network("127.0.0.0/8"),
    ipaddress.IPv6Network("::1/128"),
    # Link-local
    ipaddress.IPv4Network("169.254.0.0/16"),
    ipaddress.IPv6Network("fe80::/10"),
    # Cloud metadata
    ipaddress.IPv4Network("169.254.169.254/32"),
    # Unspecified / broadcast
    ipaddress.IPv4Network("0.0.0.0/8"),
    ipaddress.IPv4Network("255.255.255.255/32"),
    # IPv6 unique local (ULA)
    ipaddress.IPv6Network("fc00::/7"),
    # IPv6 IPv4-mapped private / local blocks
    ipaddress.IPv6Network("::ffff:0:0/96"),
    # Multicast
    ipaddress.IPv4Network("224.0.0.0/4"),
    ipaddress.IPv6Network("ff00::/8"),
]


class SSRFBlockedError(Exception):
    """Raised when a target is blocked by SSRF protection."""


def clean_target_host(target: str) -> str:
    """Extract a normalized hostname while rejecting ambiguous URL authority syntax."""
    s = target.strip()
    if not s or any(ord(char) < 32 for char in s) or "@" in s:
        raise SSRFBlockedError("Target hostname is invalid")

    if "://" in s:
        parsed = urlsplit(s)
        if parsed.scheme.lower() not in {"http", "https"} or parsed.username or parsed.password:
            raise SSRFBlockedError("Target URL scheme or credentials are invalid")
        try:
            if parsed.port is not None and not 1 <= parsed.port <= 65535:
                raise SSRFBlockedError("Target URL port is invalid")
        except ValueError as exc:
            raise SSRFBlockedError("Target URL port is invalid") from exc
        hostname = parsed.hostname or ""
    else:
        authority = s.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
        if authority.startswith("["):
            close = authority.find("]")
            if close < 0:
                raise SSRFBlockedError("Target IPv6 brackets are invalid")
            hostname = authority[1:close]
            suffix = authority[close + 1 :]
            if suffix and not re.fullmatch(r":\d{1,5}", suffix):
                raise SSRFBlockedError("Target URL port is invalid")
        elif authority.count(":") == 1:
            hostname, port = authority.rsplit(":", 1)
            if not port.isdigit() or not 1 <= int(port) <= 65535:
                raise SSRFBlockedError("Target URL port is invalid")
        else:
            hostname = authority

    try:
        hostname = hostname.encode("idna").decode("ascii").lower().rstrip(".")
    except UnicodeError as exc:
        raise SSRFBlockedError("Target hostname is invalid") from exc
    if not hostname:
        raise SSRFBlockedError("Target hostname is invalid")
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        labels = hostname.split(".")
        if len(hostname) > 253 or any(
            not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
            for label in labels
        ):
            raise SSRFBlockedError("Target hostname is invalid") from None
    return hostname


def _is_ip_blocked(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True if the IP address is in a blocked range."""
    # Unwrap IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
        ip_obj = ip_obj.ipv4_mapped

    for net in _BLOCKED_NETWORKS:
        if ip_obj.version == net.version and ip_obj in net:
            return True
    # ipaddress classifies non-global special-use, documentation, CGNAT,
    # benchmarking, and reserved blocks as non-global as well.
    return not ip_obj.is_global


def validate_target(target: str) -> str:
    """
    Validate a hostname or IP for use as a connector target.

    Performs DNS resolution and checks every resolved address against the
    blocked network list. Raises SSRFBlockedError if any resolved address
    is private or reserved.

    Returns the validated hostname string on success.
    """
    hostname = clean_target_host(target)

    if not hostname:
        raise SSRFBlockedError(f"Empty or invalid target: {target!r}")

    # Check directly if target is a literal IP address
    is_literal_ip = False
    try:
        literal_ip = ipaddress.ip_address(hostname)
        is_literal_ip = True
    except ValueError:
        pass

    if is_literal_ip:
        if _is_ip_blocked(literal_ip):
            logger.warning("SSRF blocked: literal IP %s is private or reserved", hostname)
            raise SSRFBlockedError(f"Target {hostname!r} is a private or reserved address")
        return hostname

    # Resolve domain to IP addresses
    try:
        addrs = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise SSRFBlockedError(f"Cannot resolve {hostname!r}: {exc}") from exc

    for addr_info in addrs:
        ip_str = addr_info[4][0]
        try:
            parsed = ipaddress.ip_address(ip_str)
        except ValueError:
            raise SSRFBlockedError(f"Target resolved to unparseable IP: {ip_str}") from None

        if _is_ip_blocked(parsed):
            logger.warning("SSRF blocked: %s resolved to private address %s", hostname, ip_str)
            raise SSRFBlockedError(
                f"Target {hostname!r} resolves to a private or reserved address ({ip_str})"
            )

    return hostname


async def validate_target_async(target: str) -> str:
    """Resolve and validate without blocking the event loop's DNS path."""
    hostname = clean_target_host(target)
    if not hostname:
        raise SSRFBlockedError("Empty or invalid target")
    try:
        literal = ipaddress.ip_address(hostname)
    except ValueError:
        literal = None
    if literal is not None:
        if _is_ip_blocked(literal):
            raise SSRFBlockedError(f"Target {hostname!r} is a private or reserved address")
        return hostname
    try:
        answers = await asyncio.wait_for(
            asyncio.get_running_loop().getaddrinfo(hostname, None, type=socket.SOCK_STREAM),
            timeout=5,
        )
    except (socket.gaierror, TimeoutError) as exc:
        raise SSRFBlockedError(f"Cannot resolve {hostname!r}") from exc
    if not answers:
        raise SSRFBlockedError(f"Cannot resolve {hostname!r}")
    for answer in answers:
        try:
            address = ipaddress.ip_address(answer[4][0])
        except ValueError as exc:
            raise SSRFBlockedError("Target resolved to an invalid IP address") from exc
        if _is_ip_blocked(address):
            raise SSRFBlockedError(f"Target {hostname!r} resolves to a private or reserved address")
    return hostname
