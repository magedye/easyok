"""
Qdrant vector store provider stub.

This provider is a placeholder for integrating with a Qdrant cluster.
To implement fully, install the qdrant-client package and configure
connection parameters in `config.py`.  For now it raises
`NotImplementedError`.
"""

from typing import Iterable, Tuple, Dict, List
from dataclasses import dataclass

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseVectorStore


@dataclass
class QdrantProvider(BaseVectorStore):
    settings: Settings

    def __post_init__(self) -> None:
        # TODO: Initialise Qdrant client
        pass

    def add_documents(self, documents: Iterable[str], metadatas: Iterable[Dict[str, any]]) -> None:
        raise AppException("Qdrant provider not implemented")

    def query(self, query_text: str, n_results: int) -> List[Tuple[str, Dict[str, any]]]:
        raise AppException("Qdrant provider not implemented")