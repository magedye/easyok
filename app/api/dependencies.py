"""
FastAPI Dependency Injection for Authentication & Authorization

GOVERNANCE COMPLIANCE (Phase 1 & 2):
- Authentication: JWT validation when AUTH_ENABLED=true
- Authorization: RBAC with wildcard semantics when RBAC_ENABLED=true
- Wildcard semantics: "admin:*" matches "admin:read", "admin:write", etc.
- Both ":" and "." separators are equivalent (aliased)
"""

from fastapi import Depends, HTTPException, Request, status
from typing import Dict, Any, Optional, List
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
# Role -> Permissions mapping (server-side RBAC)
# ============================================================================

ROLE_PERMISSION_MAP = {
    "viewer": ["query:execute", "query.execute"],
    "analyst": [
        "query:execute",
        "query.execute",
        "asset:read",
        "asset:write",
        "training:upload",
        "training.read",
        "feedback:submit",
        "schema:connections",
        "schema.connections",
        "auth.session.read",
        "schema.policy",
        "assumptions.review",
        "assumptions.approve",
    ],
    "admin": [
        "query:execute",
        "query.execute",
        "asset:read",
        "asset:write",
        "asset:delete",
        "training:upload",
        "training:approve",
        "training:purge",
        "training.read",
        "training.rollback",
        "audit:view",
        "admin.audit.read",
        "feedback:submit",
        "feedback.review",
        "schema:connections",
        "schema.connections",
        "auth.session.read",
        "auth.logout",
        "auth.validate",
        "schema.policy",
        "schema.policy.activate",
        "assumptions.review",
        "assumptions.approve",
        "admin.schema.drift",
        "admin.schema.retrain",
        "admin.sql.export",
    ],
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

    role = payload.get("role", "user")
    # server-side permissions derived from role if not provided
    perms = payload.get("permissions") or ROLE_PERMISSION_MAP.get(role, [])

    return {
        "user_id": payload.get("sub", "unknown"),
        "role": role,
        "permissions": perms,
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

def _check_permission_with_wildcards(required: str, user_perms: List[str]) -> bool:
    """
    Check if user has required permission, handling wildcard semantics.
    
    Rules:
    1. Exact match: if "admin:read" is required and user has "admin:read" → allow
    2. Wildcard match: if "admin:read" is required and user has "admin:*" → allow
    3. Alias handling: both ":" and "." separators are equivalent
    
    Args:
        required: Required permission (e.g., "admin:read", "admin.read")
        user_perms: List of user permissions
        
    Returns:
        True if user has permission, False otherwise
    """
    # Normalize required permission to both forms
    required_colon = required.replace(".", ":")
    required_dot = required.replace(":", ".")
    required_forms = {required_colon, required_dot}
    
    for user_perm in user_perms:
        # Normalize user permission to both forms
        user_perm_colon = user_perm.replace(".", ":")
        user_perm_dot = user_perm.replace(":", ".")
        
        # Exact match (with alias handling)
        if user_perm_colon in required_forms or user_perm_dot in required_forms:
            return True
        
        # Wildcard match: check if user has "namespace:*" permission
        # e.g., user has "admin:*", required is "admin:read"
        if user_perm_colon.endswith(":*"):
            namespace = user_perm_colon[:-2]  # Remove ":*"
            if required_colon.startswith(namespace + ":"):
                return True
        
        if user_perm_dot.endswith(".*"):
            namespace = user_perm_dot[:-2]  # Remove ".*"
            if required_dot.startswith(namespace + "."):
                return True
    
    return False


def require_permission(permission: str):
    """
    Permission dependency (RBAC).
    
    GOVERNANCE (Phase 2 — Authorization):
    Checks if user has required permission with proper wildcard semantics.
    - "admin:*" grants access to all "admin:*" sub-permissions
    - Both ":" and "." separators are equivalent (aliased)
    - If RBAC_ENABLED=false, allows all users
    
    Args:
        permission: Required permission string (e.g., "training:approve", "admin.read")
    
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
        
        # 🔐 RBAC Enabled → Check Permission with wildcard support
        perms = user["permissions"]
        
        if not _check_permission_with_wildcards(permission, perms):
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
