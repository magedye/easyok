from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime

from app.core.db import session_scope
from app.models.db.behavioral_feedback import BehavioralFeedback


class BehavioralFeedbackService:
    """Append-only storage for non-binding behavioral signals (Tier 1)."""

    def record_event(
        self,
        *,
        event_type: str,
        trace_id: str,
        user_id: str | None,
        session_id: str | None,
        payload: Dict[str, Any] | None,
    ) -> None:
        with session_scope() as session:
            evt = BehavioralFeedback(
                event_type=event_type,
                trace_id=trace_id,
                confidence_tier="TIER_1_LAB",
                timestamp=datetime.utcnow(),
                user_id=user_id,
                session_id=session_id,
                payload=payload or {},
            )
            session.add(evt)
            session.commit()

    def list_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        with session_scope() as session:
            rows = (
                session.query(BehavioralFeedback)
                .order_by(BehavioralFeedback.id.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "event_type": r.event_type,
                    "trace_id": r.trace_id,
                    "confidence_tier": r.confidence_tier,
                    "timestamp": r.timestamp.isoformat() + "Z",
                    "user_id": r.user_id,
                    "session_id": r.session_id,
                    "payload": r.payload or {},
                }
                for r in rows
            ]
