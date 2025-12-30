from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, Any

from app.core.config import get_settings
from app.core.db import session_scope
from app.models.internal import AuditLog, SchemaAccessPolicy

logger = logging.getLogger(__name__)


class TrainingReadinessError(RuntimeError):
    """Raised when training pilot readiness checks fail."""

def has_active_schema_policy() -> bool:
    with session_scope() as session:
        active_policy = (
            session.query(SchemaAccessPolicy)
            .filter(SchemaAccessPolicy.status == "active")
            .order_by(SchemaAccessPolicy.created_at.desc())
            .first()
        )
        return bool(active_policy)

def assert_training_readiness() -> None:
    """
    Validate mandatory readiness gates for the governed training pilot.
    Raises TrainingReadinessError on any failure.
    """
    settings = get_settings()

    if settings.ENV == "local" and not settings.TRAINING_READINESS_ENFORCED:
        logger.warning(
            "GOVERNANCE: Local development mode detected. "
            "Strict training readiness enforcement is disabled by configuration."
        )
        return

    reasons = []

    # Audit logging must be enabled
    if not settings.ENABLE_AUDIT_LOGGING:
        reasons.append("ENABLE_AUDIT_LOGGING must be true")

    # Active schema access policy must exist
    if not has_active_schema_policy():
        reasons.append("No active SchemaAccessPolicy found")

    # Blocked SQL attempts in last 7 days must be zero
    with session_scope() as session:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        blocked_count = (
            session.query(AuditLog)
            .filter(
                AuditLog.action == "Blocked_SQL_Attempt",
                AuditLog.timestamp >= seven_days_ago,
            )
            .count()
        )
        if blocked_count > 0:
            reasons.append("Blocked_SQL_Attempt found in last 7 days")

    if reasons:
        raise TrainingReadinessError("; ".join(reasons))
