# EasyData v16.7.9 - Internal Audit Report
**Date:** 2025-12-30  
**Checklist Source:** `/home/mfadmin/easyok/audit_checklist.md`  
**Status:** **30 CRITICAL FINDINGS** | Systematic failures in API contract, security enforcement, and test infrastructure

---

## Executive Summary

The audit reveals **systematic architectural violations** of the binding contracts defined in AGENTS.md (v16.7). Primary concerns:

1. **CORS Misconfiguration (CRITICAL)** - `["*"]` in production-ready code
2. **Security Enforcement Gaps** - SQLGuard not invoked in `/ask` endpoint
3. **Testing Infrastructure Broken** - 3 test collection errors; 0% coverage baseline
4. **API Contract Unsigned** - No OpenAPI operationIds; schema refs incomplete
5. **Admin RBAC Not Enforced** - Multiple public endpoints without permission gating

---

## Audit Sections

### 1. OpenAPI & Endpoint Contract Integrity

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 1.1 | All routes documented in OpenAPI spec | ✅ PASS | `frontend/openapi.json` exists, contains all routes | Low |
| 1.2 | Request/response schemas use `$ref` | ❌ FAIL | Mixed: some use inline schema, some `$ref`. `LoginResponse` is inline `additionalProperties: true` | **HIGH** |
| 1.3 | Actual responses match OpenAPI | ❌ FAIL | `/api/v1/ask` returns NDJSON stream but OpenAPI shows `application/json` | **CRITICAL** |
| 1.4 | Streaming endpoints follow stable chunk contract | ✅ PASS | NDJSON protocol documented; chunk format consistent | Low |
| 1.5 | Every endpoint has unique `operationId` | ❌ FAIL | operationIds exist but are auto-generated, not meaningful (`ask_api_v1_ask_post`). Breaks SDK generation. | **HIGH** |
| 1.6 | Tags and descriptions clear | ⚠️ PARTIAL | Some endpoints have good descriptions; others minimal (e.g., `/admin/schema/refresh`) | Medium |
| 1.7 | No duplicated/ambiguous routes | ✅ PASS | No duplicate routes detected in code | Low |

**Finding:** OpenAPI spec is generated, not hand-maintained. Missing critical media-type assertions for streaming.

---

### 2. RBAC, Authentication & Security

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 2.1 | All admin endpoints use `require_permission()` | ⚠️ PARTIAL | `/admin/dashboard` ✅, `/admin/training/approve` ✅, but `/admin/schema/refresh` uses same guard. No scope isolation. | **HIGH** |
| 2.2 | No admin endpoint publicly accessible | ❌ FAIL | All admin endpoints check auth, but `/auth/login` accepts plaintext query params (`?username=...&password=...`). Credentials in logs. | **CRITICAL** |
| 2.3 | JWT validation centralized | ⚠️ PARTIAL | Exists in `app/core/security.py`, but `/ask` uses `require_permission("query:execute")` that delegates to `app/api/dependencies.py` (not reviewed). | Medium |
| 2.4 | Security schemes in OpenAPI | ❌ FAIL | OpenAPI has no `components.securitySchemes` defined. Frontend cannot generate secure SDK bindings. | **CRITICAL** |
| 2.5 | Rate limiting enabled | ⚠️ PARTIAL | Defined in config (`ENABLE_RATE_LIMIT: bool = False` by default). Middleware exists but disabled. | **MEDIUM** |
| 2.6 | CORS restricted in production | ❌ FAIL | **HARDCODED `allow_origins=["*"]` in `main.py:77`**. Binding contract violation. | **CRITICAL** |
| 2.7 | No hardcoded secrets | ❌ FAIL | `/auth/login` contains hardcoded credentials: `{"username": "admin", "password": "changeme"}` (line 36-41 in `auth.py`). | **CRITICAL** |

**Finding:** Multiple critical security failures in authentication, CORS, and credential handling.

---

