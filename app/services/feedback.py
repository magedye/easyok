"""
Feedback service.

Persists feedback and converts incorrect answers into pending training items.
"""

from __future__ import annotations

import json
from typing import Optional

from app.core.db import session_scope
from app.models.internal import UserFeedback
from app.services.training_service import TrainingService


class FeedbackService:
    def __init__(self) -> None:
        self.training_service = TrainingService()

    def record_feedback(
        self,
        *,
        audit_id: int,
        is_valid: bool,
        comment: Optional[str],
        user_id: str | None = None,
        proposed_question: str | None = None,
        proposed_sql: str | None = None,
    ) -> UserFeedback:
        training_item_id = None
        if not is_valid:
            if proposed_question and proposed_sql:
                ti = self.training_service.submit_training_item(
                    item_type="sql",
                    payload={"question": proposed_question, "sql": proposed_sql, "source": "feedback"},
                    created_by=user_id,
                )
            else:
                ti = self.training_service.submit_training_item(
                    item_type="doc",
                    payload={"doc": comment or "User marked result incorrect", "source": "feedback"},
                    created_by=user_id,
                )
            training_item_id = ti.id

        feedback = UserFeedback(
            audit_log_id=audit_id,
            user_id=user_id or "anonymous",
            is_valid=is_valid,
            comment=comment,
            training_item_id=training_item_id,
        )
        with session_scope() as session:
            session.add(feedback)
            session.flush()
            session.refresh(feedback)
            return feedback
