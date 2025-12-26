"""
Pydantic response models for the API.

All API responses should conform to these schemas to ensure consistency
and ease of consumption by front‑end clients.
"""

from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


class Response(BaseModel):
    status: str
    message: Optional[str] = None
    data: Any = None
    error_code: Optional[str] = None
    timestamp: datetime