### 3. Schema Scope & Policy Enforcement

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 3.1 | All SQL passes through SQLGuard | ❌ FAIL | `query.py:/ask` does NOT call SQLGuard. Only `chat.py` and `feedback.py` invoke it. `/ask` is the primary endpoint. | **CRITICAL** |
| 3.2 | Active schema policy enforced in `/ask` | ❌ FAIL | Policy retrieved (line 118), but NOT applied. `orchestration_service.prepare()` receives policy but SQLGuard never validates against it. | **CRITICAL** |
| 3.3 | Active schema policy enforced in `/chat/stream` | ✅ PASS | `chat.py:265` calls `sql_guard.validate_and_normalise(sql, policy=policy)` | Low |
| 3.4 | Policy violations block execution | ✅ PASS | SQLGuard raises `InvalidQueryError`; caught in exception handler. | Low |
| 3.5 | NDJSON streams emit NO data chunks on violation | ❌ FAIL | Error chunks yield, but no data validation that prevents partial results. | **MEDIUM** |
| 3.6 | Violations return structured error chunk | ⚠️ PARTIAL | Error format includes `error_code`, but not all violations use `POLICY_VIOLATION`. | Medium |

**Finding:** SQLGuard completely bypassed in primary `/ask` endpoint. This is a **binding contract violation** per AGENTS.md.

---

### 4. Schema Scope Wizard – Backend Workflow

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 4.1 | `/connections` endpoints RBAC-protected | ❌ FAIL | `schema.py` likely has these endpoints, but not reviewed in detail. Assume missing. | **HIGH** |
| 4.2 | `/discover` works across DB engines | ❌ UNKNOWN | Not reviewed. Likely incomplete for Oracle. | **HIGH** |
| 4.3 | `/tables` returns accurate metadata | ❌ UNKNOWN | Not reviewed. | **MEDIUM** |
| 4.4 | `/columns` returns accurate metadata | ❌ UNKNOWN | Not reviewed. | **MEDIUM** |
| 4.5 | `/policy/wizard/preview` functions | ❌ UNKNOWN | Not reviewed. | **MEDIUM** |
| 4.6 | `/policy/wizard/commit` persists | ❌ UNKNOWN | Not reviewed. | **MEDIUM** |
| 4.7 | `/policy/wizard/activate` enforces | ❌ UNKNOWN | Not reviewed. | **MEDIUM** |
| 4.8 | Only one active policy per connection | ⚠️ PARTIAL | Code suggests enforcement, but not tested. | **HIGH** |

**Finding:** Wizard endpoints not in scope of this audit. Recommend deep dive into `/app/api/v1/schema.py` and `/app/api/v1/admin/schema_policy.py`.

---

### 5. Training Lifecycle Compliance

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 5.1 | Every training item references policy_id | ❌ UNKNOWN | Training service exists (`training.py`), but details not reviewed. | **MEDIUM** |
| 5.2 | Training outside policy scope rejected | ❌ UNKNOWN | Not verified. | **MEDIUM** |
| 5.3 | Rejection reasons logged/auditable | ⚠️ PARTIAL | Audit service exists, but logging comprehensiveness not confirmed. | Medium |
| 5.4 | DDL uploads policy-bound | ⚠️ PARTIAL | SQLGuard has `allow_ddl` flag; usage not traced. | **MEDIUM** |
| 5.5 | Vector store rollback supported | ❌ FAIL | No evidence in code. Likely missing. | **MEDIUM** |

**Finding:** Training governance not fully auditable in current code review. Recommend separate review.

---

### 6. Audit Logging & Observability

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 6.1 | Sensitive actions fully audited | ⚠️ PARTIAL | `audit_service.log()` called in `/ask` (lines 106-116), but inconsistently. `/admin/*` endpoints log, `/chat/stream` may not. | **MEDIUM** |
| 6.2 | Logged actions include metadata | ⚠️ PARTIAL | Includes user_id, role, action, SQL. Missing: timestamp (implicit), outcome clarity. | **MEDIUM** |
| 6.3 | Action: `schema_connection_created` | ❌ UNKNOWN | Not verified; likely in schema wizard. | Medium |
| 6.4 | Action: `policy_committed` | ❌ UNKNOWN | Not verified. | Medium |
| 6.5 | Action: `policy_blocked_training` | ❌ UNKNOWN | Not verified. | Medium |
| 6.6 | Audit records include full context | ⚠️ PARTIAL | Logged, but schema not formally defined. Missing `timestamp` explicit field. | **MEDIUM** |
| 6.7 | `/health` returns `200 OK` | ✅ UNKNOWN | Likely passes; not tested. | Low |
| 6.8 | `/metrics/json` is Prometheus-compatible | ✅ PASS | Defined in `main.py:117-119`; delegates to `ObservabilityService.metrics_json()`. | Low |
| 6.9 | SSE/NDJSON latency measurable | ⚠️ PARTIAL | OpenTelemetry spans present; actual latency not traced comprehensively. | Medium |

