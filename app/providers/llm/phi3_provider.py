from openai import AsyncOpenAI
from app.providers.base import BaseLLMProvider
from app.core.config import Settings


class Phi3Provider(BaseLLMProvider):
    """
    PHI-3 LLM Provider
    OpenAI-compatible, self-hosted
    """

    def __init__(self, settings: Settings):
        self.client = AsyncOpenAI(
            api_key=settings.PHI3_API_KEY,
            base_url=settings.PHI3_BASE_URL,
        )
        self.model = settings.PHI3_MODEL
        self.temperature = settings.LLM_TEMPERATURE
        self.max_tokens = settings.LLM_MAX_TOKENS

    async def generate_sql(self, prompt: str) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a SQL expert."},
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )

        return response.choices[0].message.content.strip()
