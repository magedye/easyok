# Runbook: Policy Breach (SQLGuard / SchemaAccessPolicy)

## What happened
An alert fired indicating a policy violation (sql.allowed=false or governance.result=failed).

## Why it matters
- Potential data leakage or unsafe SQL blocked.
- Indicates either a malicious/erroneous query or stale cache entry.

## Immediate action
1) Open the linked SigNoz trace (from alert).
2) Inspect spans `sql.validate` and `semantic_cache.revalidate` for `sql.hash`, `policy.version`, `schema.version`, `user.id`.
3) Check audit_logs for `Blocked_SQL_Attempt` with same trace_id/sql_hash.
4) If cache revalidation failed, flush the semantic cache entries for the affected policy/schema.

## Escalation
- Security/Governance owner if repeated violations or unknown user.
- SRE if violations correlate with infrastructure anomalies.
