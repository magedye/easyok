from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies import optional_auth, require_permission
from app.services.behavioral_feedback_service import BehavioralFeedbackService
from app.models.enums.confidence_tier import ConfidenceTier


router = APIRouter(prefix="/analytics/behavioral", tags=["analytics"])
service = BehavioralFeedbackService()


class BehavioralEvent(BaseModel):
    event_type: str = Field(..., description="advisory_accept|advisory_ignore|chart_interaction|retry|abandon")
    trace_id: str
    session_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def record_event(
    event: BehavioralEvent,
    user=Depends(optional_auth),
):
    """
    Record a non-binding, Tier-1 behavioral event.
    Does not influence execution, training, or assets.
    """
    if not event.trace_id:
        raise HTTPException(status_code=422, detail="trace_id required")
    user_id = user.get("user_id") if isinstance(user, dict) else None
    service.record_event(
        event_type=event.event_type,
        trace_id=event.trace_id,
        user_id=user_id,
        session_id=event.session_id,
        payload={
            "payload": event.payload or {},
            "confidence_tier": ConfidenceTier.TIER_1_LAB.value,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
    )
    return {"status": "accepted"}


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("admin:read"))],
)
async def list_events():
    """
    Admin-only read of behavioral events (analytics only).
    """
    return {"events": service.list_events()}
