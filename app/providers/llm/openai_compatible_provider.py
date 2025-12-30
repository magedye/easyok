from dataclasses import dataclass
from typing import Dict, List

import openai  # type: ignore

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseLLMProvider


@dataclass
class OpenAICompatibleProvider(BaseLLMProvider):
    """LLM provider for OpenAI-compatible HTTP endpoints (e.g., Groq)."""

    settings: Settings

    def __post_init__(self) -> None:
        if not self.settings.OPENAI_API_KEY:
            raise AppException("OpenAI-compatible API key is not configured")
        openai.api_key = self.settings.OPENAI_API_KEY
        if getattr(self.settings, "OPENAI_BASE_URL", None):
            openai.api_base = self.settings.OPENAI_BASE_URL
        self.model = self.settings.OPENAI_MODEL

    def generate_sql(self, prompt: str, temperature: float, max_tokens: int) -> str:
        try:
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            raise AppException(str(exc))

    def generate_summary(self, question: str, sql: str, results: List[Dict[str, str]]) -> str:
        try:
            context = str(results[:5])
            prompt = (
                f"You are a data analyst. The user asked: '{question}'.\n"
                f"The SQL executed was: {sql}.\n"
                f"Here are some of the results: {context}.\n"
                "Provide a concise, plain language summary of the findings."
            )
            response = openai.ChatCompletion.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=200,
            )
            return response["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            raise AppException(str(exc))

    async def health_check(self) -> bool:
        return True
