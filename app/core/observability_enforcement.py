"""
Observability Enforcement: Prevent silent failures of No-Op services.

This module ensures:
1. Every No-Op has emitted span attributes
2. No-Op transparency is verified before request completion
3. Admin dashboards show disabled ≠ failed distinction
"""

from typing import Callable, TypeVar, Any
from functools import wraps
from app.core.concern_lifecycle import ConcernLifecycleTracker, ConcernState

T = TypeVar('T')

_request_tracker: ConcernLifecycleTracker = ConcernLifecycleTracker()


def get_request_tracker() -> ConcernLifecycleTracker:
    """Get current request's concern lifecycle tracker."""
    return _request_tracker


def reset_request_tracker() -> ConcernLifecycleTracker:
    """Reset tracker for new request and return old one."""
    global _request_tracker
    old_tracker = _request_tracker
    _request_tracker = ConcernLifecycleTracker()
    return old_tracker


def require_observability(concern_name: str, is_noop: bool):
    """
    Decorator: Require that No-Op service emits lifecycle event.
    
    Usage:
        @require_observability('semantic_cache', is_noop=True)
        def lookup(self, query):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            tracker = get_request_tracker()
            
            try:
                result = func(*args, **kwargs)
                
                if is_noop:
                    # Record No-Op execution
                    if result is None or result == [] or result == {}:
                        tracker.record_disabled(
                            concern_name,
                            method=func.__name__,
                            reason="noop_implementation"
                        )
                    else:
                        tracker.record_skipped(
                            concern_name,
                            method=func.__name__,
                            reason="returned_result_from_noop"
                        )
                else:
                    # Record real execution
                    tracker.record_enabled(
                        concern_name,
                        method=func.__name__,
                        result=result
                    )
                
                return result
            except Exception as e:
                tracker.record_error(concern_name, func.__name__, str(e))
                raise
        
        return wrapper
    return decorator


def verify_observability_before_response() -> dict[str, Any]:
    """
    Verify observability transparency before sending response.
    
    Called at request end. Raises AssertionError if:
    - No-Op service did not emit visibility
    - Silent failure detected
    
    Returns span attributes to embed in response headers.
    """
    tracker = get_request_tracker()
    
    try:
        tracker.verify_transparency()
    except AssertionError as e:
        raise AssertionError(
            f"Observability Integrity Violation: {str(e)}. "
            "No-Op services must emit lifecycle events."
        )
    
    return tracker.to_span_attributes()


def is_concern_disabled_not_failed(span_attrs: dict, concern_name: str) -> bool:
    """
    Check if concern is disabled (not failed).
    
    Returns True if:
    - Concern is disabled AND
    - No error occurred
    
    This distinction is critical for admin dashboards.
    """
    state_key = f"{concern_name}.state"
    error_key = f"{concern_name}.error"
    
    if state_key not in span_attrs:
        return False
    
    is_disabled = span_attrs[state_key] == "disabled"
    has_error = error_key in span_attrs
    
    return is_disabled and not has_error


def get_observability_summary(span_attrs: dict) -> dict:
    """
    Extract observability summary from span attributes.
    
    Returns dict showing which concerns are:
    - enabled (real)
    - disabled (no-op)
    - skipped (runtime optimization)
    - errored (failure)
    """
    summary = {
        "enabled": [],
        "disabled": [],
        "skipped": [],
        "errored": [],
    }
    
    # Extract concern states from span attrs
    seen_concerns = set()
    for key, value in span_attrs.items():
        if ".state" in key:
            concern_name = key.replace(".state", "")
            seen_concerns.add(concern_name)
            state = value
            summary[state].append(concern_name)
    
    return summary
