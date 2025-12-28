"""
Bootstrap module: Single initialization point for runtime concerns.

This module is called once at application startup to inject all concerns.
After bootstrap, core logic MUST NOT check toggles directly.
"""

from app.core.config import Settings
from app.providers.concerns_factory import inject_all_concerns


_concerns_cache = None


def initialize_concerns(settings: Settings) -> dict:
    """
    Initialize all cross-cutting concerns at application startup.
    
    Called once per application lifecycle.
    All toggles are evaluated HERE, not in core logic.
    """
    global _concerns_cache
    _concerns_cache = inject_all_concerns(settings)
    return _concerns_cache


def get_concerns() -> dict:
    """Get the globally initialized concerns dictionary."""
    if _concerns_cache is None:
        raise RuntimeError(
            "Concerns not initialized. Call initialize_concerns() at startup."
        )
    return _concerns_cache


def get_concern(name: str):
    """Get a specific concern by name."""
    concerns = get_concerns()
    if name not in concerns:
        raise KeyError(f"Unknown concern: {name}")
    return concerns[name]
