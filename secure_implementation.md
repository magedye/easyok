EasyData Fortress — Governance Lock Execution Plan (FINAL)
Phase 0 — Immutable Context
Scope: Affirm hard baselines (FastAPI, NDJSON, JWT/RBAC, SQLite+Chroma, HTTPS proxy enforcement, fail-closed).
Non-Scope: No refactor, no new features.
Files: main.py, settings.py, policy_guard.py, training_readiness_guard.py, schema_policy_bootstrap.py, sql_guard.py.
Steps:
Ensure settings load before any guard.
Keep startup order: settings → enforce_environment_policy → bootstrap_local_schema_policy (local only) → assert_training_readiness → app init.
Keep SQLite as system DB; Chroma only for embeddings.
Runtime Guards: If startup order is altered → hard fail.
Tests: Unit/contract: import main must not reorder.
DoD: Startup order intact; no extra stores or bypass paths.
Phase 1 — Authentication (JWT)
Scope: Enforce JWT over HTTPS; no bypass when AUTH_ENABLED=true.
Non-Scope: No anonymous access in non-local.
Files: jwt.py, dependencies.py, auth.py, settings.py.
Steps:
Require env: AUTH_ENABLED=true, JWT_SECRET_KEY, JWT_ALGORITHM=HS256, issuer easydata-auth, audience easydata-api.
Protect all endpoints; missing/invalid token → 401.
Reject startup if AUTH_ENABLED=true and JWT secrets missing.
Runtime Guards: Reject plain HTTP; enforce X-Forwarded-Proto=https.
Tests: Integration: login returns JWT with sub, roles, trace_id; expired/invalid signature → 401.
DoD: All auth paths return 401 on invalid/expired; secrets required to boot when auth is on.
Phase 2 — Authorization (RBAC)
Scope: Server-side RBAC on all admin/privileged endpoints.
Non-Scope: No frontend permission logic.
Files: app/api/**/* admin routes, dependencies.py, settings.py.
Steps:
Env: RBAC_ENABLED=true, strict mode on.
Apply Depends(require_permission("admin:*")) (or specific perms) on admin routes.
Log 403 with audit on denial.
Runtime Guards: Any unprotected admin route with RBAC on → fail gate (CI) or 403 at runtime.
Tests: Governance tests expecting 403 for missing perms when RBAC on.
DoD: With RBAC on, missing perms → 403 + audit; with RBAC off, routes remain reachable.
Phase 3 — Training Readiness Guard
Scope: Block training unless governed.
Non-Scope: No silent bypass.
Files: training_readiness_guard.py.
Steps:
Enforce: ENABLE_AUDIT_LOGGING=true, active SchemaAccessPolicy, TRAINING_READINESS_ENFORCED=true (except explicit local path).
Local-only bypass: ENV=local AND TRAINING_READINESS_ENFORCED=false → log warning, return.
Otherwise: collect reasons; raise TrainingReadinessError on any failure.
Runtime Guards: Non-local with missing audit/policy → startup fail.
Tests: Unit: guard raises when requirements missing; integration: training endpoints unavailable when guard fails.
DoD: Non-local startup fails without audit+policy; local bypass only when explicitly configured.
Phase 4 — NDJSON Streaming Integrity
Scope: Enforce chunk order and trace consistency for /ask and /chat/stream.
Non-Scope: No client-side reordering or SQL manipulation.
Files: query.py, chat.py, sql_guard.py.
Steps:
Emit chunks in strict order: thinking → technical_view → data → business_view → end.
Ensure single trace_id across all chunks.
Abort/render error if order/trace violated.
Runtime Guards: Out-of-order or trace mismatch → terminate stream, log violation.
Tests: Contract tests validate sequence and trace_id consistency.
DoD: Streams always follow order; violations stop stream; no data after end/error.
Phase 5 — HTTPS & Proxy Hardening
Scope: Enforce secure transport and proxy validation.
Non-Scope: No HTTP JWT transmission.
Files: app/middleware/* (proxy/https), settings.py.
Steps:
Validate X-Forwarded-Proto=https; reject spoofed/absent when required.
Deny authenticated calls over plain HTTP.
Runtime Guards: If proto check fails → 400/403 + audit.
Tests: Integration: simulate bad proto header → reject; good proto → pass.
DoD: Authenticated traffic only over validated HTTPS; failures logged.
Phase 6 — Feature Toggles & Audit
Scope: Backend-managed toggles with audit.
Non-Scope: No UI-side mutations.
Files: settings.py (or equivalent), feature_toggle.py, audit service.
Steps:
Changes only via Admin API; require reason.
Audit event with user, reason, trace_id, timestamp.
UI read-only; display state from backend.
Runtime Guards: Toggle mutation outside admin API → 403.
Tests: Governance tests ensure admin-only mutation and audit entries.
DoD: Every toggle change audited; non-admin gets 403; UI does not mutate locally.
Phase 7 — Observability & Audit
Scope: Full traceability for all state changes.
Non-Scope: No silent logging disable.
Files: audit_service.py, OTEL init, middleware tracing.
Steps:
Env: ENABLE_AUDIT_LOGGING=true; OTEL per env; set OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SAMPLER_RATIO.
Emit trace_id per request; log violations, auth failures, SQLGuard blocks, toggle changes.
Runtime Guards: If audit disabled in non-local → startup fail.
Tests: Integration: actions emit audit with trace_id; tracing exports when enabled.
DoD: Audit searchable by trace_id; critical actions logged; OTEL respects env flags.
Phase 8 — CI/CD Gates
Scope: Prevent drift via blocking gates.
Non-Scope: No guard weakening.
Files: fortress-ci.yml, playwright.yml, check_env_schema_parity.py, verify_backend.sh.
Steps:
Blocking CI runs: bash -n verify_backend.sh; check_env_schema_parity.py; pytest -q -rs; flake8 app; Spectral on fortress.yaml.
Nightly/optional: backend smoke + Playwright E2E (no disabling guards).
Runtime Guards: Any gate failure blocks merge.
Tests: CI jobs must exit non-zero on failures.
DoD: All blocking gates green before merge; no skipped governance tests.
Phase 9 — Startup Guards (Hard Fail)
Scope: Deny boot on unsafe config.
Non-Scope: No try/except suppression.
Files: main.py, policy_guard.py, training_readiness_guard.py.
Steps:
On start, fail if: audit disabled; training enabled without readiness; AUTH/RBAC on without secrets; no active SchemaAccessPolicy (non-local); HTTPS/proxy invalid.
Log fatal reason; exit.
Runtime Guards: Process exits on any violation.
Tests: Unit/integration: start with missing prerequisites → fail closed.
DoD: Service only starts when all guards satisfied; violations are fatal and logged.
Phase 10 — Forbidden Patterns
Scope: Explicitly blocked behaviors.
Non-Scope: None.
Files: Applies repo-wide (code review/CI checks).
Rules:
No JWT over HTTP.
No client-side SQL generation/validation/permission/RLS logic.
No frontend toggle mutations.
No silent try/except around guards.
No env vars outside .env.schema/settings.py.
Tests: Governance lint/review; CI rejects deviations where detectable.
DoD: None of the forbidden patterns present in code or runtime configuration.
Hard Failure Clause
Any requirement above that cannot be met must be treated as a hard failure: refuse startup, fail CI, and block deployment until resolved.
EasyData Fortress — Governance Lock Execution Plan (FINAL)
Phase 0 — Immutable Context
Scope: Affirm hard baselines (FastAPI, NDJSON, JWT/RBAC, SQLite+Chroma, HTTPS proxy enforcement, fail-closed).
Non-Scope: No refactor, no new features.
Files: main.py, settings.py, policy_guard.py, training_readiness_guard.py, schema_policy_bootstrap.py, sql_guard.py.
Steps:
Ensure settings load before any guard.
Keep startup order: settings → enforce_environment_policy → bootstrap_local_schema_policy (local only) → assert_training_readiness → app init.
Keep SQLite as system DB; Chroma only for embeddings.
Runtime Guards: If startup order is altered → hard fail.
Tests: Unit/contract: import main must not reorder.
DoD: Startup order intact; no extra stores or bypass paths.
Phase 1 — Authentication (JWT)
Scope: Enforce JWT over HTTPS; no bypass when AUTH_ENABLED=true.
Non-Scope: No anonymous access in non-local.
Files: jwt.py, dependencies.py, auth.py, settings.py.
Steps:
Require env: AUTH_ENABLED=true, JWT_SECRET_KEY, JWT_ALGORITHM=HS256, issuer easydata-auth, audience easydata-api.
Protect all endpoints; missing/invalid token → 401.
Reject startup if AUTH_ENABLED=true and JWT secrets missing.
Runtime Guards: Reject plain HTTP; enforce X-Forwarded-Proto=https.
Tests: Integration: login returns JWT with sub, roles, trace_id; expired/invalid signature → 401.
DoD: All auth paths return 401 on invalid/expired; secrets required to boot when auth is on.
Phase 2 — Authorization (RBAC)
Scope: Server-side RBAC on all admin/privileged endpoints.
Non-Scope: No frontend permission logic.
Files: app/api/**/* admin routes, dependencies.py, settings.py.
Steps:
Env: RBAC_ENABLED=true, strict mode on.
Apply Depends(require_permission("admin:*")) (or specific perms) on admin routes.
Log 403 with audit on denial.
Runtime Guards: Any unprotected admin route with RBAC on → fail gate (CI) or 403 at runtime.
Tests: Governance tests expecting 403 for missing perms when RBAC on.
DoD: With RBAC on, missing perms → 403 + audit; with RBAC off, routes remain reachable.
Phase 3 — Training Readiness Guard
Scope: Block training unless governed.
Non-Scope: No silent bypass.
Files: training_readiness_guard.py.
Steps:
Enforce: ENABLE_AUDIT_LOGGING=true, active SchemaAccessPolicy, TRAINING_READINESS_ENFORCED=true (except explicit local path).
Local-only bypass: ENV=local AND TRAINING_READINESS_ENFORCED=false → log warning, return.
Otherwise: collect reasons; raise TrainingReadinessError on any failure.
Runtime Guards: Non-local with missing audit/policy → startup fail.
Tests: Unit: guard raises when requirements missing; integration: training endpoints unavailable when guard fails.
DoD: Non-local startup fails without audit+policy; local bypass only when explicitly configured.
Phase 4 — NDJSON Streaming Integrity
Scope: Enforce chunk order and trace consistency for /ask and /chat/stream.
Non-Scope: No client-side reordering or SQL manipulation.
Files: query.py, chat.py, sql_guard.py.
Steps:
Emit chunks in strict order: thinking → technical_view → data → business_view → end.
Ensure single trace_id across all chunks.
Abort/render error if order/trace violated.
Runtime Guards: Out-of-order or trace mismatch → terminate stream, log violation.
Tests: Contract tests validate sequence and trace_id consistency.
DoD: Streams always follow order; violations stop stream; no data after end/error.
Phase 5 — HTTPS & Proxy Hardening
Scope: Enforce secure transport and proxy validation.
Non-Scope: No HTTP JWT transmission.
Files: app/middleware/* (proxy/https), settings.py.
Steps:
Validate X-Forwarded-Proto=https; reject spoofed/absent when required.
Deny authenticated calls over plain HTTP.
Runtime Guards: If proto check fails → 400/403 + audit.
Tests: Integration: simulate bad proto header → reject; good proto → pass.
DoD: Authenticated traffic only over validated HTTPS; failures logged.
Phase 6 — Feature Toggles & Audit
Scope: Backend-managed toggles with audit.
Non-Scope: No UI-side mutations.
Files: settings.py (or equivalent), feature_toggle.py, audit service.
Steps:
Changes only via Admin API; require reason.
Audit event with user, reason, trace_id, timestamp.
UI read-only; display state from backend.
Runtime Guards: Toggle mutation outside admin API → 403.
Tests: Governance tests ensure admin-only mutation and audit entries.
DoD: Every toggle change audited; non-admin gets 403; UI does not mutate locally.
Phase 7 — Observability & Audit
Scope: Full traceability for all state changes.
Non-Scope: No silent logging disable.
Files: audit_service.py, OTEL init, middleware tracing.
Steps:
Env: ENABLE_AUDIT_LOGGING=true; OTEL per env; set OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SAMPLER_RATIO.
Emit trace_id per request; log violations, auth failures, SQLGuard blocks, toggle changes.
Runtime Guards: If audit disabled in non-local → startup fail.
Tests: Integration: actions emit audit with trace_id; tracing exports when enabled.
DoD: Audit searchable by trace_id; critical actions logged; OTEL respects env flags.
Phase 8 — CI/CD Gates
Scope: Prevent drift via blocking gates.
Non-Scope: No guard weakening.
Files: fortress-ci.yml, playwright.yml, check_env_schema_parity.py, verify_backend.sh.
Steps:
Blocking CI runs: bash -n verify_backend.sh; check_env_schema_parity.py; pytest -q -rs; flake8 app; Spectral on fortress.yaml.
Nightly/optional: backend smoke + Playwright E2E (no disabling guards).
Runtime Guards: Any gate failure blocks merge.
Tests: CI jobs must exit non-zero on failures.
DoD: All blocking gates green before merge; no skipped governance tests.
Phase 9 — Startup Guards (Hard Fail)
Scope: Deny boot on unsafe config.
Non-Scope: No try/except suppression.
Files: main.py, policy_guard.py, training_readiness_guard.py.
Steps:
On start, fail if: audit disabled; training enabled without readiness; AUTH/RBAC on without secrets; no active SchemaAccessPolicy (non-local); HTTPS/proxy invalid.
Log fatal reason; exit.
Runtime Guards: Process exits on any violation.
Tests: Unit/integration: start with missing prerequisites → fail closed.
DoD: Service only starts when all guards satisfied; violations are fatal and logged.
Phase 10 — Forbidden Patterns
Scope: Explicitly blocked behaviors.
Non-Scope: None.
Files: Applies repo-wide (code review/CI checks).
Rules:
No JWT over HTTP.
No client-side SQL generation/validation/permission/RLS logic.
No frontend toggle mutations.
No silent try/except around guards.
No env vars outside .env.schema/settings.py.
Tests: Governance lint/review; CI rejects deviations where detectable.
DoD: None of the forbidden patterns present in code or runtime configuration.
Hard Failure Clause
Any requirement above that cannot be met must be treated as a hard failure: refuse startup, fail CI, and block deployment until resolved.








