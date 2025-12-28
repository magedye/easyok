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
from app.services.base import *


class NoOpOrchestrationService(OrchestrationService):
    def execute(self, request: AskRequest) -> Iterable[BaseChunk]:
        return []


class NoOpShadowExecutionService(ShadowExecutionService):
    def run(self, sql: str, trace_id: UUID) -> List[Dict[str, Any]]:
        return []


class NoOpAdvisorService(AdvisorService):
    def explain_sql(self, sql: str) -> str:
        return ""

    def suggest_fix(self, sql: str, error: str) -> str:
        return ""

    def suggest_chart(self, columns: List[str]) -> Dict[str, Any]:
        return {}


class NoOpTrainingService(TrainingService):
    def submit_item(self, item: TrainingItemRequest, item_type: str) -> UUID:
        raise RuntimeError("Training disabled")

    def approve_assumption(self, assumption_id: UUID, reason: str) -> None:
        pass

    def reject_assumption(self, assumption_id: UUID, reason: str) -> None:
        pass


class NoOpAssetService(AssetService):
    def create(self, payload: QueryAssetCreate) -> UUID:
        raise RuntimeError("Assets disabled")

    def list(self, user_id: UUID) -> List[Dict[str, Any]]:
        return []

    def share(self, asset_id: UUID, target: str) -> None:
        pass

    def archive(self, asset_id: UUID) -> None:
        pass


class NoOpSchedulingService(SchedulingService):
    def create_schedule(self, payload: ScheduleCreate) -> UUID:
        raise RuntimeError("Scheduling disabled")

    def disable_schedule(self, schedule_id: UUID, reason: str) -> None:
        pass


class NoOpAuditService(AuditService):
    def log(self, event_type: str, payload: Dict[str, Any]) -> None:
        pass


class NoOpSchemaDriftService(SchemaDriftService):
    def detect(self) -> List[Dict[str, Any]]:
        return []


class NoOpFeatureToggleService(FeatureToggleService):
    def set(self, feature: str, enabled: bool, reason: str) -> None:
        pass


class NoOpSandboxPromotionService(SandboxPromotionService):
    def promote(self, payload: SandboxPromotion) -> None:
        pass
