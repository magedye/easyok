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
from app.services.schema_policy_service import SchemaPolicyService
from app.services.audit_service import AuditService


class TrainingService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.vector = create_vector_provider(self.settings)
        self.sql_guard = SQLGuard(self.settings)
        self.policy_service = SchemaPolicyService()
        self.audit_service = AuditService()

    def submit_training_item(
        self,
        *,
        item_type: str,
        payload: Dict[str, Any],
        created_by: str | None = None,
    ) -> TrainingItem:
        """Store a pending training item."""
        status = "pending"
        rejection_reason = self._enforce_taxonomy(item_type, payload)
        if rejection_reason:
            self.audit_service.log(
                user_id=created_by or "anonymous",
                role="guest",
                action="Blocked_Training_Attempt",
                resource_id=None,
                payload={"reason": rejection_reason},
                status="failed",
                outcome="failed",
                error_message="SECURITY_VIOLATION",
            )
            raise ValueError("SECURITY_VIOLATION: training violates taxonomy/policy")

        policy = self.policy_service.get_active()
        schema_version = getattr(policy, "schema_name", "") or ""
        policy_version = str(getattr(policy, "version", "") or "")

        # Map payload to persisted fields
        if item_type == "sql":
            question = payload.get("question") or ""
            sql = payload.get("sql") or ""
            assumptions = json.dumps(payload.get("metadata") or {})
        elif item_type == "ddl":
            question = "ddl"
            sql = payload.get("ddl") or payload.get("text") or ""
            assumptions = "DDL ingestion"
        else:
            question = payload.get("question") or ""
            sql = payload.get("sql") or payload.get("text") or ""
            assumptions = payload.get("assumptions") or ""

        if not assumptions:
            assumptions = "Pending review"

        ti = TrainingItem(
            item_type=item_type,
            question=question,
            sql=sql,
            assumptions=assumptions,
            schema_version=schema_version,
            policy_version=policy_version,
            status=status,
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
            payload: Dict[str, Any] = {
                "question": ti.question,
                "sql": ti.sql,
                "ddl": ti.sql if ti.item_type == "ddl" else None,
                "assumptions": ti.assumptions,
            }
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
                policy = self.policy_service.get_active()
                sql = self.sql_guard.validate_and_normalise(sql, policy=policy)
            docs.append(f"Q: {question}\nSQL: {sql}")
            metas.append({"type": "sql_pair", "question": question})
        else:
            return

        if docs:
            self.vector.add_documents(docs, metas)

    def _enforce_taxonomy(self, item_type: str, payload: Dict[str, Any]) -> str | None:
        """Reject overfitting or memorisation per taxonomy. Returns reason if rejected."""
        # Enforce active policy scope
        policy = self.policy_service.get_active()
        if not policy:
            return "No active schema access policy"

        if item_type == "sql":
            sql = (payload.get("sql") or "").upper()
            tables = policy.allowed_tables or []
            denied_tables = (policy.denied_tables or []) + (policy.excluded_tables or [])
            if denied_tables:
                for dt in denied_tables:
                    if dt.upper() in sql:
                        return "Schema-specific SQL training is rejected"
            if tables:
                for segment in sql.replace("\n", " ").split():
                    seg = segment.replace(",", "")
                    if "." in seg:
                        tbl = seg.split(".")[0]
                        if tbl and tbl.upper() not in [t.upper() for t in tables]:
                            return "Schema-specific SQL training is rejected"
            excluded_columns = policy.excluded_columns or {}
            if excluded_columns and "." in sql:
                parts = [p for p in sql.replace("\n", " ").split() if "." in p]
                for p in parts:
                    tbl, _, col = p.partition(".")
                    cols = excluded_columns.get(tbl) or []
                    if col.upper() in [c.upper() for c in cols]:
                        return "Schema-specific SQL training is rejected"
            if any(tok in sql for tok in ["DROP ", "DELETE ", "INSERT ", "UPDATE "]):
                return "Unsafe SQL training is rejected"
        if item_type == "doc":
            text = (payload.get("doc") or payload.get("text") or "").upper()
            if any(tok in text for tok in ["SELECT ", " FROM ", " MAJED", "."]):
                return "Schema-specific or SQL-like doc training is rejected"
        return None
