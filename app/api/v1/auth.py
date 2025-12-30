from typing import Optional
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, HTTPException, Request
from app.api.dependencies import optional_auth, UserContext
from app.core.security import create_access_token

router = APIRouter()


@router.post("/login")
async def login(
    request: Request,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> dict:
    """
    Login endpoint (MVP version - placeholder).
    
    Notes:
        - This is MVP minimal implementation
        - In production, integrate with proper user database
        - For testing, you can use hardcoded credentials
    
    Args:
        username: Username
        password: Password
    
    Returns:
        Access token
    
    Raises:
        HTTPException: 401 if credentials invalid
    """
    # MVP: Hardcoded credentials (replace with DB lookup in production)
    VALID_USER = {
        "username": "admin",
        "password": "changeme",
        "role": "admin",
        "permissions": ["query:execute", "training:approve", "admin:view"],
        "data_scope": {}
    }

    # Accept credentials from query parameters, JSON body, or form-encoded body
    if not username or not password:
        body_username = None
        body_password = None

        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                payload = await request.json()
                body_username = payload.get("username")
                body_password = payload.get("password")
            except Exception:
                body_username = None
                body_password = None
        else:
            # Fallback for application/x-www-form-urlencoded or other simple bodies
            try:
                raw_body = await request.body()
                if raw_body:
                    parsed = parse_qs(raw_body.decode())
                    body_username = parsed.get("username", [None])[0]
                    body_password = parsed.get("password", [None])[0]
            except Exception:
                body_username = None
                body_password = None

        username = username or body_username
        password = password or body_password

    if username != VALID_USER["username"] or password != VALID_USER["password"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(
        subject=username,
        role=VALID_USER["role"],
        permissions=VALID_USER["permissions"],
        data_scope=VALID_USER["data_scope"],
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
    }


@router.get("/me")
async def get_current_user_info(
    user: UserContext = Depends(optional_auth),
) -> dict:
    """
    Get current user information (from token or anonymous context).
    
    Returns:
        User context
    """
    return user
