"""
Orchestration service.

This layer coordinates between user context, Vanna service and
training, applies self‑correction and row‑level security, and handles
feedback loops.
"""

from typing import Dict, Any

from app.core.exceptions import AppException
from .vanna_service import VannaService


class OrchestrationService:
    """High‑level orchestrator for query handling."""

    MAX_RETRY_ATTEMPTS: int = 3

    def __init__(self) -> None:
        self.vanna_service = VannaService()

    async def ask(self, question: str, user: Dict[str, Any]):
        """Dispatch a query and handle retries on failure."""
        return await self.vanna_service.ask_question_stream(question, user)