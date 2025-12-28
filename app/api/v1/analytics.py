from fastapi import APIRouter, Depends

from app.api.dependencies import optional_auth, UserContext
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/user")
async def user_analytics(user: UserContext = Depends(optional_auth)):
    return AnalyticsService.user_analytics()
