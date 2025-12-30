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


def assert_training_readiness() -> Dict[str, Any]:
    """
    Validate mandatory readiness gates for the governed training pilot.
    Raises TrainingReadinessError on any failure.
    """
    settings = get_settings()
    reasons = []

    # Audit logging must be enabled
    if not settings.ENABLE_AUDIT_LOGGING:
        reasons.append("ENABLE_AUDIT_LOGGING must be true")

    # Active schema access policy must exist
    with session_scope() as session:
        active_policy = (
            session.query(SchemaAccessPolicy)
            .filter(SchemaAccessPolicy.status == "active")
            .order_by(SchemaAccessPolicy.created_at.desc())
            .first()
        )
        if not active_policy:
            reasons.append("No active SchemaAccessPolicy found")

        # Blocked SQL attempts in last 7 days must be zero
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
        if reasons == ["No active SchemaAccessPolicy found"]:
            env = getattr(settings, "ENV", getattr(settings, "APP_ENV", ""))
            allow_local_bypass = getattr(settings, "EASYDATA_ALLOW_LOCAL_NO_SCHEMA_POLICY", False)
            if env == "local" and allow_local_bypass:
                logger.warning(
                    "TrainingReadinessGuard bypassed (local only): no SchemaAccessPolicy found"
                )
                return
        raise TrainingReadinessError("; ".join(reasons))

    return {
        "status": "ready",
        "audit_logging": settings.ENABLE_AUDIT_LOGGING,
        "training_pilot_enabled": settings.ENABLE_TRAINING_PILOT,
        "active_policy_id": active_policy.id if active_policy else None,
    }
