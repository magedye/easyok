# ADR-0020: Confidence Tiers & NDJSON Streaming (v16.7.x)

## Status
Accepted

## Context
- NDJSON is the sole streaming protocol for `/api/v1/ask`.
- Execution security is governed by SQLGuard and SchemaAccessPolicy.
- Exploration output must never execute SQL.

## Decision
- Introduced `ConfidenceTier` enum: `TIER_0_FORTRESS` (execute) and `TIER_1_LAB` (advisory only).
- `/api/v1/ask` emits NDJSON chunks in strict order: `thinking` (Tier 1) → `technical_view` (Tier 0, post-SQLGuard) → `data_chunk` (Tier 0) → `business_view` (Tier 1) → `end`.
- Every chunk carries `trace_id`, `confidence_tier`, and `timestamp`.
- SQL execution occurs only in Tier 0 after SQLGuard validation; Tier 1 never executes SQL.
- End chunk terminates stream explicitly; errors emit `error` then `end`.

## Consequences
- Clear separation between advisory (Tier 1) and executable (Tier 0) outputs.
- NDJSON contract is deterministic and auditable per chunk.
- Any attempt to bypass SQLGuard or execute under Tier 1 is a security violation.
