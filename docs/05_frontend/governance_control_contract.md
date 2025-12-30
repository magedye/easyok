
# EasyData v16.7 — Frontend Governance & Control Contract

**Status:** 🔒 Binding (Post-Stage-6)
**Audience:** Frontend (React) Engineering & QA
**Applies After:**

* ADR-0018 (Architecture Isolation Enforcement)
* ADR-0019 (Governed Cognitive Training Pilot)
* flake8-easydata-arch (EDA901–905)
* Admin Feature Toggle API
* Training Pilot Backend (Phases 0–10)

---

## Executive Position

After completion of the above ADRs and backend capabilities, the **Frontend introduces no new business logic**.
Its role is strictly limited to:

* **Visibility**
* **Governance Control**
* **Decision Support**

The Frontend is **never a source of authority**.

---

## 1. Required Frontend Additions (Exclusive Scope)

### 1️⃣ Admin Governance Cockpit (MANDATORY)

#### Purpose

Provide a **single operational truth view** with zero bypass capability.

#### A. Feature Toggles Panel

**APIs**

* `GET /api/v1/admin/settings/feature-toggles`
* `POST /api/v1/admin/settings/feature-toggle`

**UI Display (per toggle)**

* Name
* Current value
* `mutable` / `immutable`
* Last change (timestamp + user)

**UI Rules**

* `immutable` → disabled + lock icon
* `mutable` → confirmation modal + **required reason (min length enforced)**

**FORBIDDEN**

* Any client-side toggle logic
* Any optimistic updates without server confirmation

---

### 2️⃣ Training Pilot — Admin Panel (MANDATORY)

> This is **not** a training UI. It is a **governance UI**.

#### A. Training Items Queue

**API**

* `GET /api/v1/admin/training/items?status=pending|approved|rejected`

**Columns**

* question
* schema_version
* policy_version
* created_by
* status
* created_at

#### B. Training Item Review View

**Read-Only Display**

* question
* assumptions
* corrected SQL
* SQLGuard validation status

**Actions**

* Approve
* Reject

**Action Rules**

* Mandatory modal

  * checklist (explicit confirmations)
  * reason (required)

**FORBIDDEN**

* Bulk approval
* Inline editing
* Auto-approval

---

### 3️⃣ Training Pilot Metrics View (Decision-Grade)

#### Purpose

Enable **Go / No-Go decisions without reading logs**.

**Panels (Read-Only)**

* Baseline vs Post-Training

  * First-pass correctness
  * Error class frequency
  * Assumption completeness
  * Latency delta
* Training signals

  * `training_item.created`
  * `training_item.approved`
  * `training_item.injected`

**Source**

* SigNoz embed (iframe or deep link)
* **No local calculations in frontend**

---

### 4️⃣ Observability Truth Indicators (CRITICAL)

#### Reason

Isolation + No-Op modes can mislead operators.

**Indicators**

* Semantic Cache: enabled / disabled / noop
* Arabic NLP: enabled / bypassed
* Alerts: enabled / muted

**Data Source**

* OpenTelemetry span attributes only
* **Never derive state from frontend config**

---

### 5️⃣ Read-Only Mode for Non-Admin (MANDATORY)

**Behavior**

* Same pages visible
* No buttons
* No modals
* No POST calls

RBAC is enforced **server-side**, UI is **hard-disabled**.

---

### 6️⃣ Explicitly Forbidden

The Frontend MUST NOT:

* Change Training Pilot state directly
* Bypass Admin APIs
* Modify immutable toggles
* Implement fallback logic on API failure
* Store governance state in `localStorage`
* Perform silent retries

---

## 2. Explicit Non-Requirements

The Frontend **does not need**:

* End-user training UI
* Embedding visualizations
* AI-assisted approvals
* Frontend-only feature flags
* Live editing of any governed entity

---

## 3. Executive Summary

After applying this contract, the Frontend becomes:

* 🪟 A visibility window
* 🕹️ A governance console
* 📊 A decision tool
* 🚫 **Not a source of authority**

