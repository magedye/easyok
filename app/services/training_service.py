"""
Training service implementing governed lifecycle:
READ -> REVIEW -> APPROVE -> TRAIN.
"""

from __future__ import annotations

import json
from typing import Dict, Any, List

from app.core.config import get_settings
from app.core.db import session_scope
from app.models.internal import TrainingItem
from app.providers.factory import create_vector_provider
from app.utils.sql_guard import SQLGuard


class TrainingService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.vector = create_vector_provider(self.settings)
        self.sql_guard = SQLGuard(self.settings)

    def submit_training_item(
        self,
        *,
        item_type: str,
        payload: Dict[str, Any],
        created_by: str | None = None,
    ) -> TrainingItem:
        """Store a pending training item."""
        ti = TrainingItem(
            item_type=item_type,
            payload=json.dumps(payload),
            status="pending",
            created_by=created_by,
        )
        with session_scope() as session:
            session.add(ti)
            session.flush()
            session.refresh(ti)
            return ti

    def list_pending(self) -> List[TrainingItem]:
        with session_scope() as session:
            return (
                session.query(TrainingItem)
                .filter(TrainingItem.status == "pending")
                .order_by(TrainingItem.created_at.asc())
                .all()
            )

    def approve(self, item_id: int, approver: str | None = None) -> TrainingItem:
        """Approve and apply training (write to vector store)."""
        with session_scope() as session:
            ti = session.get(TrainingItem, item_id)
            if ti is None:
                raise ValueError("Training item not found")
            ti.status = "approved"
            ti.approved_by = approver
            from datetime import datetime

            ti.approved_at = datetime.utcnow()
            session.add(ti)
            payload = json.loads(ti.payload or "{}")
            self._apply_to_vector(ti.item_type, payload)
            session.flush()
            session.refresh(ti)
            return ti

    def purge_vector_store(self) -> None:
        """Clear vector store (admin only)."""
        try:
            # drop and recreate collection
            self.vector.collection.delete()
            self.vector.collection = self.vector.client.get_or_create_collection("training_data")
        except Exception:
            # fallback: recreate provider
            self.vector = create_vector_provider(self.settings)

    def _apply_to_vector(self, item_type: str, payload: Dict[str, Any]) -> None:
        """
        Apply approved item to vector store.
        - ddl/doc: store raw text
        - sql: validate and store question-sql pair
        """
        docs: list[str] = []
        metas: list[dict] = []

        if item_type == "ddl":
            text = payload.get("ddl") or payload.get("text") or ""
            docs.append(text)
            metas.append({"type": "ddl"})
        elif item_type == "doc":
            text = payload.get("doc") or payload.get("text") or ""
            docs.append(text)
            metas.append({"type": "doc"})
        elif item_type == "sql":
            question = payload.get("question", "")
            sql = payload.get("sql", "")
            if sql:
                sql = self.sql_guard.validate_and_normalise(sql)
            docs.append(f"Q: {question}\nSQL: {sql}")
            metas.append({"type": "sql_pair", "question": question})
        else:
            return

        if docs:
            self.vector.add_documents(docs, metas)
