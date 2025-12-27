"""
Audit service to record immutable audit logs.
"""

from __future__ import annotations

import json
from typing import Any, Optional
from datetime import datetime

from app.core.db import session_scope
from app.models.internal import AuditLog


class AuditService:
    def log(
        self,
        *,
        user_id: str,
        role: str,
        action: str,
        resource_id: Optional[str] = None,
        payload: Optional[dict] = None,
        question: str = "",
        sql: str = "",
        status: str = "success",
        error_message: str | None = None,
        row_count: int | None = None,
        execution_time_ms: int | None = None,
        outcome: str = "success",
    ) -> AuditLog:
        record = AuditLog(
            user_id=user_id or "anonymous",
            role=role or "guest",
            action=action,
            resource_id=resource_id,
            payload=json.dumps(payload or {}),
            question=question or "",
            sql=sql or "",
            status=status,
            error_message=error_message,
            execution_time_ms=execution_time_ms,
            row_count=row_count,
            timestamp=datetime.utcnow(),
            outcome=outcome,
        )
        with session_scope() as session:
            session.add(record)
            session.flush()
            session.refresh(record)
            return record
