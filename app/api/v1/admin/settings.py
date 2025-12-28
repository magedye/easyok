from __future__ import annotations

from datetime import datetime
from time import time
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.api.dependencies import optional_auth, UserContext
from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailableError
from app.services.audit_service import AuditService
from app.services.sentry_service import SentryService


router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])
tracer = trace.get_tracer(__name__)
audit_service = AuditService()
sentry_service = SentryService()

# Allowed / forbidden toggles (closed set)
MUTABLE_FEATURES = {
    "ENABLE_SEMANTIC_CACHE",
    "ENABLE_RATE_LIMIT",
    "ENABLE_GZIP_COMPRESSION",
    "ENABLE_AUDIT_LOGGING",
}
IMMUTABLE_FEATURES = {
    "AUTH_ENABLED",
    "RBAC_ENABLED",
    "RLS_ENABLED",
}
SENTRY_RATE_LIMIT_PER_MINUTE = 5
_SENTRY_CALL_LOG: List[float] = []


def _ensure_admin(user: UserContext) -> None:
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="INSUFFICIENT_PRIVILEGES: Admin role required.",
        )


def _current_feature_state() -> Dict[str, Any]:
    settings = get_settings(force_reload=True)
    return {
        "ENABLE_SEMANTIC_CACHE": settings.ENABLE_SEMANTIC_CACHE,
        "ENABLE_RATE_LIMIT": settings.ENABLE_RATE_LIMIT,
        "ENABLE_GZIP_COMPRESSION": settings.ENABLE_GZIP_COMPRESSION,
        "ENABLE_AUDIT_LOGGING": getattr(settings, "ENABLE_AUDIT_LOGGING", True),
        "AUTH_ENABLED": settings.AUTH_ENABLED,
        "RBAC_ENABLED": settings.RBAC_ENABLED,
        "RLS_ENABLED": settings.RLS_ENABLED,
    }

def _enforce_sentry_rate_limit() -> None:
    now = time()
    window = 60
    # prune old calls
    recent = [t for t in _SENTRY_CALL_LOG if now - t < window]
    _SENTRY_CALL_LOG.clear()
    _SENTRY_CALL_LOG.extend(recent)
    if len(_SENTRY_CALL_LOG) >= SENTRY_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(status_code=429, detail="RATE_LIMIT_EXCEEDED")
    _SENTRY_CALL_LOG.append(now)


@router.get("/feature-toggles")
async def list_feature_toggles(user: UserContext = Depends(optional_auth)):
    _ensure_admin(user)
    state = _current_feature_state()
    features = []
    for name, value in state.items():
        features.append(
            {
                "name": name,
                "value": value,
                "mutable": name in MUTABLE_FEATURES,
            }
        )
    return {"features": features}


@router.get("/sentry-issues")
async def get_sentry_issues(user: UserContext = Depends(optional_auth)):
    _ensure_admin(user)
    _enforce_sentry_rate_limit()
    try:
        issues = await sentry_service.fetch_latest_issues(limit=5)
    except ServiceUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"issues": issues}


@router.post("/feature-toggle")
async def update_feature_toggle(payload: dict, user: UserContext = Depends(optional_auth)):
    _ensure_admin(user)
    feature = (payload.get("feature") or "").strip()
    reason = (payload.get("reason") or "").strip()
    new_value = payload.get("value")

    if feature in IMMUTABLE_FEATURES:
        raise HTTPException(
            status_code=403,
            detail="Security-critical settings require manual config change.",
        )
    if feature not in MUTABLE_FEATURES:
        raise HTTPException(status_code=400, detail="Unsupported feature toggle")
    if not reason or len(reason) < 10:
        raise HTTPException(status_code=400, detail="Change reason is required.")

    state = _current_feature_state()
    old_value = state.get(feature)
    if old_value == new_value:
        raise HTTPException(status_code=400, detail="No change detected for this feature.")

    change_result = "success"
    with tracer.start_as_current_span(
        "admin.feature_toggle.change",
        attributes={
            "feature.name": feature,
            "feature.old_value": str(old_value),
            "feature.new_value": str(new_value),
            "user.id": user.get("user_id", "anonymous"),
            "change.reason": reason,
        },
    ) as span:
        try:
            # Runtime application: registry can be added here.
            # For now, acknowledge change (no .env mutation).
            audit_service.log(
                user_id=user.get("user_id", "anonymous"),
                role=user.get("role", "guest"),
                action="Feature_Toggle_Changed",
                resource_id=feature,
                payload={
                    "feature": feature,
                    "old_value": old_value,
                    "new_value": new_value,
                    "reason": reason,
                },
                status="success",
                outcome="success",
            )
        except Exception as exc:
            change_result = "rejected"
            span.set_status(Status(StatusCode.ERROR, "Feature toggle change failed"))
            span.set_attribute("error.type", "CHANGE_FAILURE")
            span.set_attribute("error.message", str(exc))
            raise
        finally:
            span.set_attribute("change.result", change_result)

    return {
        "status": "success",
        "feature": feature,
        "old_value": old_value,
        "new_value": new_value,
        "changed_by": user.get("user_id", "anonymous"),
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
