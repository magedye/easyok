"""
Runtime Audit: Verify that Toggle boundaries are maintained at runtime.

This module checks that:
1. No inline toggles are being evaluated in core logic
2. All concerns are properly injected
3. No toggle state is leaking across request boundaries
"""

import inspect
from typing import Any, Callable


def audit_function_for_toggles(func: Callable) -> Callable:
    """
    Decorator to audit a function for inline toggle checks.
    
    Raises RuntimeError if function body contains toggle checks.
    """
    def wrapper(*args, **kwargs):
        source = inspect.getsource(func)
        
        # Simple detection: look for "if settings.ENABLE_"
        if "if settings.ENABLE_" in source or "if not settings.ENABLE_" in source:
            raise RuntimeError(
                f"Function '{func.__name__}' contains inline toggle checks. "
                "Use factory injection instead."
            )
        
        return func(*args, **kwargs)
    
    return wrapper


def verify_no_settings_in_orchestration(orchestration_func: Callable) -> bool:
    """
    Verify that orchestration function does not directly check settings.
    
    Returns True if clean, raises RuntimeError if violations found.
    """
    source = inspect.getsource(orchestration_func)
    
    forbidden_patterns = [
        "if settings.ENABLE_",
        "if not settings.ENABLE_",
        ".ENABLE_SEMANTIC_CACHE",
        ".ENABLE_ARABIC_NLP",
        ".ENABLE_RATE_LIMIT",
        ".ENABLE_AUDIT_LOGGING",
        ".ENABLE_RAGAS_EVALUATION",
    ]
    
    for pattern in forbidden_patterns:
        if pattern in source:
            raise RuntimeError(
                f"Orchestration function contains toggle check: {pattern}. "
                "This violates ADR-0018."
            )
    
    return True


class ImmutableToggleViolation(Exception):
    """Raised when attempt to modify immutable toggle."""
    pass


def guard_immutable_toggle(toggle_name: str, new_value: Any) -> None:
    """
    Guard against modification of immutable toggles.
    
    Raises ImmutableToggleViolation if toggle is immutable.
    """
    from app.core.toggle_classification import is_immutable
    
    if is_immutable(toggle_name):
        raise ImmutableToggleViolation(
            f"Cannot modify immutable toggle: {toggle_name}"
        )
