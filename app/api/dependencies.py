"""
Shared dependencies for FastAPI routers.

This module defines functions to retrieve the current user, enforce
permissions, and obtain provider instances.  Dependencies are
injected into route handlers via FastAPI's Depends mechanism.
"""

from typing import Any, Callable
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token, Role, Permission, ROLE_PERMISSIONS
from app.core.exceptions import PermissionDeniedError


bearer_scheme = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict[str, Any]:
    """Parse a JWT token and return a user dictionary."""
    try:
        payload = decode_access_token(credentials.credentials)
        # For demonstration purposes, assume payload contains id and role
        user = {
            "id": payload.get("sub"),
            "role": payload.get("role", Role.GUEST),
            "scopes": payload.get("scopes", []),
        }
        return user
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def require_permission(permission: Permission) -> Callable:
    """Dependency factory to require a specific permission."""
    def checker(user: dict = Depends(get_current_user)) -> dict:
        role = Role(user["role"])
        user_perms = ROLE_PERMISSIONS.get(role, [])
        if permission not in user_perms:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user
    return checker