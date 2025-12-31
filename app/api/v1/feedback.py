from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from opentelemetry import trace
from pydantic import BaseModel, Field

from app.api.dependencies import require_permission, UserContext
from app.core.db import session_scope
from app.models.internal import TrainingStaging, SchemaAccessPolicy, UserFeedback


router = APIRouter(tags=["feedback"])
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
    assumptions = (payload.assumptions or "").strip()
    if not assumptions:
        raise HTTPException(status_code=400, detail="Assumptions are required.")

    with session_scope() as session:
        policy = (
            session.query(SchemaAccessPolicy)
            .filter(SchemaAccessPolicy.status == "active")
            .order_by(SchemaAccessPolicy.created_at.desc())
            .first()
        )

    normalized_sql = payload.sql

    with tracer.start_as_current_span(
        "training_item.created",
        attributes={
            "training.status": "pending",
            "schema.version": getattr(policy, "schema_name", None) or "",
            "policy.version": getattr(policy, "version", None) or "",
            "has_corrected_sql": True,
        },
    ):
        with session_scope() as session:
            staging = TrainingStaging(
                audit_log_id=payload.audit_id,
                training_item_id=None,
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

    return {"status": "pending"}


@router.get("/feedback/pending")
async def list_pending_feedback(
    user: UserContext = Depends(require_permission("feedback.review")),
):
    with session_scope() as session:
        rows = (
            session.query(UserFeedback)
            .filter(UserFeedback.is_valid.is_(None))
            .order_by(UserFeedback.created_at.desc())
            .all()
        )
    items = [
        {"id": fb.id, "message": fb.comment or "", "created_at": fb.created_at}
        for fb in rows
    ]
    return {"items": items}


@router.get("/feedback/{feedback_id}")
async def get_feedback(
    feedback_id: int,
    user: UserContext = Depends(require_permission("feedback.review")),
):
    with session_scope() as session:
        fb = session.get(UserFeedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {
        "id": fb.id,
        "message": fb.comment or "",
        "created_at": fb.created_at,
        "user_id": fb.user_id,
    }
