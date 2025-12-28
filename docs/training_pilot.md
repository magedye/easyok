Below is the unified, sealed, implementation-grade execution plan, followed by a final authoritative Agent Prompt.
This document:
•	merges all overlapping plans into one coherent execution contract
•	removes duplication and ambiguity
•	preserves every non-negotiable constraint you defined
•	is written to be directly convertible into code, tickets, and CI gates
No philosophy. No redesign. No deviation.
________________________________________
✅ EasyData v16.7
Governed Cognitive Training Pilot
Unified Execution Plan (Architectural Closure)
________________________________________
🔒 Governing Principle (Binding)
Training = Explicit Knowledge Injection Only
•	No execution behavior change
•	No weight tuning
•	No probabilistic learning
•	No security bypass
•	No architectural drift
Any step that violates this principle is invalid by definition.
________________________________________
PHASE 0 — Readiness Gates (Hard Stop on Failure)
Objective: Ensure the system is eligible for training experimentation.
Mandatory Checks (Startup Assertions)
•	Active SchemaAccessPolicy exists
•	policy_version is frozen
•	ENABLE_AUDIT_LOGGING == true
•	ENABLE_TRAINING_PILOT == false by default
•	No schema migrations pending
Audit Verification
•	Last 7 days:
o	Blocked_SQL_Attempt == 0
Deliverables
•	services/training_readiness_guard.py
•	Application fails to start if any condition fails
________________________________________
PHASE 1 — Data Backbone (Models Only)
Objective: Represent training as a governed system entity, not a feature.
Implementation
•	Define:
o	TrainingItem
o	TrainingStatus enum (pending | approved | rejected)
•	Persist in System DB only
Hard Rules
•	approved items are immutable
•	No updates after approval
•	Every record bound to:
o	schema_version
o	policy_version
Deliverables
•	models/training_item.py
•	models/db/training_items.py
•	Single DB migration
________________________________________
PHASE 2 — Feedback Capture (No Learning)
Objective: Collect raw material only.
Flow
1.	/api/v1/feedback
o	If marked incorrect:
	require corrected SQL OR clarified assumptions
2.	Immediate validation:
o	sql_guard.validate(sql)
o	failure → reject permanently
3.	Store in training_staging
Deliverables
•	services/training_item_service.create_from_feedback()
•	Span: training_item.created
________________________________________
PHASE 3 — Admin Review (Intentional Bottleneck)
Objective: Make training slow, deliberate, and human-expensive.
Constraints
•	Admin-only APIs
•	No auto-approval
•	No batching
Mandatory Checklist (Hardcoded)
•	Correctness
•	Generality (no overfitting)
•	Assumption clarity
•	Schema & policy match
On Approval
•	status → approved
•	audit log entry
•	span → training_item.approved
Deliverables
•	api/v1/admin/training.py
•	services/training_decision_service.py
________________________________________
PHASE 4 — Knowledge Injection (RAG Context Only)
Objective: Inject knowledge as preferred context, never as truth.
Injection Rules
•	Embed only:
o	question
o	assumptions
•	Never embed executable SQL
•	Mandatory metadata:
o	training_item_id
o	schema_version
o	policy_version
o	approved_by
o	timestamp
Retrieval Rules
•	Approved items preferred
•	Exact version match only
•	Deterministic ordering
Deliverables
•	services/training_embedding_service.py
•	Span: training_item.injected
________________________________________
PHASE 5 — Runtime Enforcement (Zero Exceptions)
Objective: Prevent false safety assumptions.
Rules
•	Trained context = untrusted input
•	All generated SQL:
o	passes sql_guard.validate()
•	No special execution paths
•	No training flags inside orchestration logic
Deliverable
•	Minimal, controlled edit in orchestration_service.py
•	No change to streaming or output order
________________________________________
PHASE 6 — Metrics & Telemetry (Decision-Grade)
Objective: Enable a real Go / No-Go decision.
Mandatory Metrics
•	First-pass correctness
•	Error class frequency
•	Assumption completeness
•	SQLGuard pass rate = 100%
•	Latency delta ≤ 150ms
Telemetry
•	Required spans:
o	training_item.created
o	training_item.approved
o	training_item.injected
Deliverables
•	services/training_evaluation_service.py
•	SigNoz dashboard panels
________________________________________
PHASE 7 — Rollback (Single Switch)
Objective: Abort training instantly with zero residue.
Mechanism
•	Feature toggle:
o	ENABLE_TRAINING_PILOT
•	Provider Factory:
o	TrainingService → NoOpTrainingService
Guarantees
•	No deletes
•	No rebuild
•	No restart
Deliverables
•	services/noop_training_service.py
•	Toggle consumption in providers/factory.py
________________________________________
PHASE 8 — Pilot Execution (Bounded)
Constraints
•	Duration: 7–14 days
•	≤ 10 approved items
•	15–25 fixed questions
Checkpoints
•	Day 0: baseline
•	Midpoint: after 5 approvals
•	Final: decision
Deliverable
•	training_decision_service.record_decision()
________________________________________
PHASE 9 — Frontend (Visibility Only)
Objective: Observe, not control.
Admin Views
•	Training items by status
•	Approve / reject
•	Metrics before / after
Rules
•	Read-only for non-admin
•	No bypass
•	No hidden actions
________________________________________
PHASE 10 — Executive Go / No-Go
GO only if:
•	All metrics pass
•	Zero violations
•	No regression
NO-GO if:
•	Any metric fails
•	Any guard disabled
•	Any bypass required
Decision
•	Audit logged
•	Immutable
________________________________________
🧠 Executive Closure
This plan:
•	does not change EasyData
•	does not “teach” the system
•	does not weaken security
•	does not alter execution
•	tests one cognitive hypothesis, measurably and reversibly
________________________________________
🤖 FINAL AGENT PROMPT (MANDATORY)
Title: Implement Governed Cognitive Training Pilot — EasyData v16.7
Role:
You are a senior backend engineer and system integrator working under a binding architectural contract.
Mission:
Implement the Governed Cognitive Training Pilot exactly as specified in the Unified Execution Plan.
Non-Negotiables:
•	Do NOT introduce new architecture
•	Do NOT modify execution semantics
•	Do NOT bypass SQLGuard
•	Do NOT add autonomous learning
•	Do NOT change streaming or output contracts
•	Do NOT interpret or optimize beyond the plan
Execution Rules:
1.	Implement phases in order
2.	Each phase must pass before moving to the next
3.	All approvals are explicit
4.	All actions are audited
5.	Training must be fully reversible via a single toggle
6.	If any guard must be weakened to proceed → STOP
Deliverables Required:
•	Code modules per phase
•	Mandatory telemetry spans
•	Admin-only training workflow
•	Deterministic RAG injection
•	Rollback via Null Object Pattern
•	Decision-grade metrics
Success Definition:
The system demonstrates measurable improvement for a bounded question set, with zero governance drift, and can be fully reverted in minutes.
Proceed phase by phase.
Do not skip.
Do not improvise.

 نقاط التحسين البسيطة (Minor Issues)
