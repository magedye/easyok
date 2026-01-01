from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import UserContext, require_permission
from app.core.tier_router import OperationTier, TierRouter
from app.services.vanna_native_service import VannaNativeService

router = APIRouter(prefix="/api/v2/vanna", tags=["vanna-native"])
tier_router = TierRouter()


class VannaAgentPayload(BaseModel):
    question: str = Field(..., description="User question")
    context: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional client-supplied context"
    )


class VannaFeedbackPayload(BaseModel):
    question: str
    sql: str
    rating: int = Field(..., description="Positive or negative feedback score")
    context: Optional[Dict[str, Any]] = None


@router.post("/agent")
async def vanna_agent(
    payload: VannaAgentPayload,
    user: UserContext = Depends(require_permission("query:execute")),
):
    if tier_router.tier != OperationTier.VANNA:
        raise HTTPException(
            status_code=403,
            detail="Tier 2 (Vanna Native) is not enabled",
        )

    service: VannaNativeService = tier_router.resolve_ask_service()  # type: ignore[assignment]
    merged_context = {
        **user,
        **(payload.context or {}),
        "groups": [user.get("role", "guest")],
    }

    try:
        return await service.ask(
            question=payload.question,
            context=merged_context,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/feedback")
async def vanna_feedback(
    payload: VannaFeedbackPayload,
    user: UserContext = Depends(require_permission("feedback:submit")),
):
    service = tier_router.resolve_feedback_service()
    if service is None:
        raise HTTPException(
            status_code=403,
            detail="Feedback is unavailable for the current tier",
        )

    merged_context = {
        **user,
        **(payload.context or {}),
        "groups": [user.get("role", "guest")],
    }

    try:
        return await service.handle_feedback(
            question=payload.question,
            sql=payload.sql,
            rating=payload.rating,
            context=merged_context,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/tier-info")
async def tier_info():
    return tier_router.get_tier_info()
