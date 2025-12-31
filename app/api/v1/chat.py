import json
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import require_permission, UserContext
from app.core.config import get_settings
from app.services.orchestration_service import OrchestrationService
from app.services.audit_service import AuditService

router = APIRouter(tags=["chat"])

audit_service = AuditService()
orchestrator = OrchestrationService()


@router.get("/chat/stream")
async def chat_stream(
    question: str = Query(..., description="Natural language question"),
    top_k: int = Query(5, description="RAG top-k"),
    user: UserContext = Depends(require_permission("query:execute")),
):
    """
    SSE adapter over OrchestrationService.

    GOVERNANCE:
    - No SQL generation here
    - No policy logic here
    - No exception leakage
    """
    settings = get_settings(force_reload=True)

    async def event_stream():
        trace_payload = {
            "question": question,
            "user_id": user.get("user_id", "anonymous"),
            "role": user.get("role", "guest"),
        }

        audit_service.log(
            action="chat_stream",
            status="started",
            outcome="started",
            payload=trace_payload,
            **trace_payload,
        )

        # AUTH EVENT
        yield f"event: auth\ndata: {json.dumps({'status': 'authenticated' if user.get('is_authenticated') else 'guest'})}\n\n"

        # THINKING EVENT
        yield f"event: thinking\ndata: {json.dumps({'message': 'processing request'})}\n\n"

        # PREPARATION (SINGLE SOURCE OF TRUTH)
        prep = await orchestrator.prepare(
            question=question,
            user_context=user,
            top_k=top_k,
        )

        if not prep.get("is_safe"):
            error_payload = {
                "code": "GOVERNANCE_BLOCKED",
                "message": prep.get("error", "Request blocked by governance"),
            }

            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            yield f"event: done\ndata: {json.dumps({'status': 'failed'})}\n\n"

            audit_service.log(
                action="chat_stream",
                status="blocked",
                outcome="failed",
                error_message=error_payload["message"],
                payload=trace_payload,
                **trace_payload,
            )
            return

        # TECHNICAL VIEW (READ-ONLY)
        technical_view = {
            "sql": prep["sql"],
            "assumptions": prep["assumptions"],
            "is_safe": True,
            "confidence_tier": prep["confidence_tier"],
        }

        yield f"event: technical_view\ndata: {json.dumps(technical_view)}\n\n"

        # EXECUTION
        raw_result = await orchestrator.execute_sql(prep["sql"])

        if isinstance(raw_result, dict) and raw_result.get("error"):
            yield f"event: error\ndata: {json.dumps({'code': 'EXECUTION_FAILED', 'message': raw_result['error']})}\n\n"
            yield f"event: done\ndata: {json.dumps({'status': 'failed'})}\n\n"

            audit_service.log(
                action="chat_stream",
                status="failed",
                outcome="failed",
                error_message=raw_result["error"],
                payload=trace_payload,
                **trace_payload,
            )
            return

        # DATA
        rows = orchestrator.normalise_rows(raw_result)
        yield f"event: data\ndata: {json.dumps({'rows': rows, 'row_count': len(rows)})}\n\n"

        # BUSINESS VIEW
        business_view = orchestrator.business_view_payload(raw_result)
        yield f"event: summary\ndata: {json.dumps(business_view)}\n\n"

        # DONE
        yield f"event: done\ndata: {json.dumps({'status': 'completed'})}\n\n"

        audit_service.log(
            action="chat_stream",
            status="completed",
            outcome="success",
            payload=trace_payload,
            **trace_payload,
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )
