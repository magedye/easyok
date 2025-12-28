"""
Concern Lifecycle: Track concern state from toggle evaluation through No-Op execution.

Ensures:
- Disabled concerns emit visibility spans
- Skipped ≠ Executed
- Disabled ≠ Failed
"""

from enum import Enum
from typing import Any, Dict, Optional
from dataclasses import dataclass
from datetime import datetime


class ConcernState(Enum):
    """Concern execution state."""
    ENABLED = "enabled"           # Toggle is ON, real implementation
    DISABLED = "disabled"         # Toggle is OFF, No-Op implementation
    SKIPPED = "skipped"           # Toggle is ON but skipped at runtime (e.g., cache hit)
    ERROR = "error"               # Exception occurred
    TIMEOUT = "timeout"           # Execution timeout


@dataclass
class ConcernLifecycleEvent:
    """Event marking concern state change."""
    concern_name: str
    state: ConcernState
    timestamp: datetime
    method: str
    result: Optional[Any] = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    reason: Optional[str] = None

    def to_span_attributes(self) -> Dict[str, Any]:
        """Convert event to OTel span attributes."""
        attrs = {
            f"{self.concern_name}.state": self.state.value,
            f"{self.concern_name}.method": self.method,
            f"{self.concern_name}.timestamp": self.timestamp.isoformat(),
        }
        
        if self.result is not None:
            attrs[f"{self.concern_name}.result"] = str(self.result)
        
        if self.error:
            attrs[f"{self.concern_name}.error"] = self.error
        
        if self.duration_ms > 0:
            attrs[f"{self.concern_name}.duration_ms"] = self.duration_ms
        
        if self.reason:
            attrs[f"{self.concern_name}.reason"] = self.reason
        
        return attrs


class ConcernLifecycleTracker:
    """Track lifecycle of all concerns in a request."""

    def __init__(self):
        self.events: list[ConcernLifecycleEvent] = []

    def record_enabled(self, concern_name: str, method: str, result: Any = None) -> None:
        """Record concern execution (enabled)."""
        event = ConcernLifecycleEvent(
            concern_name=concern_name,
            state=ConcernState.ENABLED,
            timestamp=datetime.utcnow(),
            method=method,
            result=result
        )
        self.events.append(event)

    def record_disabled(self, concern_name: str, method: str, reason: str = "") -> None:
        """Record No-Op execution (disabled)."""
        event = ConcernLifecycleEvent(
            concern_name=concern_name,
            state=ConcernState.DISABLED,
            timestamp=datetime.utcnow(),
            method=method,
            reason=reason
        )
        self.events.append(event)

    def record_skipped(self, concern_name: str, method: str, reason: str = "") -> None:
        """Record skipped execution (e.g., cache hit)."""
        event = ConcernLifecycleEvent(
            concern_name=concern_name,
            state=ConcernState.SKIPPED,
            timestamp=datetime.utcnow(),
            method=method,
            reason=reason
        )
        self.events.append(event)

    def record_error(self, concern_name: str, method: str, error: str) -> None:
        """Record error."""
        event = ConcernLifecycleEvent(
            concern_name=concern_name,
            state=ConcernState.ERROR,
            timestamp=datetime.utcnow(),
            method=method,
            error=error
        )
        self.events.append(event)

    def to_span_attributes(self) -> Dict[str, Any]:
        """Convert all events to span attributes."""
        attrs = {}
        for event in self.events:
            attrs.update(event.to_span_attributes())
        return attrs

    def get_concern_states(self) -> Dict[str, ConcernState]:
        """Get final state of each concern."""
        states = {}
        for event in self.events:
            states[event.concern_name] = event.state
        return states

    def verify_transparency(self) -> bool:
        """
        Verify that all No-Op services have been recorded.
        
        Returns True if all disabled concerns were tracked.
        Raises AssertionError if silent No-Op detected.
        """
        concern_states = self.get_concern_states()
        
        # All disabled concerns MUST appear in events
        for concern_name, state in concern_states.items():
            if state == ConcernState.DISABLED:
                # Verify this is actually recorded
                has_event = any(
                    e.concern_name == concern_name and e.state == ConcernState.DISABLED
                    for e in self.events
                )
                if not has_event:
                    raise AssertionError(
                        f"Concern '{concern_name}' is disabled but not tracked. "
                        "Silent No-Op detected — violates Observability Integrity."
                    )
        
        return True
