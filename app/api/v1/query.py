import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import optional_auth, UserContext, require_permission
from app.core.config import get_settings
from app.models.request import QueryRequest
from app.services.orchestration_service import OrchestrationService
from app.services.audit_service import AuditService
from app.core.exceptions import InvalidQueryError
from app.services.schema_policy_service import SchemaPolicyService
from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode
import hashlib

router = APIRouter(tags=["query"])
orchestration_service = OrchestrationService()
settings = get_settings()
audit_service = AuditService()
policy_service = SchemaPolicyService()
tracer = trace.get_tracer(__name__)


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

                policy = policy_service.get_active()
                policy_version = policy.version if policy else None
                schema_version = policy.schema_name if policy else None

                with tracer.start_as_current_span(
                    "sql.generate",
                    attributes={
                        "llm.provider": getattr(settings, "LLM_PROVIDER", ""),
                        "llm.model": getattr(settings, "OPENAI_MODEL", ""),
                        "llm.temperature": 0.1,
                        "question": q_text,
                        "schema.version": schema_version,
                        "policy.version": policy_version,
                    },
                ):
                    technical_view = await orchestration_service.prepare(
                        question=q_text,
                        top_k=tk,
                        user_context=user,
                    )

                sql_text = technical_view.get("sql", "")
                sql_hash = hashlib.sha256(sql_text.encode("utf-8")).hexdigest() if sql_text else ""

                with tracer.start_as_current_span(
                    "sql.validate",
                    attributes={
                        "question": q_text,
                        "schema.version": schema_version,
                        "policy.version": policy_version,
                        "sql.hash": sql_hash,
                        "sql.dialect": "oracle",
                    },
                ):
                    pass

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

                yield json.dumps({"type": "technical_view", "payload": technical_view}) + "\n"
                chunk_count += 1

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
                            "schema.version": schema_version,
                            "policy.version": policy_version,
                            "sql.hash": sql_hash,
                        },
                    ):
                        pass

                    with tracer.start_as_current_span(
                        "stream.data",
                        attributes={
                            "question": q_text,
                            "schema.version": schema_version,
                            "policy.version": policy_version,
                        },
                    ):
                        yield json.dumps({"type": "data", "payload": data_payload}) + "\n"
                        chunk_count += 1

                    chart_payload = orchestration_service.chart_recommendation(data_payload)
                    yield json.dumps({"type": "chart", "payload": chart_payload}) + "\n"
                    chunk_count += 1

                    summary_payload = orchestration_service.summary_text(raw_result)
                    yield json.dumps({"type": "summary", "payload": summary_payload}) + "\n"
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
                yield json.dumps(
                    {
                        "type": "error",
                        "payload": {
                            "message": "تم حظر الاستعلام لاعتبارات أمان",
                            "error_code": "SECURITY_VIOLATION",
                        },
                    }
                ) + "\n"
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
