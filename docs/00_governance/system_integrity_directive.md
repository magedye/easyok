# EasyData v16.7 — Unified Executive Directive

**Schema Access Governance, Training Control & End-to-End Validation**

**Status:** FINAL – GOVERNANCE BINDING
**Applies To:** EasyData v16.7.x and later (unless superseded by ADR)

---

## 1. Architectural Mandate

EasyData operates as a **governed cognitive system**.

No table or column may be:

* inspected
* trained on
* queried
* assumed
* referenced implicitly

unless explicitly authorized by an **ACTIVE Schema Access Policy**.

Enforcement applies uniformly across:

* Metadata inspection
* Training (DDL / RAG)
* SQL generation
* SQL execution
* Assumptions
* Result validation

There are:

* No soft failures
* No silent rejections
* No implicit access

---

## 2. Governing Primitive: Schema Access Policy

The **Schema Access Policy** is the **single source of truth** for schema visibility.

It defines:

* Allowed tables
* Allowed columns per table
* Explicitly denied tables
* Policy status: `draft | active | revoked`

Rules:

* **No active policy → no training, no SQL, no RAG**
* Any out-of-policy reference → `SECURITY_VIOLATION`
* Every violation MUST be audited

---

## 3. Mandatory Enforcement Layers

### 3.1 SQL & Query Enforcement (SQLGuard)

SQLGuard MUST enforce:

* Every referenced table ∈ `allowed_tables`
* Every referenced column ∈ `allowed_columns[table]`

Violations:

* Immediate BLOCK
* `SECURITY_VIOLATION`
* Mandatory audit log entry

> Column-level enforcement is mandatory when enabled by policy and schema metadata availability.

---

### 3.2 Training Enforcement

Any training item referencing out-of-scope schema:

* MUST fail explicitly
* HTTP status: **400**
* Classified as `SECURITY_VIOLATION`
* Logged in audit trail
* Produces **zero side effects**

Silent auto-rejection is forbidden.

---

### 3.3 Assumptions Injection (Binding Rule)

Once a policy is active, the system MUST inject the following invariant into reasoning:

> “Analysis is restricted to tables and columns defined in the active Schema Access Policy.”

This assumption is:

* Mandatory
* Binding
* Used for correctness and intelligent failure

---

## 4. Frontend Constraints (Non-Negotiable)

Frontend is **governance-neutral**.

It MAY:

* Display
* Select
* Trigger

It MUST NOT:

* Interpret SQL
* Infer permissions
* Apply logic
* Enforce policy

Rules:

* Default selection is **all tables / columns**
* Credentials are session-only
* No persistence of secrets or logic

---

## 5. End-to-End Holistic Testing Directive

A full E2E validation suite is **mandatory**.

### Phase 1 — Governance Breach Testing

* **Test A (Column-Level Block):**
  Query non-policy column → BLOCKED → `SECURITY_VIOLATION` → audited

* **Test B (Training Violation):**
  Out-of-scope training → HTTP 400 → audited → no side effects

* **Test C (Schema Isolation):**
  Non-allowed tables behave as non-existent (not visible in technical_view or assumptions)

---

### Phase 2 — Streaming & UI Integrity

* **Test D:** `technical_view` MUST precede any data chunk
* **Test E:** UI contains zero SQL or governance logic
* **Test F:** RTL rendering verified (panels, status chips, operational views)

---

### Phase 3 — Knowledge Lifecycle Validation

* **Test G:**
  Wizard flow: Connect → Inspect DDL → Select → Activate Policy
  Result: policy active, training pipeline triggered, assumptions updated

* **Test H:**
  Restart → active policy and vector store persist → enforcement unchanged

* **Test I:**
  Feedback remains pending until approved → no implicit learning

---

### Phase 4 — Audit & Transparency

* **Test J:**
  Audit entries exist for:

  * Policy_Activation
  * Blocked_SQL_Attempt
  * Approved_Training

* **Test K:**
  Learning Validation View shows:

  * SQL before / after
  * Assumptions before / after
    Transparency only, no control surface

---

## 6. Required Deliverable Report

Produce a **System Integrity & Governance Matrix** (exportable):

| Component       | Logic Verified                 | Status (PASS/FAIL) | Audit Confirmed |
| --------------- | ------------------------------ | ------------------ | --------------- |
| Column Guard    | SQL blocked on unlisted column |                    |                 |
| Training Guard  | SECURITY_VIOLATION on breach   |                    |                 |
| Streaming Order | technical_view first           |                    |                 |
| Persistence     | Policy survives restart        |                    |                 |
| UI Neutrality   | Zero frontend logic            |                    |                 |

---

## 7. Acceptance Rule

Any governance-related test failure → **REJECT**.

* Fix
* Rerun full suite
* No waivers
* No partial acceptance

---

## 8. Final Statement

Passing this directive proves EasyData is a:

* Disciplined system
* Governed cognitive engine
* Audit-ready platform

Only after full pass is the system cleared for:

* Stage 4
* Frontend expansion
* Enterprise onboarding

**This directive is FINAL.**

Any deviation without ADR approval is a governance violation.

---