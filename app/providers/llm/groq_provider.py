import time
from groq import AsyncGroq

from app.providers.base import BaseLLMProvider
from app.core.config import Settings


class GroqProvider(BaseLLMProvider):
    """
    GROQ LLM Provider
    Uses official GROQ SDK (NOT OpenAI-compatible)
    """

    def __init__(self, settings: Settings):
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is required")

        self.client = AsyncGroq(
            api_key=settings.GROQ_API_KEY
        )

        self.model = settings.GROQ_MODEL
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS

    async def generate_sql(self, prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior SQL expert. Return ONLY valid SQL.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )

        return response.choices[0].message.content.strip()

    async def health_check(self) -> dict:
        start = time.monotonic()

        try:
            # GROQ supports models listing
            await self.client.models.list()

            latency = int((time.monotonic() - start) * 1000)

            return {
                "status": "healthy",
                "provider": "groq",
                "model": self.model,
                "latency_ms": latency,
                "error": None,
            }

        except Exception as e:
            return {
                "status": "unhealthy",
                "provider": "groq",
                "model": self.model,
                "latency_ms": None,
                "error": str(e),
            }
