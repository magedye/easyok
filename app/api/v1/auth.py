from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import optional_auth, UserContext
from app.core.security import create_access_token

router = APIRouter()


@router.post("/login")
async def login(username: str, password: str) -> dict:
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
