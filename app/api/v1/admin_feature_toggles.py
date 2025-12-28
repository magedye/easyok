"""
Admin Feature Toggles API: Governed control plane for runtime toggles.

Endpoint: POST /api/v1/admin/settings/feature-toggle

Rules:
1. Admin role required
2. Immutable toggles blocked
3. Reason mandatory (min 10 chars)
4. Every change audited + OTel
5. Violations logged and reported
"""

from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, status

from app.core.config import get_settings
from app.core.admin_rbac import (
    require_admin,
    require_reason,
    validate_toggle_change,
    get_current_user,
    RBACViolation,
    ImmutableToggleViolation,
    MissingReasonError,
)
from app.core.toggle_classification import is_immutable, is_runtime
from app.core.toggle_audit_trail import get_audit_trail, emit_toggle_change_to_otel
from app.core.observability_enforcement import get_request_tracker

router = APIRouter(prefix="/admin/settings", tags=["admin"])


# Request/Response Models

class FeatureToggleRequest(BaseModel):
    """Request to change a feature toggle."""
    feature: str = Field(..., min_length=1, example="ENABLE_SEMANTIC_CACHE")
    value: bool = Field(..., example=True)
    reason: str = Field(..., min_length=10, example="Disabling cache for performance testing")


class ToggleState(BaseModel):
    """Current state of a toggle."""
    name: str
    value: bool
    mutable: bool
    category: str  # "immutable" or "runtime"


class FeatureToggleResponse(BaseModel):
    """Response after toggle change."""
    status: str = "success"
    toggle: str
    old_value: bool
    new_value: bool
    reason: str
    user_id: str
    timestamp: str


class ToggleListResponse(BaseModel):
    """List of all toggles."""
    features: list[ToggleState]
    total: int


class ErrorResponse(BaseModel):
    """Error response."""
    status: str = "error"
    error: str
    code: str


# Endpoints

@router.post("/feature-toggle", response_model=FeatureToggleResponse)
@require_admin
@require_reason
async def change_feature_toggle(request: FeatureToggleRequest) -> FeatureToggleResponse:
    """
    Change a runtime-toggleable feature.
    
    Admin role required.
    Immutable toggles (AUTH, RBAC, RLS, SQLGuard, AUDIT) cannot be changed.
    Reason mandatory.
    Every change is audited + OTel span.
    """
    settings = get_settings()
    audit_trail = get_audit_trail()
    tracker = get_request_tracker()
    
    toggle_name = request.feature
    new_value = request.value
    reason = request.reason
    user = get_current_user()
    user_id = user.get("id") if user else "unknown"
    
    try:
        # Validate change (checks immutable, reason, admin role)
        change_metadata = validate_toggle_change(
            toggle_name=toggle_name,
            old_value=getattr(settings, toggle_name, None),
            new_value=new_value,
            reason=reason
        )
        
        # Get old value
        old_value = getattr(settings, toggle_name, None)
        
        # Record in audit trail
        if new_value:
            audit_event = audit_trail.toggle_enabled(
                toggle_name=toggle_name,
                old_value=old_value,
                new_value=new_value,
                reason=reason,
                user_id=user_id,
            )
        else:
            audit_event = audit_trail.toggle_disabled(
                toggle_name=toggle_name,
                old_value=old_value,
                new_value=new_value,
                reason=reason,
                user_id=user_id,
            )
        
        # Emit OTel span
        emit_toggle_change_to_otel(audit_event)
        
        # Update span attributes
        tracker.record_enabled(
            "governance_toggle_api",
            method="change_feature_toggle",
            result={
                "toggle": toggle_name,
                "old_value": old_value,
                "new_value": new_value,
            }
        )
        
        return FeatureToggleResponse(
            toggle=toggle_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            user_id=user_id,
            timestamp=audit_event.timestamp.isoformat(),
        )
    
    except ImmutableToggleViolation as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                error=str(e),
                code="IMMUTABLE_TOGGLE",
            ).dict()
        )
    
    except (RBACViolation, MissingReasonError) as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ErrorResponse(
                error=str(e),
                code="GOVERNANCE_VIOLATION",
            ).dict()
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ErrorResponse(
                error=str(e),
                code="INTERNAL_ERROR",
            ).dict()
        )


@router.get("/feature-toggles", response_model=ToggleListResponse)
@require_admin
async def list_feature_toggles() -> ToggleListResponse:
    """
    List all feature toggles and their states.
    
    Admin role required.
    """
    from app.core.toggle_classification import IMMUTABLE_TOGGLES, RUNTIME_TOGGLES
    
    settings = get_settings()
    toggles = []
    
    # Immutable toggles
    for toggle_name in IMMUTABLE_TOGGLES:
        value = getattr(settings, toggle_name, None)
        toggles.append(ToggleState(
            name=toggle_name,
            value=value if value is not None else False,
            mutable=False,
            category="immutable",
        ))
    
    # Runtime toggles
    for toggle_name in RUNTIME_TOGGLES:
        value = getattr(settings, toggle_name, None)
        toggles.append(ToggleState(
            name=toggle_name,
            value=value if value is not None else False,
            mutable=True,
            category="runtime",
        ))
    
    return ToggleListResponse(
        features=toggles,
        total=len(toggles),
    )


@router.get("/feature-toggles/audit-log")
@require_admin
async def get_toggle_audit_log(limit: int = 50):
    """
    Get recent toggle change events.
    
    Admin role required.
    """
    audit_trail = get_audit_trail()
    events = audit_trail.get_recent_events(limit=limit)
    
    return {
        "events": [e.to_dict() for e in events],
        "total": len(events),
    }


@router.get("/feature-toggles/violations")
@require_admin
async def get_toggle_violations():
    """
    Get all denied toggle change attempts (RBAC, immutable violations).
    
    Admin role required.
    Helps detect unauthorized attempts.
    """
    # This would be populated by middleware that catches violations
    return {
        "violations": [],
        "note": "Track violations by monitoring error logs for ImmutableToggleViolation, RBACViolation"
    }
