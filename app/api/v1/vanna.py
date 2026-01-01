from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import UserContext, require_permission
from app.core.tier_router import OperationTier, TierRouter
from app.services.vanna_hybrid_service import VannaHybridService

router = APIRouter(tags=["vanna"])
tier_router = TierRouter()


class VannaAskPayload(BaseModel):
    question: str = Field(..., description="User question")
    mode: str = Field(default="auto", description="analysis | sql | chart | auto")
    context: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional client-provided context"
    )


@router.post("/vanna/ask")
async def vanna_hybrid_ask(
    payload: VannaAskPayload,
    user: UserContext = Depends(require_permission("query:execute")),
):
    if tier_router.tier != OperationTier.GOVERNED:
        raise HTTPException(
            status_code=403,
            detail="Tier 1 (Governed) is not active",
        )

    service: VannaHybridService = tier_router.resolve_ask_service()  # type: ignore[assignment]
    merged_context = {
        **user,
        **(payload.context or {}),
        "groups": [user.get("role", "guest")],
    }

    try:
        return await service.ask(
            question=payload.question,
            context=merged_context,
            mode=payload.mode,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
