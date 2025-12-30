EASYDATA AGENT SELF-CHECK (MUST RUN BEFORE ANY TASK)

You must operate in deterministic mode (effective temperature ≈ 0.1). Do not be creative.

1) SCOPE CONFIRMATION
- Restate the user request in 1–2 lines.
- Identify the exact deliverables (files/endpoints/tests/docs).
- If anything is ambiguous, choose the most conservative interpretation aligned with existing docs/contracts. Do not expand scope.

2) CONTRACTS & SOURCES OF TRUTH (NO REINTERPRETATION)
- Check required references in priority order:
  a) docs/master_api_contract.md
  b) docs/security_permissions_matrix.md
  c) docs/adr_arch_dec_record.md + docs/adr/*
  d) docs/project_design_document.md
  e) docs/guidelines.md
  f) .env.example (SSOT for env structure)
- If a change impacts API, update master_api_contract.md first.
- If a change is non-trivial and not already decided, create an ADR instead of improvising.

3) HARD SECURITY CONTRACT (v16.3) — NON-NEGOTIABLE
- No SQL reaches any DB unless it passes SQLGuard (sqlglot Oracle dialect AST validation).
- SchemaAccessPolicy is binding (tables/columns + active version). Out-of-policy => SECURITY_VIOLATION, stop, audit.
- /ask is the only authorized SQL execution gate.
- Streaming must remain NDJSON; technical_view must be emitted before any data.
- Any violation must be audited with action=Blocked_SQL_Attempt (include question, SQL, reason).
- No silent failures; no “ok/summary ok”.

4) GOVERNED SEMANTIC CACHE (v16.5) — RULES
- Cache hit must be revalidated by SQLGuard against the CURRENT active policy before returning results.
- If revalidation fails: invalidate cache entry and return SECURITY_VIOLATION (or regenerate per design if explicitly allowed).
- Emit technical_view metadata: cache_hit, similarity_score, governance_status.

5) ADMIN FEATURE TOGGLES — RULES
- Feature toggles must NOT be changed directly from Dashboard UI.
- Changes must be performed only via Admin API with RBAC enforcement and audited with reason.

6) OBSERVABILITY — RULES (SigNoz + OTel + Sentry)
- Add/modify spans/attributes exactly as specified; do not invent new names.
- Correlate Sentry events with trace_id.
- Do not introduce Grafana/Jaeger/Prometheus UI sprawl (SigNoz is primary).

7) NON-GOALS / FORBIDDEN
- Do not bypass SQLGuard or introspect live schema outside policy/discovery endpoints.
- Do not refactor unrelated modules.
- Do not change formatting of config/templates unless explicitly requested.
- Do not change streaming contract ordering.

8) EXECUTION PLAN (OUTPUT REQUIRED)
Before writing code/docs, output:
- Files to change (exact paths)
- What will change in each file (1 line each)
- Tests to add/update
- How to verify (commands and expected results)

9) IMPLEMENTATION RULES
- Minimal diff; preserve existing formatting/style.
- English code only.
- Add precise error codes/messages matching contract.
- Add/extend unit tests for critical security/governance logic.

10) FINAL VERIFICATION (MUST REPORT)
- Run: python3 -m py_compile $(git ls-files '*.py')
- Run: pytest -q (or target tests)
- Confirm: /ask NDJSON streaming order (technical_view first) is unchanged.
- Confirm: blocked SQL generates audit log Blocked_SQL_Attempt and SECURITY_VIOLATION response.

If any step cannot be satisfied, stop and report the exact blocker and the safest fallback aligned with contracts.
