"""
Security and authentication utilities.

Governance Compliance:
- JWT secrets are validated at startup by policy_guard.py
- No global JWT manager instances at import time
- All functions use get_settings(force_reload=True) for runtime validation
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError

logger = logging.getLogger(__name__)


def create_access_token(
    subject: str,
    extra_data: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a new JWT access token.
    
    Args:
        subject: User identifier (user_id or username)
        extra_data: Additional claims to include in token
        expires_delta: Custom expiration time (default: 15 minutes)
    
    Returns:
        Encoded JWT string
    
    Governance:
        - Uses runtime settings validation
        - Requires JWT secrets to be configured
        - Fails closed if secrets missing
    """
    settings = get_settings(force_reload=True)
    
    if not settings.JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY is not configured")
    
    if not settings.JWT_ISSUER:
        raise ValueError("JWT_ISSUER is not configured")
    
    if not settings.JWT_AUDIENCE:
        raise ValueError("JWT_AUDIENCE is not configured")
    
    now = datetime.utcnow()
    expire = now + (expires_delta or timedelta(minutes=15))
    
    payload = {
        "sub": subject,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": now,
        "exp": expire,
    }
    
    if extra_data:
        payload.update(extra_data)
    
    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    
    logger.info(f"Token created for subject: {subject}")
    return token


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT access token.
    
    Args:
        token: Encoded JWT string
    
    Returns:
        Decoded payload
    
    Raises:
        AuthenticationError: If token is invalid or expired
    
    Governance:
        - Validates signature using runtime settings
        - Checks issuer and audience claims
        - Fails closed if secrets missing
    """
    settings = get_settings(force_reload=True)
    
    if not settings.JWT_SECRET_KEY:
        raise AuthenticationError("JWT_SECRET_KEY is not configured")
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            audience=settings.JWT_AUDIENCE,
        )
        return payload
    except JWTError as e:
        logger.warning(f"Token decode failed: {e}")
        raise AuthenticationError(f"Invalid token: {e}")


def verify_token_claims(payload: Dict[str, Any]) -> bool:
    """
    Verify token claims are present and valid.
    
    Args:
        payload: Decoded JWT payload
    
    Returns:
        True if valid
    
    Governance:
        - Validates required claims exist
        - Checks expiration
    """
    required_claims = ["sub", "iss", "aud", "exp", "iat"]
    for claim in required_claims:
        if claim not in payload:
            logger.warning(f"Missing required claim: {claim}")
            return False
    
    # Check expiration
    exp = payload.get("exp")
    if exp:
        now = datetime.utcnow().timestamp()
        if now > exp:
            logger.warning("Token has expired")
            return False
    
    return True


# Test function for development
def generate_test_token() -> str:
    """Generate a test token for development purposes."""
    settings = get_settings(force_reload=True)
    if settings.ENV != "local":
        raise RuntimeError("Test tokens only available in local environment")
    
    return create_access_token(
        subject="test-user",
        extra_data={"role": "admin", "permissions": ["*"]},
        expires_delta=timedelta(hours=24),
    )
