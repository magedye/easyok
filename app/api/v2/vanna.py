from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies import UserContext, require_permission
from app.core.tier_router import OperationTier, TierRouter
from app.services.vanna_native_service import VannaNativeService

# تعريف الراوتر
router = APIRouter(prefix="/api/v2/vanna", tags=["vanna-native"])

# تهيئة موجه الطبقات
tier_router = TierRouter()


# ============================================================================
# Pydantic Models
# ============================================================================

class VannaAgentPayload(BaseModel):
    question: str = Field(..., description="The natural language question")
    context: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional client-supplied context (filters, etc.)"
    )


class VannaFeedbackPayload(BaseModel):
    question: str
    sql: str
    rating: int = Field(..., description="Positive (1) or negative (-1) score")
    context: Optional[Dict[str, Any]] = None


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/agent")
async def vanna_agent(
    payload: VannaAgentPayload,
    user: UserContext = Depends(require_permission("query:execute")),
):
    """
    Tier-2 Agent Endpoint.
    Routes request to VannaNativeService if Tier-2 is active.
    """
    # 1. التحقق من تفعيل Tier-2
    if tier_router.tier != OperationTier.VANNA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tier 2 (Vanna Native) is not enabled in system settings",
        )

    # 2. حل الخدمة (Resolve Service)
    # يفترض أن TierRouter يعيد كائناً من VannaNativeService
    service: VannaNativeService = tier_router.resolve_ask_service()  # type: ignore

    # 3. دمج السياق (User Context + Client Payload)
    # هذا السياق هو ما سيستخدمه ContextUserResolver داخل الخدمة
    merged_context = {
        **user,
        **(payload.context or {}),
        "groups": [user.get("role", "guest")],
    }

    try:
        # 4. استدعاء الخدمة المحدثة
        result = await service.ask(
            question=payload.question,
            context=merged_context,
        )
        return result

    except Exception as exc:
        # تسجيل الخطأ مهم هنا للتشخيص
        print(f"[Vanna API Error]: {str(exc)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc)
        )


@router.post("/feedback")
async def vanna_feedback(
    payload: VannaFeedbackPayload,
    user: UserContext = Depends(require_permission("feedback:submit")),
):
    """
    Submit feedback for Vanna agent interactions.
    """
    service = tier_router.resolve_feedback_service()

    if service is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feedback functionality is unavailable for the current tier",
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=str(exc)
        )


@router.get("/tier-info")
async def tier_info():
    """
    Return current operation tier information.
    """
    return tier_router.get_tier_info()