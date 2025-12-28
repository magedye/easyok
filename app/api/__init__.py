from fastapi import APIRouter
from app.api.v1.routers import (
    ask_router,
    training_router,
    assets_router,
    schedule_router,
    admin_router,
    sandbox_router,
)

api_router = APIRouter()

api_router.include_router(ask_router)
api_router.include_router(training_router)
api_router.include_router(assets_router)
api_router.include_router(schedule_router)
api_router.include_router(admin_router)
api_router.include_router(sandbox_router)
