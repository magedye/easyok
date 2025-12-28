from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, Optional, Tuple

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from app.core.config import get_settings
from app.core.exceptions import InvalidQueryError
from app.providers.factory import create_vector_provider
from app.utils.sql_guard import SQLGuard
from app.services.schema_policy_service import SchemaPolicyService


class SemanticCacheService:
    """
    Governed semantic cache using ChromaDB for similarity search and Redis for authoritative entries.
    Always re-validates cached SQL via SQLGuard against the active policy before reuse.
    """

    def __init__(self, sql_guard: SQLGuard):
        self.settings = get_settings()
        self.enabled = bool(getattr(self.settings, "ENABLE_SEMANTIC_CACHE", False))
        self.threshold = float(
            getattr(self.settings, "SEMANTIC_CACHE_SIMILARITY_THRESHOLD", 0.85) or 0.85
        )
        self.sql_guard = sql_guard
        self.policy_service = SchemaPolicyService()
        self.tracer = trace.get_tracer(__name__)

        # Vector store for semantic search
        try:
            self.vector = create_vector_provider(self.settings)
            self.collection = self.vector.client.get_or_create_collection("semantic_cache_questions")
        except Exception:
            self.vector = None
            self.collection = None

        # Redis for authoritative cache
        self.redis_client = None
        if redis and self.settings.REDIS_URL:
            try:
                self.redis_client = redis.Redis.from_url(self.settings.REDIS_URL, decode_responses=True)
            except Exception:
                self.redis_client = None

        # Fallback in-memory store if Redis unavailable (best-effort, non-persistent)
        self._memory_store: Dict[str, str] = {}

    def _redis_get(self, key: str) -> Optional[Dict[str, Any]]:
        raw = None
        if self.redis_client:
            raw = self.redis_client.get(key)
        else:
            raw = self._memory_store.get(key)
        if not raw:
            return None
        try:
            return json.loads(raw)
        except Exception:
            return None

    def _redis_set(self, key: str, value: Dict[str, Any], ttl_seconds: int = 86400) -> None:
        data = json.dumps(value, ensure_ascii=False)
        if self.redis_client:
            try:
                self.redis_client.set(key, data, ex=ttl_seconds)
                return
            except Exception:
                pass
        self._memory_store[key] = data

    def _redis_delete(self, key: str) -> None:
        if self.redis_client:
            try:
                self.redis_client.delete(key)
                return
            except Exception:
                pass
        self._memory_store.pop(key, None)

    def _hash_question(self, question: str) -> str:
        return hashlib.sha256(question.strip().encode("utf-8")).hexdigest()

    def _cache_key(
        self,
        *,
        schema_version: str,
        policy_version: int,
        llm_provider: str,
        llm_model: str,
        rbac_scope: str,
        sql_hash: str,
    ) -> str:
        return f"scache:{schema_version}:{policy_version}:{llm_provider}:{llm_model}:{rbac_scope}:{sql_hash}"

    def lookup(
        self,
        question: str,
        policy,
        llm_provider: str,
        llm_model: str,
        rbac_scope: str,
    ) -> Tuple[bool, Optional[str], float, str]:
        """
        Returns (hit, validated_sql, similarity_score, governance_status)
        governance_status: "passed" | "failed_revalidation" | "miss"
        """
        if not self.enabled or not self.collection:
            return False, None, 0.0, "miss"

        with self.tracer.start_as_current_span(
            "semantic_cache.lookup",
            attributes={
                "schema_version": getattr(policy, "schema_name", None),
                "policy_version": getattr(policy, "version", None),
                "cache.enabled": True,
                "cache.type": "governed_semantic",
                "vector.store": "chromadb",
                "cache.similarity.threshold": self.threshold,
            },
        ):
            try:
                res = self.collection.query(query_texts=[question], n_results=1)
                docs = res.get("documents", [[]])[0]
                metas = res.get("metadatas", [[]])[0]
                distances = res.get("distances", [[]])[0] if res.get("distances") else []
                if not metas:
                    self._emit_span(False, 0.0)
                    return False, None, 0.0, "miss"
                meta = metas[0] or {}
                similarity = 1 - distances[0] if distances else 0.0
                cache_id = meta.get("cache_id")
                if similarity < self.threshold or not cache_id:
                    self._emit_span(False, similarity, status="miss")
                    return False, None, similarity, "miss"

                entry = self._redis_get(cache_id)
                if not entry:
                    self._emit_span(False, similarity, status="miss")
                    return False, None, similarity, "miss"

                cached_sql = entry.get("validated_sql") or ""
                with self.tracer.start_as_current_span(
                    "semantic_cache.revalidate",
                    attributes={
                        "sql.hash": entry.get("sql_hash"),
                        "schema.version": getattr(policy, "schema_name", None),
                        "policy.version": getattr(policy, "version", None),
                        "governance.engine": "SQLGuard",
                    },
                ) as gov_span:
                    try:
                        self.sql_guard.validate_and_normalise(cached_sql, policy=policy)
                        gov_span.set_attribute("governance.result", "passed")
                    except InvalidQueryError:
                        gov_span.set_attribute("governance.result", "failed")
                        gov_span.set_status(Status(StatusCode.ERROR, "Policy revalidation failed"))
                        self._redis_delete(cache_id)
                        self._emit_span(False, similarity, status="failed_revalidation")
                        return False, None, similarity, "failed_revalidation"

                self._emit_span(True, similarity, status="hit")
                return True, cached_sql, similarity, "passed"
            except Exception:
                return False, None, 0.0, "miss"

    def store(
        self,
        question: str,
        validated_sql: str,
        policy,
        llm_provider: str,
        llm_model: str,
        rbac_scope: str,
        technical_view: Optional[Dict[str, Any]] = None,
    ) -> None:
        if not self.enabled or not self.collection:
            return

        policy_version = getattr(policy, "version", None) or 0
        schema_version = getattr(policy, "schema_name", "") or "unknown"
        sql_hash = hashlib.sha256(validated_sql.encode("utf-8")).hexdigest()
        cache_key = self._cache_key(
            schema_version=schema_version,
            policy_version=policy_version,
            llm_provider=llm_provider,
            llm_model=llm_model,
            rbac_scope=rbac_scope or "guest",
            sql_hash=sql_hash,
        )

        ttl = int(getattr(self.settings, "SEMANTIC_CACHE_TTL_SECONDS", 3600) or 3600)
        entry = {
            "cache_id": cache_key,
            "validated_sql": validated_sql,
            "sql_hash": sql_hash,
            "technical_view": technical_view or {},
            "result_metadata": {},
            "governance": {
                "schema_version": schema_version,
                "policy_version": policy_version,
                "validated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
            "telemetry": {
                "source": "cache",
            },
        }
        self._redis_set(cache_key, entry, ttl_seconds=ttl)

        try:
            self.collection.add(
                ids=[cache_key],
                documents=[question],
                metadatas=[
                    {
                        "cache_id": cache_key,
                        "schema_version": schema_version,
                        "policy_version": policy_version,
                        "llm_provider": llm_provider,
                        "llm_model": llm_model,
                        "rbac_scope": rbac_scope,
                        "created_at": entry["governance"]["validated_at"],
                    }
                ],
            )
        except Exception:
            # ignore vector errors
            pass

    def _emit_span(self, hit: bool, similarity: float, status: str = "hit") -> None:
        with self.tracer.start_as_current_span(
            f"semantic_cache.{ 'hit' if hit else status if status else 'miss'}",
            attributes={
                "cache.hit": hit,
                "cache.similarity": similarity,
            },
        ):
            pass