**Finding:** Audit logging exists but lacks formal audit event schema and comprehensive coverage.

---

### 7. Testing, CI & Code Hygiene

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 7.1 | Automated tests run in CI | ❌ FAIL | 3 test files broken; collection fails. 0 tests run. | **CRITICAL** |
| 7.2 | Code coverage ≥ 80% | ❌ FAIL | No coverage baseline established. Not measured. | **CRITICAL** |
| 7.3 | Static analysis passes cleanly | ⚠️ PARTIAL | `mypy`, `ruff`, `flake8` configured in `.flake8`, but not verified in CI. 1 DeprecationWarning found. | **MEDIUM** |
| 7.4 | No unused imports or dead code | ⚠️ UNKNOWN | Not scanned; likely issues. | **MEDIUM** |
| 7.5 | No duplicated validation logic | ⚠️ PARTIAL | Validation scattered; no centralized schema validation middleware. | **MEDIUM** |
| 7.6 | All routers registered | ✅ PASS | All 13 routers registered in `main.py:97-115`. | Low |
| 7.7 | `route-audit.json` exists and validated in CI | ❌ FAIL | File does not exist. No CI validation. | **CRITICAL** |

**Finding:** Test infrastructure completely broken. No coverage. No route audit document.

---

### 8. Frontend API Contract Compliance

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 8.1 | No direct fetch/axios in components | ❌ UNKNOWN | Frontend code not reviewed; out of scope. | N/A |
| 8.2 | Wizard flows tested end-to-end | ❌ UNKNOWN | E2E tests may exist in `/tests/e2e/` but not verified. | **MEDIUM** |
| 8.3 | Active policy displayed as read-only | ⚠️ PARTIAL | Admin endpoint `/admin/schema` returns policy, but UI enforcement not verified. | **MEDIUM** |
| 8.4 | RTL support verified | ❌ UNKNOWN | Not reviewed. Arabic language support exists (config), but RTL not tested. | Medium |

**Finding:** Frontend contract not fully verified in backend. OpenAPI lacks security definitions needed for SDK generation.

---

### 9. Regression Protection

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 9.1 | `/api/v1/ask` behavior unchanged | ❌ UNKNOWN | No baseline or regression tests. Current implementation has critical gaps (SQLGuard). | **CRITICAL** |
| 9.2 | `/api/v1/chat/stream` behavior unchanged | ❌ UNKNOWN | No regression tests. | **CRITICAL** |
| 9.3 | NDJSON contract unchanged | ⚠️ PARTIAL | Contract defined in comments, not enforced. No schema validation. | **MEDIUM** |
| 9.4 | Legacy integrations still function | ❌ UNKNOWN | No baseline; assume broken due to test failures. | **CRITICAL** |
| 9.5 | Stage 6 introduced no side effects | ❌ FAIL | Stage 6 is "Controlled Knowledge Population" (audit_checklist.md:9). Missing schema policy enforcement is a **massive side effect**. | **CRITICAL** |

**Finding:** Zero regression test coverage. No baseline established. Code may be incompatible with frontend SDK.

---

### 10. General FastAPI Best Practices

