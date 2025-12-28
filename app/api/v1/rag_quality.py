from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import require_permission, UserContext
from app.services.ragas_service import RagasService

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])
ragas_service = RagasService()


@router.get("/rag-quality")
async def rag_quality(
    start: Optional[str] = Query(default=None, description="ISO start datetime"),
    end: Optional[str] = Query(default=None, description="ISO end datetime"),
    model: Optional[str] = Query(default=None),
    schema_version: Optional[str] = Query(default=None),
    policy_version: Optional[int] = Query(default=None),
    user: UserContext = Depends(require_permission("admin:view")),
):
    def parse_dt(val: Optional[str]) -> Optional[datetime]:
        return datetime.fromisoformat(val) if val else None

    return ragas_service.aggregate(
        start=parse_dt(start),
        end=parse_dt(end),
        model_name=model,
        schema_version=schema_version,
        policy_version=policy_version,
    )
