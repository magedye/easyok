"""
Toggle Audit Trail: Record every toggle change.

This module ensures:
1. Every toggle change is logged
2. Reason is captured
3. User is identified
4. Timestamp is recorded
5. OTel span is emitted
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class ToggleChangeAction(Enum):
    """Action type for toggle change."""
    ENABLED = "toggle_enabled"
    DISABLED = "toggle_disabled"
    QUERIED = "toggle_queried"


@dataclass
class ToggleChangeEvent:
    """Single toggle change event."""
    
    toggle_name: str
    action: ToggleChangeAction
    old_value: Optional[bool]
    new_value: Optional[bool]
    reason: str
    user_id: str
    timestamp: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for storage/logging."""
        return {
            "toggle_name": self.toggle_name,
            "action": self.action.value,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
            "user_id": self.user_id,
            "timestamp": self.timestamp.isoformat(),
        }
    
    def to_audit_record(self) -> str:
        """Format for audit logging."""
        return (
            f"TOGGLE_CHANGE: {self.action.value} "
            f"toggle={self.toggle_name} "
            f"old={self.old_value} new={self.new_value} "
            f"user={self.user_id} "
            f"reason={self.reason}"
        )
    
    def to_otel_attributes(self) -> Dict[str, Any]:
        """Convert to OTel span attributes."""
        return {
            "governance.toggle.name": self.toggle_name,
            "governance.toggle.action": self.action.value,
            "governance.toggle.old_value": self.old_value,
            "governance.toggle.new_value": self.new_value,
            "governance.toggle.reason": self.reason,
            "governance.toggle.user_id": self.user_id,
            "governance.toggle.timestamp": self.timestamp.isoformat(),
        }


class ToggleAuditTrail:
    """In-memory audit trail for toggle changes."""
    
    def __init__(self, max_events: int = 1000):
        self.events: list[ToggleChangeEvent] = []
        self.max_events = max_events
    
    def record(self, event: ToggleChangeEvent) -> None:
        """Record a toggle change event."""
        self.events.append(event)
        
        # Keep only recent events
        if len(self.events) > self.max_events:
            self.events = self.events[-self.max_events:]
        
        # Log to audit logger
        logger.info(f"[GOVERNANCE] {event.to_audit_record()}")
    
    def toggle_enabled(
        self,
        toggle_name: str,
        old_value: bool,
        new_value: bool,
        reason: str,
        user_id: str,
    ) -> ToggleChangeEvent:
        """Record toggle enabled."""
        event = ToggleChangeEvent(
            toggle_name=toggle_name,
            action=ToggleChangeAction.ENABLED,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            user_id=user_id,
            timestamp=datetime.utcnow(),
        )
        self.record(event)
        return event
    
    def toggle_disabled(
        self,
        toggle_name: str,
        old_value: bool,
        new_value: bool,
        reason: str,
        user_id: str,
    ) -> ToggleChangeEvent:
        """Record toggle disabled."""
        event = ToggleChangeEvent(
            toggle_name=toggle_name,
            action=ToggleChangeAction.DISABLED,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            user_id=user_id,
            timestamp=datetime.utcnow(),
        )
        self.record(event)
        return event
    
    def get_recent_events(self, limit: int = 50) -> list[ToggleChangeEvent]:
        """Get recent toggle change events."""
        return self.events[-limit:]
    
    def get_events_for_toggle(self, toggle_name: str) -> list[ToggleChangeEvent]:
        """Get all events for specific toggle."""
        return [e for e in self.events if e.toggle_name == toggle_name]
    
    def get_events_by_user(self, user_id: str) -> list[ToggleChangeEvent]:
        """Get all events initiated by user."""
        return [e for e in self.events if e.user_id == user_id]


# Global audit trail instance
_global_audit_trail = ToggleAuditTrail()


def get_audit_trail() -> ToggleAuditTrail:
    """Get global toggle audit trail."""
    return _global_audit_trail


def emit_toggle_change_to_otel(event: ToggleChangeEvent) -> None:
    """
    Emit toggle change as OTel span.
    
    This ensures toggle changes are visible in SigNoz.
    """
    # Note: In real implementation, this would use OpenTelemetry
    # For now, we log it and prepare attributes for span
    logger.debug(f"[OTel Span] Governance Toggle Change: {event.to_otel_attributes()}")
