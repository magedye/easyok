from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from opentelemetry import trace
from pydantic import BaseModel, Field

from app.api.dependencies import require_permission, UserContext
from app.core.config import get_settings
from app.core.db import session_scope
from app.models.enums.training_status import TrainingStatus
from app.models.internal import TrainingItem as TrainingItemModel, TrainingStaging, SchemaAccessPolicy
from app.services.audit_service import AuditService
from app.utils.sql_guard import SQLGuard, SQLGuardViolation


router = APIRouter(tags=["feedback"])
audit_service = AuditService()
tracer = trace.get_tracer(__name__)


class FeedbackPayload(BaseModel):
    audit_id: int
    question: str
    sql: str
    assumptions: str = Field(..., min_length=1)


@router.post("/feedback")
async def submit_feedback(
    payload: FeedbackPayload,
    user: UserContext = Depends(require_permission("feedback:submit")),
):
    settings = get_settings()
    assumptions = (payload.assumptions or "").strip()
    if not assumptions:
        raise HTTPException(status_code=400, detail="Assumptions are required.")

    # Resolve active policy for metadata/enforcement
    with session_scope() as session:
        policy = (
            session.query(SchemaAccessPolicy)
            .filter(SchemaAccessPolicy.status == "active")
            .order_by(SchemaAccessPolicy.created_at.desc())
            .first()
        )

    # Validate SQL (with policy if present)
    guard = SQLGuard(settings=settings)
    try:
        normalized_sql = guard.validate_and_normalise(payload.sql, policy=policy)
    except (SQLGuardViolation, Exception) as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    with tracer.start_as_current_span(
        "training_item.created",
        attributes={
            "training.status": TrainingStatus.pending.value,
            "schema.version": getattr(policy, "schema_name", None) or "",
            "policy.version": getattr(policy, "version", None) or "",
        },
    ):
        with session_scope() as session:
            item = TrainingItemModel(
                item_type="question_sql",
                question=payload.question,
                sql=normalized_sql,
                assumptions=assumptions,
                schema_version=getattr(policy, "schema_name", "") or "",
                policy_version=str(getattr(policy, "version", "") or ""),
                status=TrainingStatus.pending.value,
                created_by=user.get("user_id"),
                created_at=datetime.utcnow(),
            )
            session.add(item)
            session.flush()
            session.refresh(item)

            staging = TrainingStaging(
                audit_log_id=payload.audit_id,
                training_item_id=item.id,
                question=payload.question,
                sql=normalized_sql,
                assumptions=assumptions,
                schema_version=getattr(policy, "schema_name", "") or "",
                policy_version=str(getattr(policy, "version", "") or ""),
                created_at=datetime.utcnow(),
                created_by=user.get("user_id"),
            )
            session.add(staging)
            session.flush()

    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="training_item.created",
        resource_id=str(item.id),
        status="success",
        outcome="success",
        payload={
            "training_item_id": item.id,
            "audit_id": payload.audit_id,
            "schema_version": getattr(policy, "schema_name", "") if policy else "",
            "policy_version": getattr(policy, "version", "") if policy else "",
        },
    )

    return {"training_item_id": item.id, "status": TrainingStatus.pending.value}
