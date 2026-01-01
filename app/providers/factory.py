"""
Provider factory module.

This factory inspects application settings and returns the appropriate
database, vector store, and language model providers.

Design principles:
- No tier-specific logic is enforced here.
- OPERATION_TIER routing is handled by higher orchestration layers.
- This module is intentionally conservative and dependency-isolated.
"""

from app.core.config import Settings
from app.providers.base import BaseLLMProvider


# ============================================================================
# LLM Provider Factory
# ============================================================================

def create_llm_provider(settings: Settings) -> BaseLLMProvider:
    """
    Create and return an LLM provider based on settings.LLM_PROVIDER.

    Notes:
    - This factory does NOT handle Vanna-native LLMs.
    - Vanna LLM services are instantiated separately via vanna_common.
    """
    provider = settings.LLM_PROVIDER.lower()

    if provider == "openai_compatible":
        from app.providers.llm.openai_compatible_provider import (
            OpenAICompatibleProvider,
        )
        return OpenAICompatibleProvider(settings)

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
        from app.providers.llm.openai_compatible_provider import (
            OpenAICompatibleProvider,
        )

        # Map Groq configuration into OpenAI-compatible fields
        # This preserves reuse without duplicating provider logic.
        if not settings.OPENAI_API_KEY and settings.GROQ_API_KEY:
            settings.OPENAI_API_KEY = settings.GROQ_API_KEY

        if not getattr(settings, "OPENAI_BASE_URL", None) and settings.GROQ_BASE_URL:
            settings.OPENAI_BASE_URL = settings.GROQ_BASE_URL

        if not settings.OPENAI_MODEL and settings.GROQ_MODEL:
            settings.OPENAI_MODEL = settings.GROQ_MODEL

        return OpenAICompatibleProvider(settings)

    raise ValueError(f"Unsupported LLM provider: {provider}")


# ============================================================================
# Database Provider Factory
# ============================================================================

def create_db_provider(settings: Settings):
    """
    Create and return a database provider based on settings.DB_PROVIDER.

    Notes:
    - Tier-specific governance is NOT enforced here.
    - Providers are instantiated in their native capability mode.
    """
    provider = settings.DB_PROVIDER.lower()

    if provider == "oracle":
        from app.providers.database.oracle_provider import OracleProvider
        return OracleProvider(settings)

    if provider == "mssql":
        from app.providers.database.mssql_provider import MSSQLProvider
        return MSSQLProvider(settings)

    raise ValueError(f"Unsupported DB provider: {provider}")


# ============================================================================
# Vector Store Provider Factory
# ============================================================================

def create_vector_provider(settings: Settings):
    """
    Create and return a vector store provider based on settings.VECTOR_DB.
    """
    provider = settings.VECTOR_DB.lower()

    if provider == "chromadb":
        from app.providers.vector.chroma_provider import ChromaProvider
        return ChromaProvider(settings)

    if provider == "qdrant":
        from app.providers.vector.qdrant_provider import QdrantProvider
        return QdrantProvider(settings)

    raise ValueError(f"Unsupported VECTOR DB provider: {provider}")


# ============================================================================
# Training / Embedding Services
# ============================================================================

def create_training_embedding_service(settings: Settings):
    """
    Create the training embedding service.

    Notes:
    - This is intentionally decoupled from vector provider selection.
    - Tier-based enforcement is handled by the caller.
    """
    from app.services.training_embedding_service import TrainingEmbeddingService
    return TrainingEmbeddingService()
