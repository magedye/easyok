EasyData v16.1 — Unified Executive Directive  
Schema Access Governance, Training Control & End-to-End Validation

1. Architectural Mandate
EasyData must operate as a governed cognitive system. No table/column may be seen, trained on, queried, or assumed unless explicitly authorized by an Active Schema Access Policy. Enforcement applies to metadata inspection, training (DDL/RAG), SQL generation, SQL execution, assumptions, and correctness. No soft failures, no silent rejections, no implicit access.

2. Governing Primitive: Schema Access Policy
Policy is the single source of truth. It defines allowed tables, allowed columns per table, denied tables, and status (draft/active/revoked). Rules: no active policy → no training/SQL/RAG. Any out-of-policy reference → SECURITY_VIOLATION with audit.

3. Mandatory Enforcement Layers
3.1 SQL & Query Enforcement: SQLGuard must ensure every referenced table ∈ allowed_tables and every column ∈ allowed_columns[table]. Violations → SECURITY_VIOLATION → BLOCK → audit_logs entry.
3.2 Training Enforcement: Any training item referencing out-of-scope schema must fail explicitly (HTTP 400) and be logged as SECURITY_VIOLATION. No silent auto-rejection.
3.3 Assumptions Injection: After policy activation inject “Analysis is restricted to tables and columns defined in the active Schema Access Policy.” Binding for correctness and intelligent failure.

4. Frontend Constraints
Frontend is governance-neutral: display, select, trigger only. No SQL interpretation, logic, or permission inference. Default selection is all tables/columns. Credentials are session-only, never persisted.

5. End-to-End Holistic Testing Directive
You must execute a full E2E validation suite proving governance robustness.

Phase 1 — Governance Breach Testing
Test A (Column-Level Block): Query a column not in active policy → blocked, SECURITY_VIOLATION, audited.
Test B (Training Violation): Submit training referencing out-of-scope schema → explicit failure (400), SECURITY_VIOLATION audit, no side effects.
Test C (Schema Isolation): Referencing non-allowed tables should not appear in technical_view/assumptions; system behaves as if absent.

Phase 2 — Streaming & UI Integrity
Test D: technical_view always precedes data.
Test E: UI has zero SQL/logic; display+trigger only.
Test F: RTL rendering verified (panels, status chips, operational views).

Phase 3 — Knowledge Lifecycle Validation
Test G: Wizard flow Connect → Inspect DDL → Select All → Activate Policy; policy becomes active; training pipeline triggers; assumptions updated.
Test H: Restart → active policy and ChromaDB persist; enforcement remains.
Test I: Feedback pending until approved; no implicit learning.

Phase 4 — Audit & Transparency
Test J: Audit entries for Policy_Activation, Blocked_SQL_Attempt, Approved_Training.
Test K: LearningValidationView shows SQL/assumptions before vs after; transparency only.

6. Required Deliverable Report
Produce a System Integrity & Governance Matrix exportable to Sheets:
Component/Test | Logic Verified | Status (PASS/FAIL) | Audit Confirmed
Column Guard | SQL blocked on unlisted column | | 
Training Guard | SECURITY_VIOLATION on breach | | 
Streaming Order | technical_view first | | 
Persistence | Policy & data survive restart | | 
UI Neutrality | Zero frontend logic | | 

7. Acceptance Rule
Any governance-related test fail → REJECT. Fix and rerun full suite. No waivers.

8. Final Statement
Passing proves EasyData is a disciplined, governed cognitive fortress. Only after full pass is the system cleared for Stage 4 and enterprise onboarding.
