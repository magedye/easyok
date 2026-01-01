"""
Application configuration facade.

This module exposes the Settings model and cached accessors.
It intentionally contains no tier-specific or business logic.
"""

from app.core.settings import Settings, get_settings, settings

__all__ = ["Settings", "get_settings", "settings"]
