from abc import ABC, abstractmethod
from typing import Any, Dict, Iterable, List
from uuid import UUID

from app.models.api import (
    AskRequest,
    BaseChunk,
    QueryAssetCreate,
    ScheduleCreate,
    TrainingItemRequest,
    SandboxPromotion,
)


# =====================================================
# Core Orchestration
# =====================================================

class OrchestrationService(ABC):
    """
    The single authority for governed execution.
    Exploration may suggest. Governance executes.
    """

    @abstractmethod
    def execute(self, request: AskRequest) -> Iterable[BaseChunk]:
        """
        Execute a governed analytical request.
        Must return NDJSON chunks in correct order.
        """
        raise NotImplementedError


# =====================================================
# Exploration / Sandbox
# =====================================================

class ShadowExecutionService(ABC):
    """
    Fully isolated sandbox execution.
    Never touches production DB or vector store.
    """

    @abstractmethod
    def run(self, sql: str, trace_id: UUID) -> List[Dict[str, Any]]:
        """
        Execute exploratory SQL in sandbox context.
        """
        raise NotImplementedError


class AdvisorService(ABC):
    """
    Advisory-only intelligence layer.
    """

    @abstractmethod
    def explain_sql(self, sql: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def suggest_fix(self, sql: str, error: str) -> str:
        raise NotImplementedError

    @abstractmethod
    def suggest_chart(self, columns: List[str]) -> Dict[str, Any]:
        raise NotImplementedError


# =====================================================
# Training & Knowledge
# =====================================================

class TrainingService(ABC):
    """
    Governed training pipeline (Admin-only).
    No auto-training allowed.
    """

    @abstractmethod
    def submit_item(self, item: TrainingItemRequest, item_type: str) -> UUID:
        raise NotImplementedError

    @abstractmethod
    def approve_assumption(self, assumption_id: UUID, reason: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def reject_assumption(self, assumption_id: UUID, reason: str) -> None:
        raise NotImplementedError


# =====================================================
# Assets
# =====================================================

class AssetService(ABC):
    """
    QueryAsset lifecycle management.
    """

    @abstractmethod
    def create(self, payload: QueryAssetCreate) -> UUID:
        raise NotImplementedError

    @abstractmethod
    def list(self, user_id: UUID) -> List[Dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def share(self, asset_id: UUID, target: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def archive(self, asset_id: UUID) -> None:
        raise NotImplementedError


# =====================================================
# Scheduling
# =====================================================

class SchedulingService(ABC):
    """
    Headless execution of approved assets only.
    """

    @abstractmethod
    def create_schedule(self, payload: ScheduleCreate) -> UUID:
        raise NotImplementedError

    @abstractmethod
    def disable_schedule(self, schedule_id: UUID, reason: str) -> None:
        raise NotImplementedError


# =====================================================
# Governance & Admin
# =====================================================

class AuditService(ABC):
    """
    Immutable audit logging.
    """

    @abstractmethod
    def log(self, event_type: str, payload: Dict[str, Any]) -> None:
        raise NotImplementedError


class SchemaDriftService(ABC):
    """
    Detects and tracks schema drift.
    """

    @abstractmethod
    def detect(self) -> List[Dict[str, Any]]:
        raise NotImplementedError


class FeatureToggleService(ABC):
    """
    Runtime feature switches (admin-governed).
    """

    @abstractmethod
    def set(self, feature: str, enabled: bool, reason: str) -> None:
        raise NotImplementedError


# =====================================================
# Sandbox Promotion
# =====================================================

class SandboxPromotionService(ABC):
    """
    Admin-only promotion of sandbox discoveries.
    """

    @abstractmethod
    def promote(self, payload: SandboxPromotion) -> None:
        raise NotImplementedError
