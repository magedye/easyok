# API Endpoints Reference — EasyData Fortress v16.7.9

**Audience:** Frontend Engineers  
**Status:** Binding (Post-Stage-6)  
**Authority:** `/openapi/fortress.yaml`

---

## Overview

All Frontend requests MUST use the endpoints listed below. The **OpenAPI spec is authoritative**; this document provides narrative context.

**Base URL:** `/api/v1`  
**Protocol:** HTTP/HTTPS  
**Content-Type:** `application/json` (requests) / `application/x-ndjson` (streaming responses)

---

## Authentication Endpoints

### `POST /auth/login`

**Purpose:** Obtain JWT token.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Response (401):**
```json
{
  "error_code": "INVALID_CREDENTIALS",
  "message": "Username or password incorrect"
}
```

**Behavior:**
- Returns immediately (no async operation)
- Token valid for `JWT_EXPIRATION_MINUTES` (from settings)
- When `AUTH_ENABLED=false`: endpoint returns dummy token (always succeeds)

---

### `GET /auth/me`

**Purpose:** Get current session info and permissions.

**Response (200):**
```json
{
  "user_id": "uuid",
  "username": "string",
  "roles": ["admin", "editor"],
  "permissions": ["query.execute", "admin.settings.read"],
  "expires_at": "2025-01-01T12:00:00Z"
}
```

**Response (401):**
```json
{
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

**Header Required:** `Authorization: Bearer <token>`

**Behavior:**
- Returns empty permissions if `RBAC_ENABLED=false`
- Token must be in `Authorization` header as `Bearer <token>`

---

### `POST /auth/logout`

**Purpose:** Invalidate session.

**Response (204):** No content (success)

**Header Required:** `Authorization: Bearer <token>`

---

### `POST /auth/validate`

**Purpose:** Internal token validation (use `/auth/me` for UX).

**Header Required:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "valid": true,
  "expires_at": "2025-01-01T12:00:00Z"
}
```

---

## Query Endpoints

### `POST /ask` (STREAMING — NDJSON)

**Purpose:** Execute governed query with streaming NDJSON response.

**Request:**
```json
{
  "question": "How many users registered last month?",
  "stream": true,
  "context": {
    "tenant_id": "optional_tenant_uuid"
  }
}
```

**Response (200) — NDJSON Stream:**

Each line is a JSON object:

```
{"type":"thinking","trace_id":"uuid","timestamp":"2025-01-01T12:00:00Z","status":"Analyzing question..."}
{"type":"technical_view","trace_id":"uuid","timestamp":"...","sql":"SELECT COUNT(*) FROM users...","assumptions":["Column 'registered_at' exists"],"policy_hash":"abc123"}
{"type":"data","trace_id":"uuid","timestamp":"...","columns":["COUNT(*)"],"rows":[[150]],"row_count":1}
{"type":"business_view","trace_id":"uuid","timestamp":"...","summary":"150 users registered last month","chart_config":{...}}
{"type":"end","trace_id":"uuid","timestamp":"...","duration_ms":245}
```

**Chunk Order (STRICT):**
1. `thinking` — Processing status
2. `technical_view` — SQL + assumptions (MUST appear before data)
3. `data` — Query results (optional if no data)
4. `business_view` — Summary + chart (optional)
5. `end` — Stream termination

**On Error (Stream Already Started):**
```
{"type":"thinking","trace_id":"uuid","timestamp":"...","status":"Preparing..."}
{"type":"error","trace_id":"uuid","timestamp":"...","error_code":"SQL_EXECUTION_FAILED","message":"Table 'users' not found in policy"}
{"type":"end","trace_id":"uuid","timestamp":"...","duration_ms":123}
```

**Response (403) — Pre-stream Policy Violation:**
```json
{
  "error_code": "POLICY_VIOLATION",
  "message": "Question references out-of-scope tables: [users]"
}
```

**Response (429) — Rate Limited:**
```json
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "60 requests per minute exceeded"
}
```

