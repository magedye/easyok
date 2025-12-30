from fastapi import APIRouter, Depends, HTTPException
from opentelemetry import trace

from app.api.dependencies import require_permission, UserContext
from app.services.audit_service import AuditService
from app.services.schema_policy_service import SchemaPolicyService
from .schema_policy import router as schema_policy_router


router = APIRouter(tags=["admin"])
audit_service = AuditService()
policy_service = SchemaPolicyService()
tracer = trace.get_tracer(__name__)


@router.post("/training/approve")
async def approve_training(
    training_id: str,
    user: UserContext = Depends(require_permission("training:approve")),
):
    """
    Approve training data.
    """
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


@router.post("/settings/feature-toggle")
async def update_feature_toggle(
    payload: dict,
    user: UserContext = Depends(require_permission("admin:view")),
):
    """
    Governed feature toggle change (admin only).
    """
    feature = payload.get("feature")
    value = payload.get("value")
    reason = payload.get("reason") or ""

    allowed_runtime = {"ENABLE_SEMANTIC_CACHE", "ENABLE_RATE_LIMIT"}
    blocked_runtime = {"AUTH_ENABLED", "RBAC_ENABLED"}

    if feature in blocked_runtime:
        raise HTTPException(status_code=400, detail="Runtime change blocked for this feature")
    if feature not in allowed_runtime:
        raise HTTPException(status_code=400, detail="Unsupported feature toggle")

    with tracer.start_as_current_span(
        "admin.feature_toggle.change",
        attributes={
            "feature": feature,
            "value": str(value),
            "reason": reason,
            "user.id": user.get("user_id", "anonymous"),
        },
    ):
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="admin_feature_toggle",
            resource_id=feature,
            payload={"feature": feature, "value": value, "reason": reason},
            status="completed",
            outcome="success",
        )

    return {
        "feature": feature,
        "accepted": True,
        "value": value,
        "reason": reason,
    }


@router.get("/schema")
async def get_schema(user: UserContext = Depends(require_permission("admin:view"))):
    """
    Return allowed tables/columns based on active schema policy (display only).
    """
    policy = policy_service.get_active()
    if not policy:
        return {"tables": []}

    tables = []
    allowed_columns = policy.allowed_columns or {}
    for tbl in policy.allowed_tables or []:
        cols = allowed_columns.get(tbl) or []
        tables.append(
            {
                "name": tbl,
                "columns": [{"name": c, "type": "UNKNOWN", "nullable": True} for c in cols],
            }
        )
    return {"tables": tables}


@router.post("/schema/refresh")
async def refresh_schema(user: UserContext = Depends(require_permission("admin:view"))):
    """
    Placeholder refresh hook; policy governs visible schema.
    """
    return {"success": True, "timestamp": "now"}


router.include_router(schema_policy_router)
