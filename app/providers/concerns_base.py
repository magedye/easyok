"""
Base protocols for isolated cross-cutting concerns.

Each concern must have a Real and NoOp implementation adhering to these protocols.
"""

from typing import Any, Protocol, Optional, Dict
from abc import ABC


class SemanticCacheProtocol(Protocol):
    """Interface for semantic cache services."""

    def lookup(self, query: str) -> Optional[Dict[str, Any]]:
        """Return cached result or None if miss."""
        ...

    def store(self, query: str, result: Dict[str, Any]) -> None:
        """Store query result in cache."""
        ...


class ArabicNLPProtocol(Protocol):
    """Interface for Arabic NLP processing."""

    def normalize(self, text: str) -> str:
        """Normalize Arabic text."""
        ...

    def tokenize(self, text: str) -> list[str]:
        """Tokenize Arabic text."""
        ...


class RateLimiterProtocol(Protocol):
    """Interface for rate limiting."""

    def is_allowed(self, user_id: str) -> bool:
        """Check if request is within rate limit."""
        ...

    def record_request(self, user_id: str) -> None:
        """Record a user request."""
        ...


class AuditLoggerProtocol(Protocol):
    """Interface for audit logging."""

    def log(self, action: str, details: Dict[str, Any]) -> None:
        """Log an action with details."""
        ...


class RAGASEvaluatorProtocol(Protocol):
    """Interface for RAGAS evaluation."""

    def evaluate(self, question: str, answer: str, context: str) -> Dict[str, float]:
        """Evaluate answer quality."""
        ...


class SentryHookProtocol(Protocol):
    """Interface for Sentry error tracking."""

    def capture_exception(self, exc: Exception) -> None:
        """Capture and send exception to Sentry."""
        ...

    def capture_message(self, message: str, level: str = "info") -> None:
        """Capture and send message to Sentry."""
        ...


class ObservabilityExporterProtocol(Protocol):
    """Interface for OpenTelemetry exporters."""

    def emit_span(self, name: str, attributes: Dict[str, Any]) -> None:
        """Emit a traced span."""
        ...


# Null Object Implementations

class NoOpSemanticCache:
    """Cache that always misses."""

    def lookup(self, query: str) -> Optional[Dict[str, Any]]:
        return None

    def store(self, query: str, result: Dict[str, Any]) -> None:
        pass


class NoOpArabicNLP:
    """Arabic processor that returns input unchanged."""

    def normalize(self, text: str) -> str:
        return text

    def tokenize(self, text: str) -> list[str]:
        return [text]


class NoOpRateLimiter:
    """Rate limiter that always allows."""

    def is_allowed(self, user_id: str) -> bool:
        return True

    def record_request(self, user_id: str) -> None:
        pass


class NoOpAuditLogger:
    """Logger that silently drops records."""

    def log(self, action: str, details: Dict[str, Any]) -> None:
        pass


class NoOpRAGASEvaluator:
    """Evaluator that returns empty scores."""

    def evaluate(self, question: str, answer: str, context: str) -> Dict[str, float]:
        return {}


class NoOpSentryHook:
    """Sentry hook that silently ignores errors."""

    def capture_exception(self, exc: Exception) -> None:
        pass

    def capture_message(self, message: str, level: str = "info") -> None:
        pass


class NoOpObservabilityExporter:
    """Exporter that silently drops spans."""

    def emit_span(self, name: str, attributes: Dict[str, Any]) -> None:
        pass
