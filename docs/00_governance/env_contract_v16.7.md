# EasyData Environment Contract – v16.7

**Filename:** EasyData-Env-Contract-v16.7.md
**Status:** FINAL – GOVERNANCE BINDING
**Scope:** Configuration / Security / Deployment
**Applies To:** EasyData v16.7.x and later (unless superseded by ADR)

---

## 1. Authority & Purpose

This document defines the **authoritative environment configuration contract**
for EasyData v16.7.

It is **binding and non-negotiable**.

Any runtime, deployment, CI/CD pipeline, or operator **MUST comply** with
this contract in full.

This contract governs:

* Environment variable structure
* Security toggles and invariants
* Provider selection
* Feature enablement boundaries
* Preflight governance requirements

This document supersedes:

* Ad-hoc `.env` files
* Informal README instructions
* Implicit defaults
* Operator assumptions

---

## 2. Single Source of Truth Rule

The file **`.env.schema`** (derived from this contract) is the **single source of truth**
for environment structure.

Rules:

* `.env.schema` **MUST NOT** contain real secrets
* `.env.local`, `.env.ci`, `.env.production` **MAY** contain secrets as appropriate
* Variables not defined in `.env.schema` are considered **invalid**
* Code **MUST NOT** rely on undeclared variables

Clarification:

* This document (EasyData-Env-Contract-v16.7.md) is the authoritative governance contract.
* `.env.schema` is the canonical, versioned, and complete definition of all variables.
* All environment files **MUST be strict supersets** of `.env.schema`.
* In case of conflict, this document takes precedence over any derived file.

---

## 3. Security Baseline (Hard Constraints)

### 3.1 Secrets Policy

**Forbidden in `.env.schema`:**

* API keys
* Tokens
* Passwords
* Connection strings with credentials
* Private keys

Reference values MUST be empty or placeholders only, e.g.:

```
>>> CHANGE ME <<<
```

Violation = **Governance breach**

---

### 3.2 Authentication Toggles

| Variable           | Effect                         |
| ------------------ | ------------------------------ |
| AUTH_ENABLED=false | No authentication, JWT ignored |
| RBAC_ENABLED=false | Role checks disabled           |
| RLS_ENABLED=false  | Row-level security disabled    |

Rules:

* If `AUTH_ENABLED=false` → JWT, RBAC, and RLS are **ignored**
* Presence of JWT variables does **not** imply activation
* Any bypass is **permitted only when ENV=local**

---

### 3.3 Production Safety Rules

When `APP_ENV=production`:

* `DEBUG` **MUST** be `false`
* Admin or auth bypasses are forbidden
* Cache governance **MUST** be `revalidate`
* Database access **MUST** be read-only
* Telemetry visibility **MUST NOT** be disabled

---

## 4. Immutable vs Runtime Variables

### 4.1 Immutable (Startup-Critical)

Changing any of the following requires **explicit governance approval**:

* ENV
* APP_ENV
* DB_PROVIDER
* LLM_PROVIDER
* VECTOR_DB
* AUTH_ENABLED
* RBAC_ENABLED
* RLS_ENABLED

These are evaluated at startup and **MUST NOT drift silently**.

---

### 4.2 Runtime Feature Toggles

Runtime feature toggles may be modified **only via Admin API** (when enabled):

* ENABLE_SEMANTIC_CACHE
* ENABLE_RATE_LIMIT
* ENABLE_GZIP_COMPRESSION
* ENABLE_ARABIC_NLP
* ENABLE_RAGAS_EVALUATION
* ENABLE_SIGNOZ_ALERTS

Every change:

* Requires a reason
* Is audited
* Emits OpenTelemetry spans

---

## 5. Provider Exclusivity Rules

### 5.1 Database Provider

Only one DB provider is authoritative:

* If `DB_PROVIDER=oracle` → MSSQL variables are ignored
* If `DB_PROVIDER=mssql` → Oracle variables are ignored

Database users **MUST be read-only**.

Connection strings may be normalized internally but **must not alter credentials**.

---

### 5.2 LLM Provider

Only variables for the selected provider are authoritative.

Unused provider variables:

* May exist
* Must not be relied upon
* Must not be auto-selected

---

### 5.3 Vector Store

* `chromadb` → local path only
* `qdrant` → URL + API key required

Cross-provider access is forbidden.

---

## 6. Observability & Transparency

EasyData enforces **anti-deception observability**:

* Disabled ≠ silent
* No-op services MUST emit trace metadata
* All toggles must be visible in traces

Tracing and error correlation MUST include `trace_id`.

---

## 7. Preflight Governance Requirement

Before startup, the environment **MUST pass preflight checks**.

Preflight enforces:

* Structural correctness against `.env.schema`
* Provider exclusivity
* Secret presence where required
* Production safety rules
* Immutable variable drift detection

If preflight fails → **system MUST NOT start**.

---

## 8. Change Management

Any change to this contract requires:

1. New ADR
2. Explicit approval
3. Version bump (e.g. v16.8)

Silent edits are forbidden.

---

## 9. Final Verdict

This contract ensures that EasyData:

* Is deterministic at startup
* Is secure by default
* Cannot drift silently
* Preserves human authority
* Remains audit-ready

**This document is FINAL.**

Any deviation without ADR approval is an architectural violation.

---