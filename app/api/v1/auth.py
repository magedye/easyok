import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from app.api.dependencies import (
    require_permission,
    UserContext,
    extract_bearer_token,
)
from app.core.security import create_access_token, decode_access_token

router = APIRouter()


@router.post("/login")
async def login(
    request: Request,
    username: str = Query(...),
    password: str = Query(...),
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
    # Credentials sourced from environment to avoid hardcoded secrets
    VALID_USER = {
        "username": os.environ.get("AUTH_DEMO_USERNAME", "admin"),
        "password": os.environ.get("AUTH_DEMO_PASSWORD", "changeme"),
        "role": "admin",
        "permissions": ["query:execute", "training:approve", "admin:view"],
        "data_scope": {},
    }

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
    user: UserContext = Depends(require_permission("auth.session.read")),
) -> dict:
    """
    Get current user information (from token or anonymous context).
    
    Returns:
        User context
    """
    return user


@router.post("/logout", status_code=204)
async def logout(
    user: UserContext = Depends(require_permission("auth.logout")),
) -> Response:
    """
    Stateless logout (client discards token).
    """
    return Response(status_code=204)


@router.post("/validate")
async def validate_token(
    request: Request,
    user: UserContext = Depends(require_permission("auth.validate")),
) -> dict:
    """
    Validate a bearer token and return its payload.
    """
    token = extract_bearer_token(request, required=True)
    try:
        payload = decode_access_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return {"valid": True, "payload": payload}


@router.get("/status")
async def auth_status(
    user: UserContext = Depends(require_permission("auth.session.read")),
) -> dict:
    """
    Return authentication status and current permissions.
    """
    return {"status": "ok", "user": user}
