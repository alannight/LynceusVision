"""Dedicated unit tests for SSRF protection."""
from __future__ import annotations

import pytest

from app.security.ssrf import SSRFBlockedError, clean_target_host, validate_target


def test_clean_target_host() -> None:
    assert clean_target_host("https://example.com/test?query=1") == "example.com"
    assert clean_target_host("http://static.example.com:8080/") == "static.example.com"
    assert clean_target_host("https://threat.intel/sample") == "threat.intel"
    assert clean_target_host("  HTTPS://SUB.DOMAIN.ORG:443  ") == "sub.domain.org"


def test_validate_target_public_domain() -> None:
    res = validate_target("example.com")
    assert res == "example.com"


def test_validate_target_public_ip() -> None:
    res = validate_target("8.8.8.8")
    assert res == "8.8.8.8"


@pytest.mark.parametrize(
    "blocked_target",
    [
        "127.0.0.1",
        "127.0.0.2",
        "10.0.0.1",
        "10.254.254.1",
        "172.16.0.1",
        "172.31.255.254",
        "192.168.1.1",
        "192.168.100.50",
        "169.254.169.254",
        "169.254.1.1",
        "::1",
        "fe80::1",
        "::ffff:127.0.0.1",
        "::ffff:10.0.0.1",
        "::ffff:192.168.1.1",
        "::ffff:169.254.169.254",
    ],
)
def test_validate_target_blocks_private_and_reserved_ips(blocked_target: str) -> None:
    with pytest.raises(SSRFBlockedError):
        validate_target(blocked_target)


def test_validate_target_empty_target() -> None:
    with pytest.raises(SSRFBlockedError):
        validate_target("")
    with pytest.raises(SSRFBlockedError):
        validate_target("   ")


def test_validate_target_unresolvable_domain() -> None:
    with pytest.raises(SSRFBlockedError):
        validate_target("this-domain-definitely-does-not-exist-123456789.invalid")
