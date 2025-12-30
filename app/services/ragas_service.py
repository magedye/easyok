from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.config import get_settings
from app.core.db import session_scope
from app.core.exceptions import AppException
from app.models.internal import RagasMetric


class RagasService:
    """
    Offline RAG quality evaluation using RAGAS.
    - Does NOT affect runtime execution or streaming.
    - Consumes post-execution artifacts (audit logs, training/feedback) provided by caller.
    - Persists per-query metrics and supports time-series aggregation.
    """

    def __init__(self):
        self.settings = get_settings()
        if not getattr(self.settings, "ENABLE_RAG_QUALITY", False):
            raise AppException("RAG Quality is disabled by configuration")

    def evaluate_and_store(
        self,
        dataset: List[Dict[str, Any]],
        *,
        model_name: Optional[str] = None,
        schema_version: Optional[str] = None,
        policy_version: Optional[int] = None,
    ) -> List[RagasMetric]:
        """
        dataset: list of dicts with keys:
            question: str
            contexts: List[str]
            answer: str
            ground_truth: Optional[str] (if available)
            audit_log_id: Optional[int]
        """
        if not dataset:
            return []

        try:
            import pandas as pd
            from ragas import evaluate
            from ragas.metrics import context_precision, context_recall, faithfulness, answer_relevance
        except ImportError as exc:
            raise AppException(
                "ragas is not installed. Enable feature and install dependencies."
            ) from exc

        # Prepare dataframe for ragas
        df = pd.DataFrame(
            [
                {
                    "question": item.get("question", ""),
                    "contexts": item.get("contexts", []),
                    "answer": item.get("answer", "") or "",
                    "ground_truth": item.get("ground_truth", "") or "",
                    "audit_log_id": item.get("audit_log_id"),
                }
                for item in dataset
            ]
        )

        results = evaluate(
            df,
            metrics=[
                context_precision,
                context_recall,
                faithfulness,
                answer_relevance,
            ],
        )

        stored: List[RagasMetric] = []
        with session_scope() as session:
            for idx, row in df.iterrows():
                metrics_row = results.iloc[idx]
                entry = RagasMetric(
                    audit_log_id=row.get("audit_log_id"),
                    model_name=model_name,
                    schema_version=schema_version,
                    policy_version=policy_version,
                    context_precision=float(metrics_row["context_precision"]),
                    context_recall=float(metrics_row["context_recall"]),
                    faithfulness=float(metrics_row["faithfulness"]),
                    answer_relevance=float(metrics_row["answer_relevance"]),
                    created_at=datetime.utcnow(),
                )
                session.add(entry)
                session.flush()
                session.refresh(entry)
                stored.append(entry)
        return stored

    def aggregate(
        self,
        *,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        model_name: Optional[str] = None,
        schema_version: Optional[str] = None,
        policy_version: Optional[int] = None,
    ) -> Dict[str, Any]:
        with session_scope() as session:
            query = session.query(RagasMetric)
            if start:
                query = query.filter(RagasMetric.created_at >= start)
            if end:
                query = query.filter(RagasMetric.created_at <= end)
            if model_name:
                query = query.filter(RagasMetric.model_name == model_name)
            if schema_version:
                query = query.filter(RagasMetric.schema_version == schema_version)
            if policy_version:
                query = query.filter(RagasMetric.policy_version == policy_version)

            rows = query.all()

        count = len(rows)
        if count == 0:
            return {
                "count": 0,
                "context_precision": None,
                "context_recall": None,
                "faithfulness": None,
                "answer_relevance": None,
            }

        def avg(values: List[Optional[float]]) -> Optional[float]:
            valid = [v for v in values if v is not None]
            return sum(valid) / len(valid) if valid else None

        return {
            "count": count,
            "context_precision": avg([r.context_precision for r in rows]),
            "context_recall": avg([r.context_recall for r in rows]),
            "faithfulness": avg([r.faithfulness for r in rows]),
            "answer_relevance": avg([r.answer_relevance for r in rows]),
        }
