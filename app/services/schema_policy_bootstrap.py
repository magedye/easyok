from __future__ import annotations

import logging

from app.core.config import get_settings
from app.core.db import session_scope
from app.models.internal import SchemaAccessPolicy
from app.services.schema_policy_service import SchemaPolicyService

logger = logging.getLogger(__name__)


def bootstrap_local_schema_policy() -> None:
    """
    Local-only governance bootstrap:
    - Runs ONLY when ENV=local
    - Creates an active SchemaAccessPolicy ONLY if none exists
    - Never runs in ci/production
    """
    settings = get_settings()
    if settings.ENV != "local":
        return

    with session_scope() as session:
        existing = (
            session.query(SchemaAccessPolicy)
            .filter(SchemaAccessPolicy.status == "active")
            .order_by(SchemaAccessPolicy.created_at.desc())
            .first()
        )
        if existing:
            return

    schema_name = (settings.ORACLE_USER or "LOCAL").upper()
    SchemaPolicyService().commit_policy(
        db_connection_id=None,
        schema_name=schema_name,
        allowed_tables=[],
        allowed_columns={},
        excluded_tables=[],
        excluded_columns={},
        created_by="system_local_bootstrap",
    )
    logger.warning(
        "GOVERNANCE: Local-only SchemaAccessPolicy bootstrapped (active) for schema=%s",
        schema_name,
    )

