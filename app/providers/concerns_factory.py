"""
Concerns Factory: Single point of instantiation for all cross-cutting concerns.

This factory enforces the Null Object Pattern and prevents if statements from
appearing in orchestration or core logic.
"""

from app.core.config import Settings
from app.providers.concerns_base import (
    NoOpSemanticCache,
    NoOpArabicNLP,
    NoOpRateLimiter,
    NoOpAuditLogger,
    NoOpRAGASEvaluator,
    NoOpSentryHook,
    NoOpObservabilityExporter,
)


def get_semantic_cache(settings: Settings):
    """Return real or NoOp cache based on ENABLE_SEMANTIC_CACHE."""
    if not settings.ENABLE_SEMANTIC_CACHE:
        return NoOpSemanticCache()

    from app.services.semantic_cache_service import SemanticCacheService
    return SemanticCacheService(settings)


def get_arabic_nlp(settings: Settings):
    """Return real or NoOp Arabic engine based on ENABLE_ARABIC_NLP."""
    if not settings.ENABLE_ARABIC_NLP:
        return NoOpArabicNLP()

    from app.services.arabic_query_engine import ArabicQueryEngine
    return ArabicQueryEngine(settings)


def get_rate_limiter(settings: Settings):
    """Return real or NoOp rate limiter based on ENABLE_RATE_LIMIT."""
    if not settings.ENABLE_RATE_LIMIT:
        return NoOpRateLimiter()

    # Import real implementation when available
    # For now, return NoOp as placeholder
    return NoOpRateLimiter()


def get_audit_logger(settings: Settings):
    """Return real or NoOp audit logger based on ENABLE_AUDIT_LOGGING."""
    if not settings.ENABLE_AUDIT_LOGGING:
        return NoOpAuditLogger()

    from app.services.audit_service import AuditService
    return AuditService(settings)


def get_ragas_evaluator(settings: Settings):
    """Return real or NoOp RAGAS evaluator based on ENABLE_RAGAS_EVALUATION."""
    if not settings.ENABLE_RAGAS_EVALUATION:
        return NoOpRAGASEvaluator()

    from app.services.ragas_service import RAGASService
    return RAGASService(settings)


def get_sentry_hook(settings: Settings):
    """Return real or NoOp Sentry hook based on SENTRY_DSN."""
    if not settings.SENTRY_DSN:
        return NoOpSentryHook()

    from app.services.sentry_service import SentryService
    return SentryService(settings)


def get_observability_exporter(settings: Settings):
    """Return real or NoOp OTel exporter based on OTEL_EXPORTER_OTLP_ENDPOINT."""
    if not settings.OTEL_EXPORTER_OTLP_ENDPOINT:
        return NoOpObservabilityExporter()

    from app.services.observability_service import ObservabilityService
    return ObservabilityService(settings)


def inject_all_concerns(settings: Settings) -> dict:
    """
    Inject all concerns at bootstrap.
    
    Returns dict of concern_name -> instance.
    This is the ONLY place where if statements for concerns appear.
    """
    return {
        "semantic_cache": get_semantic_cache(settings),
        "arabic_nlp": get_arabic_nlp(settings),
        "rate_limiter": get_rate_limiter(settings),
        "audit_logger": get_audit_logger(settings),
        "ragas_evaluator": get_ragas_evaluator(settings),
        "sentry_hook": get_sentry_hook(settings),
        "observability_exporter": get_observability_exporter(settings),
    }
