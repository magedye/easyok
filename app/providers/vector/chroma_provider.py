"""
Chroma vector store provider.

This provider uses the Chroma persistent client to store and query
embeddings.  It assumes the client is installed via the
`chromadb` package.  Only minimal functionality is implemented here.
"""

from typing import Iterable, Tuple, Dict, List
from dataclasses import dataclass
from pathlib import Path
import uuid
import os
import importlib.util

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseVectorStore


@dataclass
class ChromaProvider(BaseVectorStore):
    settings: Settings

    def __post_init__(self) -> None:
        try:
            if not self.settings.ENABLE_TELEMETRY or not getattr(self.settings, "ANON_TELEMETRY", True):
                os.environ.setdefault("CHROMA_TELEMETRY", "false")
                os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
                if importlib.util.find_spec("posthog") is not None:
                    import posthog  # type: ignore

                    def _noop_capture(*args, **kwargs):  # type: ignore[no-untyped-def]
                        return None

                    posthog.capture = _noop_capture  # type: ignore[assignment]

            import chromadb  # type: ignore

            path = Path(self.settings.VECTOR_STORE_PATH)
            path.mkdir(parents=True, exist_ok=True)
            self.client = chromadb.PersistentClient(path=str(path))
            # Using default collections
            self.collection = self.client.get_or_create_collection("training_data")
            self.training_collection = self.client.get_or_create_collection("training_context")
        except Exception as exc:
            raise AppException(str(exc))

    def add_documents(self, documents: Iterable[str], metadatas: Iterable[Dict[str, any]]) -> None:
        try:
            docs = list(documents)
            metas = list(metadatas)
            ids = [str(uuid.uuid4()) for _ in docs]
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

    def add_training_context(self, documents: List[str], metadatas: List[Dict[str, any]]) -> None:
        try:
            ids = [str(uuid.uuid4()) for _ in documents]
            self.training_collection.add(ids=ids, documents=documents, metadatas=metadatas)
        except Exception as exc:
            raise AppException(str(exc))

    def query_training_context(
        self,
        *,
        query_text: str,
        schema_version: str,
        policy_version: str,
        n_results: int = 5,
    ) -> List[Dict[str, any]]:
        try:
            results = self.training_collection.query(
                query_texts=[query_text],
                n_results=n_results,
                where={
                    "schema_version": schema_version,
                    "policy_version": policy_version,
                },
            )
            docs = results.get("documents", [[]])[0]
            metas = results.get("metadatas", [[]])[0]
            paired = list(zip(docs, metas))
            paired.sort(key=lambda x: x[1].get("training_item_id", ""))
            return [{"document": d, "metadata": m} for d, m in paired]
        except Exception as exc:
            raise AppException(str(exc))
