import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import UserContext, require_permission
from app.core.config import get_settings
from app.models.request import QueryRequest
from app.services.orchestration_service import OrchestrationService
from app.services.audit_service import AuditService
from app.services.factory import ServiceFactory
from app.core.exceptions import InvalidQueryError
from app.models.enums.confidence_tier import ConfidenceTier
from opentelemetry import trace
from opentelemetry.trace import SpanKind
import hashlib

router = APIRouter(tags=["query"])
orchestration_service = OrchestrationService()
audit_service = AuditService()
tracer = trace.get_tracer(__name__)


def _ts() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _chunk(chunk_type: str, payload: dict, *, trace_id: str, tier: ConfidenceTier, ts: str) -> str:
    return json.dumps(
        {
            "type": chunk_type,
            "trace_id": trace_id,
            "confidence_tier": tier.value,
            "timestamp": ts,
            "payload": payload,
        }
    ) + "\n"


@router.post("/ask")
async def ask(
    request: QueryRequest | None = None,
    question: str | None = Query(default=None),
    top_k: int | None = Query(default=None),
    user: UserContext = Depends(require_permission("query:execute")),
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
    settings = get_settings(force_reload=True)
    if settings.AUTH_ENABLED and not user.get("is_authenticated"):
        raise HTTPException(status_code=401, detail="Authentication required")
    if settings.STREAM_PROTOCOL != "ndjson":
        raise HTTPException(status_code=404, detail="NDJSON stream disabled")

    async def ndjson_stream():
        """Stream NDJSON chunks in strict order: technical_view -> data -> chart -> summary."""

        # NOTE: Runtime contract: NDJSON with strict order technical_view -> data (chart/summary optional).
        # Accept either JSON body (QueryRequest) or query params (question/top_k)
        q_text = request.question if request else question
        tk = request.top_k if request and request.top_k is not None else top_k
        if q_text is None:
            raise HTTPException(status_code=422, detail="question is required")

        tk = tk if tk is not None else 5

        chunk_count = 0
        trace_id = uuid.uuid4().hex
        advisor = ServiceFactory.advisor()

        with tracer.start_as_current_span(
            "ask.request",
            kind=SpanKind.SERVER,
            attributes={
                "http.method": "POST",
                "http.route": "/api/v1/ask",
                "user.id": user.get("user_id", "anonymous"),
                "rbac.scope": user.get("role", "guest"),
                "app.env": settings.APP_ENV,
            },
        ):
            try:
                schema_version = None
                policy_version = None
                thinking_ts = _ts()
                yield _chunk(
                    "thinking",
                    {"status": "processing"},
                    trace_id=trace_id,
                    tier=ConfidenceTier.TIER_1_LAB,
                    ts=thinking_ts,
                )
                chunk_count += 1

                audit_service.log(
                    user_id=user.get("user_id", "anonymous"),
                    role=user.get("role", "guest"),
                    action="ask",
                    resource_id=None,
                    payload={"question": q_text},
                    question=q_text,
                    sql="",
                    status="started",
                    outcome="started",
                )

                with tracer.start_as_current_span(
                    "sql.generate",
                    attributes={
                        "question": q_text,
                    },
                ):
                    technical_view = await orchestration_service.prepare(
                        question=q_text,
                        top_k=tk,
                        user_context=user,
                    )

                sql_text = technical_view.get("sql", "")
                sql_hash = hashlib.sha256(sql_text.encode("utf-8")).hexdigest() if sql_text else ""
                tier_value = technical_view.get("confidence_tier", ConfidenceTier.TIER_0_FORTRESS.value)
                tier = ConfidenceTier(tier_value)

                audit_service.log(
                    user_id=user.get("user_id", "anonymous"),
                    role=user.get("role", "guest"),
                    action="ask",
                    resource_id=None,
                    payload={"question": q_text},
                    question=q_text,
                    sql=sql_text,
                    status="completed",
                    outcome="success",
                )

                if not technical_view.get("is_safe") or not sql_text:
                    yield _chunk(
                        "error",
                        {
                            "message": technical_view.get("error", "SQL generation failed"),
                            "error_code": technical_view.get("error_code", "invalid_query"),
                        },
                        trace_id=trace_id,
                        tier=ConfidenceTier.TIER_0_FORTRESS,
                        ts=_ts(),
                    )
                    yield _chunk(
                        "end",
                        {"status": "failed", "chunks": chunk_count + 1},
                        trace_id=trace_id,
                        tier=ConfidenceTier.TIER_0_FORTRESS,
                        ts=_ts(),
                    )
                    return

                yield _chunk(
                    "technical_view",
                    technical_view,
                    trace_id=trace_id,
                    tier=tier,
                    ts=_ts(),
                )
                chunk_count += 1
                explanation = advisor.explain_sql(sql_text)
                if explanation:
                    yield _chunk(
                        "explanation_chunk",
                        {"sql": sql_text, "explanation": explanation},
                        trace_id=trace_id,
                        tier=ConfidenceTier.TIER_1_LAB,
                        ts=_ts(),
                    )
                    chunk_count += 1

                with tracer.start_as_current_span(
                    "db.query.execute",
                    kind=SpanKind.CLIENT,
                    attributes={
                        "db.system": "oracle",
                        "db.operation": "SELECT",
                        "question": q_text,
                        "schema.version": schema_version,
                        "policy.version": policy_version,
                        "sql.hash": sql_hash,
                    },
                ):
                    # Enforce execution contract boundary
                    if technical_view.get("confidence_tier") != ConfidenceTier.TIER_0_FORTRESS.value:
                        audit_service.log(
                            user_id=user.get("user_id", "anonymous"),
                            role=user.get("role", "guest"),
                            action="Boundary_Violation",
                            resource_id=None,
                            payload={"reason": "Attempted execution with non-fortress tier"},
                            question=q_text,
                            sql=sql_text,
                            status="blocked",
                            outcome="failed",
                        )
                        yield _chunk(
                            "error",
                            {"message": "SECURITY_VIOLATION: execution requires TIER_0_FORTRESS", "error_code": "boundary_violation"},
                            trace_id=trace_id,
                            tier=ConfidenceTier.TIER_0_FORTRESS,
                            ts=_ts(),
                        )
                        yield _chunk(
                            "end",
                            {"status": "failed", "chunks": chunk_count + 1},
                            trace_id=trace_id,
                            tier=ConfidenceTier.TIER_0_FORTRESS,
                            ts=_ts(),
                        )
                        return
                    raw_result = await orchestration_service.execute_sql(sql_text)

                data_payload = orchestration_service.normalise_rows(raw_result)

                with tracer.start_as_current_span(
                    "ask.stream",
                    attributes={
                        "stream.protocol": "NDJSON",
                        "stream.first_chunk": "technical_view",
                        "stream.cache_hit": technical_view.get("cache_hit", False),
                    },
                ) as stream_span:
                    with tracer.start_as_current_span(
                        "stream.technical_view",
                        attributes={
                            "question": q_text,
                        },
                    ):
                        pass

                    with tracer.start_as_current_span(
                        "stream.data",
                        attributes={
                            "question": q_text,
                        },
                    ):
                        yield _chunk(
                            "data_chunk",
                            {"rows": data_payload, "row_count": len(data_payload)},
                            trace_id=trace_id,
                            tier=ConfidenceTier.TIER_0_FORTRESS,
                            ts=_ts(),
                        )
                        chunk_count += 1

                        chart_payload = orchestration_service.chart_recommendation(data_payload)
                        columns = list(data_payload[0].keys()) if data_payload and isinstance(data_payload[0], dict) else []
                        advisory_chart = advisor.suggest_chart(columns)
                        if advisory_chart:
                            yield _chunk(
                                "chart_suggestion_chunk",
                                {"chart": advisory_chart, "source": "advisory"},
                                trace_id=trace_id,
                                tier=ConfidenceTier.TIER_1_LAB,
                                ts=_ts(),
                            )
                            chunk_count += 1

                        summary_payload = orchestration_service.summary_text(raw_result)
                        yield _chunk(
                            "business_view",
                            {"chart": chart_payload, "summary": summary_payload},
                            trace_id=trace_id,
                            tier=ConfidenceTier.TIER_1_LAB,
                            ts=_ts(),
                        )
                    chunk_count += 1

                    yield _chunk(
                        "end",
                        {"status": "completed", "chunks": chunk_count},
                        trace_id=trace_id,
                        tier=ConfidenceTier.TIER_0_FORTRESS,
                        ts=_ts(),
                    )
                    chunk_count += 1

                    stream_span.set_attribute("stream.total_chunks", chunk_count)
                    stream_span.set_attribute("stream.cache_hit", technical_view.get("cache_hit", False))

            except InvalidQueryError as e:
                audit_service.log(
                    user_id=user.get("user_id", "anonymous"),
                    role=user.get("role", "guest"),
                    action="Blocked_SQL_Attempt",
                    resource_id=None,
                    payload={"question": q_text},
                    question=q_text,
                    sql="",
                    status="blocked",
                    outcome="failed",
                    error_message=str(e),
                )
                err_tier = ConfidenceTier.TIER_0_FORTRESS
                yield _chunk(
                    "error",
                    {"message": "تم حظر الاستعلام لاعتبارات أمان", "error_code": "SECURITY_VIOLATION"},
                    trace_id=trace_id,
                    tier=err_tier,
                    ts=_ts(),
                )
                yield _chunk(
                    "end",
                    {"status": "failed", "chunks": chunk_count + 1},
                    trace_id=trace_id,
                    tier=err_tier,
                    ts=_ts(),
                )
            except Exception as e:
                audit_service.log(
                    user_id=user.get("user_id", "anonymous"),
                    role=user.get("role", "guest"),
                    action="ask",
                    resource_id=None,
                    payload={"question": q_text},
                    question=q_text,
                    sql="",
                    status="failed",
                    outcome="failed",
                    error_message=str(e),
                )
                err_tier = ConfidenceTier.TIER_0_FORTRESS
                yield _chunk(
                    "error",
                    {"message": str(e), "error_code": "internal_error"},
                    trace_id=trace_id,
                    tier=err_tier,
                    ts=_ts(),
                )
                yield _chunk(
                    "end",
                    {"status": "failed", "chunks": chunk_count + 1},
                    trace_id=trace_id,
                    tier=err_tier,
                    ts=_ts(),
                )

    return StreamingResponse(ndjson_stream(), media_type="application/x-ndjson")
