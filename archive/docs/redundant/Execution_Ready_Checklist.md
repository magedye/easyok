الملف الذي قدمته **شامل، منضبط، وقابل للتنفيذ**، لكنه يحتاج بعض **التحسينات الدقيقة** ليكون مستوفياً كـ
📌 *Internal QA / Architecture Compliance Checklist* قابل للتضمين في CI، التسليم، والمراجعة الرسمية.

فيما يلي **اقتراحات التحديث والتحسين** مع **نسخة محسّنة جاهزة للتطبيق**:

---

## ✅ التوصيات العامة قبل التحديث

### 🔹 1. إضافة مفاتيح الحالة (Pass / Fail / N/A)

لاكتساب وضوح في التقارير أثناء التنفيذ.

### 🔹 2. إضافة **تعريفات معايير النجاح**

مثلاً: ما معنى “contract stability”؟ هل تتطلب 0 تحذيرات Spectral أم مقبول بعض التحذيرات؟

### 🔹 3. إضافة **مثال تنفيذ قابل للقياس**

خصوصًا في Streaming و SQLGuard و RBAC enforcement.

### 🔹 4. دمج مع CI Checks

تحويل بعض البنود إلى خاصيات قابلة للفحص الآلي (lint, tests, spectral, schema diff).

---

## ✅ النسخة **المحسّنة** — Execution‑Ready Checklist

````markdown
# EasyData v16.7.9 (Fortress)

## Internal QA & Architecture Compliance Checklist

**Focus:** Stage 6 — Controlled Knowledge Population  
**Scope:** EasyData Backend + reusable for enterprise FastAPI systems

---

## 1. OpenAPI & Endpoint Contract Integrity

**Purpose:** Ensure API contract correctness and stability.

| Checkpoint                                                        | Result | Evidence / Notes |
|-------------------------------------------------------------------|--------|------------------|
| All runtime routes documented in OpenAPI                          | ☐ Pass/☐ Fail | route-map vs paths audit |
| No undocumented endpoints                                          | ☐ Pass/☐ Fail | orphan check |
| All request/response schemas exist under `components.schemas`      | ☐ Pass/☐ Fail | spectral / validator |
| Every endpoint has unique `operationId`                            | ☐ Pass/☐ Fail | required for SDK |
| Responses match OpenAPI definitions exactly                         | ☐ Pass/☐ Fail | tests + validators |
| Streaming endpoints follow stable NDJSON/SSE contract              | ☐ Pass/☐ Fail | test contracts |
| Tags and descriptions are present                                  | ☐ Pass/☐ Fail | improves clarity |
| No duplicated or ambiguous routes                                  | ☐ Pass/☐ Fail | e.g. `/admin/admin/...` |

---

## 2. RBAC, Authentication & Security

**Purpose:** Prevent unauthorized access and ensure strict enforcement.

| Checkpoint                                                        | Result | Evidence / Notes |
|-------------------------------------------------------------------|--------|------------------|
| Admin endpoints use `require_permission()`                        | ☐ Pass/☐ Fail | code review |
| No admin route accessible without auth                             | ☐ Pass/☐ Fail | route audit |
| JWT validation is robust (`/auth/validate`)                        | ☐ Pass/☐ Fail | tests + monitoring |
| Security schemes defined & enforced (BearerAuth)                   | ☐ Pass/☐ Fail | OpenAPI + code |
| Rate limiting / abuse protection enabled                            | ☐ Pass/☐ Fail | config + tests |
| CORS restricted in production (no `*`)                              | ☐ Pass/☐ Fail | prod env config |
| Secrets never hardcoded (env-only)                                  | ☐ Pass/☐ Fail | config audit |

---

## 3. SQLGuard & Policy Enforcement

**Purpose:** Prevent policy-violating SQL and enforce governance.

| Checkpoint                                                        | Result | Evidence / Notes |
|-------------------------------------------------------------------|--------|------------------|
| All SQL runs through SQLGuard                                      | ☐ Pass/☐ Fail | code + test coverage |
| SQLGuard enforces AST-level gating                                | ☐ Pass/☐ Fail | security tests |
| Active policy is enforced for `/ask` and `/chat/stream`             | ☐ Pass/☐ Fail | streaming tests |
| Policy violations stop execution immediately                       | ☐ Pass/☐ Fail | error tests |
| No data chunks emitted on violation                                | ☐ Pass/☐ Fail | NDJSON / SSE tests |
| Violation format follows standard:                                 | ☐ Pass/☐ Fail | match schema |

