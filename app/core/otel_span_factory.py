"""
OpenTelemetry Span Factory: Create deterministic spans for concern lifecycle.

Every concern invocation emits a span attribute showing enabled/disabled state.
No span = no visibility. No visibility = governance failure.
"""

from typing import Any, Dict, Optional, Callable, TypeVar
from functools import wraps
from contextvars import ContextVar

T = TypeVar('T')

# Context variable to hold current span attributes
_span_attributes: ContextVar[Dict[str, Any]] = ContextVar(
    'span_attributes',
    default={}
)


def get_span_attributes() -> Dict[str, Any]:
    """Get current span attributes."""
    return _span_attributes.get().copy()


def set_span_attributes(attrs: Dict[str, Any]) -> None:
    """Set span attributes for current context."""
    current = _span_attributes.get().copy()
    current.update(attrs)
    _span_attributes.set(current)


def add_concern_attribute(concern_name: str, enabled: bool, mode: str, **kwargs) -> None:
    """
    Add concern state to current span.
    
    Args:
        concern_name: Name of concern
        enabled: Whether concern is functionally enabled
        mode: One of 'real', 'noop', 'skipped', 'error'
        **kwargs: Additional attributes
    """
    attrs = {
        f"{concern_name}.enabled": enabled,
        f"{concern_name}.mode": mode,
    }
    attrs.update(kwargs)
    set_span_attributes(attrs)


def span_emit_concern_state(concern_name: str):
    """
    Decorator to emit concern state as span attribute.
    
    Usage:
        @span_emit_concern_state('semantic_cache')
        def lookup(self, query: str):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Detect if this is a NoOp by checking class name
            is_noop = 'NoOp' in args[0].__class__.__name__ if args else False
            is_telemetry_noop = 'Telemetry' in args[0].__class__.__name__ if args else False
            
            mode = 'noop' if (is_noop or is_telemetry_noop) else 'real'
            enabled = not is_noop and not is_telemetry_noop
            
            add_concern_attribute(
                concern_name,
                enabled=enabled,
                mode=mode,
                method=func.__name__
            )
            
            return func(*args, **kwargs)
        
        return wrapper
    return decorator


class OTelSpanBuilder:
    """Builder for creating properly attributed spans."""

    def __init__(self, span_name: str):
        self.span_name = span_name
        self.attributes = {}

    def with_concern_enabled(self, concern_name: str) -> 'OTelSpanBuilder':
        """Mark concern as enabled."""
        self.attributes[f"{concern_name}.enabled"] = True
        self.attributes[f"{concern_name}.mode"] = "real"
        return self

    def with_concern_disabled(self, concern_name: str, reason: str = "") -> 'OTelSpanBuilder':
        """Mark concern as disabled."""
        self.attributes[f"{concern_name}.enabled"] = False
        self.attributes[f"{concern_name}.mode"] = "noop"
        if reason:
            self.attributes[f"{concern_name}.reason"] = reason
        return self

    def with_concern_skipped(self, concern_name: str, reason: str = "") -> 'OTelSpanBuilder':
        """Mark concern as skipped at runtime."""
        self.attributes[f"{concern_name}.enabled"] = True
        self.attributes[f"{concern_name}.mode"] = "skipped"
        if reason:
            self.attributes[f"{concern_name}.skip_reason"] = reason
        return self

    def with_custom_attribute(self, key: str, value: Any) -> 'OTelSpanBuilder':
        """Add custom attribute."""
        self.attributes[key] = value
        return self

    def build(self) -> Dict[str, Any]:
        """Build final attributes dictionary."""
        return {
            "span.name": self.span_name,
            **self.attributes
        }


def is_disabled_vs_failed(span_attributes: Dict[str, Any], concern_name: str) -> tuple[bool, bool]:
    """
    Disambiguate disabled state from failure state.
    
    Returns:
        (is_disabled, is_failed)
    """
    enabled = span_attributes.get(f"{concern_name}.enabled", True)
    mode = span_attributes.get(f"{concern_name}.mode", "real")
    
    is_disabled = not enabled and mode == "noop"
    is_failed = mode == "error"
    
    return (is_disabled, is_failed)


class TransparencyGuard:
    """Ensure No-Op services are transparent (not silent)."""

    @staticmethod
    def verify_noop_is_visible(concern_name: str, span_attrs: Dict[str, Any]) -> bool:
        """
        Verify that a No-Op service has emitted visibility attributes.
        
        Raises AssertionError if No-Op service failed to emit span.
        """
        key = f"{concern_name}.enabled"
        if key not in span_attrs:
            raise AssertionError(
                f"No-Op service '{concern_name}' did not emit visibility span. "
                "This violates Observability Integrity (Track C)."
            )
        
        if span_attrs[key] is not False:
            raise AssertionError(
                f"Service '{concern_name}' marked as enabled but should be disabled. "
                "Toggle mismatch detected."
            )
        
        return True
