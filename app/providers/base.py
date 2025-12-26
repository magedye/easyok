"""
Abstract provider interfaces.

Providers connect the application to external systems such as databases,
vector stores, and language models.  Subclasses must implement the
methods defined here.  See `providers/factory.py` for how to obtain
concrete providers based on configuration.
"""

from abc import ABC, abstractmethod
from typing import Any, Iterable, Tuple, Dict, List


class BaseDatabaseProvider(ABC):
    """Contract for database providers handling read‑only queries."""

    @abstractmethod
    def connect(self) -> Any:
        """Create and return a live database connection or session."""

    @abstractmethod
    def execute(self, sql: str, parameters: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        """Execute a read‑only query and return rows as dictionaries."""


class BaseVectorStore(ABC):
    """Contract for vector store providers used in RAG."""

    @abstractmethod
    def add_documents(self, documents: Iterable[str], metadatas: Iterable[Dict[str, Any]]) -> None:
        """Add documents and metadata to the vector store."""

    @abstractmethod
    def query(self, query_text: str, n_results: int) -> List[Tuple[str, Dict[str, Any]]]:
        """Return the top N documents similar to the query text."""


class BaseLLMProvider(ABC):
    """Contract for large language model providers."""

    @abstractmethod
    def generate_sql(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """Generate SQL code given a prompt and parameters."""

    @abstractmethod
    def generate_summary(self, question: str, sql: str, results: List[Dict[str, Any]]) -> str:
        """Generate a natural language summary of query results."""