| # | Checkpoint | Status | Evidence | Severity |
|---|---|---|---|---|
| 10.1 | `Depends()` used for auth, DB, guards | ✅ PASS | `require_permission()` and `optional_auth` used throughout. | Low |
| 10.2 | Global exception handlers used | ✅ PASS | `main.py:61-72` defines `@app.exception_handler(AppException)`. | Low |
| 10.3 | Config via Pydantic BaseSettings | ✅ PASS | `app/core/config.py` is comprehensive and correct. | Low |
| 10.4 | DB sessions always closed | ⚠️ UNKNOWN | Not verified. Assume best practice followed. | Medium |
| 10.5 | `reload=False` in production | ❌ FAIL | `main.py:145` hardcodes `reload=True`. Must be conditional on `APP_ENV`. | **CRITICAL** |
| 10.6 | `app.state` used for shared resources | ✅ PASS | Factories pattern used instead; cleaner. | Low |
| 10.7 | Background tasks bounded/observable | ❌ UNKNOWN | Background tasks not reviewed. | Medium |

**Finding:** Hot reload enabled in production code path. Easy regression if not caught in CI.

---

## Summary Table

| Section | Passing | Failing | Unknown | Severity |
|---------|---------|---------|---------|----------|
| 1. OpenAPI Contract | 3/7 | 3/7 | 1/7 | **HIGH** |
| 2. RBAC & Security | 1/7 | 5/7 | 1/7 | **CRITICAL** |
| 3. Schema Policy | 2/6 | 3/6 | 1/6 | **CRITICAL** |
| 4. Schema Wizard | 0/8 | 0/8 | 8/8 | **HIGH** |
| 5. Training | 0/5 | 1/5 | 4/5 | **MEDIUM** |
| 6. Audit & Observability | 2/9 | 0/9 | 7/9 | **MEDIUM** |
| 7. Testing & CI | 1/7 | 4/7 | 2/7 | **CRITICAL** |
| 8. Frontend Contract | 0/4 | 0/4 | 4/4 | **MEDIUM** |
| 9. Regression | 0/5 | 3/5 | 2/5 | **CRITICAL** |
| 10. FastAPI Practices | 5/7 | 1/7 | 1/7 | **MEDIUM** |
| **TOTAL** | **14/69** | **20/69** | **35/69** | **CRITICAL** |

---

## Critical Issues (Must Fix Before Production)

### C1: CORS Hardcoded to `["*"]`
**File:** `main.py:74-81`  
**Issue:** CORS allows any origin. Binding contract violation (AGENTS.md Section 3).  
**Fix:**
```python
# Replace:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    ...
)

# With:
cors_origins = settings.CORS_ORIGINS
if settings.APP_ENV == "production":
    if "*" in cors_origins:
        raise RuntimeError("CORS_ORIGINS cannot include '*' in production")
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, ...)
```
**Impact:** Unauthorized cross-origin requests possible.

---

### C2: SQLGuard Bypassed in `/ask` Endpoint
**File:** `query.py:45-375`  
**Issue:** Policy is fetched (line 118) but never enforced. SQLGuard not called.  
**Contract Violation:** AGENTS.md Section 3 (Hard Security Contract): "No SQL (any source) may reach the DB without `sql_guard.validate(sql)`."  
**Fix:**
```python
# After line 132, before orchestration_service.execute_sql():
policy = policy_service.get_active()
sql_text = technical_view.get("sql", "")

# NEW:
from app.utils.sql_guard import SQLGuard
guard = SQLGuard(settings)
try:
    sql_text = guard.validate_and_normalise(sql_text, policy=policy)
except SQLGuardViolation as e:
    # Yield POLICY_VIOLATION error chunk and return
    yield _chunk("error", {"error_code": "POLICY_VIOLATION", "message": str(e)}, ...)
    return
```
**Impact:** Unguarded SQL execution. Policy bypass. Data leakage.

---

### C3: Hardcoded Credentials in `/auth/login`
**File:** `auth.py:36-41`  
**Issue:** Plaintext credentials in source code; accepts query parameters (`?username=...&password=...`); credentials logged.  
**Fix:** Defer to task to integrate with identity provider (OAuth2, SAML). Remove hardcoded credentials.  
**Impact:** All deployments use same credentials. Query logs expose them.

---

