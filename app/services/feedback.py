"""
Feedback service.

Handles user feedback (valid/invalid) and pinning of results.  Stubbed
for the MVP.
"""

from typing import Dict, Any

class FeedbackService:
    def record_feedback(self, audit_id: int, is_valid: bool, comment: str | None) -> None:
        # TODO: persist feedback and update training metrics
        pass