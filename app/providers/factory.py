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

    if provider == "openai_compatible":
        from app.providers.llm.openai_compatible_provider import OpenAICompatibleProvider
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
        raise ValueError("GroqProvider is disabled; use openai_compatible with OPENAI_BASE_URL")

    raise ValueError(f"Unsupported LLM provider: {provider}")


def create_db_provider(settings: Settings):
    """Return a concrete database provider based on settings.DB_PROVIDER."""
    provider = settings.DB_PROVIDER.lower()

    if provider == "oracle":
        from app.providers.database.oracle_provider import OracleProvider

        return OracleProvider(settings)

    if provider == "mssql":
        from app.providers.database.mssql_provider import MSSQLProvider

        return MSSQLProvider(settings)

    raise ValueError(f"Unsupported DB provider: {provider}")


def create_vector_provider(settings: Settings):
    """Return a concrete vector store provider based on settings.VECTOR_DB."""
    provider = settings.VECTOR_DB.lower()

    if provider == "chromadb":
        from app.providers.vector.chroma_provider import ChromaProvider

        return ChromaProvider(settings)

    if provider == "qdrant":
        from app.providers.vector.qdrant_provider import QdrantProvider

        return QdrantProvider(settings)

    raise ValueError(f"Unsupported VECTOR DB provider: {provider}")


def create_training_embedding_service(settings: Settings):
    from app.services.training_embedding_service import TrainingEmbeddingService

    return TrainingEmbeddingService()
