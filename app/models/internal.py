"""
Internal database models for logging, training, and user metadata.

These models are used with SQLAlchemy to persist system state in the
system database (SQLite or PostgreSQL).  They should not be exposed
directly via the public API.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    Float,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base
from datetime import datetime


Base = declarative_base()


class AuditLog(Base):
    """Record of every query executed."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    question = Column(Text, nullable=False)
    sql = Column(Text, nullable=False)
    status = Column(String(50), nullable=False)  # success, failed, timeout
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer)
    row_count = Column(Integer)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    correlation_id = Column(String(255), unique=True, index=True)


class TrainingData(Base):
    """User‑approved training data for RAG."""

    __tablename__ = "training_data"

    id = Column(Integer, primary_key=True)
    question = Column(Text, nullable=False, unique=True)
    sql = Column(Text, nullable=False)
    is_approved = Column(Boolean, default=False)
    approved_by = Column(String(255), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    uploaded_by = Column(String(255), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    usage_count = Column(Integer, default=0)
    validation_score = Column(Float, default=0.0)


class UserFeedback(Base):
    """Feedback from users on executed queries."""

    __tablename__ = "user_feedback"

    id = Column(Integer, primary_key=True)
    audit_log_id = Column(Integer, ForeignKey("audit_logs.id"))
    user_id = Column(String(255), nullable=False)
    is_valid = Column(Boolean)  # True if the user validated the result
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserCapability(Base):
    """Track capability level and performance metrics per user."""

    __tablename__ = "user_capability"

    user_id = Column(String(255), primary_key=True)
    capability_level = Column(Integer, default=1)  # 1-5
    validated_queries = Column(Integer, default=0)
    failed_queries = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=datetime.utcnow)


class UserDataScope(Base):
    """Define row‑level data access scopes for users."""

    __tablename__ = "user_data_scopes"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False)
    column_name = Column(String(255), nullable=False)
    allowed_values = Column(Text, nullable=False)  # JSON string of allowed values