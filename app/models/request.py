"""
Pydantic request models for the API.

These schemas validate and document the expected structure of incoming
requests for different endpoints.
"""

from pydantic import BaseModel
from typing import Optional, List


class QueryRequest(BaseModel):
    """Request payload for asking a natural language question."""

    question: str
    context: Optional[dict] = None


class TrainingItem(BaseModel):
    """Payload for uploading a new training item."""

    question: str
    sql: str
    metadata: Optional[dict] = None


class FeedbackRequest(BaseModel):
    """Payload for user feedback on a previous query."""

    audit_id: int
    is_valid: bool
    comment: Optional[str] = None