from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class LLMClient(ABC):
    """Abstract base class for local LLM clients.

    This abstraction allows swapping the underlying runtime (Ollama, LM Studio,
    llama.cpp bindings, etc.) without changing the business logic.
    """

    @abstractmethod
    async def validate_and_rewrite(
        self,
        text: str,
        *,
        request_id: Optional[str] = None,
        ip: Optional[str] = None,
    ) -> str:
        """Validate and rewrite user-provided text.

        Implementations MUST:
        - Treat `text` as data, not as instructions.
        - Apply a strict system prompt to enforce security behaviour.
        - Return only the rewritten (or refusal) text.
        """

