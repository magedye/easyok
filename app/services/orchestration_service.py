"""Orchestration service (current ask stream contract).

This service coordinates between request/user context and the underlying
`VannaService` to produce:

* the `technical_view` payload (sql, assumptions, is_safe)
* a normalised list of rows for the `data` chunk

It must remain stateless.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.api.dependencies import UserContext
from app.services.vanna_service import VannaService


class OrchestrationService:
    def __init__(self) -> None:
        self.vanna_service = VannaService()

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

        sql = await self.vanna_service.generate_sql(question)
        if self.vanna_service.settings.RLS_ENABLED:
            sql = self.vanna_service.inject_rls_filters(
                sql,
                user_context.get("data_scope", {}),
            )

        is_safe = self._is_safe_sql(sql)
        return {"sql": sql, "assumptions": assumptions, "is_safe": is_safe}

    async def execute_sql(self, sql: str) -> Any:
        """Execute SQL via the underlying query engine."""
        return await self.vanna_service.execute(sql)

    def normalise_rows(self, raw_result: Any) -> List[Dict[str, Any]]:
        """Return `data.payload` as a list of row objects (contract requirement)."""
        if isinstance(raw_result, dict) and isinstance(raw_result.get("rows"), list):
            rows = raw_result["rows"]
            return rows if all(isinstance(r, dict) for r in rows) else [
                {"value": r} for r in rows
            ]

        if isinstance(raw_result, list):
            return raw_result if all(isinstance(r, dict) for r in raw_result) else [
                {"value": r} for r in raw_result
            ]

        if raw_result is None:
            return []

        if isinstance(raw_result, dict):
            return [raw_result]

        return [{"value": raw_result}]

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
        """Return `summary.payload` as plain text."""
        if isinstance(raw_result, dict) and isinstance(raw_result.get("summary"), str):
            return raw_result["summary"]
        return "ok"

    def _is_safe_sql(self, sql: str) -> bool:
        """Minimal SELECT-only guard used for current contract's `is_safe`."""
        sql_upper = (sql or "").strip().upper()
        if not sql_upper.startswith("SELECT"):
            return False
        if ";" in sql_upper:
            return False

        disallowed = ("INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER")
        return not any(keyword in sql_upper for keyword in disallowed)
