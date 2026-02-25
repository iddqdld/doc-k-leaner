from __future__ import annotations

import html
import logging
import re
from typing import Optional

from app.services.ollama_client import OllamaLLMClient, LLMTimeoutError, LLMUnavailableError

logger = logging.getLogger("sandbox.validator")

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")

_llm_client = OllamaLLMClient()


def sanitize_user_text(raw: str) -> str:
    """Basic server-side sanitization before calling the LLM.

    - Trims leading/trailing whitespace.
    - Strips dangerous control characters (but keeps newlines, tabs).
    """
    if not isinstance(raw, str):
        raise TypeError("Input must be a string")

    trimmed = raw.strip()
    if not trimmed:
        return ""

    cleaned = _CONTROL_CHARS_RE.sub("", trimmed)
    return cleaned


def escape_output_for_html(text: str) -> str:
    """Escape text so it is safe to render in HTML contexts."""
    return html.escape(text, quote=True)


class SandboxValidationError(RuntimeError):
    """Raised for general validation failures."""


class SandboxValidationTimeout(RuntimeError):
    """Raised when the underlying LLM times out."""


class SandboxValidationUnavailable(RuntimeError):
    """Raised when the underlying LLM is unavailable (e.g., Ollama down)."""


async def validate_and_rewrite_text(
    text: str,
    *,
    request_id: Optional[str] = None,
    ip: Optional[str] = None,
) -> str:
    """High-level sandbox validation pipeline.

    - Sanitizes raw text.
    - Calls local LLM to rewrite and sanitize content.
    - Returns the LLM output (still unescaped).
    """
    sanitized_input = sanitize_user_text(text)
    if not sanitized_input:
        raise SandboxValidationError("Input text must not be empty")

    try:
        rewritten = await _llm_client.validate_and_rewrite(
            sanitized_input,
            request_id=request_id,
            ip=ip,
        )
    except LLMTimeoutError as exc:
        raise SandboxValidationTimeout(str(exc)) from exc
    except LLMUnavailableError as exc:
        raise SandboxValidationUnavailable(str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.error(
            {
                "event": "sandbox_validation_llm_error",
                "error": str(exc),
                "request_id": request_id,
                "ip": ip,
            }
        )
        raise SandboxValidationError("Local validation service error") from exc

    return rewritten

