"""
Abstract provider interfaces and Service contracts.

Providers connect the application to external systems.
Services define the business logic contracts.
"""

from abc import ABC, abstractmethod
from typing import Any, Iterable, Tuple, Dict, List, Optional
from uuid import UUID

# =========================================================================
# Providers (External System Connectors)
# =========================================================================

class BaseDatabaseProvider(ABC):
    """
    Contract for database providers.

    Tier-2 note:
    This interface does NOT imply read-only execution. Governance,
    if required, is enforced at higher layers.
    """

    @abstractmethod
    def connect(self) -> Any:
        """Create and return a live database connection."""

    @abstractmethod
    def execute(
        self, sql: str, parameters: Dict[str, Any] | None = None
    ) -> List[Dict[str, Any]]:
        """Execute SQL and return rows as dictionaries."""


class BaseVectorStore(ABC):
    """Contract for vector store providers used in RAG."""

    @abstractmethod
    def add_documents(
        self, documents: Iterable[str], metadatas: Iterable[Dict[str, Any]]
    ) -> None:
        """Add documents and metadata to the vector store."""

    @abstractmethod
    def query(
        self, query_text: str, n_results: int
    ) -> List[Tuple[str, Dict[str, Any]]]:
        """Return the top N documents similar to the query text."""


class BaseLLMProvider(ABC):
    """
    Contract for all LLM providers.
    """

    @abstractmethod
    async def generate_sql(self, prompt: str) -> str:
        ...

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        ...


# =========================================================================
# Services (Business Logic Contracts)
# =========================================================================

class AdvisorService(ABC):
    """Contract for SQL analysis and fix suggestions."""
    @abstractmethod
    def explain_sql(self, sql: str) -> str: ...
    
    @abstractmethod
    def suggest_fix(self, sql: str, error: str) -> str: ...
    
    @abstractmethod
    def suggest_chart(self, columns: List[str]) -> Dict[str, Any]: ...


class ShadowExecutionService(ABC):
    """Contract for running queries in shadow mode (tracing only)."""
    @abstractmethod
    def run(self, sql: str, trace_id: UUID) -> List[Dict[str, Any]]: ...


class TrainingService(ABC):
    """Contract for feedback loop and RLHF."""
    @abstractmethod
    def submit_item(self, item: Any, item_type: str) -> UUID: ...
    
    @abstractmethod
    def approve_assumption(self, assumption_id: UUID, reason: str) -> None: ...
    
    @abstractmethod
    def reject_assumption(self, assumption_id: UUID, reason: str) -> None: ...


class AssetService(ABC):
    """Contract for managing saved queries/assets."""
    @abstractmethod
    def create(self, payload: Any) -> UUID: ...
    
    @abstractmethod
    def list(self, user_id: UUID) -> List[Dict[str, Any]]: ...
    
    @abstractmethod
    def share(self, asset_id: UUID, target: str) -> None: ...
    
    @abstractmethod
    def archive(self, asset_id: UUID) -> None: ...


class SchedulingService(ABC):
    """Contract for scheduled report execution."""
    @abstractmethod
    def create_schedule(self, payload: Any) -> UUID: ...
    
    @abstractmethod
    def disable_schedule(self, schedule_id: UUID, reason: str) -> None: ...


class AuditService(ABC):
    """Contract for compliance logging."""
    @abstractmethod
    def log(self, event_type: str, payload: Dict[str, Any], **kwargs) -> None: ...


class SchemaDriftService(ABC):
    """Contract for detecting database schema changes."""
    @abstractmethod
    def detect(self) -> List[Dict[str, Any]]: ...


class FeatureToggleService(ABC):
    """Contract for dynamic feature management."""
    @abstractmethod
    def set(self, feature: str, enabled: bool, reason: str) -> None: ...


class SandboxPromotionService(ABC):
    """Contract for promoting sandbox assets to production."""
    @abstractmethod
    def promote(self, payload: Any) -> None: ...


class OrchestrationService(ABC):
    """Contract for the main query pipeline orchestration."""
    # Note: Often implemented concretely in orchestration_service.py, 
    # but defined here as ABC for NoOp implementations to inherit from.
    pass