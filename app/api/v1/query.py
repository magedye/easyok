import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.dependencies import optional_auth, UserContext
from app.models.request import QueryRequest
from app.services.orchestration_service import OrchestrationService

router = APIRouter()
orchestration_service = OrchestrationService()


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
        """Stream NDJSON chunks in strict order: technical_view -> data -> chart -> summary."""

        # NOTE: Runtime contract is authoritative in AskResponse_NDJSON_Schema.md:
        # {"type": "...", "payload": ...}
        try:
            technical_view = await orchestration_service.prepare(
                question=request.question,
                top_k=request.top_k,
                user_context=user,
            )

            # Chunk 1: technical_view
            yield json.dumps({"type": "technical_view", "payload": technical_view}) + "\n"

            # If unsafe, emit error chunk and stop (stream stays HTTP 200)
            if not technical_view.get("is_safe", False):
                yield json.dumps(
                    {
                        "type": "error",
                        "payload": {
                            "message": "SQL rejected by guard",
                            "error_code": "invalid_query",
                        },
                    }
                ) + "\n"
                return

            raw_result = await orchestration_service.execute_sql(technical_view["sql"])
            data_payload = orchestration_service.normalise_rows(raw_result)

            # Chunk 2: data (payload must be a list)
            yield json.dumps({"type": "data", "payload": data_payload}) + "\n"

            # Chunk 3: chart (payload must be a dict with chart_type/x/y)
            chart_payload = orchestration_service.chart_recommendation(data_payload)
            yield json.dumps({"type": "chart", "payload": chart_payload}) + "\n"

            # Chunk 4: summary (payload must be a string)
            summary_payload = orchestration_service.summary_text(raw_result)
            yield json.dumps({"type": "summary", "payload": summary_payload}) + "\n"

        except Exception as e:
            # Keep streaming contract even on failure (after start)
            yield json.dumps(
                {
                    "type": "error",
                    "payload": {
                        "message": str(e),
                        "error_code": "internal_error",
                    },
                }
            ) + "\n"

    return StreamingResponse(ndjson_stream(), media_type="application/x-ndjson")
