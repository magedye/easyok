# EasyData Fortress — Master Governance & Implementation Plan

**Status:** FINAL — PRODUCTION READY
**Language:** English
**Last Updated:** December 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Governance Principles](#governance-principles)
3. [System Architecture](#system-architecture)
4. [Phase Execution Plan](#phase-execution-plan)
5. [Authentication & Authorization](#authentication--authorization)
6. [Data Architecture](#data-architecture)
7. [Streaming Contracts](#streaming-contracts)
8. [Security & Hardening](#security--hardening)
9. [CI/CD & Enforcement](#cicd--enforcement)
10. [Go-Live Runbook](#go-live-runbook)
11. [Troubleshooting & Rollback](#troubleshooting--rollback)

---

## Executive Summary

EasyData Fortress is a governed AI data system with strict separation of concerns, mandatory authentication, server-side authorization (RBAC), and immutable audit trails.

### Core Non-Negotiables
- **SQLite (later Postgres)** = System of Record (authoritative)
- **ChromaDB** = Semantic memory only (non-authoritative)
- **JWT + RBAC** = Identity & permissions enforcement
- **NDJSON** = Deterministic streaming with trace consistency
- **Fail-Closed** = Any ambiguity → denial, no bypass
- **Audit** = Every state change traced and logged

---

## Governance Principles

### 1. Single Source of Truth (SSOT)
`OrchestrationService` alone may:
- Generate SQL
- Call SQLGuard
- Enforce policies
- Make governance decisions
- Interact with LLM providers

**No other layer** may perform or duplicate these responsibilities.

### 2. Adapter-Only API Layer
All files under `app/api/v1/**` are protocol adapters.

**Allowed:**
- Request parsing
- Streaming format translation (NDJSON / SSE)
- Delegation to OrchestrationService
- Error mapping

**Forbidden:**
- SQL generation
- SQLGuard usage
- Policy evaluation
- LLM/provider calls
- Business logic

### 3. Fail-Closed by Default
Any misconfiguration, ambiguity, or violation results in request rejection.
There is **no permissive fallback**.

### 4. Hard-Fail on Startup
Unsafe configuration prevents service boot.

Violations logged with reason, process exits immediately.

---

## System Architecture

### Backend Components

```
FastAPI Application
├── API Layer (Adapters only)
│   ├── /api/v1/auth
│   ├── /api/v1/ask
│   ├── /api/v1/chat
│   └── /api/v1/admin
├── Core Services (SSOT)
│   ├── OrchestrationService
│   ├── SQLGuard
│   ├── SchemaPolicyService
│   └── AuditService
├── Guards (Startup & Runtime)
│   ├── PolicyGuard
│   ├── TrainingReadinessGuard
│   └── HTTPSProxyGuard
└── Data Layer
    ├── SQLite (System of Record)
    └── ChromaDB (Embeddings only)
```

### Storage Separation

| Layer | Storage | Purpose | Authoritative |
|-------|---------|---------|---------------|
| **Identity** | SQLite | Users, roles, tokens | ✅ SQLite |
| **Governance** | SQLite | Policies, decisions, audit | ✅ SQLite |
| **Training** | SQLite | Training items, versions | ✅ SQLite |
| **Embeddings** | ChromaDB | Vector similarity | ❌ ChromaDB |

**Rule:** When conflict occurs → SQLite decides.

---

## Phase Execution Plan

### Phase 0: Immutable Context (Foundation)
- Affirm hard baselines: FastAPI, NDJSON, JWT/RBAC
- Establish startup order (settings → guards → app init)
- Freeze storage decision: SQLite system DB, Chroma embeddings only
- Define hard-fail conditions

**Deliverable:** Startup order enforced; no bypass; settings load first.

---

### Phase 1: Authentication (JWT)

#### Requirements
```
ENV: Non-local environments only
AUTH_ENABLED=true
JWT_SECRET_KEY=<injected from Vault>
JWT_ALGORITHM=HS256
JWT_ISSUER=easydata-auth
JWT_AUDIENCE=easydata-api
JWT_EXPIRATION_MINUTES=60
```

#### Implementation
1. **JWT Endpoint** (`POST /api/v1/auth/login`)
   - Accept: username, password
   - Return: access_token, token_type, expires_in, trace_id
   - Token payload: sub, roles, trace_id, iss, aud, exp
   - Failed auth → 401 (no info leak)

2. **JWT Validation (Dependencies)**
   - Missing token → 401
   - Invalid signature → 401
   - Expired token → 401
   - All requests include trace_id

3. **Startup Guard**
   - If AUTH_ENABLED=true and JWT_SECRET_KEY missing → Hard Fail
   - Log fatal error, exit process

#### Tests
- ✅ Valid token → request allowed
- ✅ Missing token → 401
- ✅ Invalid signature → 401
- ✅ Expired token → 401
- ✅ Token payload contains sub, roles, trace_id

---

### Phase 2: Authorization (RBAC)

#### Requirements
```
RBAC_ENABLED=true
RBAC_STRICT_MODE=true
RBAC_DEFAULT_ROLE=viewer
RBAC_ADMIN_ROLE=admin
```

#### Implementation
1. **Role Hierarchy**
   - admin: all permissions
   - analyst: data access, training approval
   - viewer: read-only access

2. **Permission Enforcement**
   ```python
   @app.get("/api/v1/admin/toggle/{toggle_id}")
   async def toggle_feature(
       toggle_id: str,
       user=Depends(require_permission("admin:*"))
   ):
       # Only users with admin:* permission can reach here
   ```

3. **Denial Behavior**
   - Missing permission → 403 Forbidden
   - Log to audit with trace_id, user_id, action, status
   - Include reason in error response

#### Tests
- ✅ viewer role on admin endpoint → 403
- ✅ analyst cannot approve training
- ✅ admin-only operations audit denial
- ✅ RBAC_ENABLED=false allows access per auth level

---

### Phase 3: Training Readiness Guard

#### Requirements
```
ENABLE_AUDIT_LOGGING=true (non-local)
TRAINING_READINESS_ENFORCED=true (non-local)
Active SchemaAccessPolicy required (non-local)
```

#### Implementation
1. **Startup Check**
   - Non-local: audit must be enabled
   - Non-local: active policy must exist
   - Non-local: training enabled requires readiness
   - Local: optional bypass if explicitly configured

2. **Hard-Fail Conditions**
   - Audit disabled in production → exit
   - No policy in production → exit
   - Training enabled without readiness → exit

#### Tests
- ✅ Non-local without audit → startup fails
- ✅ Local with TRAINING_READINESS_ENFORCED=false → warning, continue
- ✅ Training only available when guard passes

---

### Phase 4: NDJSON Streaming Integrity

#### Canonical Order
```
thinking
  → technical_view
    → data
      → business_view
        → end
```

#### Invariants
- **Single trace_id** across all chunks in stream
- **Deterministic ordering** enforced
- **No chunks after** error or end
- **Error chunk** is flat (no payload wrapper)

#### Error Chunk Specification
```json
{
  "type": "error",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-31T12:34:56.789Z",
  "error_code": "SQL_GUARD_VIOLATION",
  "message": "Dangerous SQL pattern detected",
  "lang": "en"
}
```

#### Runtime Guards
- Out-of-order chunk → terminate stream, log violation
- Trace ID mismatch → terminate stream, log violation
- Any chunk after error/end → reject, log violation

#### Tests
- ✅ Strict order maintained
- ✅ Single trace_id per stream
- ✅ Error chunk is flat
- ✅ Order violation terminates stream

---

### Phase 5: HTTPS & Proxy Hardening

#### Requirements
```
HTTPS_ENFORCE=true (non-local)
X-FORWARDED-PROTO validation required
TLS 1.2/1.3 minimum
```

#### Implementation
1. **Proxy Validation**
   - Check X-Forwarded-Proto header
   - If AUTH_ENABLED=true, reject plain HTTP
   - Return 400/403 on validation failure

2. **TLS Enforcement**
   - Reverse proxy terminates TLS
   - Backend validates forwarded protocol
   - Secrets never sent over HTTP

#### Tests
- ✅ Missing X-Forwarded-Proto → 400 (when required)
- ✅ X-Forwarded-Proto=http with AUTH_ENABLED → 403
- ✅ Valid HTTPS request → allowed

---

### Phase 6: Feature Toggles & Audit

#### Requirements
```
Backend-managed toggles only
UI read-only
Changes via Admin API only
Every change requires audit
```

#### Implementation
1. **Admin API**
   ```python
   @app.put("/api/v1/admin/toggles/{toggle_id}")
   async def update_toggle(
       toggle_id: str,
       request: UpdateToggleRequest,
       user=Depends(require_permission("admin:*"))
   ):
       # request.reason is mandatory
       # Audit log: user, action, reason, trace_id, timestamp
   ```

2. **Frontend Behavior**
   - Read toggles from `/admin/settings/feature-toggles`
   - Display as read-only
   - No local state mutation
   - Submit changes to backend only

#### Tests
- ✅ Toggle mutation outside admin API → 403
- ✅ Every toggle change audited with reason
- ✅ UI cannot mutate toggles locally

---

### Phase 7: Observability & Audit

#### Requirements
```
ENABLE_AUDIT_LOGGING=true
ENABLE_OTEL=true (optional, respects env)
OTEL_SERVICE_NAME=easydata-backend
OTEL_EXPORTER_OTLP_ENDPOINT=<collector>
OTEL_SAMPLER_RATIO=0.1
```

#### Audit Events
Every event must include:
- **trace_id:** Request correlation ID
- **user_id:** Subject from JWT (if authenticated)
- **action:** What happened (login, rbac_denial, toggle_change, etc.)
- **status:** success / failure
- **timestamp:** ISO8601
- **reason:** Why (optional for some events)

#### Searchable By
- trace_id (correlates frontend/backend)
- user_id (user activity)
- action (event type)
- timestamp (time range)

#### Tests
- ✅ Every request generates trace_id
- ✅ Critical actions logged to audit
- ✅ Audit searchable by trace_id
- ✅ OTEL exports when enabled

---

### Phase 8: CI/CD Gates

#### Blocking Checks (Must Pass Before Merge)
1. **Syntax Check:** `bash -n verify_backend.sh`
2. **Environment Schema:** `python check_env_schema_parity.py`
3. **Unit Tests:** `pytest -q -rs` (with AUTH_ENABLED=true)
4. **Linting:** `flake8 app`
5. **OpenAPI:** Spectral validation on fortress.yaml
6. **Governance:** No forbidden patterns in code

#### Non-Blocking (Nightly/Optional)
- Backend smoke tests
- Playwright E2E tests
- Performance benchmarks

#### Forbidden Patterns (CI Must Reject)
- `import sqlalchemy` in `app/api/v1/**`
- `SQLGuard` call in API layer
- `policy.evaluate` in API layer
- LLM provider calls in API layer
- JWT over HTTP
- Frontend permission logic
- Secrets in repository

#### Tests
- ✅ All blocking gates green
- ✅ No skipped governance tests
- ✅ No forbidden patterns detected

---

### Phase 9: Startup Guards (Hard Fail Summary)

Service MUST NOT start if any of the following:

1. **Authentication Failure**
   - AUTH_ENABLED=true and JWT_SECRET_KEY missing
   - AUTH_ENABLED=true and JWT_ISSUER/AUDIENCE unconfigured

2. **Authorization Failure**
   - RBAC_ENABLED=true without role configuration

3. **Audit Failure**
   - ENABLE_AUDIT_LOGGING=false in non-local environment

4. **Training Failure**
   - Training enabled without readiness requirements met
   - TRAINING_READINESS_ENFORCED=false in production

5. **Policy Failure**
   - No active SchemaAccessPolicy in non-local
   - Policy evaluation fails

6. **Transport Failure**
   - HTTPS enforcement misconfigured
   - X-Forwarded-Proto validation fails

#### Behavior
- Log fatal error with specific reason
- Exit process immediately (exit code 1)
- No try/except suppression allowed

#### Tests
- ✅ Missing JWT secret → Hard Fail
- ✅ Audit disabled in production → Hard Fail
- ✅ No policy in production → Hard Fail

---

### Phase 10: Forbidden Patterns

### Absolute Prohibitions
1. **JWT over HTTP:** JWTs transmitted only over HTTPS
2. **SQL in API:** No SQL generation, validation in adapter layer
3. **Frontend Permissions:** No permission logic in frontend code
4. **Silent Guards:** No try/except around security guards
5. **Secrets in Code:** No secrets committed; use Vault/CI injection
6. **Env Outside Schema:** All variables in .env.schema and settings.py

### Detection
- CI static checks (grep assertions)
- Code review
- Runtime guards

### Consequence
- CI failure (blocks merge)
- Startup refusal (hard fail)
- Runtime rejection (403/401)

---

## Authentication & Authorization

### JWT Lifecycle

1. **Generation** (`POST /api/v1/auth/login`)
   - Validate credentials
   - Generate token with claims
   - Return with expiration

2. **Transmission**
   - Header: `Authorization: Bearer <token>`
   - HTTPS only
   - Never in URL/body

3. **Validation** (Every request)
   - Signature verification
   - Expiration check
   - Audience validation
   - Issuer validation

4. **Refresh** (Optional)
   - Refresh token endpoint
   - Return new access token
   - Old token invalidated

### Token Payload
```json
{
  "sub": "user123",
  "roles": ["admin"],
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "iss": "easydata-auth",
  "aud": "easydata-api",
  "exp": 1704067200
}
```

### RBAC Permission Matrix

| Role | Auth | Training Read | Training Write | Admin | Policy |
|------|------|---------------|----------------|-------|--------|
| viewer | ✅ | ✅ | ❌ | ❌ | ❌ |
| analyst | ✅ | ✅ | ✅ (approve) | ❌ | ❌ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Data Architecture

### SQLite Schema (System of Record)

#### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(128) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### roles
```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### user_roles
```sql
CREATE TABLE user_roles (
  user_id INTEGER NOT NULL,
  role_id INTEGER NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

#### schema_access_policies
```sql
CREATE TABLE schema_access_policies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  enforced_globally BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### training_items
```sql
CREATE TABLE training_items (
  id SERIAL PRIMARY KEY,
  created_by_user_id INTEGER NOT NULL,
  created_by_role VARCHAR(50) NOT NULL,
  trace_id VARCHAR(255) UNIQUE NOT NULL,
  policy_version_id INTEGER,
  status VARCHAR(50) DEFAULT 'draft',
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  FOREIGN KEY (policy_version_id) REFERENCES policy_versions(id)
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  trace_id VARCHAR(255) NOT NULL,
  user_id INTEGER,
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### feature_toggles
```sql
CREATE TABLE feature_toggles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ChromaDB (Non-Authoritative)
- Stores embeddings only
- References training_items by ID
- No governance decisions made here
- Rebuildable from SQLite

---

## Streaming Contracts

### NDJSON Contract (/ask)

**Format:** Newline-delimited JSON

**Strict Order:**
```
1. {"type": "thinking", "trace_id": "...", ...}
2. {"type": "technical_view", "trace_id": "...", ...}
3. {"type": "data", "trace_id": "...", ...}
4. {"type": "business_view", "trace_id": "...", ...}
5. {"type": "end", "trace_id": "...", "status": "success"}
```

**Error Path:**
```
1. {"type": "thinking", "trace_id": "...", ...}
2. {"type": "error", "trace_id": "...", "error_code": "...", "message": "..."}
3. {"type": "end", "trace_id": "...", "status": "error"}
```

**Invariants:**
- Single trace_id throughout
- No reordering allowed
- Stream terminated on violation
- Error chunks are flat (no payload wrapper)

### SSE Adapter Contract (/chat/stream)

**Adapter-only:** Translates NDJSON to SSE
- Maintains trace_id
- Preserves order
- Maps error chunk format
- No additional processing

---

## Security & Hardening

### Authentication Hardening
- ✅ Minimum password length: 12 characters
- ✅ Bcrypt/passlib for password hashing
- ✅ Token expiration: 60 minutes (configurable)
- ✅ Refresh token: 1440 minutes (1 day)
- ✅ No password in logs
- ✅ No token in logs (redact if necessary)

### Authorization Hardening
- ✅ RBAC checked on every privileged operation
- ✅ Principle of least privilege (default to viewer)
- ✅ No client-side permission checks
- ✅ All denials logged

### Transport Hardening
- ✅ HTTPS mandatory (non-local)
- ✅ TLS 1.2+ only
- ✅ X-Forwarded-Proto validation
- ✅ HSTS headers (if applicable)

### Data Hardening
- ✅ Sensitive data in SQLite only
- ✅ No secrets in ChromaDB
- ✅ Audit trail immutable
- ✅ No direct table access (API only)

---

## CI/CD & Enforcement

### Pre-Merge Gate (Blocking)
```bash
bash -n verify_backend.sh
python check_env_schema_parity.py
pytest -q -rs
flake8 app
spectral lint fortress.yaml
```

### Startup Checks
```python
# Pseudo-code
if AUTH_ENABLED and not JWT_SECRET_KEY:
    logger.critical("JWT_SECRET_KEY missing")
    exit(1)

if not ENABLE_AUDIT_LOGGING and ENV != "local":
    logger.critical("Audit disabled in non-local")
    exit(1)

if TRAINING_READINESS_ENFORCED and not active_policy:
    logger.critical("No active policy")
    exit(1)
```

### Runtime Guards
- JWT validation on every request
- RBAC check on privileged operations
- Streaming order enforcement
- Audit event creation

---

## Go-Live Runbook

### Pre-Launch Checklist

#### 1. Environment Sanity
- [ ] ENV=production
- [ ] AUTH_ENABLED=true
- [ ] RBAC_ENABLED=true
- [ ] ENABLE_AUDIT_LOGGING=true
- [ ] No bypass flags enabled
- [ ] All secrets injected from Vault

#### 2. Database
- [ ] initialize_fortress.py executed successfully
- [ ] Admin user created
- [ ] Roles populated (admin, analyst, viewer)
- [ ] Default policy active
- [ ] Connection test passed

#### 3. Authentication
- [ ] Login endpoint works
- [ ] Token generation includes trace_id
- [ ] Expired token returns 401
- [ ] Missing token returns 401

#### 4. Authorization
- [ ] Viewer cannot access admin endpoints
- [ ] Analyst cannot approve training
- [ ] RBAC denial logged

#### 5. Frontend
- [ ] Discovery endpoints called
- [ ] GovernanceContext initialized
- [ ] Token stored in sessionStorage
- [ ] Authorization headers injected
- [ ] 401 triggers logout

#### 6. NDJSON
- [ ] Strict order maintained
- [ ] trace_id consistent
- [ ] Error chunk format correct
- [ ] Order violation terminates stream

#### 7. Audit
- [ ] Audit table contains events
- [ ] Events searchable by trace_id
- [ ] User actions logged

#### 8. CI/CD
- [ ] All blocking gates green
- [ ] No governance tests skipped
- [ ] No forbidden patterns detected

### Launch Decision
- **GO:** All items checked and passing
- **NO-GO:** Any item unchecked or failing → hold deployment

---

## Troubleshooting & Rollback

### Common Issues

#### 1. Startup Hard-Fail: "JWT_SECRET_KEY missing"
**Solution:**
```bash
export JWT_SECRET_KEY="<value from Vault>"
# Restart service
```

#### 2. 401 on Every Request
**Check:**
- [ ] JWT_SECRET_KEY matches issuer
- [ ] Token not expired
- [ ] Authorization header format correct: `Authorization: Bearer <token>`

#### 3. 403 Despite Valid Token
**Check:**
- [ ] User role assigned
- [ ] Role has required permission
- [ ] RBAC_ENABLED=true

#### 4. NDJSON Order Violation
**Check:**
- [ ] OrchestrationService emitting in strict order
- [ ] No client-side reordering
- [ ] No chunks after error/end

#### 5. Audit Not Logging
**Check:**
- [ ] ENABLE_AUDIT_LOGGING=true
- [ ] audit_logs table exists
- [ ] No database errors

### Rollback Procedure
1. **Stop traffic** to new version
2. **Redeploy previous** version from tagged release
3. **Verify** startup checks pass
4. **Confirm** audit trail continuity
5. **Investigate** root cause in staging

---

## Hard Failure Clause

Any requirement in this plan that **cannot be satisfied** must be treated as a **critical failure**:

- ❌ Service refuses to start
- ❌ CI fails the build
- ❌ Deployment is blocked
- ❌ Team notified immediately

**There is no grace period. Governance cannot be softened.**

---

## Document Hierarchy

This plan is authoritative. Any document that contradicts it is subordinate and must be corrected.

**Hierarchy:**
1. This Master Plan (Binding)
2. ADRs (Binding)
3. Security Execution Docs (Binding)
4. Runbooks (Operational)
5. Bootstrap Scripts (One-time)

---

**End of Master Governance Plan**
