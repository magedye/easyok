import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.dependencies import optional_auth, UserContext
from app.models.request import QueryRequest
from app.services.vanna_service import VannaService

router = APIRouter()
vanna_service = VannaService()


@router.post("/ask")
async def ask(
    request: QueryRequest,
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
    async def ndjson_stream():
        """Stream NDJSON chunks in strict order: data -> chart -> summary."""

        # NOTE: Keep chunk schema aligned with tests: {"type": ..., "payload": ...}
        try:
            result = await vanna_service.ask(
                question=request.question,
                top_k=request.top_k,
                user_context=user,
            )

            # Phase 1: data (payload must be a list)
            rows = result.get("rows") if isinstance(result, dict) else None
            if isinstance(rows, list):
                data_payload = rows
            elif isinstance(result, list):
                data_payload = result
            else:
                data_payload = [result] if result is not None else []

            yield json.dumps({"type": "data", "payload": data_payload}) + "\n"

            # Phase 2: chart (payload must be a dict)
            chart_payload = {
                "type": "table",
                "config": {},
            }
            yield json.dumps({"type": "chart", "payload": chart_payload}) + "\n"

            # Phase 3: summary (payload must be a string)
            summary_payload = (
                result.get("summary")
                if isinstance(result, dict) and isinstance(result.get("summary"), str)
                else "ok"
            )
            yield json.dumps({"type": "summary", "payload": summary_payload}) + "\n"

        except Exception as e:
            # Keep streaming contract even on failure
            yield json.dumps({"type": "error", "payload": str(e)}) + "\n"

    return StreamingResponse(ndjson_stream(), media_type="application/x-ndjson")
