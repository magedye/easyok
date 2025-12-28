from app.core.config import settings
from app.services.base import *
from app.services.noop import *
from app.services.advisor_mode_service import AdvisorModeService


class ServiceFactory:
    """
    Centralized dependency injection.
    """

    @staticmethod
    def orchestration() -> OrchestrationService:
        # Real implementation injected later
        return NoOpOrchestrationService()

    @staticmethod
    def shadow_execution() -> ShadowExecutionService:
        if not settings.SANDBOX_ENABLED:
            return NoOpShadowExecutionService()
        return NoOpShadowExecutionService()  # placeholder

    @staticmethod
    def advisor() -> AdvisorService:
        if not getattr(settings, "ENABLE_ADVISOR_MODE", False):
            return NoOpAdvisorService()
        return AdvisorModeService()

    @staticmethod
    def training() -> TrainingService:
        if not settings.TRAINING_ENABLED:
            return NoOpTrainingService()
        return NoOpTrainingService()  # placeholder

    @staticmethod
    def assets() -> AssetService:
        if not settings.ASSETS_ENABLED:
            return NoOpAssetService()
        return NoOpAssetService()  # placeholder

    @staticmethod
    def scheduling() -> SchedulingService:
        if not settings.SCHEDULING_ENABLED:
            return NoOpSchedulingService()
        return NoOpSchedulingService()  # placeholder

    @staticmethod
    def audit() -> AuditService:
        return NoOpAuditService()

    @staticmethod
    def schema_drift() -> SchemaDriftService:
        return NoOpSchemaDriftService()

    @staticmethod
    def feature_toggles() -> FeatureToggleService:
        return NoOpFeatureToggleService()

    @staticmethod
    def sandbox_promotion() -> SandboxPromotionService:
        return NoOpSandboxPromotionService()
