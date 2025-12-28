from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums.training_status import TrainingStatus


class TrainingItem(BaseModel):
    id: Optional[int] = None
    item_type: str = Field(..., pattern="^(question_sql|doc)$")
    question: str
    sql: str
    assumptions: str
    schema_version: str
    policy_version: str
    status: TrainingStatus = TrainingStatus.pending
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    created_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True,
    }
