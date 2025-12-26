"""
Rate limiting middleware stub.

This middleware limits the number of requests per user/IP within a
time window.  It is disabled by default via configuration.  Actual
implementation should store counters in a shared cache (e.g. Redis).
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import HTTPException, status
import time


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = {}

    async def dispatch(self, request: Request, call_next) -> Response:
        identifier = request.client.host  # naive IP‑based identifier
        current_time = time.time()
        requests = self.requests.setdefault(identifier, [])
        # Remove timestamps outside the window
        self.requests[identifier] = [t for t in requests if current_time - t < self.window_seconds]
        if len(self.requests[identifier]) >= self.max_requests:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many requests")
        # Record this request
        self.requests[identifier].append(current_time)
        return await call_next(request)