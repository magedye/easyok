# Complete Backend → Frontend Handoff Documentation

**Status:** ✅ READY FOR FRONTEND DEVELOPMENT  
**Version:** EasyData 16.7.9  
**Date:** 2025-01-01  
**Authority:** Architecture Post-Stage-6

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Quick Start (5 Steps)](#quick-start-5-steps)
3. [API Contract (Complete)](#api-contract-complete)
4. [Streaming Protocol (NDJSON)](#streaming-protocol-ndjson)
5. [Environment Behavior Matrix](#environment-behavior-matrix)
6. [Error Handling (Complete)](#error-handling-complete)
7. [Governance Rules (10 Hard Constraints)](#governance-rules-10-hard-constraints)
8. [Local Development Setup](#local-development-setup)
9. [Testing & Debugging](#testing--debugging)
10. [Common Issues & Solutions](#common-issues--solutions)
11. [Deployment Checklist](#deployment-checklist)
12. [Quick Reference Tables](#quick-reference-tables)

---

## Executive Summary

**Frontend development can now begin independently and safely.**

This document consolidates ALL binding contracts between Backend and Frontend. No guessing. No reverse-engineering.

### What You're Getting

✅ **API Contract** — All 9+ endpoints with request/response schemas  
✅ **Streaming Protocol** — NDJSON with immutable chunk order  
✅ **Environment Matrix** — Local/CI/Prod behavior differences  
✅ **Error Handling** — All error codes with retry logic  
✅ **Governance Rules** — 10 hard constraints (PR-blocking)  
✅ **Development Setup** — Step-by-step guide with examples  

### Golden Rule

**Frontend is a visibility window, NOT a logic engine.**

✅ Display data from backend  
✅ Trigger backend operations  
❌ Generate SQL  
❌ Check permissions  
❌ Implement RLS  
❌ Cache semantically  
❌ Infer assumptions  

---

## Quick Start (5 Steps)

### 1. Verify Backend Running

```bash
# In backend root
source .venv/bin/activate
python main.py

# Should output: Uvicorn running on http://0.0.0.0:8000
```

### 2. Setup Frontend Environment

```bash
cd frontend/
npm install
cp .env.example .env.local
```

**Edit `.env.local`:**
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_API=false
VITE_ENV=development
VITE_DEBUG=true
```

### 3. Start Dev Server

```bash
npm run dev

# Output: Local: http://localhost:5173/
```

### 4. Test Connection

```javascript
// In browser console:
const r = await fetch('http://localhost:8000/api/v1/health');
console.log(await r.json());
```

### 5. Try First Query

- Open http://localhost:5173
- Enter question: "How many users?"
- Watch NDJSON chunks in browser Network tab

---

## API Contract (Complete)

### Base URL

```
/api/v1
```

### Headers (All Requests)

| Header | Required | Example |
|--------|----------|---------|
| `Content-Type` | POST/PUT | `application/json` |
| `Authorization` | If AUTH_ENABLED=true | `Bearer eyJhbGc...` |

### Response Headers

| Header | Meaning |
|--------|---------|
| `X-Trace-ID` | Correlation ID |
| `X-Policy-Version` | Active policy version |
| `X-Cache` | `HIT` if cached result |

---

### Authentication Endpoints

#### `POST /auth/login`

Get JWT token.

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
- When `AUTH_ENABLED=false` (local dev): Returns dummy token (always succeeds)
- When `AUTH_ENABLED=true` (production): Validates credentials

---

#### `GET /auth/me`

Get current session info and permissions.

**Response (200):**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "user@example.com",
  "roles": ["admin"],
  "permissions": ["query.execute", "admin.settings.read"],
  "expires_at": "2025-01-01T12:00:00Z"
}
```

**Response (401):**
```json
{
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired JWT token"
}
```

**Header Required:** `Authorization: Bearer <token>`

---

#### `POST /auth/logout`

Invalidate session.

**Response (204):** No content (success)

---

### Query Endpoints

#### `POST /ask` (STREAMING — NDJSON) ⭐ MOST IMPORTANT

Execute governed query with streaming NDJSON response.

**Request:**
```json
{
  "question": "How many users registered last month?",
  "stream": true,
  "context": {
    "tenant_id": "optional_uuid"
  }
}
```

**Response (200) — NDJSON Stream:**

```
{"type":"thinking","trace_id":"550e8400...","timestamp":"2025-01-01T12:00:00.123456Z","status":"Analyzing question..."}
{"type":"technical_view","trace_id":"550e8400...","timestamp":"...","sql":"SELECT COUNT(*) FROM users WHERE...","assumptions":["Column created_at exists"],"policy_hash":"abc123"}
{"type":"data","trace_id":"550e8400...","timestamp":"...","columns":["COUNT(*)"],"rows":[[150]],"row_count":1}
{"type":"business_view","trace_id":"550e8400...","timestamp":"...","summary":"150 users registered last month","chart_config":{...}}
{"type":"end","trace_id":"550e8400...","timestamp":"...","duration_ms":245}
```

**Strict Chunk Order (MANDATORY):**
1. `thinking` (always first)
2. `technical_view` (always second, BEFORE data)
3. `data` (optional, if data exists)
4. `business_view` (optional)
5. `end` (always last)

**Response (403) — Pre-stream Policy Violation:**
```json
{
  "error_code": "POLICY_VIOLATION",
  "message": "Question references out-of-scope tables: [users]",
  "details": {
    "tables_requested": ["users"],
    "tables_allowed": ["customers", "orders"]
  }
}
```

**Response (429) — Rate Limited:**
```json
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded: 60 requests per minute"
}
```

**Header:** `Authorization: Bearer <token>` (if AUTH_ENABLED=true)

**Critical Rules:**
- ✅ Process chunks in order (don't reorder)
- ✅ `technical_view` MUST appear before `data`
- ✅ Use `trace_id` for audit/logging
- ✅ Policy hash validates which policy version approved the query
- ❌ DON'T interpret or modify SQL
- ❌ DON'T skip assumptions panel

---

### Admin Endpoints

#### `GET /admin/settings/feature-toggles`

List all feature toggles.

**Response (200):**
```json
{
  "toggles": [
    {
      "feature": "ENABLE_TRAINING_PILOT",
      "enabled": true,
      "mutable": true,
      "reason": "Training pilot active",
      "updated_at": "2025-01-01T12:00:00Z",
      "updated_by": "admin@example.com"
    }
  ]
}
```

**Permissions Required:** `admin.settings.read`

---

#### `POST /admin/settings/feature-toggle`

Toggle a feature (requires reason).

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

**Response (403) — Immutable Toggle:**
```json
{
  "error_code": "IMMUTABLE_TOGGLE",
  "message": "Feature AUTH_ENABLED is immutable in production"
}
```

**Permissions Required:** `admin.settings.write`

---

#### `GET /admin/training`

List training items.

**Query Parameters:**
- `status`: `pending` | `approved` | `rejected` (optional)
- `limit`: max results (default 20)
- `offset`: pagination offset (default 0)

**Response (200):**
```json
{
  "items": [
    {
      "id": "550e8400...",
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

**Permissions Required:** `admin.training.read`

---

#### `POST /admin/training/{id}/approve`

Approve a pending training item.

**Request:**
```json
{
  "notes": "Verified and correct"
}
```

**Response (200):**
```json
{
  "id": "550e8400...",
  "status": "approved",
  "approved_at": "2025-01-01T12:00:00Z",
  "approved_by": "admin@example.com"
}
```

**Permissions Required:** `admin.training.approve`

---

#### `POST /admin/training/{id}/reject`

Reject a pending training item.

**Request:**
```json
{
  "reason": "Contains unsafe SQL"
}
```

**Response (200):**
```json
{
  "id": "550e8400...",
  "status": "rejected",
  "rejected_at": "2025-01-01T12:00:00Z",
  "rejected_by": "admin@example.com"
}
```

**Permissions Required:** `admin.training.reject`

---

### Feedback & Learning

#### `POST /feedback`

Submit feedback on query result.

**Request:**
```json
{
  "trace_id": "550e8400...",
  "is_valid": false,
  "feedback_text": "Result is missing recent records"
}
```

**Response (201):**
```json
{
  "feedback_id": "550e8400...",
  "created_at": "2025-01-01T12:00:00Z"
}
```

**Behavior:**
- Creates pending training item
- Does NOT immediately train vector store
- Must be approved by admin
- Audit logged as `feedback_submit`

---

### Health & Status

#### `GET /health`

Check backend health (no auth required).

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
- When `HEALTH_AGGREGATION_MODE=strict`: returns 503 if any component fails
- When `HEALTH_AGGREGATION_MODE=degraded`: returns 200 with status

---

## Streaming Protocol (NDJSON)

### Overview

**Protocol:** NDJSON (Newline-Delimited JSON)  
**Content-Type:** `application/x-ndjson`  
**Endpoint:** `POST /ask`

Each line is a complete JSON object representing a distinct chunk of the response lifecycle.

### Chunk Types & Sequence

#### 1. `thinking` (ALWAYS FIRST)

Signal that backend is processing.

**Schema:**
```json
{
  "type": "thinking",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:00.123456Z",
  "status": "Analyzing question and preparing SQL..."
}
```

**Fields:**
| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | string | ✅ | Always `"thinking"` |
| `trace_id` | UUID | ✅ | Unique request ID (same for all chunks) |
| `timestamp` | ISO8601 | ✅ | When emitted |
| `status` | string | ✅ | Human-readable progress |

**Frontend Action:** Show spinner/progress with status text.

---

#### 2. `technical_view` (ALWAYS BEFORE DATA)

Show generated SQL, assumptions, and policy validation.

**Schema:**
```json
{
  "type": "technical_view",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:01.456789Z",
  "sql": "SELECT COUNT(*) AS user_count FROM users WHERE created_at >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)",
  "assumptions": [
    "Column 'created_at' represents user registration timestamp",
    "Table 'users' contains all user records"
  ],
  "policy_hash": "sha256:abc123def456..."
}
```

**Fields:**
| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | string | ✅ | Always `"technical_view"` |
| `trace_id` | UUID | ✅ | Same as thinking |
| `timestamp` | ISO8601 | ✅ | When SQL generated |
| `sql` | string | ✅ | Generated SQL (read-only) |
| `assumptions` | string[] | ✅ | List of assumptions (can be empty) |
| `policy_hash` | string | ✅ | Hash of active policy version |

**Frontend Responsibilities:**
- Display SQL in read-only code block
- Display assumptions in separate panel
- Allow "Mark Incorrect" button (→ feedback)
- Store `policy_hash` for audit

**Critical:** MUST appear before `data` chunk.

---

#### 3. `data` (OPTIONAL, IF DATA EXISTS)

Return actual query results.

**Schema:**
```json
{
  "type": "data",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:02.789012Z",
  "columns": ["USER_COUNT"],
  "rows": [
    [150]
  ],
  "row_count": 1
}
```

**Fields:**
| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | string | ✅ | Always `"data"` |
| `trace_id` | UUID | ✅ | Same as thinking |
| `timestamp` | ISO8601 | ✅ | When data fetched |
| `columns` | string[] | ✅ | Column names (in order) |
| `rows` | any[][] | ✅ | Data rows (can be empty) |
| `row_count` | int | ✅ | Number of rows |

**Behavior:**
- ABSENT if query returns 0 rows
- ABSENT if error occurred
- Rows always match column order
- Row limit: `DEFAULT_ROW_LIMIT` (default 100)

**Frontend Action:** Render dynamic table, show "No data" if absent.

---

#### 4. `business_view` (OPTIONAL)

Provide human-readable summary and optional chart config.

**Schema:**
```json
{
  "type": "business_view",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:03.012345Z",
  "summary": "150 users registered during the past month. This represents a 23% increase.",
  "chart_config": {
    "type": "bar",
    "x_axis": "month",
    "y_axis": "user_count",
    "data": [
      {"month": "November", "user_count": 122},
      {"month": "December", "user_count": 150}
    ]
  }
}
```

**Fields:**
| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | string | ✅ | Always `"business_view"` |
| `trace_id` | UUID | ✅ | Same as thinking |
| `timestamp` | ISO8601 | ✅ | When summary generated |
| `summary` | string | ✅ | Human-readable interpretation |
| `chart_config` | object | ❌ | Chart specification (optional) |

**Chart Config:**
```json
{
  "type": "bar" | "line" | "pie",
  "x_axis": "column_name",
  "y_axis": "column_name",
  "title": "optional",
  "data": [...]
}
```

**Frontend Action:** Display summary prominently, render chart if present.

---

#### 5. `end` (ALWAYS LAST)

Signal successful stream completion.

**Schema:**
```json
{
  "type": "end",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:03.567890Z",
  "duration_ms": 3567
}
```

**Fields:**
| Field | Type | Meaning |
|-------|------|---------|
| `type` | string | Always `"end"` |
| `trace_id` | UUID | Same as thinking |
| `timestamp` | ISO8601 | When stream ended |
| `duration_ms` | int | Total time (milliseconds) |

**Frontend Action:** Hide spinner, enable export/save buttons.

---

### Error During Stream

If error occurs **after** stream starts:

```json
{"type":"thinking","trace_id":"550e8400...","status":"Validating SQL..."}
{"type":"error","trace_id":"550e8400...","error_code":"POLICY_VIOLATION","message":"Table 'users' not found in policy"}
{"type":"end","trace_id":"550e8400...","duration_ms":1345}
```

**Error Chunk Schema:**
```json
{
  "type": "error",
  "trace_id": "550e8400...",
  "timestamp": "2025-01-01T12:00:01.234567Z",
  "error_code": "POLICY_VIOLATION",
  "message": "Table 'users' not found in active policy scope",
  "details": {
    "tables_requested": ["users"],
    "tables_allowed": ["customers", "orders"]
  }
}
```

---

### Chunk Order Validation

```typescript
const validSequences = {
  'thinking': ['technical_view', 'error', 'end'],
  'technical_view': ['data', 'business_view', 'error', 'end'],
  'data': ['business_view', 'error', 'end'],
  'business_view': ['error', 'end'],
  'error': ['end'],
  'end': []
};

function validateChunkOrder(chunk, lastChunk) {
  if (!lastChunk) return chunk.type === 'thinking';
  return validSequences[lastChunk.type].includes(chunk.type);
}
```

---

### Consuming NDJSON Stream (Example)

```typescript
async function* consumeAskStream(question: string) {
  const response = await fetch('/api/v1/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ question, stream: true })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`${error.error_code}: ${error.message}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        const chunk = JSON.parse(line);
        yield chunk;
      }
    }
  }
}
```

---

## Environment Behavior Matrix

### Local Development (`ENV=local`)

| Aspect | Behavior |
|--------|----------|
| **Authentication** | `AUTH_ENABLED=false` — all endpoints succeed without token |
| **RBAC** | `RBAC_ENABLED=false` — all users treated as admin |
| **Rate Limiting** | `ENABLE_RATE_LIMIT=false` — no limits |
| **Caching** | `ENABLE_SEMANTIC_CACHE=false` — every query re-executes |
| **Training** | `ENABLE_TRAINING_PILOT=true` — `/admin/sandbox` available |
| **Errors** | Full stack traces (for debugging) |
| **CORS** | Permissive (localhost:5173) |

**Frontend Adaptation:**
```typescript
if (settings.AUTH_ENABLED === false) {
  skipLoginScreen = true;
  showAdminUI = true;
}
```

---

### CI/Testing (`ENV=ci`)

| Aspect | Behavior |
|--------|----------|
| **Authentication** | `AUTH_ENABLED=true` — tokens required |
| **RBAC** | `RBAC_ENABLED=true` — enforced per role |
| **Caching** | `ENABLE_SEMANTIC_CACHE=false` — consistent results |
| **Training** | `ENABLE_TRAINING_PILOT=false` — `/admin/sandbox` unavailable |
| **Errors** | Minimal (no internal details) |
| **Database** | Test/fixture database |

---

### Production (`ENV=production`)

| Aspect | Behavior |
|--------|----------|
| **Authentication** | `AUTH_ENABLED=true` — strict JWT validation |
| **RBAC** | `RBAC_ENABLED=true` — enforced per role |
| **RLS** | `RLS_ENABLED=true` — row-level security enforced |
| **Rate Limiting** | `ENABLE_RATE_LIMIT=true` — 60 req/min per user |
| **Caching** | `ENABLE_SEMANTIC_CACHE=true` — cached results (faster) |
| **Training** | `ENABLE_TRAINING_PILOT=false` — experimental features disabled |
| **Errors** | Minimal, generic messages (no stack traces) |
| **CORS** | Whitelist only approved domains |

---

### Feature Flags & Frontend Impact

#### `AUTH_ENABLED`

**If true:** Login required, token in all requests  
**If false:** Login skipped, dummy token used  

```typescript
if (!settings.AUTH_ENABLED) {
  // Skip login, use dummy token
  sessionToken = 'local_dev_token';
} else {
  // Show login form
}
```

---

#### `RBAC_ENABLED`

**If true:** Permissions checked, `/auth/me` returns permissions  
**If false:** All users treated as admin  

```typescript
if (!settings.RBAC_ENABLED) {
  userPermissions = ['*']; // All permissions
}
```

---

#### `ENABLE_TRAINING_PILOT`

**If true:** Training UI visible, `/admin/training` works  
**If false:** Training tab hidden, endpoints return 404  

```typescript
{settings.ENABLE_TRAINING_PILOT && <TrainingTab />}
```

---

#### `ENABLE_SEMANTIC_CACHE`

**If true:** Cached results possible, check `X-Cache: HIT` header  
**If false:** Every query re-executes  

```typescript
if (response.headers.get('X-Cache') === 'HIT') {
  showNotice('Result cached; data may not be current');
}
```

---

#### `ENABLE_RATE_LIMIT`

**If true:** 429 after 60 requests/minute  
**If false:** No rate limiting  

```typescript
if (error.status === 429) {
  const retryAfter = parseInt(error.headers['Retry-After']);
  await sleep(retryAfter * 1000);
  retryRequest();
}
```

---

### Detecting Environment at Runtime

```typescript
const detectEnvironment = async () => {
  // Option 1: Check /health
  const health = await fetch('/api/v1/health').then(r => r.json());
  
  // Option 2: Try request without auth
  try {
    const r = await fetch('/api/v1/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'test' })
    });
    if (r.ok) return 'local'; // No auth required
  } catch {
    // Timeout = likely prod
  }
};
```

---

## Error Handling (Complete)

### Standard Error Response

All errors follow this schema:

```json
{
  "error_code": "UNIQUE_CODE",
  "message": "Human-readable description",
  "details": {
    "field": "context",
    "correlation_id": "550e8400..."
  }
}
```

---

### Authentication & Authorization (4xx)

#### `INVALID_CREDENTIALS` (401)

Login with wrong credentials.

**Response:**
```json
{
  "error_code": "INVALID_CREDENTIALS",
  "message": "Username or password incorrect"
}
```

**Frontend Action:** Show login form, allow retry.

---

#### `UNAUTHORIZED` (401)

Missing, expired, or invalid token.

**Response:**
```json
{
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired JWT token",
  "details": { "reason": "token_expired" }
}
```

**Frontend Action:** Clear token, redirect to login.

---

#### `FORBIDDEN` (403)

User lacks permission.

**Response:**
```json
{
  "error_code": "FORBIDDEN",
  "message": "Insufficient permissions for this operation",
  "details": {
    "required_permission": "admin.settings.write",
    "user_permissions": ["query.execute"]
  }
}
```

**Frontend Action:** Disable button, show "Access Denied".

---

### Policy & Governance (403)

#### `POLICY_VIOLATION` (403)

Question references out-of-scope tables.

**Pre-stream (HTTP):**
```json
{
  "error_code": "POLICY_VIOLATION",
  "message": "Question references out-of-scope tables",
  "details": {
    "tables_requested": ["employees"],
    "tables_allowed": ["customers", "orders"]
  }
}
```

**In-stream (NDJSON):**
```json
{
  "type": "error",
  "error_code": "POLICY_VIOLATION",
  "message": "Column 'salary' not in active policy scope"
}
```

**Frontend Action:** Show error with explanation, suggest allowed tables.

---

#### `IMMUTABLE_TOGGLE` (403)

Trying to toggle immutable flag.

**Response:**
```json
{
  "error_code": "IMMUTABLE_TOGGLE",
  "message": "Feature AUTH_ENABLED is immutable in production",
  "details": {
    "feature": "AUTH_ENABLED",
    "reason": "Cannot disable authentication in production"
  }
}
```

**Frontend Action:** Disable toggle UI, show lock icon.

---

### Validation (400)

#### `INVALID_REQUEST` (400)

Malformed request.

**Response:**
```json
{
  "error_code": "INVALID_REQUEST",
  "message": "Question field is required and must be a string",
  "details": { "field": "question" }
}
```

**Frontend Action:** Show validation error near field.

---

#### `INVALID_QUESTION` (400)

Question too short/long.

**Response:**
```json
{
  "error_code": "INVALID_QUESTION",
  "message": "Question must be between 5 and 500 characters",
  "details": {
    "min_length": 5,
    "max_length": 500
  }
}
```

**Frontend Action:** Show character count, highlight constraints.

---

### Rate Limiting (429)

#### `RATE_LIMIT_EXCEEDED` (429)

Exceeded 60 requests/minute.

**Response:**
```json
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded: 60 requests per minute",
  "details": { "limit_per_minute": 60 }
}
```

**HTTP Header:**
```
Retry-After: 45
```

**Frontend Action:**
1. Show "Too many requests. Try again in 45 seconds."
2. Implement exponential backoff
3. Show countdown timer
4. Disable submit button

---

### Execution (500)

#### `SQL_EXECUTION_FAILED` (500)

Database error during SQL execution.

**Response:**
```json
{
  "error_code": "SQL_EXECUTION_FAILED",
  "message": "ORA-00942: table or view does not exist",
  "details": {
    "database_error": "ORA-00942",
    "table_name": "invalid_table"
  }
}
```

**Frontend Action:**
- Show error message
- Log with trace_id
- Suggest: "Try again?" or "Contact support"

---

#### `SQL_GENERATION_FAILED` (500)

LLM couldn't generate SQL.

**Response:**
```json
{
  "error_code": "SQL_GENERATION_FAILED",
  "message": "Could not generate valid SQL for the given question",
  "details": {
    "reason": "Question is too ambiguous",
    "suggestion": "Try: 'How many customers placed orders in January?'"
  }
}
```

**Frontend Action:**
- Show error with suggestion
- Offer: "Try rephrasing your question"

---

#### `SERVICE_UNAVAILABLE` (503)

Backend services down.

**Response:**
```json
{
  "error_code": "SERVICE_UNAVAILABLE",
  "message": "One or more backend services are unavailable",
  "details": {
    "unavailable_services": ["llm_provider"],
    "estimated_recovery": "2025-01-01T12:15:00Z"
  }
}
```

**Frontend Action:**
- Show: "Services temporarily unavailable"
- Implement retry with exponential backoff
- Show estimated recovery time

---

### All Error Codes (Reference)

| Code | Status | Meaning | Retry |
|------|--------|---------|-------|
| `INVALID_CREDENTIALS` | 401 | Wrong username/password | ❌ |
| `UNAUTHORIZED` | 401 | No/expired token | ❌ |
| `FORBIDDEN` | 403 | No permission | ❌ |
| `POLICY_VIOLATION` | 403 | Out-of-scope question | ❌ |
| `IMMUTABLE_TOGGLE` | 403 | Can't toggle in this env | ❌ |
| `INVALID_REQUEST` | 400 | Malformed request | ❌ |
| `INVALID_QUESTION` | 400 | Question too short/long | ❌ |
| `RATE_LIMIT_EXCEEDED` | 429 | 60 req/min exceeded | ✅ (backoff) |
| `SQL_EXECUTION_FAILED` | 500 | DB error | Maybe |
| `SQL_GENERATION_FAILED` | 500 | LLM couldn't generate SQL | ❌ |
| `SERVICE_UNAVAILABLE` | 503 | Backend down | ✅ |
| `STREAMING_INTERRUPTED` | 500 | Connection lost | ✅ |

---

### Retry Logic

```typescript
const isRetryable = (error) => {
  const retryableCodes = [
    'RATE_LIMIT_EXCEEDED',
    'SERVICE_UNAVAILABLE',
    'STREAMING_INTERRUPTED',
    'SQL_EXECUTION_FAILED' // Maybe (depends)
  ];
  return retryableCodes.includes(error.error_code);
};

// Exponential backoff
const maxRetries = 5;
const baseDelay = 1000;

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return await executeQuery();
  } catch (error) {
    if (!isRetryable(error)) throw error;
    
    const delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    
    await sleep(delay + jitter);
  }
}
```

---

## Governance Rules (10 Hard Constraints)

**Violations = PR blocked. No exceptions.**

### Rule 1: No SQL Generation or Interpretation

**Forbidden:**
```typescript
// ❌ Don't generate SQL
const sql = `SELECT * FROM ${tableName}`;

// ❌ Don't parse SQL
const columns = sql.match(/SELECT (.+?) FROM/)[1].split(',');

// ❌ Don't validate SQL
if (!sql.startsWith('SELECT')) throw new Error('Invalid SQL');
```

**Allowed:**
```typescript
// ✅ Display SQL from backend
<CodeBlock>{technicalView.sql}</CodeBlock>

// ✅ Let user copy SQL
<CopyButton text={technicalView.sql} />
```

---

### Rule 2: No Permission Inference

**Forbidden:**
```typescript
// ❌ Don't check permissions locally
const canQueryTable = allowedTables.includes(table);

// ❌ Don't hide UI based on role
if (user.role === 'admin') showAdminPanel();

// ❌ Don't assume permissions from user ID
if (user.id === 1) grantFullAccess();
```

**Allowed:**
```typescript
// ✅ Display permissions from backend
const { permissions } = await fetch('/api/v1/auth/me');

// ✅ Let backend reject with 403
try {
  await toggleFeature(name);
} catch (error) {
  if (error.error_code === 'FORBIDDEN') showError(...);
}
```

---

### Rule 3: No RLS (Row-Level Security) Logic

**Forbidden:**
```typescript
// ❌ Don't filter rows locally
const filtered = data.filter(r => r.tenant_id === tenantId);

// ❌ Don't inject WHERE clause for RLS
const withRLS = `${sql} WHERE tenant_id = ${tenantId}`;
```

**Allowed:**
```typescript
// ✅ Display rows from backend (already filtered)
<DataTable rows={data.rows} />

// ✅ Pass context to backend
const response = await ask({
  question: 'Show my orders',
  context: { tenant_id: currentUser.tenantId }
});
```

---

### Rule 4: No Semantic Cache Logic

**Forbidden:**
```typescript
// ❌ Don't cache results yourself
const cache = new Map();
if (cache.has(questionHash)) return cache.get(questionHash);

// ❌ Don't check question similarity
if (similarity(newQ, oldQ) > 0.9) return lastResult;
```

**Allowed:**
```typescript
// ✅ Let backend handle caching
const response = await ask({ question });

// ✅ Check if response was cached
if (response.headers.get('X-Cache') === 'HIT') {
  showNotice('Cached result (may not be current)');
}
```

---

### Rule 5: No Assumption Modification

**Forbidden:**
```typescript
// ❌ Don't guess assumptions
const assumptions = ['Column created_at exists'];

// ❌ Don't modify assumptions
const corrected = assumptions.map(a =>
  a.replace('created_at', 'CreatedDate')
);
```

**Allowed:**
```typescript
// ✅ Display assumptions from backend
{technicalView.assumptions.map(a => <AssumptionCard>{a}</AssumptionCard>)}

// ✅ Let user mark as incorrect
<button onClick={() => markIncorrect(assumption)}>
  This assumption is wrong
</button>
```

---

### Rule 6: No Secret Storage Beyond Request Lifetime

**Forbidden:**
```typescript
// ❌ Don't store token indefinitely
localStorage.setItem('token', jwt);

// ❌ Don't store API keys
localStorage.setItem('api_key', secretKey);

// ❌ Don't store credentials
localStorage.setItem('password', userPassword);
```

**Allowed:**
```typescript
// ✅ Store token in memory only
let sessionToken = null;

function setToken(token) {
  sessionToken = token; // Auto-cleared on page close
}

// ✅ Use HttpOnly cookies (set by backend)
// Browser handles automatically, can't be read by JS

// ✅ Refresh token via endpoint
async function ensureValidToken() {
  if (tokenExpiringSoon()) {
    const { access_token } = await fetch('/api/v1/auth/refresh');
    setToken(access_token);
  }
}
```

---

### Rule 7: No Response Reordering

**Forbidden:**
```typescript
// ❌ Don't wait for all chunks then reorder
const chunks = [];
for await (const chunk of stream) chunks.push(chunk);
const reordered = chunks.sort(...); // NEVER DO THIS

// ❌ Don't defer chunks
if (chunk.type === 'technical_view') {
  deferredChunks.push(chunk); // Show later? NO
}
```

**Allowed:**
```typescript
// ✅ Process chunks in arrival order
for await (const chunk of stream) {
  switch (chunk.type) {
    case 'thinking': setThinking(chunk); break;
    case 'technical_view': setTechnicalView(chunk); break;
    case 'data': setData(chunk); break;
    // Process immediately in order
  }
}
```

---

### Rule 8: No Unauthorized Mutations

**Forbidden:**
```typescript
// ❌ Don't mutate state without backend
const user = await fetchUser();
user.role = 'admin';
updateState(user); // Does backend know? NO

// ❌ Don't assume mutation succeeded
items.value = items.value.filter(item => item.id !== id);
// What if the request fails?
```

**Allowed:**
```typescript
// ✅ Send mutation request first
async function approveTrainingItem(itemId) {
  try {
    const response = await fetch(`/api/v1/admin/training/${itemId}/approve`, {
      method: 'POST'
    });
    
    if (!response.ok) throw new Error('Failed');
    
    // Only update UI after backend confirms
    items.value = items.value.map(item =>
      item.id === itemId ? { ...item, status: 'approved' } : item
    );
  } catch (error) {
    showError(error.message);
  }
}
```

---

### Rule 9: No Policy Version Caching

**Forbidden:**
```typescript
// ❌ Don't cache policy version
let cachedPolicyVersion = 5;
const policy = cachedPolicyVersion; // STALE

// ❌ Don't store policy in localStorage
localStorage.setItem('policy_version', version);
// Later: const policy = JSON.parse(...); // OUTDATED
```

**Allowed:**
```typescript
// ✅ Always fetch fresh policy
async function getPolicyInfo() {
  const { policy_version } = await fetch('/api/v1/settings/policy')
    .then(r => r.json());
  
  return policy_version; // Always current
}

// ✅ Use policy hash from response
const { policy_hash } = technicalView; // From backend, unique per query
```

---

### Rule 10: No Hardcoded Environment Assumptions

**Forbidden:**
```typescript
// ❌ Don't hardcode environment behavior
if (process.env.NODE_ENV === 'production') {
  skipLogin = false;
}

// ❌ Don't assume auth based on env
const authRequired = !isDevelopment();

// ❌ Don't branch on environment
if (isLocal) mockData = true;
```

**Allowed:**
```typescript
// ✅ Detect environment at runtime
const backendSettings = await detectBackendConfiguration();

// ✅ Adapt UI based on backend capability
if (backendSettings.ENABLE_TRAINING_PILOT) {
  showTrainingTab = true;
}

// ✅ Use feature detection
try {
  const response = await fetch('/api/v1/admin/training');
  trainingAvailable = response.ok;
} catch {
  trainingAvailable = false;
}
```

---

### Allowed Patterns

#### Pattern 1: Display Data From Backend

```typescript
export function TechnicalViewPanel({ technicalView }) {
  return (
    <div>
      <CodeBlock language="sql" code={technicalView.sql} />
      <AssumptionsList assumptions={technicalView.assumptions} />
      <PolicyBadge hash={technicalView.policy_hash} />
    </div>
  );
}
```

---

#### Pattern 2: Trigger Backend Actions

```typescript
export function ApproveButton({ itemId, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const approve = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/admin/training/${itemId}/approve`,
        { method: 'POST', body: JSON.stringify({ notes: 'Approved' }) }
      );
      
      if (!response.ok) {
        throw new Error((await response.json()).message);
      }
      
      onSuccess();
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return <button onClick={approve} disabled={loading}>Approve</button>;
}
```

---

#### Pattern 3: Handle Streaming Responses

```typescript
export function AskPanel({ question }) {
  const [state, setState] = useState({ chunks: [], error: null });

  useEffect(() => {
    (async () => {
      const response = await fetch('/api/v1/ask', {
        method: 'POST',
        body: JSON.stringify({ question, stream: true })
      });

      if (!response.ok) {
        setState({ chunks: [], error: await response.json() });
        return;
      }

      for await (const chunk of consumeNDJSON(response)) {
        setState(prev => ({
          chunks: [...prev.chunks, chunk],
          error: null
        }));
      }
    })();
  }, [question]);

  return (
    <>
      {state.error && <ErrorAlert error={state.error} />}
      {state.chunks.map(chunk => <ChunkRenderer chunk={chunk} />)}
    </>
  );
}
```

---

### PR Review Checklist

Before merging any frontend PR:

- [ ] No SQL generation or parsing
- [ ] No permission checks (relying on backend 403)
- [ ] No local RLS filtering
- [ ] No custom caching logic
- [ ] No assumption modification
- [ ] Tokens stored securely (not localStorage)
- [ ] Streaming chunks processed in order
- [ ] All mutations sent to backend before UI update
- [ ] No hardcoded environment assumptions
- [ ] Backend configuration detected at runtime
- [ ] All external data from `/api/v1` endpoints
- [ ] Error handling includes trace_id logging

---

## Local Development Setup

### Prerequisites

- **Node.js** 16+ (check: `node --version`)
- **npm** 8+ (check: `npm --version`)
- **Backend running** on `http://localhost:8000`
- **Git** (for version control)

---

### Step 1: Install Dependencies

```bash
cd frontend/

npm install
# or
yarn install
```

---

### Step 2: Create `.env.local`

```bash
cp .env.example .env.local
```

**Edit `.env.local`:**
```env
# Backend Configuration
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Mock Mode (false = use real backend)
VITE_USE_MOCK_API=false

# Application Settings
VITE_APP_NAME=EasyData
VITE_APP_VERSION=16.7.x
VITE_ENV=development

# Feature Flags
VITE_DEBUG=true
VITE_SHOW_ADMIN_UI=true
VITE_SHOW_TRAINING_UI=true
VITE_SHOW_ERROR_DETAILS=true

# Monitoring (optional)
# VITE_SENTRY_DSN=https://...
# VITE_GA_ID=G-...
```

---

### Step 3: Start Dev Server

```bash
npm run dev

# Output:
# ➜  Local:   http://localhost:5173/
# ➜  press h to show help
```

Open browser at `http://localhost:5173`

---

### Step 4: Backend Configuration

Backend `.env` must have:

```env
# Development Mode
ENV=local
APP_ENV=development
DEBUG=true

# Security: Disable for local dev
AUTH_ENABLED=false
RBAC_ENABLED=false
RLS_ENABLED=false

# Features
ENABLE_TRAINING_PILOT=true
ENABLE_RATE_LIMIT=false
ENABLE_LOGGING=true

# CORS: Allow frontend dev server
CORS_ORIGINS=http://localhost:5173

# Providers (configure your actual DB/LLM)
DB_PROVIDER=oracle
ORACLE_CONNECTION_STRING=...

LLM_PROVIDER=groq
GROQ_API_KEY=...

VECTOR_DB=chromadb
VECTOR_STORE_PATH=./data/vectorstore

# Port
BACKEND_PORT=8000
```

**Start Backend:**
```bash
source .venv/bin/activate
python main.py
# Or: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### Step 5: Verify Connection

```javascript
// In browser console:
const response = await fetch('http://localhost:8000/api/v1/health');
console.log(await response.json());

// Should return:
// { "status": "healthy", "components": {...} }
```

---

## Testing & Debugging

### Unit Tests

```bash
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

### E2E Tests (Playwright)

Requires backend running:

```bash
npm run test:e2e

# Example E2E test:
test('ask query and see results', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  await page.fill('[placeholder="Ask..."]', 'How many users?');
  await page.click('button:has-text("Ask")');
  
  await page.waitForSelector('[data-test="technical-view"]');
  const sql = await page.textContent('[data-test="sql"]');
  
  expect(sql).toContain('SELECT');
  
  await page.waitForSelector('[data-test="data-table"]');
});
```

---

### Browser DevTools

**Network Tab:**
- Monitor `/api/v1/*` requests
- Check status codes
- View NDJSON stream (raw tab)

**Console Tab:**
- Check errors
- Test fetch manually
- Log API responses

---

### VS Code Debugging

**.vscode/launch.json:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend"
    }
  ]
}
```

Set breakpoints in VS Code and inspect state.

---

### Mock API Mode

For frontend-only development (no backend):

```env
VITE_USE_MOCK_API=true
```

Mock handlers are in `src/mocks/handlers.ts`.

---

## Common Issues & Solutions

### CORS Error

**Error:**
```
Access to XMLHttpRequest at 'http://localhost:8000/api/v1/ask' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**
1. Check backend `.env` includes frontend origin:
   ```env
   CORS_ORIGINS=http://localhost:5173
   ```
2. Restart backend
3. Clear browser cache (`Ctrl+Shift+Del`)

---

### 401 Unauthorized (But AUTH_ENABLED=false)

**Solution:**
1. Verify `AUTH_ENABLED=false` in backend `.env`
2. Restart backend
3. Clear browser localStorage: `localStorage.clear()`
4. Try again

---

### Streaming Response Not Consumed

**Error:**
```
Unhandled promise rejection: Incomplete streaming response
```

**Solution:**
- Ensure Response.body is being read in order
- Validate NDJSON parsing
- Check browser Network tab (set `Response` to `Blob` view)

---

### Database Connection Failed

**Error:**
```
ORA-12514: TNS:listener does not currently know of service requested
```

**Solution:**
- Verify DB server is running
- Check connection string in `.env`
- Test manually: `sqlplus user/password@host:port/service`

---

### Token Expiration

**Issue:** Token expires after `JWT_EXPIRATION_MINUTES` (default 60).

**Solution:**
- Increase expiration in backend `.env`:
  ```env
  JWT_EXPIRATION_MINUTES=1440  # 24 hours
  ```
- Or implement token refresh in frontend

---

## Sample API Calls

### 1. Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'

# Response:
# {
#   "access_token": "eyJhbGc...",
#   "token_type": "bearer",
#   "expires_in": 3600
# }
```

### 2. Get Session

```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
# { "user_id": "...", "username": "user", "roles": ["admin"] }
```

### 3. Ask Query (Streaming)

```bash
curl -X POST http://localhost:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"question":"How many users?"}' \
  --http2

# Response (NDJSON):
# {"type":"thinking",...}
# {"type":"technical_view","sql":"SELECT COUNT(*)..."}
# {"type":"data","rows":[[150]]}
# {"type":"end","duration_ms":245}
```

### 4. List Toggles (Admin)

```bash
curl -X GET http://localhost:8000/api/v1/admin/settings/feature-toggles \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Response:
# { "toggles": [...] }
```

---

## Build for Production

```bash
npm run build

# Output: frontend/dist/
```

**Optimize:**
```bash
npm run build:analyze  # Shows bundle composition
```

---

## Deployment Checklist

Before deploying:

- [ ] All tests pass: `npm run test`
- [ ] No lint errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors (DevTools)
- [ ] No hardcoded URLs (use env vars)
- [ ] Governance rules verified (PR review)
- [ ] CORS configured on backend
- [ ] Streaming response handling tested
- [ ] Error handling tested (offline backend)
- [ ] Accessibility tested (axe DevTools)

---

## Quick Reference Tables

### All Endpoints

| Method | Path | Purpose | Auth | Stream |
|--------|------|---------|------|--------|
| POST | `/auth/login` | Get token | ❌ | ❌ |
| GET | `/auth/me` | Session info | ✅ | ❌ |
| POST | `/auth/logout` | Logout | ✅ | ❌ |
| POST | `/ask` | Execute query | ❌/✅ | ✅ |
| GET | `/admin/settings/feature-toggles` | List toggles | ✅ Admin | ❌ |
| POST | `/admin/settings/feature-toggle` | Toggle feature | ✅ Admin | ❌ |
| GET | `/admin/training` | List training items | ✅ Admin | ❌ |
| POST | `/admin/training/{id}/approve` | Approve training | ✅ Admin | ❌ |
| POST | `/admin/training/{id}/reject` | Reject training | ✅ Admin | ❌ |
| POST | `/feedback` | Submit feedback | ✅ | ❌ |
| GET | `/health` | Health check | ❌ | ❌ |

---

### Chunk Types

| Type | First | Before Data | Optional | Error Safe |
|------|-------|-------------|----------|-----------|
| thinking | ✅ | N/A | ❌ | ✅ |
| technical_view | ❌ | ✅ | ❌ | ✅ |
| data | ❌ | ❌ | ✅ | ❌ |
| business_view | ❌ | ❌ | ✅ | ❌ |
| error | ❌ | ❌ | ✅ | ✅ |
| end | ❌ | ❌ | ❌ | ✅ |

---

### Environment Flags

| Flag | Local | CI | Prod | Frontend Impact |
|------|-------|----|----|-----------------|
| `AUTH_ENABLED` | ❌ | ✅ | ✅ | Show/hide login |
| `RBAC_ENABLED` | ❌ | ✅ | ✅ | Show/hide admin |
| `ENABLE_TRAINING_PILOT` | ✅ | ❌ | ❌ | Show/hide training |
| `ENABLE_RATE_LIMIT` | ❌ | ❌ | ✅ | Implement backoff |
| `ENABLE_SEMANTIC_CACHE` | ❌ | ❌ | ✅ | Show cache notice |

---

### Error Codes

| Code | Status | Retry |
|------|--------|-------|
| `INVALID_CREDENTIALS` | 401 | ❌ |
| `UNAUTHORIZED` | 401 | ❌ |
| `FORBIDDEN` | 403 | ❌ |
| `POLICY_VIOLATION` | 403 | ❌ |
| `IMMUTABLE_TOGGLE` | 403 | ❌ |
| `INVALID_REQUEST` | 400 | ❌ |
| `RATE_LIMIT_EXCEEDED` | 429 | ✅ |
| `SQL_EXECUTION_FAILED` | 500 | Maybe |
| `SERVICE_UNAVAILABLE` | 503 | ✅ |

---

### Governance Rules (Summary)

1. ❌ **No SQL** — Display only
2. ❌ **No permissions** — Trust backend 403
3. ❌ **No RLS** — Backend filters
4. ❌ **No caching** — Backend handles
5. ❌ **No assumptions** — Backend generates
6. ❌ **No secrets** — Use sessionStorage/HttpOnly
7. ❌ **No reordering** — Process chunks in order
8. ❌ **No mutations** — Always request backend first
9. ❌ **No policy caching** — Always fetch fresh
10. ❌ **No hardcoding** — Detect at runtime

---

## Next Steps for Frontend Team

1. **Read** this entire document (you're doing it!)
2. **Setup** local environment per "Local Development Setup"
3. **Test** first endpoint: `GET /health` then `POST /ask`
4. **Validate** streaming protocol: watch NDJSON chunks in order
5. **Build** components that consume data (display only)
6. **Verify** governance rules in PR review
7. **Deploy** once all checks pass

---

## Questions?

| Question | Answer Location |
|----------|------------------|
| What's the API for X? | See "API Contract (Complete)" section |
| How does NDJSON work? | See "Streaming Protocol (NDJSON)" section |
| What happens in local vs prod? | See "Environment Behavior Matrix" section |
| What error codes exist? | See "Error Handling (Complete)" section |
| What can't I do? | See "Governance Rules (10 Hard Constraints)" section |
| How do I set up locally? | See "Local Development Setup" section |
| How do I debug? | See "Testing & Debugging" section |

---

## Summary

✅ **Complete API contract** — All endpoints, schemas, status codes  
✅ **Binding streaming protocol** — Strict NDJSON chunk order  
✅ **Environment behavior** — Local/CI/Prod differences  
✅ **Error handling** — All error codes + retry logic  
✅ **10 governance rules** — Hard constraints (PR-blocking)  
✅ **Local development** — Step-by-step setup  
✅ **Testing & debugging** — All tools explained  

**Frontend engineers have everything needed to implement UI independently.**

**No backend assumptions. No reverse-engineering. No questions.**

---

**Backend is ready. Frontend can begin immediately.**