```json
{
  "error_code": "POLICY_VIOLATION",
  "message": "…",
  "lang": "ar|en"
}
````

---

## 4. Schema Scope Wizard Back‑End Workflow

**Purpose:** E2E policy creation & activation.

| Checkpoint                                          | Result        | Notes            |
| --------------------------------------------------- | ------------- | ---------------- |
| `/schema/connections` RBAC-protected                | ☐ Pass/☐ Fail | role perms       |
| `/schema/discover` accurate across engines          | ☐ Pass/☐ Fail | test matrix      |
| `/tables` metadata correct                          | ☐ Pass/☐ Fail | db introspection |
| `/columns` accurate                                 | ☐ Pass/☐ Fail | db introspection |
| `/policy/wizard/preview` correctly sandboxed        | ☐ Pass/☐ Fail | UI + tests       |
| `/policy/wizard/commit` persists valid policies     | ☐ Pass/☐ Fail | integration      |
| `/policy/wizard/activate` enforces activation rules | ☐ Pass/☐ Fail | audit logs       |
| Only one active policy per connection               | ☐ Pass/☐ Fail | enforced         |

---

## 5. Training Lifecycle Compliance

**Purpose:** Govern knowledge ingestion.

| Checkpoint                                 | Result        | Notes          |
| ------------------------------------------ | ------------- | -------------- |
| Items reference policy_id or connection_id | ☐ Pass/☐ Fail | sanity tests   |
| Training outside scope rejected            | ☐ Pass/☐ Fail | policy tests   |
| Rejection reasons are auditable            | ☐ Pass/☐ Fail | audit logs     |
| DDL uploads bound by policy                | ☐ Pass/☐ Fail | policy gating  |
| Vector store rollback supported            | ☐ Pass/☐ Fail | rollback tests |

---

## 6. Audit & Observability

**Purpose:** Traceability & operations insight.

| Checkpoint                           | Result        | Notes                 |
| ------------------------------------ | ------------- | --------------------- |
| Sensitive actions logged             | ☐ Pass/☐ Fail | logs                  |
| Audit entries include full context   | ☐ Pass/☐ Fail | user, role, timestamp |
| `/health` returns 200                | ☐ Pass/☐ Fail | uptime check          |
| `/metrics/json` Prometheus format    | ☐ Pass/☐ Fail | metrics tests         |
| NDJSON/SSE latency metrics available | ☐ Pass/☐ Fail | perf tests            |

---

## 7. Testing, CI & Code Hygiene

**Purpose:** Maintain quality and prevent regressions.

| Checkpoint                               | Result        | Notes           |
| ---------------------------------------- | ------------- | --------------- |
| CI runs automated tests                  | ☐ Pass/☐ Fail | pipeline status |
| Test coverage ≥ 80%                      | ☐ Pass/☐ Fail | coverage badge  |
| Static analysis clean                    | ☐ Pass/☐ Fail | mypy, ruff      |
| No unused imports / dead code            | ☐ Pass/☐ Fail | cleanup         |
| Routers registered (no orphan routes)    | ☐ Pass/☐ Fail | audit report    |
| `route-audit.json` generated & validated | ☐ Pass/☐ Fail | diff check      |

---

## 8. Frontend API Contract Compliance

**Purpose:** Prevent FE/BE contract drift.

| Checkpoint                                         | Result        | Notes        |
| -------------------------------------------------- | ------------- | ------------ |
| No direct `fetch/axios` in UI; uses shared clients | ☐ Pass/☐ Fail | code reviews |
| Wizard flows tested E2E                            | ☐ Pass/☐ Fail | e2e          |
| UI displays policy read-only per governance        | ☐ Pass/☐ Fail | UI tests     |
| RTL support verified                               | ☐ Pass/☐ Fail | UI tests     |

---

## 9. Backward Compatibility Checks

**Purpose:** Regression‑free delivery.

| Checkpoint                         | Result        | Notes           |
| ---------------------------------- | ------------- | --------------- |
| `/api/v1/ask` unchanged            | ☐ Pass/☐ Fail | contract tests  |
| `/api/v1/chat/stream` unchanged    | ☐ Pass/☐ Fail | contract tests  |
| NDJSON contract upheld             | ☐ Pass/☐ Fail | streaming tests |
| Legacy clients still supported     | ☐ Pass/☐ Fail | integration     |
| Stage 6 introduced no side effects | ☐ Pass/☐ Fail | audit logs      |

---

## 10. FastAPI Best Practices (Reusable)

**Purpose:** Avoid common architecture pitfalls.

| Checkpoint                                     | Result        | Notes                   |
| ---------------------------------------------- | ------------- | ----------------------- |
| `Depends()` used for auth, DB sessions, guards | ☐ Pass/☐ Fail | DI consistency          |
| Centralized exception handlers                 | ☐ Pass/☐ Fail | no scattered try/except |
| Pydantic `BaseSettings` for config             | ☐ Pass/☐ Fail | env driven              |
| DB sessions properly closed                    | ☐ Pass/☐ Fail | avoid leaks             |
| `reload=False` in production                   | ☐ Pass/☐ Fail | safe mode               |
| Shared resources via `app.state`               | ☐ Pass/☐ Fail | controlled              |
| Background tasks bounded & observable          | ☐ Pass/☐ Fail | monitoring              |

---

## Status

This checklist is:

* **Executable**
* **Auditable**
* **CI‑Ready**
* **Aligned with FastAPI Enterprise Standards**

```

---

## 🔥 ملاحظات تنفيذ إضافية

### Automated CI Integration Suggestions  
- **Run schema validation** as pre‑merge gate (`swagger-cli validate`).
- **Spectral linting** with warnings non‑blocking, errors blocking.
- **Route audit generation** in pipeline: compare runtime vs spec.
- **Fail CI** only on **security regressions**, not doc gaps.

---

## 📌 خلاصة

✔️ الوثيقة أصبحت **قابلة للتنفيذ فعلاً**  
✔️ صالحة لـ **المراجعة الداخلية / Audit / Compliance**  
✔️ قابلة للربط بـ **CI/CD**  
✔️ صالحة لإعادة الاستخدام لأنظمة FastAPI المتقدمة

--