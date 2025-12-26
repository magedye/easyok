"""
OpenAI LLM provider.

This provider uses the OpenAI API to generate SQL and summaries.
It expects an API key in settings.OPENAI_API_KEY.  If the key is
missing or invalid, an exception will be raised.
"""

from typing import Dict, List
from dataclasses import dataclass
import openai  # type: ignore

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseLLMProvider


@dataclass
class OpenAIProvider(BaseLLMProvider):
    settings: Settings

    def __post_init__(self) -> None:
        if not self.settings.OPENAI_API_KEY:
            raise AppException("OpenAI API key is not configured")
        openai.api_key = self.settings.OPENAI_API_KEY

    def generate_sql(self, prompt: str, temperature: float, max_tokens: int) -> str:
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = response["choices"][0]["message"]["content"]
            return content.strip()
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