text
🔸 1. Training Volume Low (10 items)
    - Risk: Overfitting على أسئلة قليلة
    - Recommendation: 25-50 items minimum

🔸 2. Canary % Conservative (10%)
    - Recommendation: 20% for faster signal

🔸 3. No A/B Test Explicit
    - Add: ENABLE_TRAINING_A vs ENABLE_TRAINING_B

🔸 4. Arabic Integration Missing
    - CAMeL Tools preprocessing غير مذكورة
    - Critical لـ cache hit ratio +30%

توصية أخيرة واحدة فقط (ليست تغييرًا):
عند التنفيذ:
•	التزم حرفيًا بالترتيب
•	لا تدمج مرحلتين “لتسريع العمل”
•	لا تسمح بتنفيذ جزئي للـ Pilot



Below is the unified, authoritative, and implementation-ready document that consolidates the strongest and most precise elements from everything you provided into one coherent architectural blueprint.
This document is written to serve three purposes simultaneously:
1.	Decision document (Go / No-Go at executive level)
2.	Authoritative guidance for professionals and AI agents
3.	Directly translatable specification into code, tests, and governance rules
No filler. No speculative language. No magical learning claims.
________________________________________
🎯 EasyData v16.7
Governed Cognitive Training Pilot
Authoritative Architectural Blueprint (Decision-Grade)
________________________________________
Executive Framing
This document defines the only acceptable form of training for EasyData.
Training is not:
•	probabilistic learning
•	model fine-tuning
•	pattern memorization
•	black-box optimization
Training is:
a controlled, explicit, auditable injection of verified domain knowledge
into the inference pipeline — without altering execution, security, or contracts.
This blueprint is binding.
Any implementation or agent output that deviates from it is invalid.
________________________________________
🧠 Part 1 — Pilot Purpose & Hypothesis (WHY)
Training Pilot Hypothesis
If we inject a small, curated set of approved Question → SQL knowledge units,
strictly scoped by SchemaAccessPolicy,
then EasyData will show a measurable improvement in first-pass SQL correctness and assumption clarity
for the same class of questions,
without changing execution behavior, security posture, streaming order, or latency guarantees.
Cognitive Gap Addressed
•	Ambiguity in mapping business intent → correct SQL structure
•	Repeated mistakes in:
o	joins
o	filters
o	temporal logic
•	Generic or weak assumptions despite correct syntax
Expected Improved Behavior
•	Higher structural correctness for repeated question patterns
•	More explicit, domain-aligned assumptions
•	Reduced fallback / safe-fail outcomes for known intents
Behavior That Must NOT Change
•	/ask streaming order (NDJSON)
•	SQLGuard enforcement
•	SchemaAccessPolicy enforcement
•	RBAC / RLS behavior
•	Output schema and response phases
•	Performance characteristics (no regressions)
Non-Goals (Hard)
•	❌ Natural language fluency improvement
•	❌ Training on unseen schemas
•	❌ Learning from raw data or query results
•	❌ Automatic or unsupervised learning
•	❌ Any change to model weights
•	❌ Any bypass of governance or guards
________________________________________
🧱 Part 2 — Training Scope (WHAT is trained)
Trainable Knowledge Units (Explicit Only)
Only reviewable, deterministic artifacts are eligible:
1. Question → SQL Pairs
•	SQL must be:
o	read-only
o	SQLGuard-safe
o	successfully executed at least once
•	Must include explicit assumptions
•	Scoped to a specific schema_version + policy_version
2. Structural Semantics
•	Column meaning clarification
(e.g., “balance = latest transaction amount”)
•	Table role explanation
•	Canonical join paths
3. Date & Aggregation Logic
•	Approved patterns only:
o	fiscal year
o	rolling windows
o	month / quarter grouping
4. Language Normalization
•	Deterministic synonym mapping
(e.g., “revenue” → SUM(amount))
•	Arabic normalization via ArabicQueryEngine
________________________________________
Explicitly Excluded Knowledge (Non-Negotiable)
•	❌ Raw data rows or samples
•	❌ Value distributions or statistics
•	❌ Execution plans or performance hints
•	❌ Business thresholds or decisions
•	❌ User preferences or identities
•	❌ Any SQL that failed SQLGuard
•	❌ Anything that could leak via model inversion
________________________________________
🧭 Part 3 — Training Inputs & Preconditions (WHEN training is allowed)
Mandatory Preconditions (ALL must be true)
•	Active SchemaAccessPolicy exists
•	Policy enforced with zero recent violations
•	Schema frozen (no migrations pending)
•	SQL references only allowed tables/columns
•	SQL executed successfully at least once
•	Assumptions are explicit and human-readable
•	Audit logging enabled
•	TrainingItem created with status = pending
Hard Blockers (Training stops immediately)
•	Missing or outdated SchemaAccessPolicy
•	Any SQLGuard violation
•	Missing assumptions
•	Out-of-scope references
•	Schema-specific artifact marked as general
•	Any bypass attempt detected
________________________________________
⚙️ Part 4 — Training Mechanics (HOW)
Deterministic Training Flow
1.	Ask
o	User submits question
o	System generates SQL + assumptions
2.	Feedback
o	User marks result as incorrect
o	Optional corrected SQL provided
3.	Training Item Creation
o	System creates TrainingItem:
	type: question_sql | doc
	scope: schema_version + policy_version
	status: pending
