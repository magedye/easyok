"""Orchestration service (current ask stream contract).

This service coordinates between request/user context and the underlying
`VannaService` to produce:

* the `technical_view` payload (sql, assumptions, is_safe)
* a normalised list of rows for the `data` chunk

It must remain stateless.
"""

from __future__ import annotations

from typing import Any, Dict, List
from datetime import date, datetime
from decimal import Decimal

from app.api.dependencies import UserContext
from app.services.vanna_service import VannaService
from app.utils.sql_guard import SQLGuard
from app.core.exceptions import InvalidQueryError
from app.services.schema_policy_service import SchemaPolicyService
from app.services.audit_service import AuditService
from app.services.semantic_cache_service import SemanticCacheService
from app.services.arabic_query_engine import ArabicQueryEngine
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode


class OrchestrationService:
    def __init__(self) -> None:
        self.vanna_service = VannaService()
        self.sql_guard = SQLGuard(self.vanna_service.settings)
        self.policy_service = SchemaPolicyService()
        self.audit_service = AuditService()
        self.cache_service = SemanticCacheService(self.sql_guard)
        self.tracer = trace.get_tracer(__name__)
        self.arabic_engine = ArabicQueryEngine()

    async def prepare(
        self,
        *,
        question: str,
        user_context: UserContext,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """Prepare the technical view payload and final SQL to execute."""

        # NOTE: top_k is accepted for contract stability; currently unused.
        _ = top_k

        assumptions: List[str] = []

        # Basic malicious intent check on user question
        lowered_q = question.lower()
        forbidden_tokens = (" drop ", " delete ", " truncate ", " alter ", " update ", " insert ")
        if any(tok.strip() in lowered_q for tok in forbidden_tokens):
            raise InvalidQueryError("Blocked due to unsafe intent")

        original_question = question
        # Arabic preprocessing (mandatory for Arabic input)
        if self.arabic_engine._is_arabic(question):
            processed = self.arabic_engine.process(question)
            question = processed["final_query"]

        # Enforce active policy
        policy = self.policy_service.get_active()
        if not policy:
            raise InvalidQueryError("SECURITY_VIOLATION: لا توجد سياسة وصول مفعّلة.")

        cache_hit = False
        similarity = 0.0
        governance_status = "miss"
        sql = None

        if self.vanna_service.settings.ENABLE_SEMANTIC_CACHE:
            hit, cached_sql, similarity, governance_status = self.cache_service.lookup(
                question=question,
                policy=policy,
                llm_provider=self.vanna_service.settings.LLM_PROVIDER,
                llm_model=getattr(self.vanna_service.settings, "OPENAI_MODEL", ""),
                rbac_scope=user_context.get("role", "guest"),
            )
            cache_hit = hit
            if hit and cached_sql:
                sql = cached_sql

        if not sql:
            with self.tracer.start_as_current_span(
                "sql.generate",
                attributes={
                    "llm.provider": getattr(self.vanna_service.settings, "LLM_PROVIDER", ""),
                    "llm.model": getattr(self.vanna_service.settings, "OPENAI_MODEL", ""),
                    "llm.temperature": 0.1,
                },
            ):
                sql = await self.vanna_service.generate_sql(question)
            if self.vanna_service.settings.RLS_ENABLED:
                sql = self.vanna_service.inject_rls_filters(
                    sql,
                    user_context.get("data_scope", {}),
                )

        tables = self._referenced_tables(sql)
        assumptions.extend(self._assumptions_from_metadata(tables))
        if not assumptions:
            assumptions.append("تم بناء الافتراضات استناداً إلى تعريفات DDL (الأعمدة والأنواع والقيود) دون أسماء محددة.")

        if tables and not self._tables_in_policy(tables, policy):
            self.audit_service.log(
                user_id=user_context.get("user_id", "anonymous"),
                role=user_context.get("role", "guest"),
                action="Blocked_SQL_Attempt",
                resource_id=None,
                payload={"question": question, "reason": "table_scope_violation"},
                status="failed",
                outcome="failed",
                error_message="SECURITY_VIOLATION: خارج نطاق السياسة",
            )
            raise InvalidQueryError("SECURITY_VIOLATION: الجداول خارج نطاق السياسة المفعّلة.")
        if tables and not self._columns_in_policy(sql, tables, policy):
            self.audit_service.log(
                user_id=user_context.get("user_id", "anonymous"),
                role=user_context.get("role", "guest"),
                action="Blocked_SQL_Attempt",
                resource_id=None,
                payload={"question": question, "reason": "column_scope_violation"},
                status="failed",
                outcome="failed",
                error_message="SECURITY_VIOLATION: أعمدة خارج نطاق السياسة",
            )
            raise InvalidQueryError("SECURITY_VIOLATION: الأعمدة خارج نطاق السياسة المفعّلة.")

        is_safe = True
        with self.tracer.start_as_current_span(
            "sql.validate",
            attributes={
                "sql.dialect": "oracle",
                "schema.version": policy.schema_name,
                "policy.version": policy.version,
            },
        ) as span:
            try:
                sql = self.sql_guard.validate_and_normalise(sql, policy=policy)
                span.set_attribute("sql.allowed", True)
            except Exception as exc:
                span.set_attribute("sql.allowed", False)
                span.set_attribute("sql.violation.reason", str(exc))
                span.set_status(Status(StatusCode.ERROR, "SQLGuard violation"))
                is_safe = False
                sql = ""

        if not is_safe or not sql:
            raise InvalidQueryError("Blocked or invalid SQL")

        if self.vanna_service.settings.ENABLE_SEMANTIC_CACHE and not cache_hit:
            self.cache_service.store(
                question=question,
                validated_sql=sql,
                policy=policy,
                llm_provider=self.vanna_service.settings.LLM_PROVIDER,
                llm_model=getattr(self.vanna_service.settings, "OPENAI_MODEL", ""),
                rbac_scope=user_context.get("role", "guest"),
                technical_view={"assumptions": assumptions},
            )

        return {
            "sql": sql,
            "assumptions": assumptions,
            "is_safe": is_safe,
            "cache_hit": cache_hit,
            "similarity_score": similarity,
            "governance_status": governance_status,
            "policy_version": policy.version,
            "schema_version": policy.schema_name,
            "original_question": original_question,
            "processed_question": question,
        }

    async def execute_sql(self, sql: str) -> Any:
        """Execute SQL via the underlying query engine and gracefully handle DB errors."""
        res = await self.vanna_service.execute(sql)
        # If DB provider returned an error marker, propagate as-is
        if isinstance(res, dict) and res.get("error"):
            return res
        # otherwise, assume rows list
        return res

    def normalise_rows(self, raw_result: Any) -> List[Dict[str, Any]]:
        """Return `data.payload` as a list of row objects (contract requirement).

        Supports error propagation when `raw_result` contains an `error` key.
        """
        if isinstance(raw_result, dict) and raw_result.get("error"):
            # On DB error, return empty data set (data chunk will be empty) and let summary contain the error
            return []

        if isinstance(raw_result, dict) and isinstance(raw_result.get("rows"), list):
            rows = raw_result["rows"]
            return self._serialise_rows(rows)

        if isinstance(raw_result, list):
            return self._serialise_rows(raw_result)

        if raw_result is None:
            return []

        if isinstance(raw_result, dict):
            return [raw_result]

        return [{"value": raw_result}]

    def _serialise_rows(self, rows: List[Any]) -> List[Dict[str, Any]]:
        """Ensure rows are JSON-serialisable (datetime/Decimal -> strings/floats)."""
        serialised: List[Dict[str, Any]] = []
        for r in rows:
            if isinstance(r, dict):
                serialised.append({k: self._serialise_value(v) for k, v in r.items()})
            else:
                serialised.append({"value": self._serialise_value(r)})
        return serialised

    def _serialise_value(self, v: Any) -> Any:
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        if isinstance(v, Decimal):
            return float(v)
        return v

    def chart_recommendation(self, rows: List[Dict[str, Any]]) -> Dict[str, str]:
        """Return `chart.payload` with keys: chart_type, x, y."""
        x = ""
        y = ""
        if rows and isinstance(rows[0], dict):
            keys = list(rows[0].keys())
            if len(keys) >= 2:
                x, y = keys[0], keys[1]
            elif len(keys) == 1:
                x, y = keys[0], keys[0]

        if not x:
            x = "value"
        if not y:
            y = "value"

        return {"chart_type": "bar", "x": x, "y": y}

    def summary_text(self, raw_result: Any) -> str:
        """Return `summary.payload` as plain text summarising the query result.

        If a DB error is present in `raw_result`, return it so the UI receives a helpful
        message instead of the generic 'ok'.
        """
        if isinstance(raw_result, dict) and raw_result.get("error"):
            msg = str(raw_result.get("error"))
            return f"فشل الاستعلام: {msg}. تحقق من الأعمدة والأنواع المعرّفة في الـ DDL وقم بتبسيط السؤال."

        # If upstream produced a prepared 'summary', prefer it
        if isinstance(raw_result, dict) and isinstance(raw_result.get("summary"), str):
            return raw_result["summary"]

        # If rows present, summarise count
        rows = None
        if isinstance(raw_result, dict) and isinstance(raw_result.get("rows"), list):
            rows = raw_result.get("rows")
        elif isinstance(raw_result, list):
            rows = raw_result

        if rows is not None:
            count = len(rows)
            if count == 0:
                return "لا توجد بيانات مطابقة. جرّب تضييق التاريخ أو تحديد أعمدة زمنية/عددية كما هو مذكور في الـ DDL."
            if count == 1:
                return "تم إرجاع صف واحد."
            return f"تم إرجاع {count} صفوف."

        # Fallback
        return "تمت المعالجة بنجاح"

    def _referenced_tables(self, sql: str) -> List[tuple]:
        """Return list of (owner, table) tuples referenced in FROM/JOIN clauses.

        This is a heuristic; it should catch simple FROM/JOIN usages such as:
          FROM schema.table
          FROM table
          JOIN other_table
        Quoted identifiers are supported roughly.
        """
        import re
        if not sql:
            return []
        matches = re.findall(r"(?:FROM|JOIN)\s+([\"A-Za-z0-9_\.]+)", sql, re.I)
        out = []
        for m in matches:
            identifier = m.strip().strip('"')
            if "." in identifier:
                owner, tbl = identifier.split(".", 1)
                out.append((owner.upper(), tbl.upper()))
            else:
                out.append(("", identifier.upper()))
        return out

    def _assumptions_from_metadata(self, tables: List[tuple]) -> List[str]:
        """Derive assumptions from DDL metadata without hardcoding schema specifics."""
        assumptions: List[str] = []
        if not tables:
            assumptions.append("تم الاعتماد على تعريفات DDL (الأعمدة والأنواع والقيود) دون تحديد جداول صريحة.")
            return assumptions

        for owner, tbl in tables:
            try:
                owner_clause = f" AND OWNER = '{owner}'" if owner else ""
                sql = (
                    "SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS "
                    f"WHERE TABLE_NAME = '{tbl}'{owner_clause}"
                )
                cols = self.vanna_service.db.execute(sql)
                if not cols:
                    assumptions.append("الاعتماد على DDL فقط؛ الجدول المشار إليه غير متاح في التعريفات الحالية.")
                    continue

                col_types = {c.get("COLUMN_NAME"): (c.get("DATA_TYPE") or "").upper() for c in cols}
                temporal = [c for c, t in col_types.items() if "DATE" in t or "TIME" in t]
                numeric = [c for c, t in col_types.items() if any(k in t for k in ["NUMBER", "DEC", "INT", "FLOAT"])]

                assumptions.append(
                    "تم الاستناد إلى أعمدة DDL المتاحة (أنواع/قيود)؛ أعمدة زمنية محتملة: "
                    f"{', '.join(temporal) if temporal else 'غير محددة'}؛ "
                    f"أعمدة رقمية للتجميع: {', '.join(numeric) if numeric else 'غير محددة'}."
                )
            except Exception:
                assumptions.append("تعذر قراءة تعريفات DDL؛ قد تكون الافتراضات أقل دقة.")

        assumptions.append("Analysis is strictly restricted to the tables and columns defined in the active Schema Access Policy.")

        return assumptions

    def _tables_in_policy(self, tables: List[tuple], policy) -> bool:
        allowed_tables = policy.allowed_tables or []
        denied_tables = policy.denied_tables or []
        excluded_tables = policy.excluded_tables or []
        # If no allowed tables defined, treat as all allowed except explicit denied.
        for _, tbl in tables:
            if denied_tables and tbl in denied_tables:
                return False
            if excluded_tables and tbl in excluded_tables:
                return False
            if allowed_tables and tbl not in allowed_tables:
                return False
        return True

    def _columns_in_policy(self, sql: str, tables: List[tuple], policy) -> bool:
        """Check column references against policy.allowed_columns."""
        allowed_columns = policy.allowed_columns or {}
        excluded_columns = policy.excluded_columns or {}
        import re

        # Collect explicit table.column references
        tokens = re.findall(r"([A-Z0-9_]+)\.([A-Z0-9_]+)", sql.upper())
        for tbl_owner, col in tokens:
            tbl = tbl_owner.split(".")[-1]
            allowed_for_table = allowed_columns.get(tbl) or allowed_columns.get(tbl_owner) or []
            excluded_for_table = excluded_columns.get(tbl) or excluded_columns.get(tbl_owner) or []
            if excluded_for_table and col in [c.upper() for c in excluded_for_table]:
                return False
            if allowed_for_table and col not in [c.upper() for c in allowed_for_table]:
                return False
        return True
