"""
Orchestration service (NDJSON streaming – Phase 4 contract).

This service coordinates between request/user context and the underlying
VannaService to produce:

- technical_view payload (sql, assumptions, is_safe)
- normalised data rows for the data chunk
- business_view payload (human-readable summary)

This service is stateless and streaming-safe.
"""

from __future__ import annotations

from typing import Any, Dict, List
from datetime import date, datetime
from decimal import Decimal

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.api.dependencies import UserContext
from app.services.vanna_service import VannaService
from app.services.schema_policy_service import SchemaPolicyService
from app.services.audit_service import AuditService
from app.services.semantic_cache_service import SemanticCacheService
from app.services.arabic_query_engine import ArabicQueryEngine
from app.utils.sql_guard import SQLGuard
from app.core.exceptions import InvalidQueryError
from app.models.enums.confidence_tier import ConfidenceTier


class OrchestrationService:
    def __init__(self) -> None:
        self.vanna_service = VannaService()
        self.sql_guard = SQLGuard(self.vanna_service.settings)
        self.policy_service = SchemaPolicyService()
        self.audit_service = AuditService()
        self.cache_service = SemanticCacheService(self.sql_guard)
        self.arabic_engine = ArabicQueryEngine()
        self.tracer = trace.get_tracer(__name__)

    # ------------------------------------------------------------------ #
    # Preparation Phase
    # ------------------------------------------------------------------ #

    async def prepare(
        self,
        *,
        question: str,
        user_context: UserContext,
        top_k: int = 5,
    ) -> Dict[str, Any]:
        """
        Prepare the technical_view payload and validated SQL.

        MUST NOT raise uncontrolled exceptions during streaming.
        """

        _ = top_k  # accepted for contract stability

        confidence_tier = ConfidenceTier.TIER_0_FORTRESS
        assumptions: List[str] = []

        # Basic intent screening
        lowered = question.lower()
        forbidden = (" drop ", " delete ", " truncate ", " alter ", " update ", " insert ")
        if any(tok in lowered for tok in forbidden):
            return self._blocked("unsafe_intent", confidence_tier)

        if confidence_tier != ConfidenceTier.TIER_0_FORTRESS:
            return self._blocked("unsupported_confidence_tier", confidence_tier)

        original_question = question

        # Arabic preprocessing (mandatory)
        if self.arabic_engine._is_arabic(question):
            processed = self.arabic_engine.process(question)
            question = processed["final_query"]

        # Enforce active policy
        policy = self.policy_service.get_active()
        if not policy:
            return self._blocked("no_active_policy", confidence_tier)

        sql = None
        cache_hit = False
        similarity = 0.0
        governance_status = "miss"

        if self.vanna_service.settings.ENABLE_SEMANTIC_CACHE:
            hit, cached_sql, similarity, governance_status = self.cache_service.lookup(
                question=question,
                policy=policy,
                llm_provider=self.vanna_service.settings.LLM_PROVIDER,
                llm_model=getattr(self.vanna_service.settings, "OPENAI_MODEL", ""),
                rbac_scope=user_context.get("role", "guest"),
            )
            if hit and cached_sql:
                sql = cached_sql
                cache_hit = True

        if not sql:
            with self.tracer.start_as_current_span("sql.generate"):
                sql = await self.vanna_service.generate_sql(question)

            if self.vanna_service.settings.RLS_ENABLED:
                sql = self.vanna_service.inject_rls_filters(
                    sql,
                    user_context.get("data_scope", {}),
                )

        tables = self._referenced_tables(sql)
        assumptions.extend(self._assumptions_from_metadata(tables))

        if not assumptions:
            assumptions.append(
                "Assumptions derived strictly from DDL metadata without hardcoded schema specifics."
            )

        if tables and not self._tables_in_policy(tables, policy):
            self._audit_block(user_context, question, "table_scope_violation")
            return self._blocked("table_scope_violation", confidence_tier)

        if tables and not self._columns_in_policy(sql, tables, policy):
            self._audit_block(user_context, question, "column_scope_violation")
            return self._blocked("column_scope_violation", confidence_tier)

        is_safe = True

        with self.tracer.start_as_current_span("sql.validate") as span:
            try:
                sql = self.sql_guard.validate_and_normalise(sql, policy=policy)
                span.set_attribute("sql.allowed", True)
            except Exception as exc:
                span.set_attribute("sql.allowed", False)
                span.set_status(Status(StatusCode.ERROR))
                is_safe = False
                sql = ""

        if not is_safe or not sql:
            return self._blocked("sql_guard_violation", confidence_tier)

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
            "is_safe": True,
            "cache_hit": cache_hit,
            "similarity_score": similarity,
            "governance_status": governance_status,
            "policy_version": policy.version,
            "schema_version": policy.schema_name,
            "original_question": original_question,
            "processed_question": question,
            "confidence_tier": confidence_tier.value,
        }

    # ------------------------------------------------------------------ #
    # Execution Phase
    # ------------------------------------------------------------------ #

    async def execute_sql(self, sql: str) -> Any:
        if not sql:
            return {"error": "execution_payload_missing_sql"}
        return await self.vanna_service.execute(sql)

    def normalise_rows(self, raw_result: Any) -> List[Dict[str, Any]]:
        if isinstance(raw_result, dict) and raw_result.get("error"):
            return []

        if isinstance(raw_result, dict) and isinstance(raw_result.get("rows"), list):
            return self._serialise_rows(raw_result["rows"])

        if isinstance(raw_result, list):
            return self._serialise_rows(raw_result)

        if raw_result is None:
            return []

        if isinstance(raw_result, dict):
            return [raw_result]

        return [{"value": raw_result}]

    # ------------------------------------------------------------------ #
    # Business View
    # ------------------------------------------------------------------ #

    def business_view_payload(self, raw_result: Any) -> Dict[str, Any]:
        if isinstance(raw_result, dict) and raw_result.get("error"):
            return {
                "text": f"Query failed: {raw_result.get('error')}"
            }

        rows = None
        if isinstance(raw_result, dict) and isinstance(raw_result.get("rows"), list):
            rows = raw_result["rows"]
        elif isinstance(raw_result, list):
            rows = raw_result

        if rows is not None:
            count = len(rows)
            if count == 0:
                return {"text": "No matching data found."}
            if count == 1:
                return {"text": "One row was returned."}
            return {"text": f"{count} rows were returned."}

        return {"text": "Query processed successfully."}

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    def _serialise_rows(self, rows: List[Any]) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for r in rows:
            if isinstance(r, dict):
                out.append({k: self._serialise_value(v) for k, v in r.items()})
            else:
                out.append({"value": self._serialise_value(r)})
        return out

    def _serialise_value(self, v: Any) -> Any:
        if isinstance(v, (datetime, date)):
            return v.isoformat()
        if isinstance(v, Decimal):
            return float(v)
        return v

    def _blocked(self, reason: str, tier: ConfidenceTier) -> Dict[str, Any]:
        return {
            "sql": "",
            "assumptions": [],
            "is_safe": False,
            "error": reason,
            "confidence_tier": tier.value,
        }

    def _audit_block(self, user_context: UserContext, question: str, reason: str) -> None:
        self.audit_service.log(
            user_id=user_context.get("user_id", "anonymous"),
            role=user_context.get("role", "guest"),
            action="Blocked_SQL_Attempt",
            resource_id=None,
            payload={"question": question, "reason": reason},
            status="failed",
            outcome="failed",
            error_message=reason,
        )

    def _referenced_tables(self, sql: str) -> List[tuple]:
        import re
        if not sql:
            return []
        matches = re.findall(r"(?:FROM|JOIN)\s+([\"A-Za-z0-9_\.]+)", sql, re.I)
        out = []
        for m in matches:
            ident = m.strip().strip('"')
            if "." in ident:
                owner, tbl = ident.split(".", 1)
                out.append((owner.upper(), tbl.upper()))
            else:
                out.append(("", ident.upper()))
        return out

    def _assumptions_from_metadata(self, tables: List[tuple]) -> List[str]:
        assumptions: List[str] = []
        if not tables:
            return assumptions

        for owner, tbl in tables:
            assumptions.append(
                f"Query constrained to table {tbl} under active schema policy."
            )

        assumptions.append(
            "Analysis strictly limited to tables and columns permitted by the active Schema Access Policy."
        )
        return assumptions

    def _tables_in_policy(self, tables: List[tuple], policy) -> bool:
        for _, tbl in tables:
            if policy.denied_tables and tbl in policy.denied_tables:
                return False
            if policy.excluded_tables and tbl in policy.excluded_tables:
                return False
            if policy.allowed_tables and tbl not in policy.allowed_tables:
                return False
        return True

    def _columns_in_policy(self, sql: str, tables: List[tuple], policy) -> bool:
        import re
        allowed = policy.allowed_columns or {}
        excluded = policy.excluded_columns or {}

        tokens = re.findall(r"([A-Z0-9_]+)\.([A-Z0-9_]+)", sql.upper())
        for tbl_owner, col in tokens:
            tbl = tbl_owner.split(".")[-1]
            if excluded.get(tbl) and col in [c.upper() for c in excluded[tbl]]:
                return False
            if allowed.get(tbl) and col not in [c.upper() for c in allowed[tbl]]:
                return False
        return True
