"""
OpenAI‑compatible LLM provider stub.

This provider wraps services that conform to the OpenAI API (e.g.
Groq, together.ai).  Implementation will require setting an API
endpoint and key.  For now it behaves like the standard OpenAI
provider but with a configurable base URL.
"""

from typing import Dict, List
from dataclasses import dataclass
import openai  # type: ignore

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseLLMProvider


@dataclass
class OpenAICompatibleProvider(BaseLLMProvider):
    settings: Settings

    def __post_init__(self) -> None:
        if not self.settings.OPENAI_API_KEY:
            raise AppException("OpenAI‑compatible API key is not configured")
        # Configure base URL if needed.  Some providers require
        # setting openai.api_base and openai.api_key.
        # openai.api_base = "https://your-provider-endpoint"
        openai.api_key = self.settings.OPENAI_API_KEY

    def generate_sql(self, prompt: str, temperature: float, max_tokens: int) -> str:
        # Use OpenAI client but support alternative endpoints
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
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
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=200,
            )
            return response["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            raise AppException(str(exc))