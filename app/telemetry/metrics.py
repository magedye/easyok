from __future__ import annotations

from typing import Dict, Any

try:
    from opentelemetry.metrics import get_meter
except ImportError:  # pragma: no cover
    get_meter = None  # type: ignore


def export_training_metrics(metrics: Dict[str, Any]) -> None:
    """
    Export training metrics via OpenTelemetry meters (no-op if OTel metrics not available).
    """
    if get_meter is None:
        return
    meter = get_meter(__name__)
    counters = {
        "training.percentage_correct_first_pass": metrics.get("percentage_correct_first_pass", 0.0),
        "training.sqlguard_pass_rate": metrics.get("sqlguard_pass_rate", 0.0),
        "training.assumptions_present_rate": metrics.get("assumptions_present_rate", 0.0),
        "training.latency_delta_ms": metrics.get("latency_delta_ms", 0.0) or 0.0,
    }
    attrs = {
        "schema_version": metrics.get("schema_version", ""),
        "policy_version": metrics.get("policy_version", ""),
        "phase": metrics.get("phase", ""),
        "run_id": metrics.get("run_id", ""),
    }
    for name, value in counters.items():
        try:
            meter.create_observable_gauge(name, [lambda options=None, v=value: [value]], description=name, unit="")
        except Exception:
            continue
