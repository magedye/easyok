import json
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import require_permission, UserContext
from app.core.config import get_settings
from app.services.vanna_service import VannaService
from app.utils.sql_guard import SQLGuard
from app.services.audit_service import AuditService
from app.core.exceptions import InvalidQueryError
from app.services.schema_policy_service import SchemaPolicyService

router = APIRouter(tags=["chat"])
settings = get_settings()
vanna = VannaService()
sql_guard = SQLGuard(settings)
audit_service = AuditService()
policy_service = SchemaPolicyService()


def _mask_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Apply basic PII masking to emails/phones/ssn/ip."""
    import re

    email_re = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
    phone_re = re.compile(r"\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b")
    ssn_re = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
    ip_re = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")

    def mask_value(val: Any) -> Any:
        if not isinstance(val, str):
            return val
        if email_re.search(val):
            parts = val.split("@")
            return f"{parts[0][:1]}***@{parts[1]}"
        if phone_re.search(val):
            digits = "".join([c for c in val if c.isdigit()])
            return f"***-***-{digits[-4:]}" if len(digits) >= 4 else "***"
        if ssn_re.search(val):
            return "***-**-****"
        if ip_re.search(val):
            segs = val.split(".")
            if len(segs) == 4:
                return f"{segs[0]}.{segs[1]}.***.*"
        return val

    masked = []
    for row in rows:
        masked_row = {}
        for k, v in row.items():
            if isinstance(v, dict):
                masked_row[k] = {ik: mask_value(iv) for ik, iv in v.items()}
            elif isinstance(v, list):
                masked_row[k] = [mask_value(iv) for iv in v]
            else:
                masked_row[k] = mask_value(v)
        masked.append(masked_row)
    return masked


def _chart_payload(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    x = ""
    y = ""
    if rows and isinstance(rows[0], dict):
        keys = list(rows[0].keys())
        if len(keys) >= 2:
            x, y = keys[0], keys[1]
        elif len(keys) == 1:
            x = y = keys[0]
    if not x:
        x = "value"
    if not y:
        y = "value"
    chart_type = "bar"
    # simple heuristic
    if rows and isinstance(rows[0], dict):
        first_val = list(rows[0].values())[0]
        if isinstance(first_val, (int, float)):
            chart_type = "line"
    return {"type": chart_type, "config": {"x": x, "y": y}}


def _summary_ar(rows: List[Dict[str, Any]]) -> str:
    count = len(rows)
    if count == 0:
        return "لا توجد بيانات"
    if count == 1:
        return "تم إرجاع صف واحد."
    return f"تم إرجاع {count} صفوف."


@router.get("/chat/stream")
async def chat_stream(
    question: str = Query(..., description="Natural language question"),
    top_k: int = Query(5, description="RAG top-k"),
    user: UserContext = Depends(require_permission("query:execute")),
):
    if settings.STREAM_PROTOCOL != "sse":
        raise HTTPException(status_code=404, detail="SSE stream disabled")

    async def event_stream():
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="chat_stream",
            resource_id=None,
            payload={"question": question},
            question=question,
            sql="",
            status="started",
            outcome="started",
        )
        # auth event
        yield f"event: auth\ndata: {json.dumps({'status': 'authenticated' if user.get('is_authenticated') else 'guest'})}\n\n"
        # thinking event
        yield f"event: thinking\ndata: {json.dumps({'stage': 'retrieval', 'message': 'retrieving context'})}\n\n"

        # context retrieval
        context_sources: list[dict] = []
        if getattr(vanna, "vector", None):
            try:
                results = vanna.vector.query(question, n_results=top_k)
                for doc, meta in results or []:
                    context_sources.append(
                        {
                            "type": (meta or {}).get("type") or "sql_pair",
                            "relevance": (meta or {}).get("score") or 0,
                            "snippet": (doc or "")[:200],
                        }
                    )
            except Exception:
                context_sources = []
        yield f"event: context\ndata: {json.dumps({'sources': context_sources})}\n\n"

        # technical_view
        sql = await vanna.generate_sql(question)
        if settings.RLS_ENABLED:
            sql = vanna.inject_rls_filters(sql, user.get("data_scope", {}))
        assumptions: List[str] = []
        tables = []
        try:
            tables = vanna.referenced_tables(sql)
        except Exception:
            tables = []
        if tables:
            assumptions.extend([f"يفترض وجود الجدول {t[0] + '.' if t[0] else ''}{t[1]}" for t in tables])
        if not assumptions:
            assumptions.append("تم توليد الاستعلام بناءً على المخطط المدرّب الحالي فقط.")

        is_safe = True
        error_msg = ""
        try:
            policy = policy_service.get_active()
            if not policy:
                raise InvalidQueryError("SECURITY_VIOLATION: no active schema policy")
            sql = sql_guard.validate_and_normalise(sql, policy=policy)
        except Exception as exc:
            is_safe = False
            error_msg = str(exc)

        technical_view = {
            "sql": sql,
            "assumptions": assumptions,
            "is_safe": is_safe,
            "dialect": settings.DB_TYPE,
            "datasource_type": settings.DB_TYPE,
        }
        yield f"event: technical_view\ndata: {json.dumps(technical_view)}\n\n"

        if not is_safe or not assumptions:
            error_payload = {
                "code": "POLICY_VIOLATION",
                "message": error_msg or "SQL rejected or assumptions missing",
            }
            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            audit_service.log(
                user_id=user.get("user_id", "anonymous"),
                role=user.get("role", "guest"),
                action="chat_stream",
                resource_id=None,
                payload={"question": question},
                question=question,
                sql=sql,
                status="blocked",
                outcome="failed",
                error_message=error_payload["message"],
            )
            yield "event: done\ndata: {\"status\":\"completed\"}\n\n"
            return

        try:
            raw_result = await vanna.execute(sql)
            if isinstance(raw_result, dict) and raw_result.get("error"):
                raise RuntimeError(raw_result.get("error"))
            rows = raw_result if isinstance(raw_result, list) else []
        except Exception as exc:
            error_payload = {"code": "service_unavailable", "message": str(exc)}
            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            audit_service.log(
                user_id=user.get("user_id", "anonymous"),
                role=user.get("role", "guest"),
                action="chat_stream",
                resource_id=None,
                payload={"question": question},
                question=question,
                sql=sql,
                status="failed",
                outcome="failed",
                error_message=str(exc),
            )
            yield "event: done\ndata: {\"status\":\"completed\"}\n\n"
            return

        masked_rows = _mask_rows(rows)
        yield f"event: data\ndata: {json.dumps({'rows': masked_rows, 'row_count': len(masked_rows)})}\n\n"

        chart_payload = _chart_payload(masked_rows)
        yield f"event: chart\ndata: {json.dumps(chart_payload)}\n\n"

        summary_text = _summary_ar(masked_rows)
        yield f"event: summary\ndata: {json.dumps({'text': summary_text, 'language': 'ar'})}\n\n"

        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="chat_stream",
            resource_id=None,
            payload={"question": question},
            question=question,
            sql=sql,
            status="completed",
            outcome="success",
        )
        yield "event: done\ndata: {\"status\":\"completed\"}\n\n"

    try:
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except InvalidQueryError:
        error_payload = {"code": "invalid_query", "message": "تم حظر الاستعلام لاعتبارات أمان"}
        async def blocked_stream():
            yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"
            yield "event: done\ndata: {\"status\":\"completed\"}\n\n"
        return StreamingResponse(blocked_stream(), media_type="text/event-stream")