4.	Review & Approval
o	Admin verifies:
	correctness
	generality
	assumptions quality
o	Approve or Reject
5.	Knowledge Injection
o	Approved items only:
	embedded into ChromaDB
	tagged with metadata (policy, approver, timestamp)
6.	Inference Impact
o	Retrieval prefers approved items
o	Execution pipeline remains unchanged
o	SQLGuard re-validates at runtime
________________________________________
📊 Part 5 — Success Metrics & Failure Signals
Success Criteria (Objective)
Measured on a fixed evaluation set:
•	≥ 80% correctness for trained question class
•	≥ 30% reduction in repeated error classes
•	≥ 50% improvement in assumption completeness
•	0 SQLGuard regressions
•	0 governance bypass incidents
•	No latency regression (>150ms overhead forbidden)
Failure Signals (Immediate Action)
•	Correctness < 70%
•	New error classes introduced
•	Assumptions degrade
•	Regression in untrained domains (>5%)
•	Any SQLGuard violation
•	Any need to disable guards to pass
________________________________________
🧪 Part 6 — Pilot Execution Plan (Bounded Experiment)
Fixed Scope
•	Duration: 7–14 days
•	Question set: 15–25 carefully selected
•	Training volume: ≤ 10 approved items
•	Same questions asked pre/post training
Checkpoints
•	Day 0: Baseline
•	Mid-pilot: After 5 approvals
•	Final: End of pilot → Go / No-Go
No extensions without explicit approval.
________________________________________
🔐 Part 7 — Governance & Safety Constraints
Unbreakable Guarantees
•	Isolation
o	Training artifacts stored separately
o	Read-only access for runtime
•	Auditability
o	Every item tagged with:
	approver
	timestamp
	policy version
•	No SQL Bypass
o	Trained SQL treated as untrusted
o	SQLGuard enforced at runtime
•	Full Rollback
o	Single feature toggle disables training
o	No cleanup required
o	Vector store rebuildable from approved set
________________________________________
🚫 Global Constraints (Reiterated)
You MUST NOT:
•	Introduce new features
•	Modify architecture
•	Assume hidden signals
•	Skip approvals
•	Treat training as probabilistic magic
You MUST:
•	Respect all existing contracts
•	Treat training as explicit knowledge injection
•	Be conservative and measurable
________________________________________
✅ Definition of Done (Decision-Grade)
This pilot is acceptable only if:
•	A clear Go / No-Go decision is possible
•	Training impact is numerically demonstrated
•	Failure is detectable early
•	Pilot can be aborted instantly
•	No architectural changes are required
•	Governance remains enforceable
________________________________________
🏁 Final Executive Statement
This Training Pilot does not prove that the model is smart.
It proves that EasyData can learn safely, deliberately, and reversibly
under strict governance and full observability.
That is the only kind of learning acceptable in enterprise systems.
________________________________________
Status:
☑ Ready for Approval
☐ Go
☐ No-Go
☐ Defer (specify missing preconditions)
________________________________________


Below is the implementation checklist extracted directly from the authoritative Training Pilot Blueprint.
It is strictly executable, ordered, and maps one-to-one to code, tests, and governance artifacts.
No interpretation. No redesign. No feature creep.
________________________________________
✅ EasyData v16.7
Governed Cognitive Training Pilot
Implementation Checklist (Authoritative)
________________________________________
PHASE 0 — Pre-Implementation Gates (MANDATORY)
Nothing may be built until all items in this phase are satisfied.
Governance & Readiness
•	Active SchemaAccessPolicy exists and is enforced
•	Policy version frozen for pilot duration
•	No schema migrations pending
•	Zero SQLGuard violations in last 7 days
•	Audit logging enabled (ENABLE_AUDIT_LOGGING=true)
•	Training feature toggle exists (read-only unless admin API)
Documentation
•	Training Pilot Blueprint approved (this document)
•	Pilot scope signed off by Data Governance owner
•	Rollback procedure documented and reviewed
________________________________________
PHASE 1 — Data Model & Contracts
1. Training Item Schema
•	Define TrainingItem model:
o	id
o	type (question_sql | doc)
o	question
o	sql
o	assumptions
o	schema_version
o	policy_version
o	status (pending | approved | rejected)
o	created_by
o	approved_by
o	timestamps
•	Persist in system DB (not user DB)
•	Enforce immutability after approval
________________________________________
PHASE 2 — Capture & Feedback Pipeline
Feedback Capture
•	Capture incorrect answers via existing feedback endpoint
•	Require corrected SQL OR explicit clarification
•	Store feedback in training_staging
•	Tag with trace_id and policy_version
Validation
•	Validate SQL via sql_guard.validate()
•	Reject feedback if SQLGuard fails
•	Require assumptions field (non-empty)
________________________________________
PHASE 3 — Admin Review & Approval
Admin Workflow
•	Admin-only endpoint to list pending TrainingItems
•	Admin review checklist:
o	SQL correctness
o	Generality (not overfitted)
o	Assumptions clarity
o	Policy compliance
Approval / Rejection
•	Approval:
o	status → approved
o	log audit event
•	Rejection:
o	status → rejected
o	reason required
o	no injection
________________________________________
PHASE 4 — Knowledge Injection (RAG Layer)
Storage
•	Embed approved TrainingItems into ChromaDB
•	Metadata must include:
o	schema_version
o	policy_version
o	training_item_id
o	approved_by
o	timestamp
Retrieval
•	Retrieval must:
o	prefer approved items
o	respect schema + policy version match
o	be deterministic
•	No impact on execution pipeline
________________________________________
PHASE 5 — Inference Enforcement
Runtime Guards
•	Trained context treated as untrusted input
•	All generated SQL (trained or not) must pass:
•	sql_guard.validate(sql)
•	No runtime bypass paths
________________________________________
PHASE 6 — Metrics & Telemetry
Mandatory Metrics
•	First-pass SQL correctness (baseline vs post-training)
•	Repeated error class reduction
•	Assumption completeness score
•	SQLGuard pass rate (must remain 100%)
•	Latency delta (≤ +150ms)
•	Cache hit ratio change
Telemetry
•	Emit spans for:
o	training_item.created
o	training_item.approved
o	training_item.injected
•	Correlate with trace_id
•	Visible in SigNoz
________________________________________
PHASE 7 — Evaluation & Failure Detection
Offline Evaluation
•	Fixed evaluation question set
•	Pre-training baseline recorded
•	Post-training evaluation executed
Failure Signals (Automated)
•	Correctness < 70% → FAIL
•	Any SQLGuard violation → IMMEDIATE ROLLBACK
•	Untrained domain regression > 5% → FAIL
•	Assumptions degrade → FAIL
•	Latency regression > 300ms → FAIL
________________________________________
PHASE 8 — Rollback & Safety
Rollback Controls
•	Feature toggle to disable training layer
•	Toggle disables retrieval only (no deletes)
•	No runtime restart required
Data Safety
•	Training data append-only
•	Vector store rebuildable from approved set
•	No orphaned state after rollback
________________________________________
PHASE 9 — Frontend (Visibility Only)
Admin UI
•	View TrainingItems by status
•	Approve / Reject with reason
•	Read-only for non-admins
Transparency
•	Show:
o	baseline vs post-training metrics
o	active training items
o	rollback status
________________________________________
PHASE 10 — Final Go / No-Go
Decision Gate
•	All success metrics met → GO
•	Any hard failure → NO-GO
•	Partial results → DEFER (with reason)
•	Decision recorded
•	Audit log written
________________________________________
🏁 Final Rule
If any checklist item is skipped,
the Training Pilot is invalid by definition.
________________________________________


