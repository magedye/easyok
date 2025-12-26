"""
Ollama LLM provider stub.

This provider integrates with a local or remote Ollama server.  It
assumes the model is specified via `settings.OLLAMA_MODEL`.  Actual
network calls are not implemented here.
"""

from typing import Dict, List
from dataclasses import dataclass

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseLLMProvider


@dataclass
class OllamaProvider(BaseLLMProvider):
    settings: Settings

    def __post_init__(self) -> None:
        if not self.settings.OLLAMA_MODEL:
            raise AppException("Ollama model name not configured")
        # TODO: Connect to Ollama server and load model

    def generate_sql(self, prompt: str, temperature: float, max_tokens: int) -> str:
        # TODO: Call Ollama model
        raise AppException("Ollama LLM provider not implemented")

    def generate_summary(self, question: str, sql: str, results: List[Dict[str, str]]) -> str:
        # TODO: Call Ollama model for summarisation
        raise AppException("Ollama LLM provider not implemented")