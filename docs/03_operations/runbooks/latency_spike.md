# Runbook: Latency Spike (/ask or DB)

## What happened
Alert triggered on p95 latency (ask.request or db.query.execute) breaching threshold.

## Why it matters
- User experience degradation.
- Potential DB stress or LLM slowdowns.

## Immediate action
1) Open the SigNoz trace linked in the alert.
2) Check spans:
   - `db.query.execute` for execution time and row counts.
   - `sql.generate` for LLM delays or errors.
   - `semantic_cache.lookup` to see if cache misses increased.
3) Correlate with DB health (/api/v1/admin/metrics) and system health.

## Escalation
- SRE if DB latency persists > 15m.
- Backend lead if LLM generation is the bottleneck.
