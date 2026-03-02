"""Service layer for communicating with the SolidityGuard microservice."""

import hashlib
import hmac
import json
import base64
import time
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 120.0


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _create_service_jwt() -> str:
    """Mint a JWT accepted by SolidityGuard using the shared secret."""
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(json.dumps({
        "sub": "dockcleaner-service",
        "email": "service@dockcleaner.local",
        "name": "Doc(k)leaner",
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }).encode())
    signing_input = f"{header}.{payload}"
    sig = hmac.new(
        settings.solidityguard_jwt_secret.encode(),
        signing_input.encode(),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{_b64url_encode(sig)}"


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_create_service_jwt()}"}


async def start_audit(
    files: list[tuple[str, bytes]],
    mode: str = "standard",
    tools: list[str] | None = None,
) -> dict[str, Any]:
    """Upload .sol files to SolidityGuard and start an audit.

    Args:
        files: List of (filename, content_bytes) tuples.
        mode: "quick" or "standard".
        tools: Tool list, defaults to ["pattern"] (lightweight).

    Returns:
        AuditStatus dict from SolidityGuard (contains 'id', 'status', etc.).
    """
    if tools is None:
        tools = ["pattern", "slither"]

    multipart_files = [
        ("files", (name, content, "text/plain"))
        for name, content in files
    ]
    data = {
        "mode": mode,
        "tools": json.dumps(tools),
    }

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.post(
            f"{settings.solidityguard_url}/api/audit",
            files=multipart_files,
            data=data,
            headers=_auth_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def get_audit_status(audit_id: str) -> dict[str, Any]:
    """Poll the status of a running audit."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.solidityguard_url}/api/audit/{audit_id}",
        )
        resp.raise_for_status()
        return resp.json()


async def get_audit_findings(
    audit_id: str,
    severity: str | None = None,
    category: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch findings for a completed audit."""
    params: dict[str, str] = {}
    if severity:
        params["severity"] = severity
    if category:
        params["category"] = category

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.solidityguard_url}/api/audit/{audit_id}/findings",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()


async def get_audit_report(audit_id: str) -> dict[str, Any]:
    """Fetch the full audit report (findings + markdown + score)."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.solidityguard_url}/api/audit/{audit_id}/report",
        )
        resp.raise_for_status()
        return resp.json()


async def get_audit_report_pdf(audit_id: str) -> bytes:
    """Download the PDF report as raw bytes."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.solidityguard_url}/api/audit/{audit_id}/report/pdf",
        )
        resp.raise_for_status()
        return resp.content


async def list_patterns(
    category: str | None = None,
    severity: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch all 104 vulnerability patterns from SolidityGuard."""
    params: dict[str, str] = {}
    if category:
        params["category"] = category
    if severity:
        params["severity"] = severity

    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{settings.solidityguard_url}/api/patterns",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()


async def health_check() -> bool:
    """Check if SolidityGuard is reachable."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.solidityguard_url}/api/patterns")
            return resp.status_code == 200
    except httpx.HTTPError:
        return False
