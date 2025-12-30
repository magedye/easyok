### ✅ `ask_ndjson_contract.md` (UPDATED)

# AskResponse — NDJSON Streaming Contract (Runtime-Aligned)

## General Rules

- Protocol: HTTP Streaming (NDJSON)
- Content-Type: application/x-ndjson
- Each line: one JSON object
- Ordering: STRICT
- Transport: HTTP only (no SSE, no WebSocket)
- Stream is stateful, request is stateless

---

## Stream Order (Authoritative)

The response stream MUST emit chunks in the following order:

1. thinking
2. technical_view
3. data (optional, may be empty)
4. business_view (optional)
5. end

On error after stream start:

thinking → error → end

Any deviation is a contract violation.

---

## Base Chunk Envelope

Each chunk MUST contain:

```json
{
  "type": "<chunk_type>",
  "payload": <content>
}
````

---

## 1️⃣ thinking

Purpose:
Internal reasoning marker for streaming UX synchronization.

```json
{
  "type": "thinking",
  "payload": true
}
```

---

## 2️⃣ technical_view

Purpose:
Auditable technical execution context.

```json
{
  "type": "technical_view",
  "payload": {
    "sql": "string",
    "assumptions": ["string"],
    "is_safe": true
  }
}
```

---

## 3️⃣ data (Optional)

Purpose:
Raw business data only.

```json
{
  "type": "data",
  "payload": [
    { "column": "value" }
  ]
}
```

Rules:

* payload MUST be a list
* No SQL
* No assumptions
* No technical metadata

---

## 4️⃣ business_view (Optional)

Purpose:
User-facing natural language explanation.

```json
{
  "type": "business_view",
  "payload": "string"
}
```

---

## 5️⃣ end (Mandatory)

Purpose:
Explicit stream termination marker.

```json
{
  "type": "end",
  "payload": {
    "status": "success" | "failed"
  }
}
```

---

## Error Chunk

If an error occurs after streaming starts:

```json
{
  "type": "error",
  "payload": {
    "error_code": "string",
    "message": "string",
    "lang": "ar|en"
  }
}
```

Rules:

* No data or business_view after error
* HTTP status remains 200
* Stream MUST end with `end`

---

## Guarantees

* Backward-compatible for `data.payload`
* RBAC and SQLGuard enforced before data emission
* Deterministic and testable
* Frontend-safe (no partial rendering after error)
* Production-grade and auditable

---

## Test Expectations

```python
assert chunks[0]["type"] == "thinking"
assert chunks[-1]["type"] == "end"
```

Error case:

```python
assert ["thinking", "error", "end"] == [c["type"] for c in chunks]
```

---

## Status

✔ This document reflects the **actual runtime contract**.
✔ Binding for Backend, Frontend, and E2E tests.
✔ Stage 6 remains CLOSED.

```

