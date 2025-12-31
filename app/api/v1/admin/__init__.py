from fastapi import APIRouter, Depends, HTTPException
from opentelemetry import trace

from app.api.dependencies import require_permission, UserContext
from app.services.audit_service import AuditService
from app.core.db import session_scope
from app.models.internal import AuditLog
from .schema_policy import router as schema_policy_router


router = APIRouter(tags=["admin"])
audit_service = AuditService()
tracer = trace.get_tracer(__name__)


@router.post("/training/approve")
async def approve_training(
    training_id: str,
    user: UserContext = Depends(require_permission("training:approve")),
):
    """
    Approve training data.
    """
    from app.core.config import get_settings
    settings = get_settings(force_reload=True)
    if settings.RBAC_ENABLED:
        perms = user.get("permissions") or []
        aliases = {"training:approve", "training.approve"}
        if not any(p in aliases for p in perms):
            raise HTTPException(status_code=403, detail="Missing required permission: training:approve")

    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="training_approve",
        resource_id=training_id,
        status="success",
        outcome="success",
    )
    return {
        "status": "approved",
        "training_id": training_id,
        "approved_by": user["user_id"],
    }


@router.get("/dashboard")
async def get_dashboard(
    user: UserContext = Depends(require_permission("admin:view")),
):
    """
    Get admin dashboard.
    """
    return {
        "user": user["user_id"],
        "role": user["role"],
        "permissions": user["permissions"],
    }


@router.get("/schema")
async def get_schema(user: UserContext = Depends(require_permission("admin:view"))):
    """
    Return allowed tables/columns based on active schema policy (display only).
    """
    return {"tables": []}


@router.post("/schema/refresh")
async def refresh_schema(user: UserContext = Depends(require_permission("admin:view"))):
    """
    Placeholder refresh hook; policy governs visible schema.
    """
    return {"success": True, "timestamp": "now"}


@router.get("/audit")
async def get_audit_log(
    user: UserContext = Depends(require_permission("admin.audit.read")),
):
    with session_scope() as session:
        rows = (
            session.query(AuditLog)
            .order_by(AuditLog.timestamp.desc())
            .limit(200)
            .all()
        )
    events = [
        {
            "id": r.id,
            "user_id": r.user_id,
            "role": r.role,
            "action": r.action,
            "resource_id": r.resource_id,
            "timestamp": r.timestamp,
            "outcome": r.outcome,
        }
        for r in rows
    ]
    return {"events": events}


@router.get("/schema/drift")
async def schema_drift(
    user: UserContext = Depends(require_permission("admin.schema.drift")),
):
    return {"drift_detected": False, "details": {}}


@router.post("/schema/drift/retrain", status_code=202)
async def retrain_on_drift(
    user: UserContext = Depends(require_permission("admin.schema.retrain")),
):
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="schema_drift_retrain",
        resource_id=None,
        status="started",
        outcome="started",
    )
    return {"status": "scheduled"}


@router.post("/run_sql_csv")
async def run_sql_csv(
    payload: dict,
    user: UserContext = Depends(require_permission("admin.sql.export")),
):
    raise HTTPException(status_code=503, detail="SQL export disabled at API adapter layer")


router.include_router(schema_policy_router)
