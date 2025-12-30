from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import require_permission, UserContext
from app.core.config import get_settings
from app.core.exceptions import AppException

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])


def rag_quality_guard():
    settings = get_settings()
    if not getattr(settings, "ENABLE_RAG_QUALITY", False):
        raise AppException("RAG Quality endpoint is disabled")
    return settings


@router.get("/rag-quality")
async def rag_quality(
    start: Optional[str] = Query(default=None, description="ISO start datetime"),
    end: Optional[str] = Query(default=None, description="ISO end datetime"),
    model: Optional[str] = Query(default=None),
    schema_version: Optional[str] = Query(default=None),
    policy_version: Optional[int] = Query(default=None),
    user: UserContext = Depends(require_permission("admin:view")),
    settings=Depends(rag_quality_guard),
):
    from app.services.ragas_service import RagasService

    def parse_dt(val: Optional[str]) -> Optional[datetime]:
        return datetime.fromisoformat(val) if val else None

    service = RagasService()
    return service.aggregate(
        start=parse_dt(start),
        end=parse_dt(end),
        model_name=model,
        schema_version=schema_version,
        policy_version=policy_version,
    )
