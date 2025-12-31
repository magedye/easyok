# NDJSON Streaming Contract (Canonical)

**Status:** FINAL
**Version:** Phase 4 (Fortress)
**Applies To:** `/api/v1/ask`, `/api/v1/chat/stream`
**Audience:** Backend, Frontend, QA, Governance
**Authority Level:** Binding / Fail-Closed

---

## 1. Purpose

This document defines the **single authoritative NDJSON streaming contract** for EasyData Fortress.
Any deviation from this contract is a **governance violation** and MUST result in a hard failure.

This file supersedes any other NDJSON or streaming description in the repository.

---

## 2. Non-Negotiable Principles

1. **Strict Order Enforcement**
   Chunks MUST follow an explicitly allowed transition order.

2. **Trace ID Consistency**
   All chunks in a stream MUST share the same `trace_id`.

3. **Fail-Closed on Error**
   Any error immediately terminates normal processing.

4. **Frontend Is a Passive Consumer**
   The frontend MUST NOT infer, reorder, retry mid-stream, or interpret SQL.

5. **END Is Mandatory**
   Every stream MUST terminate with exactly one `end` chunk.

---

## 3. Base NDJSON Chunk Schema

Each line is a complete JSON object terminated by a newline (`\n`).

```json
{
  "type": "<ChunkType>",
  "trace_id": "<uuid>",
  "timestamp": "<ISO-8601>",
  "payload": {}
}
```

---

## 4. Canonical Chunk Types

### 4.1 THINKING (Required — First)

```json
{
  "type": "thinking",
  "payload": {
    "content": "Reasoning text",
    "step": "analysis"
  }
}
```

**Rules**

* MUST be the first chunk.
* Emitted exactly once.

---

### 4.2 TECHNICAL_VIEW (Optional)

```json
{
  "type": "technical_view",
  "payload": {
    "sql": "SELECT ...",
    "assumptions": [],
    "is_safe": true,
    "policy_hash": "optional"
  }
}
```

**Governance**

* SQL is **display-only**.
* Frontend MUST NOT parse, validate, or modify SQL or assumptions.

---

### 4.3 DATA (Optional)

```json
{
  "type": "data",
  "payload": {
    "rows": [],
    "columns": [],
    "row_count": 0
  }
}
```

---

### 4.4 BUSINESS_VIEW (Optional)

```json
{
  "type": "business_view",
  "payload": {
    "text": "User-facing summary",
    "metrics": {},
    "chart": {}
  }
}
```

---

### 4.5 ERROR (Conditional — Terminal)

```json
{
  "type": "error",
  "payload": {
    "message": "Human-readable message",
    "error_code": "MACHINE_CODE",
    "details": {}
  }
}
```

**Hard Rules**

* Represents a **terminal failure**.
* Only **one** error chunk may be emitted.
* MUST be followed by exactly one `end` chunk.
* No normal processing may resume after this point.

---

### 4.6 END (Required — Last)

```json
{
  "type": "end",
  "payload": {
    "status": "success | failed",
    "total_chunks": 0,
    "message": "optional"
  }
}
```

**Rules**

* MUST be emitted exactly once.
* MUST be the final chunk.
* After `end`, no further output is allowed.

---

## 5. Valid Chunk Transitions (Authoritative)

```text
thinking
 ├─> technical_view
 │    ├─> data
 │    │    ├─> business_view
 │    │    │    ├─> end
 │    │    │    └─> error ─> end
 │    │    └─> error ─> end
 │    └─> error ─> end
 ├─> business_view ─> end
 ├─> error ─> end
 └─> end
```

No other transitions are permitted.

---

## 6. Error Flow (Binding)

When any governed failure occurs (SQLGuard, RBAC, policy, runtime):

```text
thinking → error → end(status=failed)
```

**Explicitly Forbidden**

* Emitting `technical_view`, `data`, or `business_view` after an error
* Emitting more than one `error`
* Emitting any chunk after `end`

---

## 7. Frontend Enforcement Rules

Frontend MUST:

* Use a typed `ChunkType` enum (no string literals)
* Validate order using a StreamValidator
* Abort processing on:

  * Order violation
  * Trace ID mismatch
  * Missing `end`
* Treat `error` as terminal

Frontend MUST NOT:

* Retry mid-stream
* Reorder or infer chunks
* Modify SQL or assumptions
* Continue rendering after `error`

---

## 8. Restart & Recovery

NDJSON streams **cannot resume**.

On interruption:

* Reset all local stream state
* Generate a new request
* Use a new `trace_id`
* Restart the query from the beginning

Partial recovery is forbidden.

---

## 9. Contract Violations

Any of the following is a **hard failure**:

* Missing `thinking` as the first chunk
* Missing `end` as the last chunk
* Any chunk after `end`
* Any chunk after `error` except `end`
* Trace ID inconsistency
* Invalid chunk transition

**Expected Behavior:**
Abort stream, surface error, log governance violation.

---

## 10. Contract Test Coverage (Mandatory)

Backend MUST pass:

* SQLGuard violation → `error → end`
* No sensitive chunks after error
* Exactly one `end`
* Stable ordering under failure

Frontend MUST pass:

* Validator rejects invalid order
* Validator rejects missing `end`
* Validator rejects trace ID mismatch

---

## 11. Final Authority Clause

This file (**`streaming.md`**) is the **single source of truth** for NDJSON streaming.

If any other document, comment, test, or implementation conflicts with this contract:

➡️ **This contract prevails.**

