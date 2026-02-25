from __future__ import annotations

import asyncio
import ipaddress
import socket
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urlsplit

import httpx


class UnsafeFetchURLError(ValueError):
    """Raised when a URL is considered unsafe to fetch from the backend."""


class RemoteFileTooLargeError(ValueError):
    """Raised when a remote response exceeds configured size limits."""


@dataclass(frozen=True)
class FetchedRemoteFile:
    url: str
    content: bytes
    content_type: str


def _is_public_ip(ip: ipaddress._BaseAddress) -> bool:
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _iter_ips(host: str) -> Iterable[ipaddress._BaseAddress]:
    # If host is already an IP literal, don't resolve.
    try:
        yield ipaddress.ip_address(host)
        return
    except ValueError:
        pass

    infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    for family, _type, _proto, _canon, sockaddr in infos:
        if family == socket.AF_INET:
            yield ipaddress.ip_address(sockaddr[0])
        elif family == socket.AF_INET6:
            yield ipaddress.ip_address(sockaddr[0])


async def assert_url_is_safe_to_fetch(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"}:
        raise UnsafeFetchURLError("Only http/https URLs are allowed")
    if not parts.hostname:
        raise UnsafeFetchURLError("URL hostname is required")
    if parts.username or parts.password:
        raise UnsafeFetchURLError("Credentials in URL are not allowed")

    host = parts.hostname.strip().lower()
    if host in {"localhost"} or host.endswith(".local"):
        raise UnsafeFetchURLError("Localhost URLs are not allowed")

    def _resolve_and_check() -> None:
        any_public = False
        for ip in _iter_ips(host):
            if not _is_public_ip(ip):
                raise UnsafeFetchURLError("URL resolves to a non-public IP address")
            any_public = True
        if not any_public:
            raise UnsafeFetchURLError("Failed to resolve hostname")

    # socket.getaddrinfo is blocking; run it off the event loop.
    await asyncio.to_thread(_resolve_and_check)


async def fetch_url_with_limit(
    url: str,
    *,
    max_bytes: int,
    timeout_seconds: float = 30.0,
) -> FetchedRemoteFile:
    await assert_url_is_safe_to_fetch(url)

    headers = {
        "User-Agent": "doc-k-leaner/1.0 (+local-security-audit)",
        "Accept": "*/*",
    }

    content = bytearray()
    async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=False) as client:
        current = httpx.URL(url)
        for _ in range(5):
            async with client.stream("GET", current, headers=headers) as resp:
                # Handle redirects explicitly so we can re-validate targets.
                if resp.status_code in {301, 302, 303, 307, 308}:
                    location = resp.headers.get("location")
                    if not location:
                        raise httpx.HTTPStatusError(
                            "Redirect without Location header", request=resp.request, response=resp
                        )
                    next_url = current.join(location)
                    await assert_url_is_safe_to_fetch(str(next_url))
                    current = next_url
                    continue

                resp.raise_for_status()
                content_type = (
                    (resp.headers.get("content-type") or "application/octet-stream").split(";")[0].strip()
                )

                async for chunk in resp.aiter_bytes():
                    if not chunk:
                        continue
                    content.extend(chunk)
                    if len(content) > max_bytes:
                        raise RemoteFileTooLargeError(
                            f"Remote file exceeds max size ({max_bytes} bytes)"
                        )

                return FetchedRemoteFile(
                    url=str(current),
                    content=bytes(content),
                    content_type=content_type,
                )

    raise UnsafeFetchURLError("Too many redirects")

