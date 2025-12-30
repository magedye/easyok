# EasyData v16.7.9 — Frontend Integration Contract

**Audience:** React Frontend Engineers  
**Scope:** Integration with Fortress-grade Backend  
**Stage:** 6 (Formally Closed)  
**Status:** 🔒 Binding & Non-Negotiable

---

## 1. Official API Contract (Single Source of Truth)

- The **only authoritative API reference** is:
```

/openapi/fortress.yaml

````
- Swagger UI, assumptions, or reverse-engineering are forbidden.
- All endpoints, schemas, streaming contracts, permissions, and errors are defined there.

**Client Generation (Recommended):**
```bash
npx openapi-typescript-codegen \
--input openapi/fortress.yaml \
--output frontend/src/api \
--client fetch
````

Generated clients must be used directly; no handwritten API calls.

---

## 2. Core Execution Flow (Authoritative)

Authentication behavior is **conditional** and must strictly follow backend configuration.

| Endpoint              | Purpose                  | Auth Required  |
| --------------------- | ------------------------ | -------------- |
| `/api/v1/auth/login`  | Obtain JWT               | ❌ Always       |
| `/api/v1/ask`         | Query execution (NDJSON) | ⚠️ Conditional |
| `/api/v1/chat/stream` | Live chat (SSE)          | ⚠️ Conditional |
| `/api/v1/feedback`    | Submit feedback          | ⚠️ Conditional |
| `/api/v1/training/*`  | Governed training ops    | ⚠️ Restricted  |

**Rule:**
Frontend MUST branch behavior strictly based on backend flag:

```
AUTH_ENABLED = true | false
```

Frontend must never assume authentication is required or bypassed.

---

## 3. Streaming Contract (NDJSON / SSE)

### `/api/v1/ask` — NDJSON Stream

**Guaranteed order:**

```
thinking → (optional chunks) → end
```

**Optional chunks (MAY appear, MUST NOT be assumed):**

* `technical_view`
* `data`
* `business_view`

### Error / Policy / Provider Failure

```
thinking → error → end
```

**Hard Rules:**

* No partial data must be displayed after an error.
* Frontend MUST treat `end` as the only termination signal.
* Do not retry streams automatically.

---

## 4. Authentication & Token Handling

* Token is obtained from `/auth/login` as `access_token`.
* Token MUST be attached as:

  ```
  Authorization: Bearer <token>
  ```

### Storage Rules (Mandatory)

* Tokens MUST be stored:

  * In memory **or**
  * HttpOnly cookies
* **Forbidden storage locations:**

  * `localStorage`
  * `sessionStorage`
  * IndexedDB

Violation is a security breach.

---

## 5. Governance & Policy Enforcement (UI Rules)

* Policies are **read-only** in the UI.
* Feature flags are **read-only** in the UI.
* All mutations occur **server-side only** via admin APIs.
* UI must hide or disable controls unless RBAC explicitly allows access.

Frontend must never simulate governance logic.

---

## 6. Error Contract (Strict)

All non-stream errors follow:

```json
{
  "error_code": "POLICY_VIOLATION",
  "message": "Human-readable message",
  "lang": "en|ar"
}
```

**Rules:**

* Use `error_code` for logic.
* Use `lang` for localization.
* Do not infer meaning from message text.

---

## 7. Language & RTL Support

* Frontend MUST support:

  * English (LTR)
  * Arabic (RTL)
* Backend may emit `lang: "ar"` or `"en"` dynamically.
* UI must switch layout and messaging accordingly.

---

## 8. Allowed vs Forbidden UI Actions

### Allowed

* Display streaming results
* Submit feedback
* Submit governed training requests (when enabled)
* Display active policy (read-only)

### Forbidden

* Client-side SQL generation
* Client-side policy enforcement
* Feature toggle mutation
* Policy creation/modification
* Caching query results locally
* Retrying failed NDJSON/SSE streams
* Parsing NDJSON into business logic objects

Frontend is a **viewer**, not a decision engine.

---

## 9. Security Expectations

* No unauthenticated calls to protected routes.
* No wildcard CORS assumptions.
* Respect backend origin restrictions.
* Treat all backend responses as authoritative.

---

## 10. Final Declaration

* Backend contracts are stable.
* Stage 6 is formally closed.
* This document is binding.

Any deviation without explicit approval is a **contract violation**.

```

---

## الحكم النهائي

- ✅ جاهز للإرسال
- ✅ حوكمي 100%
- ✅ لا يترك مجال اجتهاد
- ✅ متوافق مع Fortress / Stage 6



## 🧠 **Prompt v2 — Playwright E2E Specification (Governance-Bound)**


# Role
You are the QA Automation Agent responsible for Playwright E2E testing.

# Context
Project: EasyData v16.7.9  
Backend: Fortress-grade API (Stage 6 formally closed)  
Frontend: React  
Governance: Strict / Non-negotiable  

This is a **verification-only task**.
No refactors, no feature changes, no contract reinterpretation.

# Objective
Produce a **Playwright E2E test specification** that verifies frontend compliance with the
`frontend_integration_contract.md`.

The goal is to validate **behavioral correctness**, not UI aesthetics.

# Scope (Must Be Covered)

## 1. Environment Awareness
- Tests MUST branch based on `AUTH_ENABLED`:
  - If `false`: skip login flow, call `/api/v1/ask` directly
  - If `true`: execute `/auth/login`, extract token, then proceed
- Do not hardcode assumptions.

## 2. Core E2E Flows (Mandatory)

### Flow A — Query Execution (/api/v1/ask)
Validate:
- Request is sent correctly
- NDJSON stream is consumed incrementally
- Chunk order is enforced:
```

thinking → (optional chunks) → end

```
- On error:
```

thinking → error → end

```
- UI stops rendering after `end`
- No data rendered after `error`

### Flow B — Policy / Error Handling
Validate:
- Error responses follow:
```

{ error_code, message, lang }

```
- UI behavior is driven by `error_code`, not message text
- Language switching (RTL/LTR) reacts to `lang`

### Flow C — Read-Only Governance
Validate:
- Policy UI is read-only
- Feature toggles are disabled / hidden
- No UI element allows mutation unless admin RBAC is detected

## 3. Security Assertions
- No API calls without Authorization header when required
- Token is NOT stored in localStorage or sessionStorage
- No retry logic for NDJSON or SSE streams

## 4. Forbidden Behaviors (Must Assert Absence)
- No client-side SQL generation
- No client-side policy logic
- No automatic retry on stream failure
- No partial rendering after error chunk

## 5. Evidence Capture
Tests MUST:
- Log NDJSON chunks received (sanitized)
- Assert termination only on `end`
- Capture screenshots only on failure
- Produce deterministic output

# Output Requirements

Produce:
1. `playwright.config.ts` (minimal, stable)
2. `tests/e2e/ask.spec.ts`
3. `tests/e2e/auth.spec.ts` (conditional)
4. `tests/e2e/governance.spec.ts`
5. Inline comments explaining **what is being validated and why**

# Constraints
- No mocking backend behavior
- No bypassing contracts
- No UI refactors
- No assumptions beyond provided contracts
- Tests must pass in CI with headless Chromium

# Definition of Done
- Tests validate **contract compliance**
- Tests are deterministic
- No flaky waits or arbitrary timeouts
- All assertions map directly to contract rules

# Final Instruction
Generate the Playwright E2E specification and confirm readiness.
Do not include explanations outside code comments.
```
