# Semantic Cache Span Contract (OTel) — v16.5+

## Spans
1) `semantic_cache.lookup` (kind: INTERNAL)
   - Attributes:
     - `cache.enabled`: true|false
     - `cache.type`: "governed_semantic"
     - `vector.store`: "chromadb"
     - `cache.similarity.score`: float 0–1
     - `cache.similarity.threshold`: float
     - `cache.hit`: true|false
     - `schema_version`, `policy_version` (if available)
   - Status:
     - OK when similarity >= threshold
     - UNSET when similarity < threshold

2) `semantic_cache.revalidate` (kind: INTERNAL)
   - Parent: `semantic_cache.lookup`
   - Attributes:
     - `sql.hash`: sha256 (no raw SQL)
     - `schema.version`
     - `policy.version`
     - `governance.engine`: "SQLGuard"
     - `governance.result`: "passed" | "failed"
   - Status:
     - OK when governance.result == "passed"
     - ERROR when governance.result == "failed"
     - On failure: also delete cache entry.

## Failure Semantics
- Any revalidation failure sets span.status=ERROR, attributes `error.type=SECURITY_VIOLATION`.
- No cached data is served when ERROR occurs.

## Streaming Contract
- technical_view must include:
  - `cache_hit`
  - `similarity_score`
  - `governance_status` ("passed" | "failed_revalidation" | "miss")
