"""
API endpoints for querying the system.

The query endpoint accepts natural language questions and streams
results back to the client via NDJSON.  Users must be authenticated
and have the appropriate permission.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.models.request import QueryRequest
from app.api.dependencies import get_current_user
from app.services.orchestration import OrchestrationService


router = APIRouter()

@router.post("/ask", response_class=StreamingResponse)
async def ask_question(payload: QueryRequest, user=Depends(get_current_user)) -> StreamingResponse:
    """Endpoint to submit a question and receive a streaming response."""
    service = OrchestrationService()
    return await service.ask(payload.question, user)