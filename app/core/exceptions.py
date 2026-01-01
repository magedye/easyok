"""
Custom exception definitions for the EasyData application.

Use these exceptions to signal specific error conditions within services
and providers.  The global exception handler in `main.py` translates
them into JSON responses with consistent structure.
"""

from __future__ import annotations

from typing import Callable
import time


class AppException(Exception):
    """Base class for application exceptions."""

    status_code: int = 500
    error_code: str = "internal_error"
    message: str = "An unexpected error occurred"

    def __init__(self, message: str | None = None):
        if message:
            self.message = message
        super().__init__(self.message)


class ServiceUnavailableError(AppException):
    status_code = 503
    error_code = "service_unavailable"
    message = "Service is temporarily unavailable"


class InvalidQueryError(AppException):
    status_code = 400
    error_code = "invalid_query"
    message = "Generated SQL is invalid"


class InvalidConnectionStringError(AppException):
    status_code = 400
    error_code = "INVALID_CONNECTION_STRING"
    message = "Invalid database connection string"


class UnauthorizedError(AppException):
    status_code = 401
    error_code = "unauthorized"
    message = "Authentication required"


class AuthenticationError(AppException):
    status_code = 401
    error_code = "authentication_error"
    message = "Invalid or expired token"


class PermissionDeniedError(AppException):
    status_code = 403
    error_code = "permission_denied"
    message = "You do not have permission to perform this action"


class CircuitBreaker:
    """
    Simple circuit breaker decorator to prevent cascading failures.

    Use this decorator on methods that call external services (LLMs,
    databases).  When the number of consecutive failures exceeds
    `max_failures`, the circuit is opened and subsequent calls will
    immediately raise `ServiceUnavailableError` until `timeout`
    seconds have passed.
    """

    def __init__(self, max_failures: int = 5, timeout: int = 60):
        self.max_failures = max_failures
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time: float | None = None

    def __call__(self, func: Callable):
        def wrapper(*args, **kwargs):
            if self._is_open():
                raise ServiceUnavailableError()
            try:
                result = func(*args, **kwargs)
                self._reset()
                return result
            except Exception:
                self._record_failure()
                raise
        return wrapper

    def _is_open(self) -> bool:
        if self.failure_count >= self.max_failures:
            if self.last_failure_time is None:
                self.last_failure_time = time.time()
            if time.time() - self.last_failure_time < self.timeout:
                return True
            self._reset()
        return False

    def _record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()

    def _reset(self) -> None:
        self.failure_count = 0
        self.last_failure_time = None
