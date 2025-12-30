إليك الوثيقة الموحدة والكاملة **(Execution-Grade Artifact)**.
هذه النسخة تدمج كل ما ناقشناه (الحوكمة، المكونات، الـ RBAC، والتقنيات مثل Zod و Pact) في ملف واحد جاهز للتسليم للوكيل لبدء **Stage 7**.

### 📄 الملف الرسمي: `docs/contracts/frontend_governance_v16.7.md`

```markdown
# EasyData v16.7 — Frontend Governance & Control Contract

**Status:** 🔒 Binding (Post-Stage-6)
**Audience:** Frontend Engineering, QA, & Integration Agents
**Enforcement:** CI/CD Gates (Pact + OpenAPI Diff)

---

## 1. Executive Mandate
**The Frontend is a Visibility Window, NOT a Source of Authority.**
It provides governance control and decision support but introduces **zero business logic**.

### Core Guiding Principles
1.  **No "Smart" Client:** Logic regarding feature toggles, policies, or SQL generation exists solely in the Backend.
2.  **Server-Driven Truth:** All state (Toggles, Training Items, Metrics) is fetched from APIs; no local defaults.
3.  **Strict Isolation:** No direct calls to DB or internal services. All traffic goes through `fortress.yaml` defined routes.

---

## 2. Functional Scope (The "Must-Haves")

### 2.1 Admin Governance Cockpit
**Purpose:** Single operational truth view.
* **Feature Toggles:**
    * Display `mutable` vs `immutable` status visually (Lock icon).
    * Changing a toggle requires a **Reason** (min length 10 chars).
    * Optimistic updates are **FORBIDDEN**.
* **Observability Indicators:**
    * Badges for: `Semantic Cache`, `Arabic NLP`, `Alerts`.
    * Source: OpenTelemetry Spans / API status (never hardcoded config).

### 2.2 Training Pilot Admin Panel
**Purpose:** Governance of the Knowledge Population loop.
* **Queue View:** Filter by `pending`, `approved`, `rejected`.
* **Review Modal:**
    * Read-only SQL/Assumptions.
    * **Approve/Reject Actions:** Must prompt for a mandatory Reason.
    * **Forbidden:** Bulk approvals, inline editing.

### 2.3 Read-Only Mode (RBAC Enforced)
* Non-Admin users (`viewer`) see the same layout but **cannot** interact.
* All Action Buttons/Modals are disabled or hidden.
* Backend enforces 403 Forbidden even if UI is bypassed.

---

## 3. UI Architecture & Routes

### 3.1 Sitemap (Final)
```text
/
└── /admin
    ├── /dashboard              # (Telemetry, Sentry, Observability)
    ├── /settings
    │     └── /feature-toggles  # (Governance Cockpit)
    ├── /training
    │     ├── /queue            # (Pending Items)
    │     ├── /approved
    │     ├── /rejected
    │     └── /metrics          # (Baseline vs Post-Training)
    └── /runbooks

```

### 3.2 Component Catalog (Binding)

* **`AdminLayout`**: Unified wrapper with RBAC guards.
* **`FeatureToggleRow`**: Handles Mutable/Immutable state rendering.
* **`TrainingReviewModal`**: Enforces "Reason" capture before API call.
* **`ReadOnlyBadge`**: Visual indicator for immutable system states.
* **`SentryIssuesPanel`**: Read-only proxy view of Sentry data.

---

## 4. Security & RBAC Matrix

**Roles:** `admin` | `viewer`

| Domain | Action | Admin | Viewer | Constraint |
| --- | --- | --- | --- | --- |
| **Toggles** | View List | ✅ | ✅ | - |
|  | Toggle On/Off | ✅ | ❌ | Requires Reason |
|  | Modify Immutable | ❌ | ❌ | Hard Blocked |
| **Training** | View Queue | ✅ | ✅ | - |
|  | Approve Item | ✅ | ❌ | Requires Reason |
|  | Reject Item | ✅ | ❌ | Requires Reason |
| **Obs** | View Metrics | ✅ | ✅ | - |
|  | Silence Alerts | ❌ | ❌ | API Only |

---

## 5. Technical Implementation Strategy

### 5.1 Single Source of Truth (SSOT)

* **Spec:** `openapi/fortress.yaml` is the absolute master.
* **Generation:** Frontend code **MUST** be auto-generated. Manual API calls are prohibited.

### 5.2 The "Chain of Truth" Pipeline

1. **OpenAPI Spec** (`fortress.yaml`) defined by Backend.
2. **Zod Schemas** generated via `openapi-zod-client`.
3. **Typed Axios Client** uses Zod for runtime validation.
4. **Pact Tests** verify the consumer contract against the backend.

### 5.3 Code Structure (Mandatory)

```text
src/api/
├── generated/           # 🛑 DO NOT EDIT (Auto-generated)
│   ├── client.ts        # Axios functions
│   ├── schemas.ts       # Zod definitions
│   └── index.ts
├── http.ts              # Axios instance with Interceptors (Auth)
└── index.ts             # Public export

```

### 5.4 CI/CD Gates

* **Lint/Type:** `eslint` + `tsc` (Standard).
* **Contract Guard:** `pact-js` consumer tests running against Backend.
* **Schema Guard:** `openapi-diff` preventing breaking changes.

---

## 6. Forbidden Patterns (Strict)

1. ❌ **No `localStorage` for Governance State:** Trust only the API.
2. ❌ **No Silent Retries:** If an Admin action fails, show the error toast.
3. ❌ **No "Any" Types:** All data must pass through Zod schemas.
4. ❌ **No Direct Sentry/SigNoz API Calls:** Use the Backend Proxy endpoints to avoid exposing keys.
5. ❌ **No Layout Drift:** The `/admin` routes must follow the strict hierarchy defined above.

---

**Signed:** Lead Architect
**Date:** 2025-12-30
**Ref:** ADR-018, ADR-019

```

---

### 🚀 الأمر التنفيذي للوكيل (Agent Prompt)

الآن، انسخ هذا الأمر وأرسله للوكيل ليبدأ التنفيذ الفعلي لـ Stage 7 بناءً على الوثيقة أعلاه:

```markdown
# TASK: EXECUTE STAGE 7 - FRONTEND CONSTRUCTION

**Context:** Stage 6 is closed. We are building the Governance UI (Stage 7).
**Authority:** `docs/contracts/frontend_governance_v16.7.md` (The content provided above).

## Phase 1: Foundation & Contracts (IMMEDIATE PRIORITY)

1.  **Save the Contract:**
    Create `docs/contracts/frontend_governance_v16.7.md` with the content provided.

2.  **Scaffold the Tooling:**
    - Install dependencies: `openapi-zod-client`, `axios`, `zod`, `@pact-foundation/pact`.
    - Setup script: `scripts/generate-api.ts` configured to read `openapi/fortress.yaml`.

3.  **Generate the Client:**
    - Run the generator to populate `src/api/generated/`.
    - **Verify:** Ensure `FeatureToggle` and `TrainingItem` schemas exist and match the contract.

4.  **Implement Base Layout:**
    - Create `AdminLayout` and `ProtectedRoute` components enforcing the RBAC Matrix (Admin vs Viewer).

**Output:**
Report completion of scaffolding and client generation. Confirm that Zod schemas match the Backend spec.

```