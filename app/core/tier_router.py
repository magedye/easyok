from __future__ import annotations

from enum import Enum
from typing import Dict, Any

from app.core.settings import settings
from app.services.orchestration_service import OrchestrationService
from app.services.vanna_hybrid_service import VannaHybridService
from app.services.vanna_native_service import VannaNativeService


class OperationTier(str, Enum):
    FORTRESS = "tier0_fortress"
    GOVERNED = "tier1_governed"
    VANNA = "tier2_vanna"


class TierRouter:
    """
    Single source of truth for tier routing. No business logic beyond dispatch.
    """

    def __init__(self) -> None:
        self.tier = OperationTier(settings.OPERATION_TIER)
        self._fortress: OrchestrationService | None = None
        self._hybrid: VannaHybridService | None = None
        self._vanna: VannaNativeService | None = None

    def _fortress_service(self) -> OrchestrationService:
        if self._fortress is None:
            self._fortress = OrchestrationService()
        return self._fortress

    def _hybrid_service(self) -> VannaHybridService:
        if self._hybrid is None:
            self._hybrid = VannaHybridService()
        return self._hybrid

    def _vanna_service(self) -> VannaNativeService:
        if self._vanna is None:
            self._vanna = VannaNativeService()
        return self._vanna

    def resolve_ask_service(self):
        if self.tier == OperationTier.FORTRESS:
            return self._fortress_service()
        if self.tier == OperationTier.GOVERNED:
            return self._hybrid_service()
        return self._vanna_service()

    def resolve_feedback_service(self):
        if self.tier == OperationTier.FORTRESS:
            return None
        if self.tier == OperationTier.GOVERNED:
            return self._hybrid_service()
        return self._vanna_service()

    def get_tier_info(self) -> Dict[str, Any]:
        return {
            "tier": self.tier.value,
            "features": {
                "agent_enabled": self.tier != OperationTier.FORTRESS,
                "memory_enabled": self.tier == OperationTier.VANNA,
                "feedback_enabled": self.tier != OperationTier.FORTRESS,
                "rich_output": self.tier == OperationTier.VANNA,
            },
        }
