from __future__ import annotations

from typing import Dict, List

from app.services.base import AdvisorService


class AdvisorModeService(AdvisorService):
    """Advisory-only explanations, fixes, and chart suggestions."""

    def explain_sql(self, sql: str) -> str:
        if not sql:
            return ""
        return f"Advisory explanation: review the SELECT and WHERE clauses for correctness. SQL length={len(sql)}."

    def suggest_fix(self, sql: str, error: str) -> str:
        if not sql and not error:
            return ""
        prefix = "Advisory fix suggestion:"
        if error:
            return f"{prefix} verify joins/filters to address: {error}"
        return f"{prefix} ensure table and column names align with policy scope."

    def suggest_chart(self, columns: List[str]) -> Dict[str, str]:
        if not columns:
            return {}
        x = columns[0]
        y = columns[1] if len(columns) > 1 else columns[0]
        col_lower = [c.lower() for c in columns]
        chart_type = "line" if any("date" in c or "time" in c for c in col_lower) else "bar"
        return {"type": chart_type, "x": x, "y": y}
