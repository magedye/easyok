"""
Provider factory module.

This factory inspects application settings and returns the appropriate
database, vector store, and language model providers.  It avoids
importing heavy drivers unless necessary and isolates provider
instantiation from the rest of the codebase.
"""

from app.core.config import Settings
from app.providers.base import BaseLLMProvider

def create_llm_provider(settings: Settings) -> BaseLLMProvider:
    provider = settings.LLM_PROVIDER.lower()

    if provider == "openai":
        from app.providers.llm.openai_provider import OpenAIProvider
        return OpenAIProvider(settings)

    if provider == "google":
        from app.providers.llm.google_provider import GoogleProvider
        return GoogleProvider(settings)

    if provider == "ollama":
        from app.providers.llm.ollama_provider import OllamaProvider
        return OllamaProvider(settings)

    if provider == "phi3":
            from app.providers.llm.phi3_provider import Phi3Provider
            return Phi3Provider(settings)
    
        if provider == "groq":
            from app.providers.llm.groq_provider import GroqProvider
            return GroqProvider(settings)
    
        raise ValueError(f"Unsupported LLM provider: {provider}")