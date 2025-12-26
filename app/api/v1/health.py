from fastapi import APIRouter
from app.services.health_service import HealthService

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/llm")
async def llm_health():
    return {
        "status": "ok",
        "component": "llm",
        "details": await HealthService.llm_health(),
    }
