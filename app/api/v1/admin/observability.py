from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.dependencies import require_permission, UserContext
from app.core.config import get_settings


router = APIRouter(prefix="/admin/observability", tags=["admin-observability"])


@router.get("/status")
async def observability_status(user: UserContext = Depends(require_permission("admin:view"))):
    settings = get_settings()
    semantic_cache = "enabled" if settings.ENABLE_SEMANTIC_CACHE else "disabled"
    arabic_nlp = "enabled" if settings.ENABLE_ARABIC_NLP else "bypassed"
    alerts = "enabled" if settings.ENABLE_SIGNOZ_ALERTS else "muted"
    return {
        "semantic_cache": semantic_cache,
        "arabic_nlp": arabic_nlp,
        "alerts": alerts,
    }
