from __future__ import annotations

from datetime import datetime
from typing import List

from opentelemetry import trace

from app.core.db import session_scope
from app.models.enums.training_status import TrainingStatus
from app.models.internal import TrainingItem, TrainingStaging


tracer = trace.get_tracer(__name__)


class TrainingItemService:
    def list_pending(self) -> List[TrainingStaging]:
        with session_scope() as session:
            return (
                session.query(TrainingStaging)
                .filter(TrainingStaging.status == TrainingStatus.pending.value)
                .order_by(TrainingStaging.created_at.asc())
                .all()
            )

    def approve(self, staging_id: int, admin_id: str) -> TrainingItem:
        with session_scope() as session:
            staging = session.get(TrainingStaging, staging_id)
            if not staging or staging.status != TrainingStatus.pending.value:
                raise ValueError("Staging item not found or not pending")

            item = TrainingItem(
                item_type="question_sql",
                question=staging.question,
                sql=staging.sql,
                assumptions=staging.assumptions,
                schema_version=staging.schema_version or "",
                policy_version=staging.policy_version or "",
                status=TrainingStatus.approved.value,
                created_by=staging.created_by,
                approved_by=admin_id,
                created_at=staging.created_at or datetime.utcnow(),
                approved_at=datetime.utcnow(),
            )
            session.add(item)
            session.flush()
            session.refresh(item)

            staging.status = TrainingStatus.approved.value
            session.add(staging)
            session.flush()
            return item

    def reject(self, staging_id: int, admin_id: str, reason: str) -> None:
        with session_scope() as session:
            staging = session.get(TrainingStaging, staging_id)
            if not staging or staging.status != TrainingStatus.pending.value:
                raise ValueError("Staging item not found or not pending")
            staging.status = TrainingStatus.rejected.value
            staging.rejection_reason = reason
            session.add(staging)
            session.flush()
