"""
Observability Contract: Guarantee that disabled ≠ silent.

Every No-Op service MUST:
1. Emit span attributes showing disabled state
2. Not silently fail or return wrong results
3. Maintain the same interface as real implementation
"""

from typing import Any, Dict, Protocol, Optional
from app.core.concern_lifecycle import ConcernLifecycleTracker


class ObservableSemanticCache(Protocol):
    """Semantic cache that emits observability."""
    
    def lookup(self, query: str, tracker: Optional[ConcernLifecycleTracker] = None) -> Optional[Dict[str, Any]]:
        """
        Lookup query in cache.
        
        If this is No-Op:
        - Returns None
        - Records event in tracker
        """
        ...

    def store(self, query: str, result: Dict[str, Any], tracker: Optional[ConcernLifecycleTracker] = None) -> None:
        """
        Store result in cache.
        
        If this is No-Op:
        - Does nothing
        - Records event in tracker
        """
        ...


class ObservableArabicNLP(Protocol):
    """Arabic NLP that emits observability."""
    
    def normalize(self, text: str, tracker: Optional[ConcernLifecycleTracker] = None) -> str:
        """
        Normalize text.
        
        If this is No-Op:
        - Returns text unchanged
        - Records event in tracker
        """
        ...

    def tokenize(self, text: str, tracker: Optional[ConcernLifecycleTracker] = None) -> list[str]:
        """
        Tokenize text.
        
        If this is No-Op:
        - Returns [text]
        - Records event in tracker
        """
        ...


class ObservableRateLimiter(Protocol):
    """Rate limiter that emits observability."""
    
    def is_allowed(self, user_id: str, tracker: Optional[ConcernLifecycleTracker] = None) -> bool:
        """
        Check if request is allowed.
        
        If this is No-Op:
        - Always returns True
        - Records event in tracker
        """
        ...


class ObservableAuditLogger(Protocol):
    """Audit logger that emits observability."""
    
    def log(self, action: str, details: Dict[str, Any], tracker: Optional[ConcernLifecycleTracker] = None) -> None:
        """
        Log action.
        
        If this is No-Op:
        - Silently drops log
        - Records event in tracker
        """
        ...


class ObservableRAGASEvaluator(Protocol):
    """RAGAS evaluator that emits observability."""
    
    def evaluate(self, question: str, answer: str, context: str, tracker: Optional[ConcernLifecycleTracker] = None) -> Dict[str, float]:
        """
        Evaluate answer quality.
        
        If this is No-Op:
        - Returns empty dict
        - Records event in tracker
        """
        ...


class ObservableSentryHook(Protocol):
    """Sentry hook that emits observability."""
    
    def capture_exception(self, exc: Exception, tracker: Optional[ConcernLifecycleTracker] = None) -> None:
        """
        Capture exception.
        
        If this is No-Op:
        - Silently ignores
        - Records event in tracker
        """
        ...

    def capture_message(self, message: str, level: str = "info", tracker: Optional[ConcernLifecycleTracker] = None) -> None:
        """
        Capture message.
        
        If this is No-Op:
        - Silently ignores
        - Records event in tracker
        """
        ...


# Enforcement

class ObservabilityViolation(Exception):
    """Raised when observability contract is violated."""
    pass


def enforce_observability(func_name: str, is_noop: bool, tracker: Optional[ConcernLifecycleTracker]) -> None:
    """
    Verify that No-Op service will emit observability.
    
    Raises ObservabilityViolation if contract violated.
    """
    if is_noop and tracker is None:
        raise ObservabilityViolation(
            f"No-Op service '{func_name}' invoked without lifecycle tracker. "
            "Cannot emit observability. Use tracker parameter."
        )
