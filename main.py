"""
Entry point for the EasyData backend application.

This module initialises the FastAPI app, loads configuration, registers
routers and middlewares, and exposes the ASGI application.

The application is intentionally minimal; most business logic is defined
in the `app` package.  Configuration values come from `.env` via
`app.core.config.settings`.  See the documentation in that module for
details.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request
from datetime import datetime
import time

from app.core.config import settings
from app.core.exceptions import AppException
from app.api.v1 import (
    query,
    admin,
    health,
    auth,
    chat,
    training,
    assets,
    feedback,
    schema,
    api_catalog,
    observability,
    analytics,
    rag_quality,
)
from app.api.v1.admin import settings as admin_settings
from app.services.observability_service import ObservabilityService
from app.telemetry import setup_tracing
from app.services.alerting_guard import initialize_alerting
from app.services.training_readiness_guard import assert_training_readiness, TrainingReadinessError


tags_metadata = [{"name": "health", "description": "Health endpoints"}]


def create_app() -> FastAPI:
    """Factory function to create the FastAPI application."""
    app = FastAPI(
        title="EasyData AI Analyst Backend",
        version="0.1.0",
        description="Self‑hosted backend for natural language to SQL queries using Vanna.",
        openapi_tags=tags_metadata,
    )

    # Global exception handler
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "message": exc.message,
                "data": None,
                "error_code": exc.error_code,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )

    # CORS configuration (allow all origins for now; adjust for prod)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Conditional middleware loading based on toggles
    if settings.ENABLE_LOGGING:
        from app.middleware.logging import LoggingMiddleware
        app.add_middleware(LoggingMiddleware)

    if settings.ENABLE_RATE_LIMIT:
        from app.middleware.rate_limit import RateLimitMiddleware
        app.add_middleware(RateLimitMiddleware)

    if settings.ENABLE_PERFORMANCE:
        from app.middleware.performance import PerformanceMiddleware
        app.add_middleware(PerformanceMiddleware)

    # Add routers
    app.include_router(query.router, prefix="/api/v1")
    app.include_router(auth.router, prefix="/api/v1/auth")
    app.include_router(admin.router, prefix="/api/v1/admin")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(training.router, prefix="/api/v1")
    app.include_router(assets.router, prefix="/api/v1")
    app.include_router(feedback.router, prefix="/api/v1")
    app.include_router(schema.router, prefix="/api/v1")
    app.include_router(api_catalog.router, prefix="/api/v1")
    app.include_router(observability.router, prefix="/api/v1")
    app.include_router(analytics.router, prefix="/api/v1")
    app.include_router(rag_quality.router, prefix="/api/v1")
    app.include_router(admin_settings.router, prefix="/api/v1")
    # Health router already has prefix="/health"; include at /api/v1
    app.include_router(health.router, prefix="/api/v1")

    @app.get("/metrics/json", tags=["health"])
    async def metrics_json():
        return ObservabilityService.metrics_json()

    # Enforce alert gating early
    initialize_alerting()

    # Enforce training readiness gates (hard fail on violation)
    try:
        assert_training_readiness()
    except TrainingReadinessError as exc:
        raise RuntimeError(f"Training readiness failed: {exc}") from exc

    setup_tracing(app, service_name="easydata-backend")

    return app


app = create_app()
settings._START_TIME = getattr(settings, "_START_TIME", time.time())

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
