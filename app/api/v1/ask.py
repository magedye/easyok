import json
from typing import Any, Dict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.dependencies import require_permission, UserContext
from app.core.config import get_settings
from app.services.orchestration_service import OrchestrationService
from app.services.audit_service import AuditService
from app.core.tier_router import TierRouter, OperationTier

router = APIRouter(tags=["ask"])
settings = get_settings()

audit_service = AuditService()
tier_router = TierRouter()


@router.post("/api/v1/ask")
async def ask_ndjson(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("query:execute")),
):
    """
    NDJSON Streaming Endpoint (Phase 4 – Binding Contract)

    GOVERNANCE:
    - OrchestrationService is the ONLY authority
    - Fail-Closed
    - No SQL generation here
    - No policy logic here
    """

    if settings.STREAM_PROTOCOL != "ndjson":
        raise HTTPException(status_code=404, detail="NDJSON stream disabled")
    if tier_router.tier != OperationTier.FORTRESS:
        raise HTTPException(
            status_code=403,
            detail="NDJSON contract is available only in tier0_fortress",
        )

    orchestrator: OrchestrationService = tier_router.resolve_ask_service()  # type: ignore[assignment]

    question = payload.get("question")
    top_k = payload.get("top_k", 5)

    if not question:
        raise HTTPException(status_code=400, detail="Missing question")

    async def ndjson_stream():
        trace_int = orchestrator.tracer.start_span("ask_ndjson").get_span_context().trace_id
        trace_id = f"{trace_int:032x}"

        def emit(chunk: Dict[str, Any]):
            chunk["trace_id"] = trace_id
            yield json.dumps(chunk, ensure_ascii=False) + "\n"

        def emit_error(message: str, code: str):
            ts = datetime.utcnow().isoformat() + "Z"
            return json.dumps(
                {
                    "type": "error",
                    "trace_id": trace_id,
                    "timestamp": ts,
                    "error_code": code,
                    "message": message,
                    "lang": "en",
                },
                ensure_ascii=False,
            ) + "\n"

        # THINKING (MANDATORY FIRST)
        yield from emit({
            "type": "thinking",
            "payload": {"content": "Processing request", "step": "prepare"},
        })

        prep = await orchestrator.prepare(
            question=question,
            user_context=user,
            top_k=top_k,
        )

        if not prep.get("is_safe"):
            yield emit_error(prep.get("error", "Request blocked by governance"), "GOVERNANCE_BLOCKED")
            yield from emit({"type": "end", "payload": {"status": "failed"}})
            return

        yield from emit({
            "type": "technical_view",
            "payload": {
                "sql": prep["sql"],
                "assumptions": prep["assumptions"],
                "is_safe": True,
                "confidence_tier": prep["confidence_tier"],
            },
        })

        raw_result = await orchestrator.execute_sql(prep["sql"])

        if isinstance(raw_result, dict) and raw_result.get("error"):
            yield emit_error(raw_result["error"], "EXECUTION_FAILED")
            yield from emit({"type": "end", "payload": {"status": "failed"}})
            return

        rows = orchestrator.normalise_rows(raw_result)
        yield from emit({"type": "data", "payload": {"rows": rows}})

        business_view = orchestrator.business_view_payload(raw_result)
        yield from emit({"type": "business_view", "payload": business_view})

        yield from emit({"type": "end", "payload": {"status": "success"}})

    return StreamingResponse(
        ndjson_stream(),
        media_type="application/x-ndjson",
    )
