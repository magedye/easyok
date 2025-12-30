dBelow is a **clean, execution-ready internal document in English**, written in a **formal, professional, and direct style**, suitable for **internal audit, QA review, or architectural compliance validation**.

---

# EasyData v16.7.9 (Fortress)

## Internal Quality Assurance & Architecture Compliance Checklist

**Focus:** Stage 6 — Controlled Knowledge Population
**Scope:** EasyData + reusable for any advanced FastAPI-based system
**Objective:** Ensure correctness, security, policy enforcement, and long-term maintainability while avoiding common and recurring FastAPI pitfalls.

---

## 1. OpenAPI & Endpoint Contract Integrity

**Objective:** Guarantee API consistency, SDK compatibility, and contract stability.

| Checkpoint                                                          | Status | Notes                       |
| ------------------------------------------------------------------- | ------ | --------------------------- |
| All routes are documented in the official OpenAPI spec              | ☐      | No undocumented endpoints   |
| All request/response schemas are defined under `components.schemas` | ☐      | Prefer `$ref` usage         |
| Actual responses match OpenAPI definitions exactly                  | ☐      | Including error models      |
| Streaming endpoints (NDJSON / SSE) follow a stable chunk contract   | ☐      | No breaking changes         |
| Every endpoint has a unique `operationId`                           | ☐      | Required for SDK generation |
| Tags and descriptions are clear and accurate                        | ☐      | Improves OpenAPI UI clarity |
| No duplicated or ambiguous routes exist                             | ☐      | e.g. `/admin/admin/...`     |

---

## 2. RBAC, Authentication & Security

**Objective:** Enforce strict access control and eliminate accidental exposure.

| Checkpoint                                                   | Status | Notes                          |
| ------------------------------------------------------------ | ------ | ------------------------------ |
| All administrative endpoints use `require_permission(...)`   | ☐      | No reliance on `optional_auth` |
| No admin endpoint is publicly accessible                     | ☐      | Zero exceptions                |
| JWT validation is centralized and reliable                   | ☐      | `/auth/validate` or equivalent |
| Security schemes are defined in OpenAPI and enforced in code | ☐      | BearerAuth                     |
| Rate limiting or abuse protection is enabled                 | ☐      | e.g. `slowapi`                 |
| CORS is restricted in production                             | ☐      | Never `["*"]`                  |
| Secrets are never hardcoded                                  | ☐      | Environment-based only         |

---

## 3. Schema Scope & Policy Enforcement

**Objective:** Prevent data leakage and enforce governance at execution time.

| Checkpoint                                              | Status | Notes               |
| ------------------------------------------------------- | ------ | ------------------- |
| All SQL passes through SQLGuard before execution        | ☐      | Mandatory           |
| Active schema policy is enforced in `/ask`              | ☐      | No bypass           |
| Active schema policy is enforced in `/chat/stream`      | ☐      | Including streaming |
| Policy violations block execution entirely              | ☐      | No partial results  |
| NDJSON/SSE streams emit **no data chunks** on violation | ☐      | Critical            |
| Violations return a structured error chunk:             | ☐      | `POLICY_VIOLATION`  |

**Required error format:**

```json
{
  "error_code": "POLICY_VIOLATION",
  "message": "...",
  "lang": "ar/en"
}
```

---

## 4. Schema Scope Wizard – Backend Workflow

**Objective:** Ensure end-to-end policy creation without hidden breaks.

| Checkpoint                                              | Status | Notes                  |
| ------------------------------------------------------- | ------ | ---------------------- |
| `/connections` endpoints implemented and RBAC-protected | ☐      |                        |
| `/discover` works reliably across DB engines            | ☐      | Oracle issues resolved |
| `/tables` returns accurate metadata                     | ☐      |                        |
| `/columns` returns accurate metadata                    | ☐      |                        |
| `/policy/wizard/preview` functions correctly            | ☐      |                        |
| `/policy/wizard/commit` persists correctly              | ☐      |                        |
| `/policy/wizard/activate` enforces activation rules     | ☐      |                        |
| Only one active policy per connection                   | ☐      | Enforced               |

