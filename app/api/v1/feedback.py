from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.dependencies import require_permission, UserContext
from app.services.feedback import FeedbackService
from app.services.audit_service import AuditService

router = APIRouter(tags=["feedback"])
service = FeedbackService()
audit_service = AuditService()


class FeedbackPayload(BaseModel):
    audit_id: int
    is_valid: bool
    comment: str | None = None
    proposed_question: str | None = None
    proposed_sql: str | None = None


@router.post("/feedback")
async def submit_feedback(
    payload: FeedbackPayload,
    user: UserContext = Depends(require_permission("feedback:submit")),
):
    fb = service.record_feedback(
        audit_id=payload.audit_id,
        is_valid=payload.is_valid,
        comment=payload.comment,
        user_id=user.get("user_id"),
        proposed_question=payload.proposed_question,
        proposed_sql=payload.proposed_sql,
    )
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="feedback_submit",
        resource_id=str(fb.id),
        status="success",
        outcome="success",
    )
    return {"id": fb.id, "training_item_id": fb.training_item_id}
