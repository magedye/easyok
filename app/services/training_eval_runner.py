from __future__ import annotations

from typing import Callable, List, Dict, Any

from app.services.training_evaluation_service import TrainingEvaluationService


class TrainingEvalRunner:
    """
    Offline evaluation runner for fixed question sets.
    Expects an evaluator callable that accepts a list of questions and returns
    a list of evaluation results with keys:
      - sqlguard_passed (bool)
      - structure_correct (bool)
      - assumptions_present (bool)
      - error_class (str)
      - latency_ms (float)
    """

    def __init__(self, questions: List[str]) -> None:
        self.questions = questions
        self.evaluator: Callable[[List[str]], List[Dict[str, Any]]] | None = None
        self.service = TrainingEvaluationService()

    def set_evaluator(self, evaluator: Callable[[List[str]], List[Dict[str, Any]]]) -> None:
        self.evaluator = evaluator

    def run(
        self,
        *,
        run_id: str,
        phase: str,
        schema_version: str,
        policy_version: str,
    ):
        if not self.evaluator:
            raise ValueError("Evaluator not set")
        results = self.evaluator(self.questions)
        baseline_latency = None
        post_latency = None
        if results:
            latencies = [r.get("latency_ms") or 0 for r in results]
            avg_latency = sum(latencies) / len(latencies)
            if phase == "baseline":
                baseline_latency = avg_latency
            else:
                post_latency = avg_latency
        return self.service.compute_and_store(
            run_id=run_id,
            phase=phase,
            schema_version=schema_version,
            policy_version=policy_version,
            evaluation_results=results,
            baseline_latency_ms=baseline_latency,
            post_training_latency_ms=post_latency,
        )
