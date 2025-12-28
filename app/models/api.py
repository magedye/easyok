from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


# -----------------------------
# Enums
# -----------------------------

class ConfidenceTier(str, Enum):
    TIER_0_FORTRESS = "TIER_0_FORTRESS"
    TIER_1_LAB = "TIER_1_LAB"


class AssetVisibility(str, Enum):
    private = "private"
    shared = "shared"


class DeliveryChannel(str, Enum):
    email = "email"
    dashboard = "dashboard"


# -----------------------------
# Core Request Models
# -----------------------------

class AskRequest(BaseModel):
    question: str
    stream: bool = True
    context: Optional[Dict[str, Any]] = None


# -----------------------------
# NDJSON Base & Chunks
# -----------------------------

class BaseChunk(BaseModel):
    type: str
    trace_id: UUID
    confidence_tier: ConfidenceTier
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ThinkingChunk(BaseChunk):
    type: str = Field("thinking", const=True)
    status: str


class TechnicalViewChunk(BaseChunk):
    type: str = Field("technical_view", const=True)
    sql: str
    assumptions: List[str] = []
    policy_hash: str


class DataChunk(BaseChunk):
    type: str = Field("data_chunk", const=True)
    columns: List[str]
    rows: List[List[Any]]
    row_count: int


class BusinessViewChunk(BaseChunk):
    type: str = Field("business_view", const=True)
    summary: str
    chart_config: Dict[str, Any]


class EndChunk(BaseChunk):
    type: str = Field("end", const=True)
    duration_ms: int


class ErrorChunk(BaseChunk):
    type: str = Field("error", const=True)
    error_code: str
    message: str


# -----------------------------
# Training
# -----------------------------

class TrainingItemRequest(BaseModel):
    content: str
    metadata: Optional[Dict[str, Any]] = None


# -----------------------------
# Assets
# -----------------------------

class QueryAssetCreate(BaseModel):
    trace_id: UUID
    title: str
    visibility: AssetVisibility = AssetVisibility.private


# -----------------------------
# Scheduling
# -----------------------------

class ScheduleCreate(BaseModel):
    asset_id: UUID
    cron: str
    delivery: List[DeliveryChannel] = []


# -----------------------------
# Admin / Sandbox
# -----------------------------

class FeatureToggle(BaseModel):
    feature: str
    enabled: bool
    reason: str


class SandboxPromotion(BaseModel):
    discovery_id: UUID
    reason: str
