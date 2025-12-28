from fastapi import APIRouter, Depends

from app.api.dependencies import require_permission, optional_auth, UserContext
from app.services.observability_service import ObservabilityService

router = APIRouter(prefix="/admin", tags=["observability"])


@router.get("/health")
async def system_health(user: UserContext = Depends(require_permission("admin:view"))):
    return ObservabilityService.system_health()


@router.get("/metrics")
async def system_metrics(user: UserContext = Depends(require_permission("admin:view"))):
    return ObservabilityService.metrics_json()


@router.get("/telemetry")
async def system_aggregates(user: UserContext = Depends(require_permission("admin:view"))):
    return ObservabilityService.aggregates()
