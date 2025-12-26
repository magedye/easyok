"""
Logging middleware.

Logs incoming requests and outgoing responses along with execution
time.  Structured logging can be enabled via the ENABLE_LOGGING
configuration flag.  Uses Python's built‑in logging for simplicity.
"""

import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = logging.Formatter(
    "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        logger.info(f"Incoming request: {request.method} {request.url.path}")
        response = await call_next(request)
        duration = time.time() - start_time
        logger.info(
            f"Completed {request.method} {request.url.path} with status {response.status_code} in {duration:.3f}s"
        )
        return response