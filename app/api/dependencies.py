from fastapi import Depends, HTTPException, Request, status
from typing import Dict, Any, Optional
from app.core.config import get_settings
from app.core.security import decode_access_token


# ============================================================================
# UserContext Contract (Stable, Immutable)
# ============================================================================

UserContext = Dict[str, Any]

ANONYMOUS_CONTEXT: UserContext = {
    "user_id": "anonymous",
    "role": "guest",
    "permissions": ["query:execute"],
    "data_scope": {},
    "is_authenticated": False,
}


# ============================================================================
# Token Extraction (Clear Responsibility)
# ============================================================================

def extract_bearer_token(
    request: Request,
    *,
    required: bool = True
) -> Optional[str]:
    """
    Extract Bearer token from Authorization header.
    
    Args:
        request: FastAPI Request object
        required: If True, raise 401 when token is missing
    
    Returns:
        Token string or None
    
    Raises:
        HTTPException: 401 if required=True and token missing/invalid
    """
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header:
        if required:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header missing",
            )
        return None
    
    scheme, _, token = auth_header.partition(" ")
    
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Expected: Bearer <token>",
        )
    
    return token


# ============================================================================
# Optional Authentication (Toggleable Dependency)
# ============================================================================

async def optional_auth(request: Request) -> UserContext:
    """
    Optional authentication dependency.
    
    Returns user context based on AUTH_ENABLED setting:
    - If AUTH_ENABLED=false: Returns anonymous context
    - If AUTH_ENABLED=true: Requires valid JWT
    
    Returns:
        UserContext dict (stable contract)
    
    Raises:
        HTTPException: 401 if AUTH_ENABLED and token invalid
    """
    settings = get_settings(force_reload=True)
    
    # 🔓 Security Disabled → Return Anonymous Context
    if not settings.AUTH_ENABLED:
        return ANONYMOUS_CONTEXT.copy()
    
    # 🔐 Security Enabled → Enforce JWT
    token = extract_bearer_token(request, required=True)
    
    try:
        payload = decode_access_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
    
    return {
        "user_id": payload.get("sub", "unknown"),
        "role": payload.get("role", "user"),
        "permissions": payload.get("permissions", []),
        "data_scope": payload.get("data_scope", {}),
        "is_authenticated": True,
    }


# ============================================================================
# Strict Authentication (For Admin-Only Operations)
# ============================================================================

async def get_current_user(user: UserContext = Depends(optional_auth)) -> UserContext:
    """
    Strict authentication dependency.
    
    Requires user to be authenticated. Use this only for operations
    that MUST have authentication, regardless of AUTH_ENABLED.
    
    Raises:
        HTTPException: 401 if user is not authenticated
    """
    if not user["is_authenticated"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for this operation",
        )
    return user


# ============================================================================
# Permission Checking (RBAC with Toggle)
# ============================================================================

def require_permission(permission: str):
    """
    Permission dependency (RBAC).
    
    Checks if user has required permission.
    If RBAC_ENABLED=false, allows all users.
    
    Args:
        permission: Required permission string (e.g., "training:approve")
    
    Returns:
        Dependency function
    
    Raises:
        HTTPException: 403 if permission missing (when RBAC_ENABLED)
    """
    async def checker(user: UserContext = Depends(optional_auth)) -> UserContext:
        settings = get_settings(force_reload=True)
        
        # 🔓 RBAC Disabled → Allow Everything
        if not settings.RBAC_ENABLED:
            return user
        
        # 🔐 RBAC Enabled → Check Permission
        if permission not in user["permissions"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        
        return user
    
    return checker


# ============================================================================
# Role Checking (Optional, for convenience)
# ============================================================================

def require_role(role: str):
    """
    Role dependency.
    
    Checks if user has required role.
    If RBAC_ENABLED=false, allows all users.
    
    Args:
        role: Required role string (e.g., "admin")
    
    Returns:
        Dependency function
    
    Raises:
        HTTPException: 403 if role missing (when RBAC_ENABLED)
    """
    async def checker(user: UserContext = Depends(optional_auth)) -> UserContext:
        settings = get_settings(force_reload=True)
        
        # 🔓 RBAC Disabled → Allow Everything
        if not settings.RBAC_ENABLED:
            return user
        
        # 🔐 RBAC Enabled → Check Role
        if user["role"] != role and user["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {role}. Your role: {user['role']}",
            )
        
        return user
    
    return checker
