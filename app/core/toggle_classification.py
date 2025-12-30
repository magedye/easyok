"""
Toggle Classification: Immutable vs Runtime.

This module defines which toggles are immutable (cannot be disabled) vs
which can be toggled at runtime via Admin API.
"""

from enum import Enum
from typing import Set


class ToggleType(Enum):
    """Toggle classification."""
    IMMUTABLE = "immutable"
    RUNTIME = "runtime"


# Immutable toggles: Cannot be disabled under any circumstances.
# These are security and core governance mechanisms.
IMMUTABLE_TOGGLES: Set[str] = {
    "AUTH_ENABLED",           # Authentication is non-negotiable
    "RBAC_ENABLED",           # Role-based access control
    "RLS_ENABLED",            # Row-level security
    "SQLGUARD_ENABLED",       # SQL validation and security
    "ENABLE_AUDIT_LOGGING",   # Governance trail
}

# Runtime toggles: Can be toggled via Admin API with audit trail.
# These are performance, observability, and optional features.
RUNTIME_TOGGLES: Set[str] = {
    "ENABLE_SEMANTIC_CACHE",        # Performance optimization
    "ENABLE_RATE_LIMIT",            # Infrastructure protection
    "ENABLE_GZIP_COMPRESSION",      # Network optimization
    "ENABLE_ARABIC_NLP",            # Language feature
    "ENABLE_RAGAS_EVALUATION",      # Quality evaluation
    "ENABLE_RAG_QUALITY",           # RAG quality feature flag (lazy, optional)
    "ENABLE_SIGNOZ_ALERTS",         # Observability alerts
    "SENTRY_DSN",                   # Error tracking
}


def is_immutable(toggle_name: str) -> bool:
    """Check if a toggle is immutable (cannot be changed)."""
    return toggle_name in IMMUTABLE_TOGGLES


def is_runtime(toggle_name: str) -> bool:
    """Check if a toggle is runtime-changeable."""
    return toggle_name in RUNTIME_TOGGLES


def get_toggle_type(toggle_name: str) -> ToggleType:
    """Classify a toggle."""
    if is_immutable(toggle_name):
        return ToggleType.IMMUTABLE
    if is_runtime(toggle_name):
        return ToggleType.RUNTIME
    raise ValueError(f"Unknown toggle: {toggle_name}")