Below is a direct, deterministic mapping from the Training Pilot Implementation Checklist → concrete code modules in EasyData v16.7.
This is not a proposal.
This is an implementation map you can hand to engineers or agents and expect consistent results.
________________________________________
🧭 Training Pilot Checklist → Code Modules Map
EasyData v16.7 (Authoritative)
________________________________________
PHASE 0 — Governance & Readiness Gates
Checklist Item	Code Module / Location
Active SchemaAccessPolicy enforced	services/schema_policy_service.py
Policy version frozen	schema_access_policies.status == active
SQLGuard violations = 0	services/sql_guard.py + audit_logs
Audit logging enabled	core/config.py → ENABLE_AUDIT_LOGGING
Training toggle exists	api/v1/admin/settings.py
________________________________________
PHASE 1 — Data Model & Contracts
TrainingItem Schema
Concern	Module
Pydantic model	models/training_item.py
DB table (system DB)	models/db/training_items.py
Immutability after approval	services/training_item_service.py
Status enum	models/enums/training_status.py
________________________________________
PHASE 2 — Capture & Feedback Pipeline
Checklist Item	Code Module
Feedback endpoint	api/v1/feedback.py
Staging table	models/db/training_staging.py
Attach trace_id	middleware/trace_context.py
SQLGuard validation	services/sql_guard.py
Assumptions required	services/training_item_service.py
________________________________________
PHASE 3 — Admin Review & Approval
Checklist Item	Code Module
List pending items	api/v1/admin/training.py
RBAC enforcement	dependencies/require_permission.py
Approval logic	services/training_item_service.py
Audit logging	services/audit_service.py
Reject with reason	models/training_rejection.py
________________________________________
PHASE 4 — Knowledge Injection (RAG Layer)
Checklist Item	Code Module
Embedding approved items	services/training_embedding_service.py
ChromaDB client	providers/vectorstore/chromadb_provider.py
Metadata enforcement	services/training_metadata.py
Policy/schema match	services/training_scope_guard.py
________________________________________
PHASE 5 — Inference Enforcement
Checklist Item	Code Module
Treat trained context as untrusted	services/orchestration_service.py
Re-run SQLGuard	services/sql_guard.py
No bypass paths	core/exceptions.py
________________________________________
PHASE 6 — Metrics & Telemetry
Metric / Signal	Module
First-pass accuracy	services/training_evaluation_service.py
Error class tracking	services/error_classification.py
Latency measurement	middleware/performance.py
Cache hit ratio	services/semantic_cache_service.py
OTel spans	telemetry/spans.py
Mandatory spans:
•	training_item.created
•	training_item.approved
•	training_item.injected
________________________________________
PHASE 7 — Evaluation & Failure Detection
Checklist Item	Code Module
Offline eval runner	services/training_eval_runner.py
Baseline persistence	models/db/training_metrics.py
Regression detection	services/training_regression_guard.py
Auto rollback trigger	services/training_rollback_service.py
________________________________________
PHASE 8 — Rollback & Safety
Checklist Item	Code Module
Feature toggle	api/v1/admin/settings.py
Toggle consumption	providers/factory.py
Null Object Pattern	services/noop_training_service.py
Vector rebuild	services/vector_rebuild_service.py
________________________________________
PHASE 9 — Frontend (Visibility Only)
UI Element	Module
Training Sandbox page	src/pages/Admin/TrainingSandbox.tsx
Pending review list	src/components/TrainingQueue.tsx
Side-by-side diff	src/components/TrainingDiffView.tsx
Blind test runner	src/pages/Admin/TrainingEvaluation.tsx
RBAC gating	src/hooks/usePermissions.ts
________________________________________
PHASE 10 — Final Go / No-Go
Checklist Item	Code Module
Decision recording	services/training_decision_service.py
Audit log	services/audit_service.py
Status persistence	models/db/training_decisions.py
________________________________________
🔑 Cross-Cutting Enforcement (Non-Negotiable)
Rule	Module
SQLGuard mandatory	services/sql_guard.py
Schema policy binding	services/schema_policy_service.py
NDJSON streaming preserved	api/v1/ask.py
Admin-only actions	dependencies/require_permission.py
Config SSOT	core/config.py
Factory truth	providers/factory.py
________________________________________
🧠 Architectural Principle (Reminder)
Training does not introduce intelligence.
It introduces constraint.
Every module above exists to ensure:
•	explicit knowledge
•	reversible impact
•	measurable benefit
•	zero governance drift
________________________________________