---

## 4. Minimum Required Components (Closed Set)

1. Admin Feature Toggles Panel
2. Training Items Admin Queue
3. Training Review Modal
4. Training Metrics View
5. Observability Status Badges

Anything beyond this is **scope creep**.

---

## 5. Component List (Binding)

### A. Core Layout

| Component      | Responsibility                           |
| -------------- | ---------------------------------------- |
| AdminLayout    | Unified governance wrapper               |
| ProtectedRoute | RBAC guard (admin / viewer)              |
| LoadingState   | Official loading states                  |
| ErrorBoundary  | API failure handling (no smart fallback) |

---

### B. Governance Cockpit

| Component                 | Responsibility            |
| ------------------------- | ------------------------- |
| UnifiedDashboard          | Governance landing page   |
| TelemetryPanel            | SigNoz embed              |
| SentryIssuesPanel         | Read-only Sentry issues   |
| ObservabilityStatusBadges | enabled / disabled / noop |

---

### C. Feature Toggles

| Component          | Responsibility        |
| ------------------ | --------------------- |
| FeatureTogglePanel | Toggle list           |
| FeatureToggleRow   | Single toggle         |
| ToggleConfirmModal | Reason + confirmation |

---

### D. Training Pilot (Admin Only)

| Component            | Responsibility      |
| -------------------- | ------------------- |
| TrainingQueuePage    | Training item list  |
| TrainingItemRow      | Item row            |
| TrainingReviewModal  | Approve / Reject    |
| TrainingChecklist    | Mandatory checklist |
| TrainingMetricsPanel | Baseline vs post    |

---

### E. Shared

| Component     | Responsibility            |
| ------------- | ------------------------- |
| ReadOnlyBadge | Immutable indicator       |
| RoleBadge     | admin / viewer            |
| AuditHint     | “All actions are audited” |

---

## 6. Routes Map (Final)

```
/
└── /admin
    ├── /dashboard
    │     ├── telemetry
    │     ├── sentry
    │     └── observability
    │
    ├── /settings
    │     └── feature-toggles
    │
    ├── /training
    │     ├── queue
    │     ├── approved
    │     ├── rejected
    │     └── metrics
    │
    └── /runbooks
          ├── policy-breach
          └── latency-spike
```

❗ No control routes exist outside `/admin`.

---

## 7. RBAC Matrix (Binding)

### Roles

* `admin`
* `viewer`

#### Feature Toggles

| Action                  | Admin | Viewer |
| ----------------------- | ----- | ------ |
| View toggles            | ✅     | ✅      |
| Change runtime toggle   | ✅     | ❌      |
| Change immutable toggle | ❌     | ❌      |
| Submit without reason   | ❌     | ❌      |

#### Training Pilot

| Action       | Admin | Viewer |
| ------------ | ----- | ------ |
| View items   | ✅     | ✅      |
| Approve      | ✅     | ❌      |
| Reject       | ✅     | ❌      |
| Edit         | ❌     | ❌      |
| Bulk approve | ❌     | ❌      |

#### Observability

| Action         | Admin | Viewer |
| -------------- | ----- | ------ |
| View SigNoz    | ✅     | ✅      |
| View Sentry    | ✅     | ✅      |
| Silence alerts | ❌     | ❌      |

---

## 8. Non-Negotiable Frontend Rules (Summary)

* ❌ No governance logic in UI
* ❌ No state changes without API
* ❌ No optimistic updates
* ❌ No local governance storage
* ❌ No silent retries

✔ Everything must be:

* server-validated
* RBAC-enforced
* audited
* observable

---

## 9. Definition of Done — Frontend

The Frontend is accepted **only if**:

* No action is possible without admin role
* Immutable toggles are truly locked
* Every action requires a reason
* SigNoz and Sentry reflect real system state
* All protections can be disabled without breaking UI

---

## Final Seal

This document is **binding**.
Any deviation is a **governance violation**.

EasyData v16.7 Frontend is now:

**Governed · Observable · Non-Authoritative**
