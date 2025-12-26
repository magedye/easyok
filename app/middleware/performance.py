"""
Performance monitoring and optimisation middleware.

This middleware measures request handling time and logs SLO breaches.
It also provides hooks for compression or caching if desired.  For
production use, integrate with Prometheus via the prometheus_client
library.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time
import logging

logger = logging.getLogger(__name__)


class PerformanceMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, slo_seconds: float = 5.0):
        super().__init__(app)
        self.slo_seconds = slo_seconds

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.time()
        response = await call_next(request)
        duration = time.time() - start
        if duration > self.slo_seconds:
            logger.warning(
                f"SLO breach: {request.url.path} took {duration:.2f}s, exceeds {self.slo_seconds}s"
            )
        return response