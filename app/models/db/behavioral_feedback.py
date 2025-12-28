from __future__ import annotations

from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class BehavioralFeedback(Base):
    __tablename__ = "behavioral_feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False)
    trace_id = Column(String, nullable=False)
    confidence_tier = Column(String, default="TIER_1_LAB", nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(String, nullable=True)
    session_id = Column(String, nullable=True)
    payload = Column(JSON, nullable=True)
