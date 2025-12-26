"""
Google LLM provider stub.

This class acts as a placeholder for a Google LLM provider.  Actual
implementation requires integrating with Google's AI APIs (e.g. PaLM).
"""

from typing import Dict, List
from dataclasses import dataclass

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseLLMProvider


@dataclass
class GoogleProvider(BaseLLMProvider):
    settings: Settings

    def __post_init__(self) -> None:
        if not self.settings.GOOGLE_API_KEY:
            raise AppException("Google API key is not configured")
        # TODO: Initialise Google AI client with the API key

    def generate_sql(self, prompt: str, temperature: float, max_tokens: int) -> str:
        # TODO: Call Google AI service
        raise AppException("Google LLM provider not implemented")

    def generate_summary(self, question: str, sql: str, results: List[Dict[str, str]]) -> str:
        # TODO: Call Google AI summarisation
        raise AppException("Google LLM provider not implemented")