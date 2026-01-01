from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional
from uuid import UUID

from app.models.api import (
    AskRequest,
    BaseChunk,
    QueryAssetCreate,
    ScheduleCreate,
    TrainingItemRequest,
    SandboxPromotion,
)

# =========================================================================
# FIX: Explicit Imports for ALL Parent Services
# =========================================================================
# نستورد كل الخدمات الأب لتجنب NameError
try:
    from app.services.orchestration_service import OrchestrationService
except ImportError:
    # Fallback if file doesn't exist yet (prevents crash, assumes object)
    class OrchestrationService: pass

try:
    from app.services.shadow_execution_service import ShadowExecutionService
except ImportError:
    class ShadowExecutionService: pass

try:
    from app.services.advisor_service import AdvisorService
except ImportError:
    class AdvisorService: pass

try:
    from app.services.training_service import TrainingService
except ImportError:
    class TrainingService: pass

try:
    from app.services.asset_service import AssetService
except ImportError:
    class AssetService: pass

try:
    from app.services.scheduling_service import SchedulingService
except ImportError:
    class SchedulingService: pass

try:
    from app.services.audit_service import AuditService
except ImportError:
    class AuditService: pass

try:
    from app.services.schema_drift_service import SchemaDriftService
except ImportError:
    class SchemaDriftService: pass

try:
    from app.services.feature_toggle_service import FeatureToggleService
except ImportError:
    class FeatureToggleService: pass

try:
    from app.services.sandbox_promotion_service import SandboxPromotionService
except ImportError:
    class SandboxPromotionService: pass


# =========================================================================
# No-Op Implementations
# =========================================================================

class NoOpOrchestrationService(OrchestrationService):
    def __init__(self):
        pass
        
    def execute(self, request: AskRequest) -> Iterable[BaseChunk]:
        return []

    async def prepare(self, *, question: str, user_context: Any, top_k: int = 5) -> Dict[str, Any]:
        return {}

    async def execute_sql(self, sql: str) -> Any:
        return []
    
    def normalise_rows(self, raw_result: Any) -> List[Dict[str, Any]]:
        return []
        
    def business_view_payload(self, raw_result: Any) -> Dict[str, Any]:
        return {"text": "No-Op service active."}

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
    def log(self, event_type: str, payload: Dict[str, Any], **kwargs) -> None:
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