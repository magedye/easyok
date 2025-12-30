import csv
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Response
from opentelemetry import trace

from app.api.dependencies import require_permission, UserContext
from app.services.audit_service import AuditService
from app.services.schema_policy_service import SchemaPolicyService
from app.utils.sql_guard import SQLGuard, SQLGuardViolation
from app.core.config import get_settings
from app.core.db import session_scope
from app.models.internal import AuditLog
from app.services.vanna_service import VannaService
from .schema_policy import router as schema_policy_router


router = APIRouter(tags=["admin"])
audit_service = AuditService()
policy_service = SchemaPolicyService()
tracer = trace.get_tracer(__name__)
settings = get_settings()
sql_guard = SQLGuard(settings)
vanna_service = VannaService()


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
    sql = (payload.get("sql") or "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="sql is required")
    policy = policy_service.get_active()
    try:
        normalized_sql = sql_guard.validate_and_normalise(sql, policy=policy)
    except SQLGuardViolation as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    rows = vanna_service.db.execute(normalized_sql) or []
    if not rows:
        csv_body = ""
    else:
        headers = list(rows[0].keys())
        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow({h: row.get(h) for h in headers})
        csv_body = buffer.getvalue()
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="admin_run_sql_csv",
        resource_id=None,
        payload={"rows": len(rows)},
        sql=sql,
        status="completed",
        outcome="success",
    )
    return Response(content=csv_body, media_type="text/csv")


router.include_router(schema_policy_router)
