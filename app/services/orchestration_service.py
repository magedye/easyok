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
from app.utils.sql_guard import SQLGuard


class OrchestrationService:
    def __init__(self) -> None:
        self.vanna_service = VannaService()
        self.sql_guard = SQLGuard(self.vanna_service.settings)

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

        tables = self._referenced_tables(sql)
        if tables:
            assumptions.extend([f"Assuming table {owner + '.' if owner else ''}{tbl} exists" for owner, tbl in tables])
        if not assumptions:
            assumptions.append("Assuming schema is trained and referenced columns exist.")

        is_safe = True
        try:
            sql = self.sql_guard.validate_and_normalise(sql)
        except Exception:
            is_safe = False

        return {"sql": sql, "assumptions": assumptions, "is_safe": is_safe}

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
        """Return `summary.payload` as plain text summarising the query result.

        If a DB error is present in `raw_result`, return it so the UI receives a helpful
        message instead of the generic 'ok'.
        """
        if isinstance(raw_result, dict) and raw_result.get("error"):
            return str(raw_result.get("error"))

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
                return "لا توجد بيانات"
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
