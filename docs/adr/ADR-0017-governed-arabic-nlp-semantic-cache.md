# ADR-0017: Governed Arabic NLP Pipeline & Semantic Cache
Status: Accepted  
Date: 2025-01-10  
Version: EasyData v16.5–v16.7  
Decision Type: Architectural / Security / Data Governance  
Owner: Architecture & Security Council

---

## 1. Context
EasyData supports Arabic user queries and relies on a RAG-based pipeline (Vanna + LLM + Vector Store) to generate SQL under strict governance.  
Arabic introduces significant linguistic variance (orthography, morphology, clitics, diacritics) that degrades:
- Semantic similarity accuracy
- Cache hit ratio
- Embedding stability
- SQL generation precision
- Governance correctness (false negatives / positives)

Additionally, introducing a Semantic Cache without governance introduces a critical security risk: historical data leakage after policy changes.

We require a unified, governed approach to:
- Normalize Arabic input deterministically
- Improve semantic consistency
- Prevent unsafe cache reuse after policy updates
- Preserve existing security and streaming contracts

---

## 2. Decision
Adopt a mandatory, governed Arabic NLP preprocessing layer combined with a Governed Semantic Cache, enforced across the /ask execution pipeline.

### 2.1 ArabicQueryEngine (Mandatory)
A dedicated preprocessing service that standardizes Arabic input before it reaches:
- Semantic Cache
- Embedding generation
- Vanna / LLM
- SQL generation

ArabicQueryEngine performs (strict order):
1) Normalization (CAMeL Tools)  
2) Segmentation (Farasa)  
3) Tokenization / Morphology (CAMeL Tools)  
4) Embedding preparation (CAMeLBERT / AraBERT)  
Only the processed output is allowed downstream.

### 2.2 Governed Semantic Cache (Mandatory)
A semantic cache layer using:
- ChromaDB for vector similarity (questions)
- Redis for cached results (SQL + data)

Every cache hit is subject to mandatory revalidation:
- Cached SQL is re-validated via `SQLGuard.validate(...)`
- Validation is performed against the current `SchemaAccessPolicy` version
- Failed revalidation invalidates the cache entry immediately

No cached result may bypass current governance rules.

---

## 3. Architecture Overview
```
User Query (Arabic)
        ↓
ArabicQueryEngine
        ↓
Normalized / Segmented Query
        ↓
Semantic Cache Lookup (ChromaDB)
        ↓
[Cache Hit?]
   ├─ No → LLM / Vanna → SQLGuard → DB
   └─ Yes → SQLGuard (Revalidation)
             ├─ Pass → Return Cached Result
             └─ Fail → Block / Regenerate
```

---

## 4. Non-Negotiable Rules
### 4.1 ArabicQueryEngine Rules
- MUST run for all Arabic input
- MUST execute before cache lookup and embeddings
- MUST emit OpenTelemetry span `arabic.preprocess`
- MUST fail fast on error (no fallback to raw input)
- MUST NOT generate or execute SQL
- Bypassing ArabicQueryEngine for Arabic queries is a governance violation.

### 4.2 Governed Semantic Cache Rules
- Cache matching is semantic, not string-based
- Cache hits MUST NOT return data directly
- Cached SQL MUST pass `SQLGuard.validate(...)` using the active policy
- Cache entries are invalidated on:
  - Policy version change
  - Schema version change
  - SQLGuard rejection
- Traditional (unguarded) caching is explicitly forbidden.

---

## 5. Observability & Telemetry Contract
### 5.1 Arabic NLP Span
- Span Name: `arabic.preprocess`
- Mandatory Attributes:
  - `language = "ar"`
  - `normalization.applied = true`
  - `segmentation.applied = true`
  - `morphology.applied = true`
  - `embedding.model = "camelbert-da"`
  - `original.length`
  - `final.length`

### 5.2 Semantic Cache Spans
- Span Names: `semantic_cache.lookup`, `semantic_cache.revalidate`
- Mandatory Attributes:
  - `cache.hit`
  - `similarity.score`
  - `governance.result = passed | failed`
  - `policy.version`
  - `schema.version`
  - `sql.hash`

---

## 6. Security Implications
This decision directly mitigates:
- Arabic linguistic ambiguity attacks
- Cache poisoning
- Historical data leakage
- Policy drift exploitation
- Silent governance bypass

All cache reuse is explicitly governed and auditable.

---

## 7. Alternatives Considered
| Option | Decision | Reason |
| --- | --- | --- |
| Raw Arabic input to embeddings | Rejected | Unstable semantics |
| spaCy / Stanza only | Rejected | Weaker Arabic morphology |
| Ungoverned semantic cache | Rejected | Security risk |
| Live DB introspection | Rejected | Policy bypass |

---

## 8. Consequences
Positive:
- +30–40% semantic cache hit ratio for Arabic
- Deterministic Arabic understanding
- Stronger SQL accuracy
- Zero regression in security posture
- Full observability and auditability

Trade-offs:
- Slight preprocessing latency (milliseconds)
- Additional dependencies (CAMeL Tools, Farasa)
- Increased architectural strictness (intentional)

---

## 9. Enforcement
This ADR is binding. Any future change that:
- Alters Arabic preprocessing
- Modifies cache behavior
- Introduces alternative NLP pipelines
- Bypasses revalidation

MUST introduce a new ADR and explicit approval.

---

## 10. Final Seal
With this decision, EasyData transitions from Arabic-capable to Arabic-correct by design, while ensuring that performance optimizations (semantic caching) never compromise governance or security. This ADR closes the Arabic NLP & Semantic Cache governance layer for EasyData v16.7.