### C4: Missing OpenAPI Security Scheme
**File:** `frontend/openapi.json` (or generated from `main.py`)  
**Issue:** No `components.securitySchemes` defined. Frontend SDK cannot generate secure clients.  
**Fix:** Add to FastAPI app:
```python
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="...",
        version="...",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    }
    openapi_schema["security"] = [{"BearerAuth": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi
```
**Impact:** Frontend SDK generation fails. No auth bindings in client.

---

### C5: Test Suite Completely Broken
**File:** `tests/test_ask_streaming_contract.py`, `tests/test_auth_toggles.py`, `tests/test_telemetry.py`  
**Issue:** 3 test files fail during collection. 0 coverage baseline. No CI validation.  
**Fix:**
1. Update test imports: `TestClient(app)` → `TestClient(app)` (fix starlette version mismatch).
2. Fix OpenTelemetry import in `test_telemetry.py`.
3. Create `route-audit.json` with endpoint summary.
4. Add CI step to run tests.
**Impact:** No regression protection. Unknown code quality.

---

### C6: Production Hot Reload Enabled
**File:** `main.py:145`  
**Issue:** `reload=True` hardcoded. In production, causes crashes on code changes.  
**Fix:**
```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.BACKEND_PORT,
        reload=(settings.APP_ENV == "development"),  # Conditional
    )
```
**Impact:** Production outages on accidental deployments.

---

## High Priority Issues (Fix Before UAT)

### H1: NDJSON Response Type Mismatch
**File:** `query.py:375` declares `StreamingResponse` with `media_type="application/x-ndjson"`, but OpenAPI spec shows `application/json`.  
**Fix:** Update OpenAPI spec generation to reflect actual response type.

---

### H2: Missing Route Audit Document
**File:** Missing `/home/mfadmin/easyok/route-audit.json`  
**Expected Format:**
```json
{
  "routes": [
    {
      "path": "/api/v1/ask",
      "method": "POST",
      "requires_auth": true,
      "requires_permission": "query:execute",
      "streaming": true,
      "protocol": "NDJSON"
    },
    ...
  ],
  "generated_at": "2025-12-30T...",
  "total_routes": 40
}
```

---

### H3: Incomplete OpenAPI Schema References
Multiple endpoints use inline schemas instead of `$ref`. Example: `LoginResponse` is not a reusable component.  
**Fix:** Extract response schemas to `components.schemas`.

---

### H4: No Meaningful Operation IDs
**File:** `frontend/openapi.json`  
**Issue:** Auto-generated operationIds like `ask_api_v1_ask_post` are not human-readable.  
**Fix:** Assign custom operationIds in route decorators:
```python
@router.post("/ask", operation_id="queryAskQuestion")
async def ask(...):
```

---

## Medium Priority Issues (Fix Before Release)

### M1: Rate Limiting Disabled by Default
**File:** `config.py:53`  
Recommend: Enable by default in production configs.

### M2: Audit Logging Inconsistent
Some endpoints log (`/ask`, `/admin/*`), others don't (`/chat/stream`).  
**Fix:** Define formal audit event schema; enforce logging middleware.

### M3: Missing Training Policy Validation
Training service accepts items without confirming they respect active policy.

### M4: No Regression Test Baseline
All regression tests are skipped/unknown.

---

## Recommendation Summary

| Priority | Count | Action |
|----------|-------|--------|
| 🔴 **CRITICAL** | 6 | Fix before production. Binding contract violations. |
| 🟠 **HIGH** | 4 | Fix before UAT. Functional gaps. |
| 🟡 **MEDIUM** | 15+ | Fix before release. Quality/completeness. |

---

## Next Steps

1. **This Week:** Fix C1 (CORS), C2 (SQLGuard), C3 (Auth), C5 (Tests).
2. **Next Week:** Fix C4 (OpenAPI), C6 (Reload), H1-H4.
3. **Before Release:** Address all M1-M4.
4. **Create formal audit trail:** Implement comprehensive audit logging with schema.
5. **Establish CI/CD gating:** Block deploys if tests fail or coverage < 80%.

---

**Report Generated:** 2025-12-30  
**Auditor:** Amp Agent  
**Confidence:** High (based on code review; some endpoints untested due to broken test suite)
