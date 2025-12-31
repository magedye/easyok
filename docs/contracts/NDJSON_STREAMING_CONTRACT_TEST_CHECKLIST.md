# NDJSON Streaming Contract — Test Checklist (Binding)

**Document Status:** FINAL
**Scope:** Backend ↔ Frontend Streaming
**Applies To:** `/api/v1/ask`, `/api/v1/chat/stream`
**Authority:** streaming.md (Canonical)

---

## 1. Stream Structure & Termination

### CT-01 — NDJSON Line Integrity

* **Given:** A streaming response
* **Verify:**

  * Each line is valid JSON
  * Each JSON object is fully contained in a single line
* **Fail If:**

  * Partial JSON objects are split across lines
  * Invalid JSON is emitted

---

### CT-02 — Mandatory END Chunk

* **Verify:**

  * Exactly one chunk with `type = "end"` is emitted
  * `end` is the final chunk
* **Fail If:**

  * No `end` chunk exists
  * More than one `end` chunk is emitted
  * Any chunk appears after `end`

---

## 2. Base Chunk Schema

### CT-03 — Required Base Fields

* **Verify:** Every chunk contains:

  * `type`
  * `trace_id`
  * `timestamp`
  * `payload`
* **Fail If:** Any field is missing

---

### CT-04 — Payload Presence

* **Verify:**

  * `payload` exists on **every** chunk
  * `payload` is an object (may be empty)
* **Fail If:**

  * `payload` is missing
  * Fields appear outside `payload`

---

## 3. Trace ID Governance

### CT-05 — Trace ID Consistency

* **Verify:**

  * All chunks in the stream share the same `trace_id`
* **Fail If:**

  * Any chunk has a different `trace_id`

---

## 4. Chunk Ordering Rules

### CT-06 — First Chunk Must Be THINKING

* **Verify:**

  * The first emitted chunk has `type = "thinking"`
* **Fail If:**

  * Any other chunk appears first

---

### CT-07 — Valid Transition Enforcement

* **Verify:**

  * Each chunk transition matches the allowed transitions in `streaming.md`
* **Fail If:**

  * An invalid transition occurs (e.g., `data → thinking`)

---

## 5. THINKING Chunk

### CT-08 — THINKING Uniqueness

* **Verify:**

  * Exactly one `thinking` chunk is emitted
* **Fail If:**

  * Zero or more than one `thinking` chunk exists

---

## 6. TECHNICAL_VIEW Chunk

### CT-09 — SQL Display-Only Enforcement

* **Verify:**

  * `technical_view.payload.sql` is present when chunk exists
* **Fail If:**

  * SQL is missing
  * SQL is mutated downstream (frontend-side)

---

## 7. DATA Chunk

### CT-10 — DATA Schema Validity

* **Verify:**

  * Payload is either:

    * an array of objects, or
    * an object with `rows`
* **Fail If:**

  * Payload is malformed or ambiguous

---

## 8. BUSINESS_VIEW Chunk

### CT-11 — BUSINESS_VIEW Readability

* **Verify:**

  * `payload.text` is present and human-readable
* **Fail If:**

  * Business summary is missing or empty

---

## 9. ERROR Handling (Critical)

### CT-12 — Single ERROR Chunk

* **Verify:**

  * At most one `error` chunk is emitted
* **Fail If:**

  * More than one `error` chunk exists

---

### CT-13 — ERROR Payload Shape

* **Verify:** `error.payload` contains:

  * `message`
  * `error_code`
* **Fail If:**

  * Fields appear outside `payload`
  * Required fields are missing

---

### CT-14 — ERROR Is Terminal

* **Verify:**

  * After `error`, only **one** `end` chunk is emitted
* **Fail If:**

  * Any other chunk appears after `error`
  * More than one chunk appears after `error`

---

### CT-15 — ERROR Implies Failed END

* **Verify:**

  * `end.payload.status == "failed"`
* **Fail If:**

  * Status is missing or set to `success`

---

## 10. END Chunk

### CT-16 — END Payload Integrity

* **Verify:** `end.payload` contains:

  * `status`
  * `total_chunks`
* **Fail If:**

  * Any field is missing

---

## 11. Frontend Contract Enforcement

### CT-17 — Order Validation

* **Verify:**

  * Frontend rejects invalid chunk order
* **Fail If:**

  * Frontend renders out-of-order chunks

---

### CT-18 — Trace ID Validation

* **Verify:**

  * Frontend rejects streams with mixed `trace_id`
* **Fail If:**

  * Frontend continues processing on mismatch

---

### CT-19 — Missing END Handling

* **Verify:**

  * Frontend fails if stream ends without `end`
* **Fail If:**

  * Frontend treats stream as complete

---

## 12. Restart & Recovery

### CT-20 — No Mid-Stream Resume

* **Verify:**

  * Stream interruptions require full restart
* **Fail If:**

  * Partial resume or continuation occurs

---

## 13. Forbidden Behaviors (Absolute)

### CT-21 — No Chunks After END

* **Verify:** No output after `end`
* **Fail If:** Any chunk appears

---

### CT-22 — No Frontend Interpretation

* **Verify:**

  * Frontend does not parse SQL or assumptions
* **Fail If:**

  * Any logic inspects or alters SQL

---

## 14. CI Enforcement

### CT-23 — Contract Test as Gate

* **Verify:**

  * All contract tests run in CI
* **Fail If:**

  * Any contract test is skipped or downgraded

---

## Final Authority Clause

This checklist is **binding**.

If any test, implementation, or document conflicts with this checklist:

➡️ **`streaming.md` prevails, and the conflicting component must fail.**