Below is the authoritative dependency graph for the Governed Cognitive Training Pilot in EasyData v16.7.
It is expressed in layered + directional form, so it can be:
•	implemented safely
•	validated architecturally
•	converted to diagrams or CI checks
•	enforced by agents
No interpretation. No optional edges.
________________________________________
🧭 EasyData v16.7
Governed Training Pilot — Dependency Graph
________________________________________
🔰 LAYER 0 — Configuration & Law (Root of Truth)
Nothing depends on training unless enabled here.
.env
 └── core/config.py
Provides:
•	Feature toggles
•	Environment (production vs non-prod)
•	Governance modes
•	Safety guards
All layers depend on this.
________________________________________
🔐 LAYER 1 — Security & Governance Core (Non-Bypassable)
core/exceptions.py
security/sql_guard.py
services/schema_policy_service.py
services/audit_service.py
dependencies/require_permission.py
Rules:
•	SQLGuard MUST be called before execution
•	SchemaAccessPolicy MUST be enforced
•	Audit MUST log all actions
•	RBAC MUST gate admin actions
⬅️ Every downstream layer depends on this layer
________________________________________
🧱 LAYER 2 — Domain Models & Contracts
models/enums/training_status.py
models/training_item.py
models/db/training_items.py
models/db/training_staging.py
models/db/training_metrics.py
models/db/training_decisions.py
Defines:
•	TrainingItem lifecycle
•	Persistence schema
•	Status transitions
•	Immutability rules
⬅️ Consumed by services
⬅️ Never depend on services or APIs
________________________________________
⚙️ LAYER 3 — Core Training Services (Business Logic)
services/training_item_service.py
services/training_scope_guard.py
services/training_embedding_service.py
services/training_metadata.py
services/training_decision_service.py
Responsibilities:
•	Validate training items
•	Enforce schema/policy scope
•	Control approval flow
•	Prepare embedding payloads
⬅️ Depends on:
•	Layer 1 (security)
•	Layer 2 (models)
⬇️ Provides logic to API & inference
________________________________________
🧪 LAYER 4 — Evaluation & Regression Control
services/training_evaluation_service.py
services/training_eval_runner.py
services/training_regression_guard.py
services/training_rollback_service.py
Responsibilities:
•	Baseline capture
•	Post-training comparison
•	Failure detection
•	Rollback trigger
⬅️ Depends on:
•	Layer 3 (training logic)
•	Layer 1 (audit + guards)
⬇️ Feeds metrics to observability
________________________________________
🧠 LAYER 5 — Knowledge Injection (RAG / Vector Layer)
providers/vectorstore/chromadb_provider.py
services/vector_rebuild_service.py
services/noop_training_service.py
Responsibilities:
•	Store approved knowledge
•	Rebuild safely
•	Provide Null Object when disabled
⬅️ Depends on:
•	Layer 3 (approved items)
•	Layer 0 (feature toggles)
⬇️ Consumed by orchestration
________________________________________
🧩 LAYER 6 — Provider Factory (Single Point of Truth)
providers/factory.py
Decisions:
•	RealTrainingService vs NoOpTrainingService
•	Semantic cache on/off
•	Feature isolation
⬅️ Depends on:
•	core/config.py
•	No business logic
⬇️ Injected into orchestration
________________________________________
🔄 LAYER 7 — Orchestration & Runtime Execution
services/orchestration_service.py
services/semantic_cache_service.py
services/arabic_query_engine.py
Flow:
1.	Arabic preprocessing
2.	Trained context retrieval
3.	LLM generation
4.	SQLGuard validation
5.	Execution
⬅️ Depends on:
•	Layer 1 (guards)
•	Layer 5 (knowledge)
•	Layer 6 (factory)
⬇️ Emits telemetry
________________________________________
📡 LAYER 8 — Telemetry & Observability
telemetry/spans.py
middleware/trace_context.py
services/sentry_proxy_service.py
tests/test_telemetry.py
Responsibilities:
•	Emit mandatory spans
•	Correlate trace_id
•	Validate instrumentation
•	Surface failures
⬅️ Observes all layers
❌ Does not influence logic
________________________________________
🌐 LAYER 9 — API Surface (Controlled Access)
api/v1/ask.py
api/v1/feedback.py
api/v1/admin/training.py
api/v1/admin/settings.py
Rules:
•	No business logic
•	RBAC enforced
•	NDJSON streaming preserved
⬅️ Depends on:
•	Layer 3 (services)
•	Layer 7 (orchestration)
⬇️ Serves frontend
________________________________________
🖥️ LAYER 10 — Frontend (Visibility & Control Only)
src/pages/Admin/TrainingSandbox.tsx
src/components/TrainingQueue.tsx
src/components/TrainingDiffView.tsx
src/pages/Admin/TrainingEvaluation.tsx
src/hooks/usePermissions.ts
Rules:
•	No intelligence
•	No bypass
•	Admin-only actions
•	Display & trigger only
⬅️ Depends on API
❌ Never depends on backend internals
________________________________________
🔁 CRITICAL FLOW SUMMARY (Topological)
.env
 → config
   → security & policy
     → models
       → training services
         → evaluation / rollback
           → vector store
             → provider factory
               → orchestration
                 → telemetry
                   → API
                     → frontend
________________________________________
🚫 Forbidden Dependencies (Hard Errors)
❌ API → DB directly
❌ Frontend → Vector Store
❌ Training → SQL execution bypassing SQLGuard
❌ Services → .env directly
❌ Orchestration → conditional feature logic (must go via factory)
________________________________________
🏁 Architectural Seal
This dependency graph guarantees:
•	zero hidden coupling
•	reversible training
•	measurable impact
•	enforceable governance
•	agent-safe development


