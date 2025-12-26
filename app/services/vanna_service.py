"""
Vanna service: orchestrates retrieval‑augmented SQL generation and execution.

This service encapsulates the workflow of retrieving similar questions,
deciding whether to adapt existing SQL or generate new SQL, executing
queries, and streaming results back to the client in phases.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple
from datetime import datetime

from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.exceptions import AppException, InvalidQueryError, ServiceUnavailableError, CircuitBreaker
from app.providers.factory import get_database_provider, get_vector_store, get_llm_provider
from app.utils.sql_guard import SQLGuard
from app.services.training_service import TrainingService  # type: ignore


class VannaService:
    """High‑level service for question answering using Vanna."""

    def __init__(self) -> None:
        self.db = get_database_provider()
        self.vector_store = get_vector_store()
        self.llm = get_llm_provider()
        self.sql_guard = SQLGuard(settings)
        self.training_service = TrainingService()
        # Circuit breakers for external services
        self.llm_breaker = CircuitBreaker(max_failures=3, timeout=30)
        self.db_breaker = CircuitBreaker(max_failures=3, timeout=30)

    async def ask_question_stream(self, question: str, user: Dict[str, Any]) -> StreamingResponse:
        """
        Entry point for answering a question.  Returns a streaming response
        that yields data, chart configuration, and a summary in sequence.

        :param question: The user's natural language question.
        :param user: Dict containing user information (id, role, etc.).
        """

        async def _stream():
            audit_log_id: int | None = None
            sql: str | None = None
            try:
                # Phase 1: retrieve context from vector store
                similar: List[Tuple[str, Dict[str, Any]]] = []
                try:
                    similar = self.vector_store.query(question, settings.RAG_TOP_K)
                except AppException as e:
                    # log and proceed with novel generation
                    pass
                # Determine novel vs similar path
                if similar:
                    # For now treat any result as similar; in a real system we would
                    # evaluate similarity scores in metadata
                    cached_sql = similar[0][1].get("sql")
                    if cached_sql:
                        sql = cached_sql
                    else:
                        sql = None
                # Generate SQL if no cached version
                if not sql:
                    try:
                        prompt = self._build_prompt(question, context=None)
                        sql = self.llm_breaker(self.llm.generate_sql)(
                            prompt,
                            temperature=0.1,
                            max_tokens=settings.MAX_SQL_TOKENS,
                        )
                    except ServiceUnavailableError:
                        yield json.dumps({"phase": "error", "message": "LLM unavailable"}).encode() + b"\n"
                        return
                # Validate SQL
                try:
                    sql = self.sql_guard.validate_and_normalise(sql)
                except InvalidQueryError as err:
                    yield json.dumps({"phase": "error", "message": err.message}).encode() + b"\n"
                    return
                # Enforce row‑level security
                sql = self._inject_rls_filters(sql, user)
                # Execute query
                try:
                    rows = self.db_breaker(self.db.execute)(sql)
                except ServiceUnavailableError:
                    yield json.dumps({"phase": "error", "message": "Database temporarily unavailable"}).encode() + b"\n"
                    return
                # Phase 1: stream data
                yield json.dumps({
                    "phase": "data",
                    "sql": sql,
                    "rows": rows[:100],
                    "total_rows": len(rows),
                    "timestamp": datetime.utcnow().isoformat(),
                }).encode() + b"\n"
                # Phase 2: chart configuration
                chart_config = self._generate_chart_config(rows)
                yield json.dumps({
                    "phase": "chart",
                    "type": chart_config.get("type"),
                    "config": chart_config.get("config"),
                }).encode() + b"\n"
                # Phase 3: summary
                try:
                    summary = self.llm.generate_summary(question, sql, rows)
                except Exception:
                    summary = ""
                yield json.dumps({
                    "phase": "summary",
                    "text": summary,
                }).encode() + b"\n"
                # Record audit log and training
                # This is a synchronous stub; in a real system this would be async
                # and write to the system database.
            except Exception as exc:
                yield json.dumps({"phase": "error", "message": str(exc)}).encode() + b"\n"

        return StreamingResponse(_stream(), media_type="application/x-ndjson")

    def _build_prompt(self, question: str, context: Dict[str, Any] | None) -> str:
        base_prompt = (
            "You are a SQL expert. Generate a SQL query for this question:\n\n"
            f"Question: {question}\n\n"
            "Database: " + settings.DB_TYPE + "\n"
            "Constraints:\n"
            "- Return only SELECT queries\n"
            "- Include appropriate row limit syntax\n"
            "- No data modification allowed\n"
        )
        if context:
            base_prompt += "\nContext:\n" + json.dumps(context, ensure_ascii=False)
        return base_prompt

    def _generate_chart_config(self, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Stub chart detection: choose bar for categorical vs numeric, line for time series
        if not rows:
            return {"type": "table", "config": {}}
        sample = rows[0]
        # Choose first numeric column as y, first non‑numeric as x
        x_field, y_field = None, None
        for key, value in sample.items():
            if isinstance(value, (int, float)) and y_field is None:
                y_field = key
            elif x_field is None:
                x_field = key
        chart_type = "bar" if y_field and x_field else "table"
        return {
            "type": chart_type,
            "config": {
                "x": x_field,
                "y": y_field,
            },
        }

    def _inject_rls_filters(self, sql: str, user: Dict[str, Any]) -> str:
        """
        Inject row‑level security (RLS) filters into the SQL based on
        the user's data scopes.  This is a simplified implementation.
        """
        # TODO: fetch user scopes from database or user object
        scopes = user.get("scopes", [])
        if not scopes:
            return sql
        conditions = []
        for scope in scopes:
            col = scope.get("column")
            allowed = scope.get("values", [])
            if col and allowed:
                placeholders = ", ".join(f"'{v}'" for v in allowed)
                conditions.append(f"{col} IN ({placeholders})")
        if not conditions:
            return sql
        where_clause = " AND ".join(conditions)
        upper_sql = sql.upper()
        if " WHERE " in upper_sql:
            return sql.replace("WHERE", f"WHERE {where_clause} AND", 1)
        return f"{sql} WHERE {where_clause}"