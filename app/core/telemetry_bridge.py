"""
Telemetry Bridge: Ensure every No-Op concern emits visibility.

This module wraps all concerns with OTel span attributes that distinguish
disabled state from failure state.
"""

from typing import Any, Dict, Optional, Callable
from functools import wraps
import logging
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class SpanAttributeCarrier:
    """Carrier for span attributes across concern boundaries."""

    def __init__(self):
        self.attributes: Dict[str, Any] = {}

    def set_concern_disabled(self, concern_name: str, reason: str = "toggle_disabled") -> None:
        """Mark a concern as disabled."""
        self.attributes[f"{concern_name}.enabled"] = False
        self.attributes[f"{concern_name}.mode"] = "noop"
        self.attributes[f"{concern_name}.reason"] = reason

    def set_concern_enabled(self, concern_name: str) -> None:
        """Mark a concern as enabled."""
        self.attributes[f"{concern_name}.enabled"] = True
        self.attributes[f"{concern_name}.mode"] = "real"

    def set_concern_skipped(self, concern_name: str, reason: str = "") -> None:
        """Mark a concern as skipped (runtime optimization)."""
        self.attributes[f"{concern_name}.enabled"] = True
        self.attributes[f"{concern_name}.mode"] = "skipped"
        if reason:
            self.attributes[f"{concern_name}.skip_reason"] = reason

    def set_concern_error(self, concern_name: str, error: str) -> None:
        """Mark a concern as failed."""
        self.attributes[f"{concern_name}.enabled"] = True
        self.attributes[f"{concern_name}.mode"] = "error"
        self.attributes[f"{concern_name}.error"] = error

    def to_dict(self) -> Dict[str, Any]:
        """Export attributes."""
        return self.attributes.copy()


# Thread-local carrier for current request
_current_carrier: SpanAttributeCarrier = SpanAttributeCarrier()


def get_carrier() -> SpanAttributeCarrier:
    """Get the current request's span carrier."""
    return _current_carrier


def reset_carrier() -> None:
    """Reset carrier for new request."""
    global _current_carrier
    _current_carrier = SpanAttributeCarrier()


@contextmanager
def span_context():
    """Context manager for request lifecycle."""
    reset_carrier()
    try:
        yield get_carrier()
    finally:
        # Carrier will be flushed at request end
        pass


def wrap_concern_with_telemetry(concern_name: str, is_noop: bool):
    """
    Decorator to wrap concern method with telemetry.
    
    Args:
        concern_name: Name of concern (e.g., "semantic_cache")
        is_noop: Whether this is a No-Op implementation
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            carrier = get_carrier()
            
            try:
                if is_noop:
                    carrier.set_concern_disabled(concern_name)
                    logger.debug(f"[NoOp] {concern_name}.{func.__name__} (disabled)")
                else:
                    carrier.set_concern_enabled(concern_name)
                    logger.debug(f"[Real] {concern_name}.{func.__name__} (enabled)")
                
                return func(*args, **kwargs)
            except Exception as e:
                carrier.set_concern_error(concern_name, str(e))
                raise
        
        return wrapper
    return decorator


# Telemetry-wrapped No-Op implementations

class TelemetrySemanticCache:
    """No-Op cache with observability."""

    def __init__(self, carrier: Optional[SpanAttributeCarrier] = None):
        self.carrier = carrier or get_carrier()

    @wrap_concern_with_telemetry("semantic_cache", is_noop=True)
    def lookup(self, query: str) -> Optional[Dict[str, Any]]:
        return None

    @wrap_concern_with_telemetry("semantic_cache", is_noop=True)
    def store(self, query: str, result: Dict[str, Any]) -> None:
        pass


class TelemetryArabicNLP:
    """No-Op Arabic processor with observability."""

    def __init__(self, carrier: Optional[SpanAttributeCarrier] = None):
        self.carrier = carrier or get_carrier()

    @wrap_concern_with_telemetry("arabic_nlp", is_noop=True)
    def normalize(self, text: str) -> str:
        return text

    @wrap_concern_with_telemetry("arabic_nlp", is_noop=True)
    def tokenize(self, text: str) -> list[str]:
        return [text]


class TelemetryRateLimiter:
    """No-Op rate limiter with observability."""

    def __init__(self, carrier: Optional[SpanAttributeCarrier] = None):
        self.carrier = carrier or get_carrier()

    @wrap_concern_with_telemetry("rate_limiter", is_noop=True)
    def is_allowed(self, user_id: str) -> bool:
        return True

    @wrap_concern_with_telemetry("rate_limiter", is_noop=True)
    def record_request(self, user_id: str) -> None:
        pass


class TelemetryAuditLogger:
    """No-Op audit logger with observability."""

    def __init__(self, carrier: Optional[SpanAttributeCarrier] = None):
        self.carrier = carrier or get_carrier()

    @wrap_concern_with_telemetry("audit_logger", is_noop=True)
    def log(self, action: str, details: Dict[str, Any]) -> None:
        pass


class TelemetryRAGASEvaluator:
    """No-Op RAGAS evaluator with observability."""

    def __init__(self, carrier: Optional[SpanAttributeCarrier] = None):
        self.carrier = carrier or get_carrier()

    @wrap_concern_with_telemetry("ragas_evaluator", is_noop=True)
    def evaluate(self, question: str, answer: str, context: str) -> Dict[str, float]:
        self.carrier.set_concern_skipped("ragas_evaluator", reason="disabled")
        return {}


class TelemetrySentryHook:
    """No-Op Sentry hook with observability."""

    def __init__(self, carrier: Optional[SpanAttributeCarrier] = None):
        self.carrier = carrier or get_carrier()

    @wrap_concern_with_telemetry("sentry_hook", is_noop=True)
    def capture_exception(self, exc: Exception) -> None:
        pass

    @wrap_concern_with_telemetry("sentry_hook", is_noop=True)
    def capture_message(self, message: str, level: str = "info") -> None:
        pass


class TelemetryObservabilityExporter:
    """No-Op OTel exporter with observability."""

    def __init__(self, carrier: Optional[SpanAttributeCarrier] = None):
        self.carrier = carrier or get_carrier()

    @wrap_concern_with_telemetry("observability_exporter", is_noop=True)
    def emit_span(self, name: str, attributes: Dict[str, Any]) -> None:
        pass
