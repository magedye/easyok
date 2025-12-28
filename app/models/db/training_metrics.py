from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON

from app.models.internal import Base


class TrainingMetric(Base):
    __tablename__ = "training_metrics"

    id = Column(Integer, primary_key=True)
    run_id = Column(String(64), nullable=False, index=True)
    phase = Column(String(32), nullable=False)  # baseline | post_training
    schema_version = Column(String(64), nullable=False, index=True)
    policy_version = Column(String(64), nullable=False, index=True)
    percentage_correct_first_pass = Column(Float, nullable=False, default=0.0)
    error_class_count_by_type = Column(JSON, nullable=False, default={})
    assumptions_present_rate = Column(Float, nullable=False, default=0.0)
    sqlguard_pass_rate = Column(Float, nullable=False, default=0.0)
    baseline_latency_ms = Column(Float, nullable=True)
    post_training_latency_ms = Column(Float, nullable=True)
    latency_delta_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