**Header Required:** `Authorization: Bearer <token>` (if `AUTH_ENABLED=true`)

**Behavior:**
- Stream is **stateful** — headers are sent only once
- Frontend MUST consume stream in order (no reordering)
- `trace_id` is unique per request (for audit/correlation)
- If stream breaks, client MUST resend (no retry built into protocol)
- `policy_hash` indicates which policy version validated the query
- When `STREAM_PROTOCOL=ndjson`: returns NDJSON (current)
- When `STREAM_PROTOCOL=sse`: returns Server-Sent Events (alternative)

---

## Admin Endpoints

### `GET /admin/settings/feature-toggles`

**Purpose:** List all feature toggles.

**Response (200):**
```json
{
  "toggles": [
    {
      "feature": "ENABLE_TRAINING_PILOT",
      "enabled": true,
      "mutable": true,
      "reason": "Training pilot active for v16.7",
      "updated_at": "2025-01-01T12:00:00Z",
      "updated_by": "admin@example.com"
    }
  ]
}
```

**Header Required:** `Authorization: Bearer <admin_token>`

**Permissions Required:** `admin.settings.read`

---

### `POST /admin/settings/feature-toggle`

**Purpose:** Toggle a feature (requires reason).

**Request:**
```json
{
  "feature": "ENABLE_SEMANTIC_CACHE",
  "enabled": true,
  "reason": "Enabling for performance testing"
}
```

**Response (200):**
```json
{
  "feature": "ENABLE_SEMANTIC_CACHE",
  "enabled": true,
  "updated_at": "2025-01-01T12:00:00Z"
}
```

**Response (400) — Missing Reason:**
```json
{
  "error_code": "INVALID_REQUEST",
  "message": "Reason required (min 10 characters)"
}
```

**Response (403) — Immutable Toggle:**
```json
{
  "error_code": "IMMUTABLE_TOGGLE",
  "message": "Feature AUTH_ENABLED is immutable in production"
}
```

**Header Required:** `Authorization: Bearer <admin_token>`

**Permissions Required:** `admin.settings.write`

---

### `GET /admin/training`

**Purpose:** List training items.

**Query Parameters:**
- `status`: `pending` | `approved` | `rejected` (optional)
- `limit`: max results (default 20)
- `offset`: pagination offset (default 0)

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid",
      "question": "How many active users?",
      "sql": "SELECT COUNT(*) FROM users WHERE active=1",
      "status": "pending",
      "created_at": "2025-01-01T10:00:00Z",
      "created_by": "user@example.com"
    }
  ],
  "total": 42
}
```

**Header Required:** `Authorization: Bearer <admin_token>`

**Permissions Required:** `admin.training.read`

---

### `POST /admin/training/{id}/approve`

**Purpose:** Approve a pending training item.

**Request:**
```json
{
  "notes": "Verified and correct"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "approved",
  "approved_at": "2025-01-01T12:00:00Z",
  "approved_by": "admin@example.com"
}
```

**Header Required:** `Authorization: Bearer <admin_token>`

**Permissions Required:** `admin.training.approve`

---

### `POST /admin/training/{id}/reject`

**Purpose:** Reject a pending training item.

**Request:**
```json
{
  "reason": "Contains unsafe SQL"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "rejected",
  "rejected_at": "2025-01-01T12:00:00Z",
  "rejected_by": "admin@example.com"
}
```

**Header Required:** `Authorization: Bearer <admin_token>`

**Permissions Required:** `admin.training.reject`

---

## Feedback & Learning Endpoints

### `POST /feedback`

**Purpose:** Submit feedback on query result.

**Request:**
```json
{
  "trace_id": "uuid",
  "is_valid": false,
  "feedback_text": "Result is missing recent records"
}
```

**Response (201):**
```json
{
  "feedback_id": "uuid",
  "created_at": "2025-01-01T12:00:00Z"
}
```

**Behavior:**
- Creates pending training item
- Does NOT immediately train vector store
- Must be approved by admin before injection
- Audit logged as `feedback_submit`

---

## Health & Status Endpoints

### `GET /health`

**Purpose:** Check backend health.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T12:00:00Z",
  "components": {
    "db": "healthy",
    "llm": "healthy",
    "vector_store": "healthy",
    "cache": "degraded"
  }
}
```

