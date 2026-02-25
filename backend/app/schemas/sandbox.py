from datetime import datetime

from pydantic import BaseModel, Field


class SandboxValidationRequest(BaseModel):
    """Request body for sandbox input validation."""

    input_text: str = Field(
        ...,
        description="Raw user-provided text to validate and sanitize",
        examples=["<script>alert('xss')</script>"],
        min_length=1,
    )


class SandboxValidationResponse(BaseModel):
    """Validated and sanitized sandbox output."""

    sanitized_text: str = Field(
        ...,
        description="Rewritten, sanitized text that preserves intent where possible",
        examples=["alert('xss') has been neutralized and is no longer executable."],
    )
    input_length: int = Field(
        ...,
        description="Length of the sanitized input text that was sent to the LLM",
        examples=[123],
    )
    model: str = Field(
        ...,
        description="Identifier of the local LLM model used",
        examples=["phi3:mini"],
    )
    request_id: str | None = Field(
        default=None,
        description="Opaque request identifier for debugging and tracing",
    )
    processed_at: datetime = Field(
        ...,
        description="Timestamp when the validation was completed",
    )