---

## 5. Training Lifecycle Compliance

**Objective:** Prevent uncontrolled or out-of-scope knowledge ingestion.

| Checkpoint                                                    | Status | Notes     |
| ------------------------------------------------------------- | ------ | --------- |
| Every training item references `policy_id` or `connection_id` | ☐      | Mandatory |
| Training outside policy scope is automatically rejected       | ☐      |           |
| Rejection reasons are logged and auditable                    | ☐      |           |
| DDL uploads are policy-bound                                  | ☐      |           |
| Vector store rollback is supported (if implemented)           | ☐      |           |

---

## 6. Audit Logging & Observability

**Objective:** Enable traceability, compliance, and operational insight.

| Checkpoint                               | Status | Notes                                                      |
| ---------------------------------------- | ------ | ---------------------------------------------------------- |
| Sensitive actions are fully audited      | ☐      |                                                            |
| Logged actions include:                  | ☐      |                                                            |
| • `schema_connection_created`            | ☐      |                                                            |
| • `policy_committed`                     | ☐      |                                                            |
| • `policy_blocked_training`              | ☐      |                                                            |
| Audit records include full context:      | ☐      | user_id, role, action, timestamp, outcome, payload_summary |
| `/health` returns `200 OK` consistently  | ☐      |                                                            |
| `/metrics/json` is Prometheus-compatible | ☐      |                                                            |
| SSE/NDJSON latency is measurable         | ☐      |                                                            |

---

## 7. Testing, CI & Code Hygiene

**Objective:** Maintain long-term stability and prevent silent regressions.

| Checkpoint                                       | Status | Notes              |
| ------------------------------------------------ | ------ | ------------------ |
| Automated tests run in CI                        | ☐      |                    |
| Code coverage ≥ 80%                              | ☐      |                    |
| Static analysis passes cleanly                   | ☐      | mypy, ruff, flake8 |
| No unused imports or dead code                   | ☐      |                    |
| No duplicated validation logic                   | ☐      | Prefer middleware  |
| All routers are registered                       | ☐      | No orphan routers  |
| `route-audit.json` exists and is validated in CI | ☐      |                    |

---

## 8. Frontend API Contract Compliance (If Applicable)

**Objective:** Prevent frontend-backend contract drift.

| Checkpoint                                       | Status | Notes                 |
| ------------------------------------------------ | ------ | --------------------- |
| No direct `fetch` or `axios` usage in components | ☐      | Use `rest.ts + hooks` |
| Wizard flows tested end-to-end                   | ☐      |                       |
| Active policy displayed as read-only             | ☐      |                       |
| RTL support verified                             | ☐      |                       |

---

## 9. Regression Protection

**Objective:** Ensure backward compatibility.

| Checkpoint                               | Status | Notes |
| ---------------------------------------- | ------ | ----- |
| `/api/v1/ask` behavior unchanged         | ☐      |       |
| `/api/v1/chat/stream` behavior unchanged | ☐      |       |
| NDJSON contract unchanged                | ☐      |       |
| Legacy integrations still function       | ☐      |       |
| Stage 6 introduced no side effects       | ☐      |       |

---

## 10. General FastAPI Best Practices (Reusable)

**Objective:** Avoid common FastAPI architectural mistakes.

| Checkpoint                                     | Status | Notes                     |
| ---------------------------------------------- | ------ | ------------------------- |
| `Depends()` used for auth, DB sessions, guards | ☐      | Centralized               |
| Global exception handlers are used             | ☐      | No scattered try/except   |
| Configuration via Pydantic `BaseSettings`      | ☐      | `.env` driven             |
| DB sessions are always closed                  | ☐      | Prevent leaks             |
| `reload=False` in production                   | ☐      |                           |
| `app.state` used for shared resources          | ☐      | DB clients, vector stores |
| Background tasks are bounded and observable    | ☐      |                           |

---

### Status

This checklist is:

* **Executable**
* **Auditable**
* **Reusable across FastAPI enterprise systems**
* **Designed to prevent the most common production failures**

