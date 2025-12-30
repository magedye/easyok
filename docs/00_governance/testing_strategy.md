# EasyData Testing Strategy

**Architecture-First · Governance-Driven · Execution-Ready**

## 1. Purpose

This document defines the official testing strategy for EasyData.

The objective is not to “prove the system works once,” but to continuously enforce architectural integrity, governance guarantees, and operational readiness across all stages of development.

Testing in EasyData is layered by intent, not by tooling.

## 2. Core Principles

1. Architecture before functionality — tests protect decisions, not just behavior.
2. Governance is enforceable — every security or policy rule must be backed by a test.
3. Determinism in CI, realism outside CI  
   - CI → deterministic, mocked, fast  
   - Runtime verification → real DB, real LLM, real failures
4. No silent regressions — any architectural or contract drift must break tests immediately.

## 3. Testing Layers Overview

| Layer | Tooling        | Purpose                                  | Environment     |
| ----- | -------------- | ---------------------------------------- | --------------- |
| L1    | pytest         | Contract, governance, policy enforcement | CI / Local      |
| L2    | Verification v3| Real DB + LLM connectivity               | Local / Staging |
| L3    | Verification v4| Load, failure injection, resilience      | Local / Staging |
| L4    | Manual / Prod  | Observability validation                 | Production      |

Each layer answers a different question. No layer replaces another.

## 4. Layer 1 — pytest (Architectural & Governance Tests)

### 4.1 Role of pytest

pytest is not used to validate:
- performance
- real DB connectivity
- real LLM responses
- streaming under load

pytest is used to guarantee:
- API contract stability
- governance invariants
- policy enforcement
- failure behavior consistency
- protection against architectural drift

pytest is a hard gate.

### 4.2 Canonical pytest Structure

```
tests/
├── api/              # API contract & routing
├── contract/         # OpenAPI ↔ runtime parity
├── governance/       # RBAC, admin guards, feature toggles
├── policy/           # SQLGuard & policy violation shape
├── orchestration/    # Stream logic (order, termination)
├── streaming/        # NDJSON contract (logical)
├── observability/    # Health & metrics shape
├── failure/          # Mocked provider failures
└── conftest.py
```

This structure is binding.

### 4.3 What pytest MUST Cover

**A. API Contract Stability**
- Required fields, type validation, method restrictions, backward compatibility

**B. Governance & Security**
- `/admin` access rules
- Local admin bypass behavior
- Immutable feature flags
- RBAC invariants

**C. Policy Enforcement**
- SQLGuard blocks forbidden SQL
- Policy violations return standardized JSON errors
- No silent fallthroughs

**D. Streaming Contract (Logical)**
- Event order correctness
- Mandatory terminal events
- No summary before data

**E. Failure Handling (Mocked)**
- LLM failure → controlled error
- DB failure → controlled error
- No unhandled exceptions

**F. Observability Shape**
- Health endpoints exist
- Response structure is stable
- Metrics endpoints shape-validated (if present)

### 4.4 What pytest MUST NOT Do

- No real DB connections
- No real LLM calls
- No real streaming IO
- No load or stress testing
- No timing-sensitive assertions

## 5. Layer 2 — Verification v3 (Operational Reality)

Purpose: Prove the system actually works with real DB, real LLM, real orchestration.  
Scope: DB connectivity, LLM live responses, end-to-end conversation, NDJSON stream presence.  
Nature: Non-CI, execution-time evidence, operator-driven.

## 6. Layer 3 — Verification v4 (Resilience & Trust)

Purpose: Prove the system fails correctly.  
Scope: Load handling, streaming under concurrency, LLM/DB outage behavior, timeouts, circuit breaker activation.  
Nature: Pre-production gate, chaos-aware, trust-building.

## 7. Acceptance Gates

- Gate A (Before Frontend Integration): pytest passing; Verification v3 successful.
- Gate B (Before Staging/Demo): pytest passing; v3 passing; v4 executed with acceptable outcomes.
- Gate C (Before Production): pytest passing; v4 reviewed; observability validated.

## 8. Governance Statement

Any change that alters API shape, modifies security rules, affects streaming semantics, or weakens policy enforcement MUST:
1. Update tests
2. Pass all pytest gates
3. Be justifiable against this strategy

## 9. Final Position

EasyData testing is prescriptive, not defensive. Tests exist to make regressions impossible to introduce. This document is binding for all contributors and agents.
