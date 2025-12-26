from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import optional_auth, UserContext
from app.services.vanna_service import VannaService
from app.core.config import get_settings

router = APIRouter()
vanna_service = VannaService()


@router.post("/ask")
async def ask(
    question: str,
    user: UserContext = Depends(optional_auth),
):
    """
    Ask a natural language question.
    
    This endpoint works with or without authentication,
    depending on AUTH_ENABLED setting.
    
    Args:
        question: Natural language question
        user: User context (injected automatically)
    
    Returns:
        Query result with optional RLS filtering
    """
    try:
        result = await vanna_service.ask(
            question=question,
            user_context=user,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
