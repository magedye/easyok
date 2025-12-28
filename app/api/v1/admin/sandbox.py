import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.admin_rbac import require_admin, get_current_user
from app.services.audit_service import AuditService
from app.services.shadow_execution_service import ShadowExecutionService
from app.models.enums.confidence_tier import ConfidenceTier


router = APIRouter(prefix="/admin/sandbox", tags=["admin"])


class SandboxExecuteRequest(BaseModel):
    sql: str = Field(..., min_length=1, description="Exploratory SQL for sandbox execution")


class SandboxPromotionRequest(BaseModel):
    exploratory_sql: str = Field(..., min_length=1)
    reason: str = Field(..., min_length=10)


def _ts() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _chunk(chunk_type: str, payload: Any, *, trace_id: str, tier: ConfidenceTier) -> str:
    return json.dumps(
        {
            "type": chunk_type,
            "trace_id": trace_id,
            "confidence_tier": tier.value,
            "timestamp": _ts(),
            "payload": payload,
        }
    ) + "\n"


@router.post("/execute", status_code=status.HTTP_200_OK, response_class=StreamingResponse)
@require_admin
async def execute_sandbox(request: SandboxExecuteRequest):
    """
    Execute exploratory SQL in an isolated sandbox (advisory only).
    Returns NDJSON with experimental and end chunks.
    """
    svc = ShadowExecutionService()
    result = svc.run(request.sql)
    tier = ConfidenceTier.TIER_1_LAB

    def stream():
        yield _chunk(
            "experimental",
            {
                "status": result.status,
                "rows": result.rows,
                "row_count": result.row_count,
                "reason": result.reason,
                "sql": request.sql if result.status == "blocked" else "",
                "sandbox_data_origin": result.sandbox_data_origin,
                "is_production": result.is_production,
            },
            trace_id=result.trace_id,
            tier=tier,
        )
        yield _chunk(
            "end",
            {"status": result.status, "chunks": 2},
            trace_id=result.trace_id,
            tier=tier,
        )

    return StreamingResponse(stream(), media_type="application/x-ndjson")


@router.post("/promote", status_code=status.HTTP_200_OK)
@require_admin
async def promote_sandbox(request: SandboxPromotionRequest):
    """
    Request promotion of sandbox SQL. No execution or training occurs.
    """
    user = get_current_user() or {}
    audit = AuditService()
    audit.log(
        user_id=user.get("id", "unknown"),
        role=user.get("role", "admin"),
        action="Sandbox_Promotion_Requested",
        resource_id=None,
        payload={
            "exploratory_sql": request.exploratory_sql,
            "reason": request.reason,
        },
        status="requested",
        outcome="pending_review",
    )
    return {
        "status": "accepted",
        "trace_id": uuid.uuid4().hex,
        "message": "Promotion request recorded; no execution performed.",
    }