**Behavior:**
- Does NOT require authentication
- When `HEALTH_AGGREGATION_MODE=strict`: returns 503 if any component fails
- When `HEALTH_AGGREGATION_MODE=degraded`: returns 200 with component status

---

## Error Handling

### Standard Error Response

All errors (except streaming) return JSON:

```json
{
  "error_code": "UNIQUE_CODE",
  "message": "Human-readable description",
  "details": {
    "field": "question",
    "context": "optional context object"
  }
}
```

### Common Error Codes

| Code | Status | Meaning | Retry |
|------|--------|---------|-------|
| `INVALID_CREDENTIALS` | 401 | Login failed | No |
| `UNAUTHORIZED` | 401 | No token or expired | No |
| `POLICY_VIOLATION` | 403 | Out-of-scope question | No |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Yes (exponential backoff) |
| `SQL_EXECUTION_FAILED` | 500 | Query execution error | Depends on cause |
| `SERVICE_UNAVAILABLE` | 503 | Backend degraded | Yes |

---

## CORS & Headers

### Allowed Origins

Set via `CORS_ORIGINS` environment variable (space-separated list).

Example:
```
CORS_ORIGINS=http://localhost:5173 https://easydata.example.com
```

### Required Headers (Requests)

| Header | Required | Example |
|--------|----------|---------|
| `Authorization` | If `AUTH_ENABLED=true` | `Bearer eyJhbGc...` |
| `Content-Type` | For POST/PUT | `application/json` |

### Response Headers

| Header | Meaning |
|--------|---------|
| `X-Trace-ID` | Correlation ID (matches trace_id in NDJSON) |
| `X-Policy-Version` | Active schema policy version |
| `Content-Type` | `application/json` or `application/x-ndjson` |

---

## Local Development

When running locally with `AUTH_ENABLED=false`:

1. **Login endpoint returns dummy token:**
   ```json
   {
     "access_token": "local_dev_token",
     "token_type": "bearer",
     "expires_in": 999999
   }
   ```

2. **`/auth/me` returns stub user:**
   ```json
   {
     "user_id": "00000000-0000-0000-0000-000000000000",
     "username": "local_dev",
     "roles": ["admin"],
     "permissions": ["*"]
   }
   ```

3. **All endpoints succeed regardless of token validity.**

---

## Testing Endpoints

When `ENABLE_TRAINING_PILOT=true`, additional endpoints are available:

### `POST /admin/sandbox/execute`

Execute queries in isolated sandbox (data not persisted).

**Request:**
```json
{
  "sql": "SELECT * FROM users LIMIT 5"
}
```

**Response:** Same NDJSON stream as `/ask`.

---

## Rate Limiting

**Default:** 60 requests per minute (per user)

Configure via:
- `RATE_LIMIT_REQUESTS_PER_MINUTE`
- `RATE_LIMIT_SCOPE` (`user` | `ip` | `global`)

When limit exceeded: HTTP 429 with `Retry-After` header.

---

## Summary

| Endpoint | Purpose | Auth | Stream |
|----------|---------|------|--------|
| `POST /auth/login` | Get token | No | No |
| `GET /auth/me` | Session info | Yes | No |
| `POST /ask` | Query execution | Conditional | **YES** |
| `GET /admin/settings/feature-toggles` | List toggles | Yes (admin) | No |
| `POST /admin/settings/feature-toggle` | Update toggle | Yes (admin) | No |
| `GET /admin/training` | List training items | Yes (admin) | No |
| `POST /admin/training/{id}/approve` | Approve training | Yes (admin) | No |
| `POST /feedback` | Submit feedback | Yes | No |
| `GET /health` | Health check | No | No |