Below is the exact conversion of the dependency graph into Mermaid and PlantUML.
Both are architecturally faithful, layered, and safe to paste directly into documentation or CI-generated diagrams.
No abstraction loss. No extra edges.
________________________________________
🧭 Option 1 — Mermaid (Recommended for Markdown / GitHub / DokuWiki)
graph TD

%% =========================
%% Layer 0 — Configuration
%% =========================
ENV[".env"] --> CONFIG["core/config.py"]

%% =========================
%% Layer 1 — Security & Governance Core
%% =========================
CONFIG --> SQLGUARD["security/sql_guard.py"]
CONFIG --> POLICY["services/schema_policy_service.py"]
CONFIG --> AUDIT["services/audit_service.py"]
CONFIG --> RBAC["dependencies/require_permission.py"]
CONFIG --> EXC["core/exceptions.py"]

%% =========================
%% Layer 2 — Domain Models
%% =========================
SQLGUARD --> MODELS["models/*"]
POLICY --> MODELS
AUDIT --> MODELS

%% =========================
%% Layer 3 — Training Services
%% =========================
MODELS --> TRAINING_SVC["services/training_item_service.py"]
MODELS --> SCOPE_GUARD["services/training_scope_guard.py"]
MODELS --> EMBEDDING_SVC["services/training_embedding_service.py"]
MODELS --> METADATA_SVC["services/training_metadata.py"]
MODELS --> DECISION_SVC["services/training_decision_service.py"]

SQLGUARD --> TRAINING_SVC
POLICY --> SCOPE_GUARD
AUDIT --> TRAINING_SVC
RBAC --> TRAINING_SVC

%% =========================
%% Layer 4 — Evaluation & Rollback
%% =========================
TRAINING_SVC --> EVAL_SVC["services/training_evaluation_service.py"]
EVAL_SVC --> REGRESSION["services/training_regression_guard.py"]
REGRESSION --> ROLLBACK["services/training_rollback_service.py"]
AUDIT --> ROLLBACK

%% =========================
%% Layer 5 — Knowledge Injection (Vector Layer)
%% =========================
TRAINING_SVC --> VECTOR["providers/vectorstore/chromadb_provider.py"]
VECTOR --> REBUILD["services/vector_rebuild_service.py"]
CONFIG --> NOOP["services/noop_training_service.py"]

%% =========================
%% Layer 6 — Provider Factory
%% =========================
CONFIG --> FACTORY["providers/factory.py"]
VECTOR --> FACTORY
NOOP --> FACTORY

%% =========================
%% Layer 7 — Orchestration & Runtime
%% =========================
FACTORY --> ORCH["services/orchestration_service.py"]
FACTORY --> CACHE["services/semantic_cache_service.py"]
FACTORY --> ARABIC["services/arabic_query_engine.py"]

SQLGUARD --> ORCH
POLICY --> ORCH

%% =========================
%% Layer 8 — Telemetry & Observability
%% =========================
ORCH --> OTEL["telemetry/spans.py"]
ORCH --> TRACE["middleware/trace_context.py"]
ORCH --> SENTRY["services/sentry_proxy_service.py"]

%% =========================
%% Layer 9 — API Layer
%% =========================
ORCH --> ASK_API["api/v1/ask.py"]
TRAINING_SVC --> FEEDBACK_API["api/v1/feedback.py"]
TRAINING_SVC --> ADMIN_TRAIN["api/v1/admin/training.py"]
CONFIG --> ADMIN_SETTINGS["api/v1/admin/settings.py"]

%% =========================
%% Layer 10 — Frontend
%% =========================
ASK_API --> UI["Frontend (Admin & User UI)"]
ADMIN_TRAIN --> UI
ADMIN_SETTINGS --> UI
________________________________________
🧭 Option 2 — PlantUML (Best for Formal Architecture Docs)
@startuml
skinparam componentStyle rectangle
skinparam shadowing false

package "Layer 0: Configuration" {
  [.env] --> [core/config.py]
}

package "Layer 1: Security & Governance" {
  [core/config.py] --> [sql_guard.py]
  [core/config.py] --> [schema_policy_service.py]
  [core/config.py] --> [audit_service.py]
  [core/config.py] --> [require_permission.py]
  [core/config.py] --> [exceptions.py]
}

package "Layer 2: Domain Models" {
  [sql_guard.py] --> [models]
  [schema_policy_service.py] --> [models]
  [audit_service.py] --> [models]
}

package "Layer 3: Training Services" {
  [models] --> [training_item_service.py]
  [models] --> [training_scope_guard.py]
  [models] --> [training_embedding_service.py]
  [models] --> [training_metadata.py]
  [models] --> [training_decision_service.py]

  [sql_guard.py] --> [training_item_service.py]
  [schema_policy_service.py] --> [training_scope_guard.py]
  [audit_service.py] --> [training_item_service.py]
  [require_permission.py] --> [training_item_service.py]
}

package "Layer 4: Evaluation & Rollback" {
  [training_item_service.py] --> [training_evaluation_service.py]
  [training_evaluation_service.py] --> [training_regression_guard.py]
  [training_regression_guard.py] --> [training_rollback_service.py]
  [audit_service.py] --> [training_rollback_service.py]
}

package "Layer 5: Knowledge Injection" {
  [training_item_service.py] --> [chromadb_provider.py]
  [chromadb_provider.py] --> [vector_rebuild_service.py]
  [core/config.py] --> [noop_training_service.py]
}

package "Layer 6: Provider Factory" {
  [core/config.py] --> [factory.py]
  [chromadb_provider.py] --> [factory.py]
  [noop_training_service.py] --> [factory.py]
}

package "Layer 7: Orchestration" {
  [factory.py] --> [orchestration_service.py]
  [factory.py] --> [semantic_cache_service.py]
  [factory.py] --> [arabic_query_engine.py]

  [sql_guard.py] --> [orchestration_service.py]
  [schema_policy_service.py] --> [orchestration_service.py]
}

