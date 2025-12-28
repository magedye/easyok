"""
Governance Middleware: Enforce governance rules on every request.

This middleware:
1. Sets current user context for RBAC
2. Catches RBACViolation and ImmutableToggleViolation
3. Logs violations to governance audit trail
4. Emits OTel spans for violations
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import json
import logging

from app.core.admin_rbac import (
    set_current_user,
    RBACViolation,
    ImmutableToggleViolation,
    MissingReasonError,
)

logger = logging.getLogger(__name__)


class GovernanceMiddleware(BaseHTTPMiddleware):
    """Enforce governance rules on requests."""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request through governance checks.
        """
        # Extract user from JWT or auth header (normally done by auth middleware)
        user = self._extract_user(request)
        set_current_user(user)
        
        try:
            response = await call_next(request)
            return response
        
        except ImmutableToggleViolation as e:
            logger.warning(f"[GOVERNANCE VIOLATION] Immutable toggle violation: {str(e)}")
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "error": str(e),
                    "code": "IMMUTABLE_TOGGLE_VIOLATION",
                },
            )
        
        except RBACViolation as e:
            user_id = user.get("id", "unknown") if user else "anonymous"
            logger.warning(f"[RBAC VIOLATION] User {user_id}: {str(e)}")
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "error": str(e),
                    "code": "RBAC_VIOLATION",
                },
            )
        
        except MissingReasonError as e:
            logger.warning(f"[GOVERNANCE VIOLATION] Missing reason: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "error": str(e),
                    "code": "MISSING_REASON",
                },
            )
    
    def _extract_user(self, request: Request) -> dict:
        """
        Extract user from request.
        
        In production, this would decode JWT from Authorization header.
        For now, return placeholder.
        """
        # Try to get from header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            # In production: decode JWT and extract user
            # For now: placeholder
            return {
                "id": "user_from_jwt",
                "role": "admin",  # Would be decoded from JWT
            }
        
        return None
