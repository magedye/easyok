"""
Chroma vector store provider.

This provider uses the Chroma persistent client to store and query
embeddings.  It assumes the client is installed via the
`chromadb` package.  Only minimal functionality is implemented here.
"""

from typing import Iterable, Tuple, Dict, List
from dataclasses import dataclass
import chromadb  # type: ignore

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseVectorStore


@dataclass
class ChromaProvider(BaseVectorStore):
    settings: Settings

    def __post_init__(self) -> None:
        try:
            self.client = chromadb.PersistentClient(path=str(self.settings.VECTOR_STORE_PATH))
            # Using a single default collection
            self.collection = self.client.get_or_create_collection("training_data")
        except Exception as exc:
            raise AppException(str(exc))

    def add_documents(self, documents: Iterable[str], metadatas: Iterable[Dict[str, any]]) -> None:
        try:
            ids = [str(i) for i, _ in enumerate(documents)]
            docs = list(documents)
            metas = list(metadatas)
            self.collection.add(ids=ids, documents=docs, metadatas=metas)
        except Exception as exc:
            raise AppException(str(exc))

    def query(self, query_text: str, n_results: int) -> List[Tuple[str, Dict[str, any]]]:
        try:
            results = self.collection.query(query_texts=[query_text], n_results=n_results)
            docs = results.get("documents", [[]])[0]
            metas = results.get("metadatas", [[]])[0]
            return list(zip(docs, metas))
        except Exception as exc:
            raise AppException(str(exc))