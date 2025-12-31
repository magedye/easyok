from fastapi import APIRouter
from app.services.health_service import HealthService
from app.services.observability_service import ObservabilityService

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/llm")
async def llm_health():
    return {
        "status": "ok",
        "component": "llm",
        "details": await HealthService.llm_health(),
    }


@router.get("")
async def system_health():
    return ObservabilityService.system_health()
