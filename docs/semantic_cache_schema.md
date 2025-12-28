# Governed Semantic Cache Schema (Redis + ChromaDB) — v16.5+

## Redis (Authoritative Cache Store)
- **Key format:** `scache:{schema_version}:{policy_version}:{llm_provider}:{llm_model}:{rbac_scope}:{sql_hash}`
- **Value (JSON):**
```json
{
  "cache_id": "scache:schema_v12:policy_v7:openai:gpt-4o-mini:admin:9a81f3c...",
  "validated_sql": "...",               // post-SQLGuard, policy-validated
  "sql_hash": "9a81f3c...",
  "technical_view": {
    "assumptions": ["..."]
  },
  "result_metadata": {
    "row_count": 0,
    "columns": []
  },
  "governance": {
    "schema_version": "schema_v12",
    "policy_version": "policy_v7",
    "validated_at": "2025-01-18T10:12:45Z"
  },
  "telemetry": {
    "source": "cache"
  }
}
```
- **TTL:** hard max 24h; flush on policy/schema commit.
- **Rules:** never store raw sensitive rows; never store unvalidated SQL.

## ChromaDB (Semantic Index)
- **Collection:** `semantic_cache_questions`
- **Document:** normalized user question text only.
- **Metadata (per vector):**
```json
{
  "cache_id": "scache:...",
  "schema_version": "schema_v12",
  "policy_version": "policy_v7",
  "llm_provider": "openai",
  "llm_model": "gpt-4o-mini",
  "rbac_scope": "admin",
  "created_at": "2025-01-18T10:12:44Z"
}
```
- **Prohibited in Chroma:** SQL, result rows, PII, policy rules.

## Lookup Algorithm (Deterministic)
1) Embed incoming question → query Chroma (cosine similarity).
2) If similarity < threshold → MISS.
3) Fetch Redis entry by `cache_id`.
4) Re-run `sql_guard.validate_and_normalise(cached_sql, policy)`.
5) If validation fails → invalidate entry → MISS.
6) If validation passes → HIT.

## Streaming Transparency
- On HIT, `technical_view` must include:
  - `cache_hit`: true
  - `similarity_score`: <float>
  - `governance_status`: "passed" | "failed_revalidation"

## Telemetry Contract
- Spans:
  - `semantic_cache.lookup` (attributes: cache.enabled, cache.type, vector.store, cache.similarity.score, cache.similarity.threshold, cache.hit)
  - `semantic_cache.revalidate` (attributes: sql.hash, schema.version, policy.version, governance.engine, governance.result; ERROR on failure)
