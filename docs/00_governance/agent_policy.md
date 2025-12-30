AGENT_ENV_GOVERNANCE_POLICY.md
```

---

# 🛡️ Agent Policy — Environment Governance & Configuration Control

## 1. Purpose (Binding)

This policy defines **mandatory governance rules** for any agent interacting with environment configuration, settings, or runtime guards in the EasyData system.

Compliance is **non-optional**.
Violation invalidates the execution.

---

## 2. Scope

This policy applies to **any agent** that:

* Reads or modifies environment variables
* Generates `.env*` files
* Updates `settings.py`
* Updates or executes `policy_guard.py`
* Runs tests or starts the backend

Applies to all environments:

* `local`
* `ci`
* `production`

---

## 3. Single Source of Truth (SSOT)

### 3.1 Authoritative File

`.env.schema` is the **ONLY** authoritative source for environment variables.

Rules:

* If a variable exists in `.env.schema` → it MUST exist everywhere.
* If a variable does NOT exist in `.env.schema` → it MUST NOT exist anywhere.
* No agent is allowed to invent, infer, or auto-generate variables.

---

## 4. Environment File Rules

### 4.1 Required Files

The following files MUST exist and MUST contain **all variables** from `.env.schema`:

| File              | Purpose                     |
| ----------------- | --------------------------- |
| `.env.local`      | Local development & testing |
| `.env.ci`         | Continuous Integration      |
| `.env.production` | Production deployment       |

---

### 4.2 `.env.local` Rules

* `ENV=local` is mandatory
* Dangerous flags are allowed **ONLY here**
* Examples (allowed):

  * `AUTH_ENABLED=false`
  * `RBAC_ENABLED=false`
  * `RLS_ENABLED=false`
  * `ADMIN_LOCAL_BYPASS=true`
* Must never be used outside local development
* Must be blocked by `policy_guard.py` in non-local environments

---

### 4.3 `.env.ci` Rules

* `ENV=ci` is mandatory
* No security bypasses
* No admin escalation
* No real production secrets
* External services must be mocked, stubbed, or disabled
* Deterministic and non-interactive

---

### 4.4 `.env.production` Rules

* `ENV=production` is mandatory
* Secure defaults only
* All secrets MUST be empty or explicitly marked:

  ```
  >>> CHANGE ME <<<
  ```
* No dangerous flags under any circumstance

---

## 5. settings.py Policy

Any agent modifying or validating `app/core/settings.py` MUST ensure:

* One single `Settings` class
* Every variable in `.env.schema` exists **exactly once**
* No extra variables
* Explicit typing for all fields
* No `os.getenv()` outside `settings.py`
* Invalid enum values MUST fail fast
* Defaults MUST match `.env.schema`

Silent fallbacks are forbidden.

---

## 6. policy_guard.py Policy

### 6.1 Purpose

`policy_guard.py` enforces **environment trust boundaries only**.

It MUST:

* Run before application startup
* Block dangerous flags unless `ENV=local`
* Fail fast and loudly

### 6.2 Dangerous Flags (Non-exhaustive)

The following are FORBIDDEN unless `ENV=local`:

* `AUTH_ENABLED=false`
* `RBAC_ENABLED=false`
* `RLS_ENABLED=false`
* `ADMIN_LOCAL_BYPASS=true`
* `ENABLE_RATE_LIMIT=false`
* `ENABLE_AUDIT_LOGGING=false`
* `ENABLE_TELEMETRY=false`
* `ENABLE_OTEL=false`

### 6.3 Explicit Non-Responsibilities

`policy_guard.py` MUST NOT:

* Validate secrets
* Validate DB connectivity
* Branch on `APP_ENV`
* Contain business logic
* Contain CI logic

---

## 7. Synchronization Script Policy (`sync_env.py`)

Any agent using or modifying `sync_env.py` MUST ensure:

* `.env.schema` is the source of truth
* A backup is created before modification
* User is prompted on value conflicts:

  1. Keep current
  2. Replace with schema value
  3. Enter custom value
* Order, comments, and formatting are preserved
* No variable deletion
* No duplication
* A change report is produced

Non-interactive changes without explicit instruction are forbidden.

---

## 8. Test & Runtime Execution Policy

* Tests MUST NOT be fixed by deleting or weakening logic
* Any bypass MUST be:

  * Environment-driven
  * Local-only
  * Explicit
* Skipped tests MUST be intentional and explainable
* Backend MUST remain startable after tests

---

## 9. Prohibited Actions (Hard Ban)

An agent MUST NEVER:

* Remove variables from `.env.schema`
* Add variables not defined in `.env.schema`
* Weaken production security defaults
* Hardcode secrets
* Silently skip tests
* Reorder or reformat `.env` files unnecessarily
* Use `APP_ENV` as a security control

---

## 10. Compliance Declaration

An execution is considered **COMPLIANT** only if:

* All environment files align with `.env.schema`
* `settings.py` matches schema 1:1
* `policy_guard.py` enforces boundaries correctly
* No forbidden actions occurred

Any violation invalidates the execution result.

---

## 11. Status

**This policy is binding, versioned, and audit-ready.**

Recommended header for versioning:

```
Version: 1.0
Status: ACTIVE
Scope: Environment Governance
```

---

### ملاحظة ختامية حاكمة

هذه الوثيقة **ليست إرشادية**، بل **قانون تشغيل**.
أي وكيل لا يلتزم بها يجب اعتباره **غير موثوق للتنفيذ**.
