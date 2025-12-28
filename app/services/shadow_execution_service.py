from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List
from datetime import datetime
import uuid

from app.utils.sql_guard import SQLGuard
from app.core.config import get_settings
from app.core.exceptions import InvalidQueryError
from app.models.enums.confidence_tier import ConfidenceTier


@dataclass
class SandboxResult:
    status: str
    rows: List[Dict[str, Any]]
    row_count: int
    reason: str | None = None
    confidence_tier: ConfidenceTier = ConfidenceTier.TIER_1_LAB
    trace_id: str = ""
    timestamp: str = ""
    sandbox_data_origin: str = "schema_only"
    is_production: bool = False


class _NoOpSandboxDriver:
    """Isolated, non-persistent sandbox driver."""

    def execute(self, sql: str, max_rows: int) -> List[Dict[str, Any]]:
        # By design, sandbox returns empty set; execution is advisory only.
        return []


class ShadowExecutionService:
    """Executes exploratory SQL in a fully isolated, advisory-only sandbox."""

    MAX_ROWS = 50
    MAX_COLUMNS = 50
    MAX_PAYLOAD_BYTES = 64_000

    def __init__(self) -> None:
        self.settings = get_settings()
        self.guard = SQLGuard(settings=self.settings, allow_ddl=False, allow_dml=False)
        self.driver = _NoOpSandboxDriver()

    def run(self, exploratory_sql: str) -> SandboxResult:
        trace_id = uuid.uuid4().hex
        now = datetime.utcnow().isoformat() + "Z"
        origin = self.settings.SANDBOX_DATA_STRATEGY
        sensitive = {c.upper() for c in (self.settings.SANDBOX_SENSITIVE_COLUMNS or [])}

        # Validate read-only SQL (blocks DDL/DML unconditionally)
        try:
            sql = self.guard.validate_and_normalise(exploratory_sql, policy=None)
        except InvalidQueryError as exc:
            return SandboxResult(
                status="blocked",
                rows=[],
                row_count=0,
                reason=str(exc),
                trace_id=trace_id,
                timestamp=now,
                sandbox_data_origin=origin,
            )

        rows = self._generate_rows(origin, sql)
        rows = rows[: self.MAX_ROWS]
        trimmed_rows = [self._trim_columns(r, sensitive) for r in rows]

        if self._payload_too_large(trimmed_rows):
            return SandboxResult(
                status="blocked",
                rows=[],
                row_count=0,
                reason="Payload exceeds sandbox limits",
                trace_id=trace_id,
                timestamp=now,
                sandbox_data_origin=origin,
            )

        return SandboxResult(
            status="executed",
            rows=trimmed_rows,
            row_count=len(trimmed_rows),
            trace_id=trace_id,
            timestamp=now,
            sandbox_data_origin=origin,
        )

    def _generate_rows(self, origin: str, sql: str) -> List[Dict[str, Any]]:
        if origin == "schema_only":
            return []
        if origin == "masked_snapshot":
            # synthetic masked placeholder rows
            return [{"COL1": "[masked]", "COL2": 0}]
        if origin == "synthetic_data":
            return [{"COL1": "sample", "COL2": 123, "COL3": "1970-01-01"}]
        return []

    def _trim_columns(self, row: Dict[str, Any], sensitive: set[str]) -> Dict[str, Any]:
        if not isinstance(row, dict):
            return {}
        cols = list(row.items())[: self.MAX_COLUMNS]
        masked = {}
        for k, v in cols:
            if k.upper() in sensitive:
                masked[k] = None
            else:
                masked[k] = self._mask_value(v)
        return masked

    def _mask_value(self, value: Any) -> Any:
        if isinstance(value, (bytes, bytearray)):
            return "[binary masked]"
        if isinstance(value, str):
            return "[masked]"
        if isinstance(value, (int, float)):
            return 0
        return value

    def _payload_too_large(self, rows: List[Dict[str, Any]]) -> bool:
        size = len(str(rows).encode("utf-8"))
        return size > self.MAX_PAYLOAD_BYTES
