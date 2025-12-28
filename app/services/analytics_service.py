from __future__ import annotations

from statistics import mean
from typing import Dict, Any, List

from app.core.db import session_scope
from app.models.internal import AuditLog, UserFeedback


class AnalyticsService:
    @staticmethod
    def user_analytics() -> Dict[str, Any]:
        with session_scope() as session:
            logs: List[AuditLog] = (
                session.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(200).all()
            )
            total = len(logs)
            successes = [l for l in logs if (l.status or "").lower() == "success"]
            failures = [l for l in logs if (l.status or "").lower() != "success"]
            exec_times = [l.execution_time_ms for l in successes if l.execution_time_ms is not None]
            recent = [
                {
                    "queryId": str(l.id),
                    "question": l.question,
                    "sql": l.sql,
                    "status": l.status,
                    "executionTimeMs": l.execution_time_ms,
                    "createdAt": l.timestamp.isoformat(),
                }
                for l in logs[:10]
            ]
            top = recent[:5]

            # Feedback-based rating proxy
            feedback = session.query(UserFeedback).all()
            ratings = [1 if f.is_valid else 0 for f in feedback if f.is_valid is not None]

        return {
            "totalQueries": total,
            "successfulQueries": len(successes),
            "failedQueries": len(failures),
            "averageExecutionTime": mean(exec_times) if exec_times else 0,
            "topQueries": top,
            "recentQueries": recent,
            "accuracyScore": mean(ratings) if ratings else None,
        }