package "Layer 8: Telemetry" {
  [orchestration_service.py] --> [otel_spans.py]
  [orchestration_service.py] --> [trace_context.py]
  [orchestration_service.py] --> [sentry_proxy_service.py]
}

package "Layer 9: API" {
  [orchestration_service.py] --> [/api/v1/ask]
  [training_item_service.py] --> [/api/v1/feedback]
  [training_item_service.py] --> [/api/v1/admin/training]
  [core/config.py] --> [/api/v1/admin/settings]
}

package "Layer 10: Frontend" {
  [/api/v1/ask] --> [UI]
  [/api/v1/admin/training] --> [UI]
  [/api/v1/admin/settings] --> [UI]
}

@enduml
________________________________________
🏁 Final Note (Architectural Integrity)
These diagrams enforce:
•	Single Source of Truth
•	Factory-as-Law
•	No hidden coupling
•	No governance bypass
•	Safe rollback paths
They are suitable for:
•	ADR attachments
•	CI architecture checks
•	Agent constraints
•	Enterprise design reviews


Below is the Training-Only Subgraph, extracted cleanly from the full architecture and restricted strictly to the Governed Cognitive Training domain.
This subgraph:
•	excludes runtime execution (/ask)
•	excludes frontend UX details
•	excludes observability plumbing not specific to training
•	shows only what must exist for training to function safely
It is suitable for:
•	ADR attachment
•	Training subsystem ownership
•	Agent-level constraints
•	CI architecture validation
________________________________________
🧠 EasyData v16.7
Governed Cognitive Training — Training-Only Subgraph
________________________________________
🧭 Mermaid — Training-Only Dependency Graph
graph TD

%% =========================
%% Configuration & Toggles
%% =========================
ENV[".env"] --> CONFIG["core/config.py"]

%% =========================
%% Governance Core (Mandatory)
%% =========================
CONFIG --> SQLGUARD["security/sql_guard.py"]
CONFIG --> POLICY["services/schema_policy_service.py"]
CONFIG --> AUDIT["services/audit_service.py"]
CONFIG --> RBAC["dependencies/require_permission.py"]

%% =========================
%% Training Domain Models
%% =========================
SQLGUARD --> MODELS["models/training_item.py"]
POLICY --> MODELS
AUDIT --> MODELS

%% =========================
%% Training Capture & Validation
%% =========================
MODELS --> TRAINING_SVC["services/training_item_service.py"]
SQLGUARD --> TRAINING_SVC
POLICY --> TRAINING_SVC
AUDIT --> TRAINING_SVC
RBAC --> TRAINING_SVC

%% =========================
%% Admin Review & Decision
%% =========================
TRAINING_SVC --> DECISION["services/training_decision_service.py"]
DECISION --> AUDIT

%% =========================
%% Knowledge Injection (RAG Context)
%% =========================
TRAINING_SVC --> EMBEDDING["services/training_embedding_service.py"]
EMBEDDING --> VECTOR["providers/vectorstore/chromadb_provider.py"]

%% =========================
%% Training Evaluation & Safety
%% =========================
TRAINING_SVC --> EVAL["services/training_evaluation_service.py"]
EVAL --> REGRESSION["services/training_regression_guard.py"]
REGRESSION --> ROLLBACK["services/training_rollback_service.py"]
ROLLBACK --> CONFIG

%% =========================
%% Feature Gating (Factory Law)
%% =========================
CONFIG --> FACTORY["providers/factory.py"]
VECTOR --> FACTORY
CONFIG --> NOOP["services/noop_training_service.py"]
NOOP --> FACTORY

%% =========================
%% API Surface (Training Only)
%% =========================
TRAINING_SVC --> FEEDBACK_API["api/v1/feedback.py"]
TRAINING_SVC --> ADMIN_API["api/v1/admin/training.py"]
CONFIG --> ADMIN_SETTINGS["api/v1/admin/settings.py"]
________________________________________
🧭 PlantUML — Training-Only Subgraph
@startuml
skinparam componentStyle rectangle
skinparam shadowing false

package "Config & Toggles" {
  [.env] --> [core/config.py]
}

package "Governance Core" {
  [core/config.py] --> [sql_guard.py]
  [core/config.py] --> [schema_policy_service.py]
  [core/config.py] --> [audit_service.py]
  [core/config.py] --> [require_permission.py]
}

package "Training Models" {
  [sql_guard.py] --> [training_item.py]
  [schema_policy_service.py] --> [training_item.py]
  [audit_service.py] --> [training_item.py]
}

package "Training Logic" {
  [training_item.py] --> [training_item_service.py]
  [sql_guard.py] --> [training_item_service.py]
  [schema_policy_service.py] --> [training_item_service.py]
  [audit_service.py] --> [training_item_service.py]
  [require_permission.py] --> [training_item_service.py]
}

package "Approval & Decisions" {
  [training_item_service.py] --> [training_decision_service.py]
  [training_decision_service.py] --> [audit_service.py]
}

package "Knowledge Injection" {
  [training_item_service.py] --> [training_embedding_service.py]
  [training_embedding_service.py] --> [chromadb_provider.py]
}

package "Evaluation & Rollback" {
  [training_item_service.py] --> [training_evaluation_service.py]
  [training_evaluation_service.py] --> [training_regression_guard.py]
  [training_regression_guard.py] --> [training_rollback_service.py]
  [training_rollback_service.py] --> [core/config.py]
}

package "Factory (Feature Gating)" {
  [core/config.py] --> [factory.py]
  [chromadb_provider.py] --> [factory.py]
  [core/config.py] --> [noop_training_service.py]
  [noop_training_service.py] --> [factory.py]
}

package "Training APIs" {
  [training_item_service.py] --> [/api/v1/feedback]
  [training_item_service.py] --> [/api/v1/admin/training]
  [core/config.py] --> [/api/v1/admin/settings]
}

