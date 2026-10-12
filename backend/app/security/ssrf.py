"""SSRF protection for LynceusVision connectors.

Validates that a hostname/IP is not a private, reserved, loopback,
link-local, or cloud metadata address before any outbound request is made.
"""
from __future__ import annotations

import ipaddress
import logging
import socket

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
    """Safely extract hostname/domain from user input without destructive character stripping."""
    s = target.strip()
    for prefix in ("https://", "http://"):
        if s.lower().startswith(prefix):
            s = s[len(prefix):]
    # Remove URL paths, queries, fragments
    s = s.split("/")[0].split("?")[0].split("#")[0].strip()
    # Strip port if present (handling IPv6 brackets)
    if s.startswith("[") and "]" in s:
        s = s[1 : s.index("]")]
    elif ":" in s and s.count(":") == 1:
        s = s.split(":")[0]
    return s.lower()


def _is_ip_blocked(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True if the IP address is in a blocked range."""
    # Unwrap IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1 -> 127.0.0.1)
    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
        ip_obj = ip_obj.ipv4_mapped

    for net in _BLOCKED_NETWORKS:
        if ip_obj.version == net.version and ip_obj in net:
            return True
    return False


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
            raise SSRFBlockedError(
                f"Target {hostname!r} is a private or reserved address"
            )
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
            raise SSRFBlockedError(f"Target resolved to unparseable IP: {ip_str}")

        if _is_ip_blocked(parsed):
            logger.warning("SSRF blocked: %s resolved to private address %s", hostname, ip_str)
            raise SSRFBlockedError(
                f"Target {hostname!r} resolves to a private or reserved address ({ip_str})"
            )

    return hostname
