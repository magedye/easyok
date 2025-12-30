# EasyData v16.7

## Agents Development & Governance Guidelines

### Deterministic · Governed · Enterprise-Grade

**Status: Binding Architectural and Behavioral Contract**

---

## 1. Deterministic Reasoning Mode (MANDATORY)

All AI agents operating on the EasyData project **MUST** operate in a
**low-variance, deterministic reasoning mode**, equivalent to an effective
temperature ≈ **0.1**.

This is **not a preference**.  
It is a **hard behavioral constraint**.

### Agents MUST:

- Produce **deterministic, explicit, reproducible** outputs.
- Prefer **implementation-oriented** responses over conceptual or exploratory language.
- Follow **existing documentation, ADRs, enforced OpenAPI contracts, and configuration
  exactly as written**.
- Select the **most conservative and least disruptive option** when multiple valid
  choices exist.
- Ensure every output is:
  - traceable to an existing rule or document
  - directly actionable
  - consistent with current architecture

### Agents MUST NOT:

- Introduce assumptions, reinterpretations, or alternatives unless:
  - explicitly requested, or
  - required to resolve a documented ambiguity.
- Propose refactors, architectural changes, or “improvements” unless explicitly instructed.
- Deviate from established contracts “for best practice” or convenience.

**Goal:**  
Eliminate architectural drift, ambiguity, and inconsistent agent behavior.

---

## 2. Single Sources of Truth (Mandatory References)

Before any change, agents **MUST** consult the following authoritative sources:

| Artifact | Purpose |
|--------|---------|
| `openapi/fortress.yaml` | Canonical OpenAPI root specification (entry point) |
| `openapi/paths.yaml` | All endpoints with RBAC, risk, audit, and policy metadata |
| `openapi/schemas.yaml` | Request/response domain models |
| `openapi/streaming.yaml` | NDJSON / SSE streaming contracts |
| `openapi/errors.yaml` | Unified error models |
| `openapi/generator/spectral-rules.yaml` | CI-enforced governance rules (RBAC, policy binding, audit, streaming) |
| `adr_arch_dec_record.md` | Architectural Decision Records (ADR) |
| `security_permissions_matrix.md` | RBAC, SQL firewall, JWT, RLS |
| `software_requirements_spec.md` | Functional & non-functional requirements |
| `project_design_document.md` | System architecture, services, workflows |
| `guidelines.md` | Canonical structure, configuration, conventions |

**OpenAPI is the single executable source of truth.**

Standalone API contract documents (e.g. `master_api_contract.md`)
are **deprecated, forbidden, and MUST NOT be introduced**.

If ambiguity exists:

- Create a new ADR.
- **Do not infer or reinterpret silently.**

---

## 3. Hard Security Contract (v16.3+) — NON-NEGOTIABLE

### SQLGuard

- **SQLGuard is mandatory.**
- No SQL (LLM, Vanna, training, cache, any source) may reach the DB without:

```

sql_guard.validate(sql)

```

- Any direct execution (`db.execute(sql)`) is a **security bug**.

### Validation

- AST-based only (`sqlglot`, Oracle dialect).
- Enforces:
- statement type gating (SELECT / WITH only by default)
- DDL/DML detection
- table & column inspection

### SchemaAccessPolicy

- Binding and enforced at **table and column level**.
- Any out-of-policy reference:
- raises `SECURITY_VIOLATION`
- stops execution immediately
- is audited

### Execution Path

- `/ask` is the **only** authorized execution path.
- Must:
- stream NDJSON
- emit `technical_view` first
- enforce SQLGuard unconditionally

### Audit & Failure Semantics

- Action: `Blocked_SQL_Attempt`
- Includes: question, SQL, violation reason
- **Fail fast**:
```

error_code: SECURITY_VIOLATION

```
- No recovery, no correction, no silent failure.

Agents MUST NOT:

- bypass SQLGuard
- introspect live DB schema outside policy
- generate SQL without policy awareness
- break NDJSON or SSE streaming contracts

---

## 4. Architectural Rules (Binding)

### 4.1 Contract First (Governed)

- Contract First refers **exclusively** to the modular OpenAPI specification
under `/openapi`.
- Governance metadata (`x-permissions`, `x-risk`, `x-audit-required`,
`x-policy-bound`) is **binding**, not descriptive.
- Implementation MUST reflect OpenAPI exactly.
- Frontend and SDK stability depends on this.

Standalone API contract documents are **forbidden**.

### 4.2 Structured Monolith Only

- No microservices.
- No ad-hoc modules.
- Follow `guidelines.md` and `project_design_document.md`.

### 4.3 Single Source of Truth (SSOT)

- All configuration via `.env` → `core/config.py`.
- No hard-coded values.
- `.env.example` required for new variables.

