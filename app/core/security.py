"""
JWT Token Management

GOVERNANCE COMPLIANCE (Phase 1 — Authentication):
- JWT operations ONLY occur after startup guards validate secrets
- See app/core/policy_guard.py for validation logic
- No global JWT managers at import time
- All JWT operations call get_settings(force_reload=True) to get fresh config
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from app.core.config import get_settings


def create_access_token(
    subject: str,
    role: str = "user",
    permissions: list[str] = None,
    data_scope: dict = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    
    NOTE: JWT secret validation is enforced at startup via policy_guard.
    This function assumes all JWT configuration is valid.
    
    Args:
        subject: User ID (sub claim)
        role: User role (default: "user")
        permissions: List of permissions
        data_scope: RLS scope data
        expires_delta: Custom expiration time
    
    Returns:
        Encoded JWT token
    
    Raises:
        ValueError: If JWT is not properly configured (should not happen at runtime)
    """
    
    settings = get_settings(force_reload=True)
    
    # Defensive check: JWT secrets must be configured
    if not settings.JWT_SECRET_KEY:
        raise ValueError(
            "JWT_SECRET_KEY is not configured. "
            "This should have been caught at startup by policy_guard."
        )

    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    
    expire = datetime.utcnow() + expires_delta
    
    to_encode = {
        "sub": subject,
        "role": role,
        "permissions": permissions or [],
        "data_scope": data_scope or {},
        "exp": expire,
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify a JWT access token.
    
    NOTE: JWT secret validation is enforced at startup via policy_guard.
    This function assumes all JWT configuration is valid.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload
    
    Raises:
        JWTError: If token is invalid or expired
        ValueError: If JWT is not properly configured (should not happen at runtime)
    """
    
    settings = get_settings(force_reload=True)

    # Defensive check: JWT secrets must be configured
    if not settings.JWT_SECRET_KEY:
        raise ValueError(
            "JWT_SECRET_KEY is not configured. "
            "This should have been caught at startup by policy_guard."
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise JWTError(f"Invalid or expired token: {str(e)}")
