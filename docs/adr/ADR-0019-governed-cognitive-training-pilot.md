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
• SQLGuard is mandatory and non-bypassable
• SchemaAccessPolicy is enforced at runtime
• /ask execution path, streaming order, and security contracts are immutable
• Observability and auditability are first-class requirements
However, repeated user questions within the same schema and policy scope reveal systematic correctness gaps:
• Ambiguous mapping from business intent to SQL structure
• Repeated structural errors (joins, filters, temporal logic)
• Weak or implicit assumptions despite syntactically valid SQL
Traditional ML training or fine-tuning is explicitly forbidden due to:
• Non-determinism
• Lack of auditability
• Incompatibility with enterprise governance
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
1. Question → SQL pairs
o SQL must be read-only
o SQL must pass SQLGuard
o SQL must have executed successfully at least once
o Explicit assumptions are mandatory
o Scoped to a specific schema_version + policy_version
2. Structural semantics
o Canonical join paths
o Table role clarification
o Column meaning clarification
3. Date & aggregation logic
o Approved patterns only (fiscal year, rolling windows, quarter/month)
4. Language normalization
o Deterministic synonym mapping
o Arabic normalization via ArabicQueryEngine
________________________________________
4. Explicit Non-Goals (Hard Constraints)
The following are strictly forbidden:
• Model fine-tuning or weight updates
• Probabilistic or unsupervised learning
• Training on raw data or query results
• Storing data samples, distributions, or statistics
• Bypassing SQLGuard or SchemaAccessPolicy
• Any change to /ask execution flow or streaming order
Any implementation violating these constraints is architecturally invalid.
________________________________________
5. Training Lifecycle (Deterministic)
1. Capture
o User marks answer as incorrect
o Corrected SQL or clarified assumptions provided
o Stored as TrainingItem with status pending
2. Validation
o SQLGuard validation required
o Assumptions required and human-readable
o Out-of-scope references rejected
3. Admin Review
o Admin-only approval or rejection
o Checklist enforced in code:
 Correctness
 Generality
 Assumption quality
 Policy compliance
4. Knowledge Injection
o Approved items only
o Embedded into vector store (ChromaDB)
o Tagged with schema + policy version metadata
5. Inference Impact
o Retrieval prefers approved items
o Execution pipeline unchanged
o SQLGuard re-validates at runtime
________________________________________
6. Governance Guarantees
This decision enforces the following non-negotiable guarantees:
• Isolation: Training artifacts are stored separately from runtime execution
• Auditability: Every action is logged with approver, timestamp, and versions
• Reversibility: Single feature toggle disables training retrieval instantly
• No Trust Elevation: Trained SQL is treated as untrusted input
• No Bypass: SQLGuard and policy enforcement remain mandatory
________________________________________
7. Observability & Metrics
The pilot is measurable and falsifiable.
Mandatory Telemetry Spans
• training_item.created
• training_item.approved
• training_item.injected
Success Metrics
• ≥ 80% first-pass SQL correctness for trained question class
• ≥ 30% reduction in repeated error classes
• ≥ 50% improvement in assumption completeness
• 0 SQLGuard regressions
• ≤ 150ms latency overhead
Failure Signals (Immediate Rollback)
• SQLGuard violation
• Correctness < 70%
• New error classes introduced
• Regression in untrained domains > 5%
• Latency regression > 300ms
________________________________________
8. Rollback Strategy
• Feature toggle disables training retrieval only
• No data deletion required
• No restart required
• Vector store rebuildable from approved set
Rollback is guaranteed to be safe, immediate, and complete.
________________________________________
9. Consequences
Positive
• Measurable correctness improvement without architectural risk
• Explicit, reviewable knowledge capture
• Full governance and audit alignment
Trade-offs
• Training is intentionally slow and admin-gated
• No automatic learning or adaptation
• Limited scope by design
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
