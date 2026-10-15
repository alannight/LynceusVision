"""Dedicated unit tests for SSRF protection."""

from __future__ import annotations

import asyncio
import socket

import pytest

from app.security.ssrf import (
    SSRFBlockedError,
    clean_target_host,
    validate_target,
    validate_target_async,
)


def test_clean_target_host() -> None:
    assert clean_target_host("https://example.com/test?query=1") == "example.com"
    assert clean_target_host("http://static.example.com:8080/") == "static.example.com"
    assert clean_target_host("https://threat.intel/sample") == "threat.intel"
    assert clean_target_host("  HTTPS://SUB.DOMAIN.ORG:443  ") == "sub.domain.org"


@pytest.mark.parametrize(
    "target",
    [
        "ftp://example.com",
        "https://user@example.com",
        "example.com&next=internal",
        "example.com:99999",
        "https://example.com:bad/path",
    ],
)
def test_clean_target_host_rejects_ambiguous_authority(target: str) -> None:
    with pytest.raises(SSRFBlockedError):
        clean_target_host(target)


def test_validate_target_public_domain(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))
        ],
    )
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


def test_validate_target_unresolvable_domain(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(*_args: object, **_kwargs: object) -> list[object]:
        raise socket.gaierror("not found")

    monkeypatch.setattr(socket, "getaddrinfo", fail)
    with pytest.raises(SSRFBlockedError):
        validate_target("this-domain-definitely-does-not-exist-123456789.invalid")


@pytest.mark.asyncio
async def test_async_dns_resolution_blocks_private_answers(monkeypatch: pytest.MonkeyPatch) -> None:
    loop = asyncio.get_running_loop()

    async def private_answer(*_args: object, **_kwargs: object) -> list[tuple[object, ...]]:
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.1.2.3", 0))]

    monkeypatch.setattr(loop, "getaddrinfo", private_answer)
    with pytest.raises(SSRFBlockedError):
        await validate_target_async("rebind.example")


@pytest.mark.asyncio
async def test_ipv4_mapped_ipv6_loopback_is_blocked() -> None:
    with pytest.raises(SSRFBlockedError):
        await validate_target_async("::ffff:127.0.0.1")
