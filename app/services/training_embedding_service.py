from __future__ import annotations

from typing import List, Optional

from opentelemetry import trace

from app.core.config import get_settings
from app.core.db import session_scope
from app.models.internal import TrainingItem as TrainingItemModel
from app.providers.factory import create_vector_provider


tracer = trace.get_tracer(__name__)


class TrainingEmbeddingService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.vector = create_vector_provider(self.settings)

    def inject_training_item(self, training_item_id: int) -> None:
        with session_scope() as session:
            item: Optional[TrainingItemModel] = session.get(TrainingItemModel, training_item_id)
            if not item or item.status != "approved":
                raise ValueError("TrainingItem not found or not approved")

        document = f"QUESTION: {item.question}\nASSUMPTIONS: {item.assumptions}"
        metadata = {
            "training_item_id": str(item.id),
            "schema_version": item.schema_version,
            "policy_version": item.policy_version,
            "approved_by": item.approved_by or "",
            "approved_at": item.approved_at.isoformat() if item.approved_at else "",
        }

        with tracer.start_as_current_span(
            "training_item.injected",
            attributes={
                "training_item_id": str(item.id),
                "schema.version": item.schema_version,
                "policy.version": item.policy_version,
            },
        ):
            self.vector.add_training_context([document], [metadata])

    def retrieve_training_context(
        self,
        query_text: str,
        schema_version: str,
        policy_version: str,
        n_results: int = 5,
    ) -> List[dict]:
        results = self.vector.query_training_context(
            query_text=query_text,
            schema_version=schema_version,
            policy_version=policy_version,
            n_results=n_results,
        )
        return results