@enduml
________________________________________
🔑 Architectural Properties of This Subgraph
This subgraph guarantees:
•	✅ Training is impossible without governance
•	✅ No learning without approval
•	✅ No injection without SQLGuard
•	✅ Rollback is a config-level action
•	✅ Training can be fully disabled without code changes
•	✅ No dependency on runtime execution path
________________________________________
🚫 Explicitly Excluded (By Design)
The following are not allowed to appear in this subgraph:
•	/api/v1/ask
•	orchestration_service.py
•	semantic_cache_service.py
•	frontend UI components
•	direct DB execution
•	observability-only spans
If any of these appear → architectural violation.
________________________________________
🏁 Final Seal
This is the minimum closed system required for safe, enterprise-grade training in EasyData.




________________________________________
ADR-0019: Governed Cognitive Training Pilot
Status: Approved – Binding
Date: 2025-01-XX
Version: EasyData v16.7
Decision Type: Architectural / Governance
Scope: Backend · RAG · Governance · Observability
Owners: Architecture · Data Governance · Security
________________________________________
1. Context
EasyData v16.7 operates under strict governance constraints:
•	SQLGuard is mandatory and non-bypassable
•	SchemaAccessPolicy is enforced at runtime
•	/ask execution path, streaming order, and security contracts are immutable
•	Observability and auditability are first-class requirements
However, repeated user questions within the same schema and policy scope reveal systematic correctness gaps:
•	Ambiguous mapping from business intent to SQL structure
•	Repeated structural errors (joins, filters, temporal logic)
•	Weak or implicit assumptions despite syntactically valid SQL
Traditional ML training or fine-tuning is explicitly forbidden due to:
•	Non-determinism
•	Lack of auditability
•	Incompatibility with enterprise governance
A controlled alternative is required.
________________________________________
2. Decision
We introduce a Governed Cognitive Training Pilot based on explicit knowledge injection, not learning.
Training in EasyData is formally defined as:
A controlled, explicit, auditable injection of verified domain knowledge
into the inference pipeline, without altering execution, security, or contracts.
This pilot is bounded, reversible, deterministic, and governed.
________________________________________
3. Scope of Training (Explicitly Allowed)
Only the following deterministic knowledge units may be injected:
1.	Question → SQL pairs
o	SQL must be read-only
o	SQL must pass SQLGuard
o	SQL must have executed successfully at least once
o	Explicit assumptions are mandatory
o	Scoped to a specific schema_version + policy_version
2.	Structural semantics
o	Canonical join paths
o	Table role clarification
o	Column meaning clarification
3.	Date & aggregation logic
o	Approved patterns only (fiscal year, rolling windows, quarter/month)
4.	Language normalization
o	Deterministic synonym mapping
o	Arabic normalization via ArabicQueryEngine
________________________________________
4. Explicit Non-Goals (Hard Constraints)
The following are strictly forbidden:
•	Model fine-tuning or weight updates
•	Probabilistic or unsupervised learning
•	Training on raw data or query results
•	Storing data samples, distributions, or statistics
•	Bypassing SQLGuard or SchemaAccessPolicy
•	Any change to /ask execution flow or streaming order
Any implementation violating these constraints is architecturally invalid.
________________________________________
5. Training Lifecycle (Deterministic)
1.	Capture
o	User marks answer as incorrect
o	Corrected SQL or clarified assumptions provided
o	Stored as TrainingItem with status pending
2.	Validation
o	SQLGuard validation required
o	Assumptions required and human-readable
o	Out-of-scope references rejected
3.	Admin Review
o	Admin-only approval or rejection
o	Checklist enforced in code:
	Correctness
	Generality
	Assumption quality
	Policy compliance
4.	Knowledge Injection
o	Approved items only
o	Embedded into vector store (ChromaDB)
o	Tagged with schema + policy version metadata
5.	Inference Impact
o	Retrieval prefers approved items
o	Execution pipeline unchanged
o	SQLGuard re-validates at runtime
________________________________________
6. Governance Guarantees
This decision enforces the following non-negotiable guarantees:
•	Isolation: Training artifacts are stored separately from runtime execution
•	Auditability: Every action is logged with approver, timestamp, and versions
•	Reversibility: Single feature toggle disables training retrieval instantly
•	No Trust Elevation: Trained SQL is treated as untrusted input
•	No Bypass: SQLGuard and policy enforcement remain mandatory
________________________________________
7. Observability & Metrics
The pilot is measurable and falsifiable.
Mandatory Telemetry Spans
•	training_item.created
•	training_item.approved
•	training_item.injected
Success Metrics
•	≥ 80% first-pass SQL correctness for trained question class
•	≥ 30% reduction in repeated error classes
•	≥ 50% improvement in assumption completeness
•	0 SQLGuard regressions
•	≤ 150ms latency overhead
Failure Signals (Immediate Rollback)
•	SQLGuard violation
•	Correctness < 70%
•	New error classes introduced
•	Regression in untrained domains > 5%
•	Latency regression > 300ms
________________________________________
8. Rollback Strategy
•	Feature toggle disables training retrieval only
•	No data deletion required
•	No restart required
•	Vector store rebuildable from approved set
Rollback is guaranteed to be safe, immediate, and complete.
________________________________________
9. Consequences
Positive
•	Measurable correctness improvement without architectural risk
•	Explicit, reviewable knowledge capture
•	Full governance and audit alignment
Trade-offs
•	Training is intentionally slow and admin-gated
•	No automatic learning or adaptation
•	Limited scope by design
These trade-offs are intentional and accepted.
________________________________________
10. Final Architectural Position
This ADR formally establishes that:
EasyData does not “learn” in the ML sense.
It accumulates explicit, governed knowledge under strict control.
Any future proposal that introduces probabilistic learning, implicit adaptation, or bypasses governance must supersede this ADR explicitly or is invalid by default.
________________________________________
Decision:
☑ Approved
☐ Rejected
☐ Deferred
This ADR is binding for EasyData v16.7 and later unless explicitly superseded.

