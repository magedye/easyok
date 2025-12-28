# Bridge Contract v16.7.8 — Execution vs Exploration Boundary
This contract is immutable. Any change to execution paths requires a new ADR.

## Execution Contract (Tier 0 / Fortress)
- confidence_tier must be `TIER_0_FORTRESS`.
- Payload must contain governed fields only (technical_view, data_chunk, business_view).
- No advisory or exploratory fields permitted in execution inputs.
- SQL execution occurs only after SQLGuard + policy enforcement.

## Exploration Contract (Tier 1 / Lab)
- confidence_tier must be `TIER_1_LAB`.
- Outputs are advisory only (thinking, explanation_chunk, chart_suggestion_chunk, business_view).
- No SQL execution; no escalation; no persistence.

## Non-Escalation Rule
- Tier escalation cannot occur programmatically within a request.
- Any attempt to mix advisory content into execution is a boundary violation.

## Enforcement Points
- Orchestrator must assert Tier 0 before execution.
- Advisory fields are rejected from execution payloads.
- Boundary violations emit error + end chunks and are audited as `Boundary_Violation`.

## CI Guard
- verify_architecture.py must fail if execution path is modified without updating this contract/ADR.
