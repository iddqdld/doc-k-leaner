"""
Sandbox Input Validation API

Routes:
    POST /api/sandbox/validate  - Validate and sanitize arbitrary text via local LLM
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.config import settings
from app.core.deps import get_optional_user
from app.db.postgres import get_db
from app.schemas.sandbox import (
    SandboxValidationRequest,
    SandboxValidationResponse,
)
from app.services.db_service import insert_sandbox_usage
from app.services.sandbox_validator import (
    SandboxValidationError,
    SandboxValidationTimeout,
    SandboxValidationUnavailable,
    escape_output_for_html,
    validate_and_rewrite_text,
)

router = APIRouter(
    prefix="/api/sandbox",
    tags=["sandbox"],
)

logger = logging.getLogger("sandbox.api")


_rate_limit_state: Dict[str, List[float]] = {}


async def enforce_rate_limit(request: Request) -> None:
    """Simple in-memory rate limiting per client IP.

    This is process-local and intended as a defense-in-depth layer.
    For production-grade rate limiting, use an external gateway/reverse proxy.
    """
    client_host = request.client.host if request.client else "unknown"
    now = time.time()
    window = float(settings.sandbox_rate_limit_window_seconds)
    max_requests = int(settings.sandbox_rate_limit_max_requests)

    timestamps = _rate_limit_state.get(client_host, [])
    timestamps = [t for t in timestamps if now - t < window]

    if len(timestamps) >= max_requests:
        logger.warning(
            {
                "event": "sandbox_rate_limited",
                "ip": client_host,
                "window_seconds": window,
                "max_requests": max_requests,
            }
        )
        raise HTTPException(
            status_code=429,
            detail="Too many validation requests. Please slow down.",
        )

    timestamps.append(now)
    _rate_limit_state[client_host] = timestamps


@router.post(
    "/validate",
    response_model=SandboxValidationResponse,
    summary="Validate and sanitize sandbox input",
    description=(
        "Validate and sanitize arbitrary user-provided text using a local LLM. "
        "The output aims to preserve the original intent while enforcing security best practices."
    ),
)
async def validate_sandbox_input(
    request: Request,
    payload: SandboxValidationRequest,
    _rate_limited: None = Depends(enforce_rate_limit),
    db=Depends(get_db),
    user: dict | None = Depends(get_optional_user),
) -> SandboxValidationResponse:
    """Validate and sanitize user-provided text for the sandbox feature."""
    raw_text = payload.input_text

    if len(raw_text) > settings.sandbox_max_input_chars:
        raise HTTPException(
            status_code=413,
            detail=f"Input text is too long (max {settings.sandbox_max_input_chars} characters).",
        )

    request_id = request.headers.get("X-Request-ID") or str(
        id(request)
    )  # lightweight opaque id
    ip = request.client.host if request.client else None

    logger.info(
        {
            "event": "sandbox_validate_request",
            "request_id": request_id,
            "ip": ip,
            "input_length": len(raw_text),
        }
    )

    try:
        rewritten = await validate_and_rewrite_text(
            raw_text,
            request_id=request_id,
            ip=ip,
        )
    except SandboxValidationTimeout:
        logger.warning(
            {
                "event": "sandbox_validate_timeout",
                "request_id": request_id,
                "ip": ip,
            }
        )
        raise HTTPException(
            status_code=503,
            detail="The validation service is currently unavailable. Please try again later.",
        )
    except SandboxValidationUnavailable:
        logger.warning(
            {
                "event": "sandbox_validate_unavailable",
                "request_id": request_id,
                "ip": ip,
            }
        )
        raise HTTPException(
            status_code=503,
            detail="The validation service is currently unavailable. Please try again later.",
        )
    except SandboxValidationError as exc:
        logger.error(
            {
                "event": "sandbox_validate_error",
                "request_id": request_id,
                "ip": ip,
                "error": str(exc),
            }
        )
        # Fail closed: do not return user input as sanitized output
        raise HTTPException(
            status_code=500,
            detail="Failed to validate input. Please try again later.",
        )

    escaped_output = escape_output_for_html(rewritten)

    try:
        owner_id = user["id"] if user else None
        await insert_sandbox_usage(db, raw_text, owner_id=owner_id)
    except Exception:
        logger.warning("Failed to log sandbox usage", exc_info=True)

    logger.info(
        {
            "event": "sandbox_validate_success",
            "request_id": request_id,
            "ip": ip,
            "output_length": len(rewritten),
        }
    )

    return SandboxValidationResponse(
        sanitized_text=escaped_output,
        input_length=len(raw_text),
        model=settings.sandbox_llm_model,
        request_id=request_id,
        processed_at=datetime.now(timezone.utc),
    )

