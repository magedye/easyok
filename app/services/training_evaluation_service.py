from __future__ import annotations

from typing import Dict, List, Any

from app.core.db import session_scope
from app.models.db.training_metrics import TrainingMetric


class TrainingEvaluationService:
    def compute_and_store(
        self,
        *,
        run_id: str,
        phase: str,
        schema_version: str,
        policy_version: str,
        evaluation_results: List[Dict[str, Any]],
        baseline_latency_ms: float | None = None,
        post_training_latency_ms: float | None = None,
    ) -> TrainingMetric:
        total = len(evaluation_results) or 1
        correct = 0
        sqlguard_pass = 0
        assumptions_present = 0
        error_class_count: Dict[str, int] = {}

        for res in evaluation_results:
            if res.get("sqlguard_passed"):
                sqlguard_pass += 1
            if res.get("assumptions_present"):
                assumptions_present += 1
            if res.get("structure_correct") and res.get("sqlguard_passed"):
                correct += 1
            err = res.get("error_class") or "none"
            error_class_count[err] = error_class_count.get(err, 0) + 1

        percentage_correct_first_pass = (correct / total) * 100.0
        sqlguard_pass_rate = (sqlguard_pass / total) * 100.0
        assumptions_present_rate = (assumptions_present / total) * 100.0

        latency_delta = None
        if baseline_latency_ms is not None and post_training_latency_ms is not None:
            latency_delta = post_training_latency_ms - baseline_latency_ms

        metric = TrainingMetric(
            run_id=run_id,
            phase=phase,
            schema_version=schema_version,
            policy_version=policy_version,
            percentage_correct_first_pass=percentage_correct_first_pass,
            error_class_count_by_type=error_class_count,
            assumptions_present_rate=assumptions_present_rate,
            sqlguard_pass_rate=sqlguard_pass_rate,
            baseline_latency_ms=baseline_latency_ms,
            post_training_latency_ms=post_training_latency_ms,
            latency_delta_ms=latency_delta,
        )

        with session_scope() as session:
            session.add(metric)
            session.flush()
            session.refresh(metric)
            return metric