### 4.4 Python Environment (PEP 668)

- Always use `./.venv/`.
- Never install system-wide packages.
- Never use `--break-system-packages`.

### 4.5 Lazy Loading

- Providers instantiated via `providers/factory.py`.
- Avoid global imports of DB drivers or LLM clients.

### 4.6 Stateless Services

- No in-memory state across requests.
- Persistence only via DB or vector store.

### 4.7 Isolation of Concerns

- `core/` → config, constants, exceptions, security
- `providers/` → concrete providers only
- `services/` → business logic only
- `api/` → routing & DI only

### 4.8 Middleware

- Cross-cutting concerns only.
- Must be toggleable via `.env`.

---

## 5. RBAC & Feature Toggle Governance (v16.7)

### Critical Rule

- Feature toggles **MUST NOT** be changed directly from UI.
- UI is **read-only** for feature state.

All changes MUST:

- go through **Admin Feature Toggle API**
- be **admin-only**
- require a **reason**
- be **audited**
- emit **OpenTelemetry spans**

Agents MUST NOT:

- add UI-level toggles without backend enforcement
- allow non-admin toggle changes
- modify `.env` or config at runtime

---

## 6. Streaming, Errors & Reliability

- `/api/v1/ask` must stream NDJSON.
- `/chat/stream` must use SSE exactly as defined in OpenAPI.
- Chunk order and semantics are **contractual**.
- No data chunks may be emitted after policy or security violations.
- Use circuit breakers for external calls.
- Use unified exceptions from `core/exceptions.py`.

Streaming schemas are compatibility-sensitive.
Breaking changes are forbidden.

---

## 7. Testing & Documentation

- Unit tests for critical logic are mandatory.
- Any non-trivial decision → ADR.
- Update SRS if requirements evolve.

### OpenAPI Governance Enforcement

- OpenAPI specifications are enforced via CI using the project Spectral ruleset.
- Spectral **errors** are blocking by default.
- Spectral **warnings** are non-blocking unless explicitly escalated.

Any OpenAPI change that fails CI is invalid by definition.

---

## 8. Agent Development Workflow

1. **Plan** — identify requirement, consult authoritative artifacts.
2. **Contracts** — update modular OpenAPI first.
3. **Implement** — providers/services only.
4. **Wire API** — routes only, no logic.
5. **Secure** — SQLGuard, RLS, RBAC.
6. **Test & Document** — tests + ADR.
7. **Review & Commit** — deterministic, minimal diffs.

---

## 9. Operational Readiness & Execution Closure (v16.7+)

### Execution Closure Rule

When a Stage is formally closed for execution:

- The stage becomes **non-blocking**.
- All further work is **report-only** unless a runtime or security regression
is detected.

Agents MUST NOT:

- Block delivery due to:
- documentation gaps
- Spectral warnings
- test harness incompatibilities
- tooling or version mismatches
- Re-open a closed stage without explicit authorization.

### Definition of Blocking Issues

Only the following MAY block delivery after stage closure:

- Runtime crash or startup failure
- Security regression (RBAC, SQLGuard, data leakage)
- Contract break affecting active clients

Everything else MUST be reported as observations.

---

## 10. Operational Health Gate (Mandatory)

Agents MUST respect the backend startup health gate:

- `/ask` and `/chat/stream` MUST NOT be considered available unless:
- LLM provider = OK
- Database = OK
- Vector store = OK

Process boot alone does NOT imply readiness.

---

## 11. Execution Verification Authority

Agents performing verification MUST use the canonical:

`Execution-Ready Checklist.md`

Rules:

- Checklist results are authoritative.
- Pass / Fail / N/A states MUST be respected.
- CI severity rules defined there override ad-hoc judgment.
- Verification after stage closure is **report-only** by default.

---

## 12. Final Seal

This document is a **binding architectural and behavioral contract**.

Any agent output that violates:

- deterministic reasoning
- OpenAPI governance enforcement
- SQLGuard enforcement
- SchemaAccessPolicy
- admin-only governance
- streaming contracts
- execution-closure rules

is **invalid and must be rejected**.

Reintroducing non-enforced API contract documents is **forbidden**.

---

### Final Note

This unified guideline ensures that **every agent behaves like a senior,
risk-averse, enterprise engineer**, not a creative assistant.

Deviation is not flexibility —  
**it is an architectural violation.**
```

---

## الوضع النهائي

* ✔️ `agents.md` الآن **متزامن بالكامل** مع:

  * Modular OpenAPI
  * Spectral CI enforcement
  * Stage 6 closure
* ✔️ لا توجد مراجع ميتة
* ✔️ لا يوجد مجال تفسير
* ✔️ جاهز للاعتماد الفوري