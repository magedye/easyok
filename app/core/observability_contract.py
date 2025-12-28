"""
EasyData v16.7 – Observability Contract
======================================

Purpose:
Ensure absolute transparency (Disabled ≠ Silent).

This contract prevents silent failures and unexplained states
inside the Orchestrator.
"""

from __future__ import annotations
from enum import Enum
from typing import Any, Dict, Protocol, Optional, runtime_checkable
from dataclasses import dataclass, field
from datetime import datetime

# ---------------------------------------------------------------------
# 1. Execution Modes Definition
# ---------------------------------------------------------------------

class ConcernMode(str, Enum):
    """Canonical execution modes for any service inside EasyData."""
    REAL = "real"            # Real execution
    NOOP = "noop"            # Service is programmatically disabled (Toggle OFF)
    SKIPPED = "skipped"      # Execution skipped (e.g., cache hit)
    ERROR = "error"          # Execution attempted but failed


# ---------------------------------------------------------------------
# 2. Core Observability Protocol
# ---------------------------------------------------------------------

@runtime_checkable
class ObservableConcern(Protocol):
    """Base structural contract for all observable services."""
    concern_name: str

    def emit_observability(
        self,
        tracker: "ConcernLifecycleTracker",
        mode: ConcernMode,
    ) -> None:
        """Emit service state signals to the tracking system."""
        ...


# ---------------------------------------------------------------------
# 3. Specific Service Protocols
# ---------------------------------------------------------------------

class ObservableSemanticCache(Protocol):
    def lookup(
        self,
        query: str,
        tracker: Optional["ConcernLifecycleTracker"] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        In No-Op mode:
        - Returns None
        - Records mode=noop in the tracker
        """
        ...

    def store(
        self,
        query: str,
        result: Dict[str, Any],
        tracker: Optional["ConcernLifecycleTracker"] = None,
    ) -> None:
        ...


class ObservableArabicNLP(Protocol):
    def normalize(
        self,
        text: str,
        tracker: Optional["ConcernLifecycleTracker"] = None,
    ) -> str:
        """
        In No-Op mode:
        - Returns original text
        - Records execution state
        """
        ...


class ObservableRateLimiter(Protocol):
    def is_allowed(
        self,
        user_id: str,
        tracker: Optional["ConcernLifecycleTracker"] = None,
    ) -> bool:
        """
        In No-Op mode:
        - Always returns True
        - Records that bypass occurred
        """
        ...


class ObservableRAGASEvaluator(Protocol):
    def evaluate(
        self,
        question: str,
        answer: str,
        context: str,
        tracker: Optional["ConcernLifecycleTracker"] = None,
    ) -> Dict[str, float]:
        """
        In No-Op mode:
        - Returns an empty dict
        - Records the advisory-only state
        """
        ...


# ---------------------------------------------------------------------
# 4. Lifecycle Tracking Engine
# ---------------------------------------------------------------------

@dataclass
class ConcernLifecycleTracker:
    """
    Tracks the execution state of each service
    during a single request lifecycle (trace_id).
    """
    trace_id: str
    states: Dict[str, ConcernMode] = field(default_factory=dict)

    def record_state(self, concern_name: str, mode: ConcernMode) -> None:
        """Record state to ensure visibility in NDJSON and OpenTelemetry."""
        self.states[concern_name] = mode

    def get_attributes(self) -> Dict[str, Any]:
        """Convert states into OpenTelemetry-compatible attributes."""
        attributes: Dict[str, Any] = {}
        for name, mode in self.states.items():
            attributes[f"{name}.enabled"] = (mode == ConcernMode.REAL)
            attributes[f"{name}.mode"] = mode.value
        return attributes


# ---------------------------------------------------------------------
# 5. Contract Enforcement Logic
# ---------------------------------------------------------------------

class ObservabilityViolation(Exception):
    """Raised when a No-Op service is invoked without a lifecycle tracker."""
    pass


def enforce_observability(
    concern_name: str,
    is_noop: bool,
    tracker: Optional[ConcernLifecycleTracker],
) -> None:
    """
    Ensure that a disabled (No-Op) service emits its state
    and never fails silently.
    """
    if is_noop and tracker is None:
        raise ObservabilityViolation(
            f"Architecture Breach: No-Op service '{concern_name}' invoked without tracker. "
            "Silence is forbidden in EasyData v16.7."
        )

    if tracker:
        mode = ConcernMode.NOOP if is_noop else ConcernMode.REAL
        tracker.record_state(concern_name, mode)
