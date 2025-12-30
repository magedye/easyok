# Correctness After Learning (CAL) — Acceptance Checklist

**Document Reference:** Stage 2/3 Final Release Gate
**Version:** **1.3 – Auditable / Governance-Aligned**
**Scope:** EasyData v16.x
**Purpose:** Verify that EasyData evolves through **feedback-driven learning only** (RAG / vectors / governance), **without code changes**, and **without violating safety or training readiness**.

---

## Section 0 — Mandatory Preconditions (Hard Gate)

*Any “No” = STOP. Test is invalid.*

* [ ] **Code Freeze:** No backend code changes since the last failed Pilot run (hash verified).
* [ ] **Environment:** `ENV=local` or `ENV=staging` (Production excluded).
* [ ] **Dangerous Flags Disclosure:** If any **Local/Test-only flags** are enabled (e.g., `ADMIN_LOCAL_BYPASS`, training guards), they are **explicitly documented** for this run.
* [ ] **Persistence:** Vector Store uses **PersistentClient**; target schema loaded and checksum verified.
* [ ] **Governance Active:** Feedback & Training APIs reachable and **audited**.
* [ ] **Target Selection:** Failed queries (trend/filtering/joins) are identified, timestamped, and logged.
* [ ] **Training Readiness:** No active **TrainingReadinessError** *or* guard is **explicitly disabled for local testing** and documented.

---

## Section 1 — Learning Cycle Activation (Audit Trail)

*For each previously failed query, all steps must be traceable.*

* [ ] **Feedback Logged:** `POST /api/v1/feedback` with `is_valid=false` and **specific failure reasons**.
* [ ] **Artifact Creation:** **Pending Training Item** created in System DB with immutable linkage to feedback.
* [ ] **Governance Approval:** Item approved via `POST /api/v1/training/approve/{id}` (actor + timestamp).
* [ ] **Vector Sync:** Audit entry confirms **successful retraining** (collection, embedding model, version).
* [ ] **No Code Touch:** Evidence that no code/config (non-env) changed during the cycle.

---

## Section 2 — Re-Ask Validation Gates (NDJSON Analysis)

*Re-run the **exact** natural language query. Analyze the NDJSON stream.*

### Gate A — Structural Integrity

* [ ] **Evolution:** Generated SQL is **distinct** from pre-learning SQL (diff recorded).
* [ ] **Compliance:** SQL is **Oracle-compatible**; no syntax errors.
* [ ] **Authenticity:** **No fallback SQL** (e.g., `SELECT 1 FROM DUAL`).
  **Result:** [ ] PASS  [ ] FAIL

### Gate B — Semantic Precision

* [ ] **Intent Alignment:** SQL reflects the business logic (correct joins, filters).
* [ ] **Data Logic:** Dates and categorical IDs (e.g., `TRA_TYPE_ID`) match **audited Oracle values**.
  **Result:** [ ] PASS  [ ] FAIL

### Gate C — Assumption Transparency

* [ ] **Visibility:** `assumptions[]` present in `technical_view`.
* [ ] **Refinement:** Assumptions explicitly address the **prior failure cause**.
  **Result:** [ ] PASS  [ ] FAIL

### Gate D — Outcome Quality (Success Path)

Choose **one** path only:

**Path 1 — Data Success**

* [ ] **Real Oracle Data** returned (no mocks/placeholders).
* [ ] **Chart Config** generated; **Arabic Summary** reflects **actual row count**.

**Path 2 — Intelligent Failure**

* [ ] **Actionable Explanation:** Summary explains *why* data is missing and suggests refinements.
* [ ] **No Triviality:** FAIL if response is only “No data available”.

**Result:** [ ] PASS  [ ] FAIL

---

## Section 3 — Aggregate Scoring & Decision

* **N** = Total retrained queries

* **P** = Queries passing **all** Gates (A–D)

* [ ] **Success Rate (P/N):** ________ %

* [ ] **Safety Violations:** **0 (Mandatory)**

| Score      | Decision    | Action                                |
| ---------- | ----------- | ------------------------------------- |
| **≥ 80%**  | **GO**      | Proceed to Stage 4 (Teams / WhatsApp) |
| **60–79%** | **ITERATE** | One final Cognitive Recovery Round    |
| **< 60%**  | **NO-GO**   | Structural knowledge gap — stop Pilot |

---

## Section 4 — Explicit Exclusions (Automatic Failures)

The following **do NOT count as success**:

* **NO:** Safe failure without business guidance.
* **NO:** Code-based improvement (any manual code/config change).
* **NO:** Mock or placeholder data (`1`, dummy rows).
* **NO:** Training readiness bypass **undocumented** or used outside Local/Test.
* **NO:** Telemetry-only “success” without data or rationale.

---

## Section 5 — Evidence & Artifacts (Required Attachments)

* NDJSON logs (before/after)
* SQL diff (pre/post learning)
* Training Item ID(s) + approval record
* Vector retrain audit entry
* Environment flags disclosure (Local/Test)

---

**Executive Signature:** ____________________
**Date:** ____________________

**Final Decision:** [ ] GO  [ ] ITERATE  [ ] NO-GO