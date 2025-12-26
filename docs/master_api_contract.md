# 🧾 Master API Contract (Current / Binding)

This document is the **official binding contract** between the frontend and backend for the **current** (stable) implementation.

---

## 1) Authentication

Authentication is toggleable.

* When `AUTH_ENABLED=false`, endpoints work without an `Authorization` header.
* When `AUTH_ENABLED=true`, protected endpoints require a JWT token in the `Authorization` header: `Bearer <token>`.

---

## 2) Streaming Protocol (NDJSON)

### 2.1 Content-Type (mandatory)

All streaming responses from the ask endpoint MUST be **NDJSON over HTTP**:

* `Content-Type: application/x-ndjson`
* Each line is exactly one JSON object, terminated by `\n`.
* **No SSE framing** is used in the current binding contract.

### 2.2 Unified Chunk Envelope (mandatory)

Every NDJSON line MUST use the same envelope (no extra fields):

```json
{"type":"data|chart|summary|error|technical_view","payload":{}}
```

Fields:

* `type` (string, required): one of `technical_view`, `data`, `chart`, `summary`, `error`.
* `payload` (any JSON value, required): the phase payload (see below).

---

## 3) Endpoints

### 3.1 POST `/api/v1/ask`

**Description:** Receives a natural language question, generates SQL, executes it (read-only), and streams results in strict phases.

#### Request (JSON body)

```json
{
  "question": "What is the total sales this month?",
  "context": {"schema": "SCOTT", "examples": []},
  "top_k": 5
}
```

* `question` (string, required)
* `context` (object, optional)
* `top_k` (integer, optional, default `5`) — reserved for RAG retrieval control.

> Note: `top_k` MUST be accepted in the request body to avoid validation errors (HTTP 422).

#### Response (NDJSON stream)

The response is streamed as `application/x-ndjson` with the **strict order**:

1) `technical_view`
2) `data`
3) `chart`
4) `summary`

##### Chunk 1: `technical_view`

`payload` MUST include (TechnicalView concept):

```json
{
  "sql": "SELECT ...",
  "assumptions": ["..."],
  "is_safe": true
}
```

##### Chunk 2: `data`

`payload` MUST be a list of row objects:

```json
[
  {"col1": "value", "col2": 123}
]
```

##### Chunk 3: `chart`

`payload` MUST be a chart recommendation object:

```json
{
  "chart_type": "bar",
  "x": "column_name",
  "y": "column_name"
}
```

Allowed `chart_type` values (current stable set): `bar`, `line`, `pie`.

##### Chunk 4: `summary`

`payload` MUST be a string:

```json
"ok"
```

##### Error chunk: `error`

If an error occurs, the backend MUST still return a valid NDJSON chunk:

```json
{
  "message": "Error message content",
  "error_code": "internal_error"
}
```

---

## 4) Error Codes

| Code | Status | Default Message | Notes |
| --- | --- | --- | --- |
| `invalid_query` | 400 | Invalid SQL | SQL rejected by firewall or validation failed |
| `unauthorized` | 401 | Authentication required | JWT token missing or invalid |
| `permission_denied` | 403 | Access denied | User role does not allow this operation |
| `service_unavailable` | 503 | Service temporarily unavailable | Database or model provider failed |
| `internal_error` | 500 | Unexpected error | Unknown server error |

---

## 5) Additional Notes

* All SQL MUST be read-only (SELECT-only).
* RLS (Row-Level Security) constraints are applied only when enabled.
