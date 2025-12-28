"""
Governance Status Endpoint: Show current governance state.

Endpoint: GET /api/v1/admin/settings/governance-status

Returns:
- Immutable toggle states (all should be true)
- Runtime toggle states
- Recent audit events
- Violations
"""

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from app.core.admin_rbac import require_admin, is_admin
from app.core.toggle_classification import IMMUTABLE_TOGGLES, RUNTIME_TOGGLES
from app.core.toggle_audit_trail import get_audit_trail
from app.core.config import get_settings

router = APIRouter(prefix="/admin", tags=["admin"])


class ImmutableToggleStatus(BaseModel):
    """Status of immutable (governance) toggles."""
    name: str
    value: bool
    enforced: bool  # Should always be true


class RuntimeToggleStatus(BaseModel):
    """Status of runtime toggles."""
    name: str
    value: bool
    last_changed: str | None
    changed_by: str | None


class GovernanceStatus(BaseModel):
    """Overall governance status."""
    immutable_toggles: list[ImmutableToggleStatus]
    runtime_toggles: list[RuntimeToggleStatus]
    recent_changes: int
    violations_detected: int
    status: str  # "compliant" or "violation"


@router.get("/settings/governance-status", response_model=GovernanceStatus)
@require_admin
async def get_governance_status() -> GovernanceStatus:
    """
    Get current governance status.
    
    Admin role required.
    
    Shows:
    - All immutable toggles (must be true)
    - All runtime toggles (can vary)
    - Recent audit trail
    - Detected violations
    """
    settings = get_settings()
    audit_trail = get_audit_trail()
    
    # Immutable toggles
    immutable_status = []
    all_immutable_enabled = True
    for toggle_name in IMMUTABLE_TOGGLES:
        value = getattr(settings, toggle_name, False)
        immutable_status.append(ImmutableToggleStatus(
            name=toggle_name,
            value=value,
            enforced=value,  # Should always be true
        ))
        if not value:
            all_immutable_enabled = False
    
    # Runtime toggles
    runtime_status = []
    for toggle_name in RUNTIME_TOGGLES:
        value = getattr(settings, toggle_name, None)
        
        # Find last change
        events = audit_trail.get_events_for_toggle(toggle_name)
        last_event = events[-1] if events else None
        
        runtime_status.append(RuntimeToggleStatus(
            name=toggle_name,
            value=value if value is not None else False,
            last_changed=last_event.timestamp.isoformat() if last_event else None,
            changed_by=last_event.user_id if last_event else None,
        ))
    
    # Recent changes count
    recent_changes = len(audit_trail.get_recent_events(limit=100))
    
    # Status
    status = "compliant" if all_immutable_enabled else "violation"
    
    return GovernanceStatus(
        immutable_toggles=immutable_status,
        runtime_toggles=runtime_status,
        recent_changes=recent_changes,
        violations_detected=0,  # Would be populated by violation logger
        status=status,
    )


@router.get("/settings/immutable-toggles")
@require_admin
async def get_immutable_toggles():
    """
    Get all immutable (non-negotiable) toggles.
    
    These CANNOT be changed. They form the security/governance foundation.
    """
    return {
        "immutable_toggles": list(IMMUTABLE_TOGGLES),
        "note": "These toggles are governed by ADR-0018 and cannot be disabled."
    }


@router.get("/settings/runtime-toggles")
@require_admin
async def get_runtime_toggles():
    """
    Get all runtime toggles that can be changed via Admin API.
    """
    return {
        "runtime_toggles": list(RUNTIME_TOGGLES),
        "note": "These toggles can be changed via POST /api/v1/admin/settings/feature-toggle"
    }
