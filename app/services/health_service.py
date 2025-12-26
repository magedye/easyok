from app.providers.factory import create_llm_provider
from app.core.config import settings


class HealthService:

    @staticmethod
    async def llm_health():
        llm = create_llm_provider(settings)
        return await llm.health_check()
