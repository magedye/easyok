# Error Handling Contract

**Audience:** Frontend Engineers  
**Status:** Binding (Post-Stage-6)

---

## Overview

All errors returned by the Backend follow a **consistent JSON schema**.

Errors are either:
1. **Pre-stream (HTTP)** — returned before NDJSON begins
2. **In-stream** — returned as `error` chunk within NDJSON

---

## Standard Error Response

All non-streaming errors return:

```json
{
  "error_code": "UNIQUE_IDENTIFIER",
  "message": "Human-readable description",
  "details": {
    "field": "optional_context",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**HTTP Headers:**
| Header | Meaning |
|--------|---------|
| `X-Trace-ID` | Correlation ID (matches `details.correlation_id`) |
| `X-Error-Code` | Error code (for programmatic handling) |

---

## Error Classification

### Authentication & Authorization Errors (4xx)

#### `INVALID_CREDENTIALS` (401)

**When:** Login with wrong username/password.

**Response:**
```json
{
  "error_code": "INVALID_CREDENTIALS",
  "message": "Username or password incorrect",
  "details": {
    "attempted_username": "user@example.com"
  }
}
```

**Frontend Action:** Show login form again, allow retry.

---

#### `UNAUTHORIZED` (401)

**When:** Token missing, expired, or invalid.

**Response:**
```json
{
  "error_code": "UNAUTHORIZED",
  "message": "Invalid or expired JWT token",
  "details": {
    "reason": "token_expired"
  }
}
```

**Possible Reasons:**
- `token_expired` — Token lifetime exceeded
- `token_invalid_signature` — Token tampered
- `token_missing` — No Authorization header
- `token_invalid_format` — Not `Bearer <token>`

**Frontend Action:** 
1. Clear stored token
2. Redirect to login
3. Allow user to re-authenticate

---

#### `FORBIDDEN` (403)

**When:** User lacks permission for endpoint.

**Response:**
```json
{
  "error_code": "FORBIDDEN",
  "message": "Insufficient permissions for this operation",
  "details": {
    "required_permission": "admin.settings.write",
    "user_permissions": ["admin.settings.read", "query.execute"]
  }
}
```

**Frontend Action:** 
- Hide or disable button
- Show "Access Denied" if user tries anyway
- Explain what permission is needed

---

### Policy & Governance Errors (403)

#### `POLICY_VIOLATION` (403)

**When:** Question references out-of-scope tables or columns.

**Response (Pre-stream):**
```json
{
  "error_code": "POLICY_VIOLATION",
  "message": "Question references out-of-scope tables",
  "details": {
    "tables_requested": ["employees"],
    "tables_allowed": ["customers", "orders"],
    "policy_version": 5
  }
}
```

**Response (In-stream):**
```json
{
  "type": "error",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:01.234567Z",
  "error_code": "POLICY_VIOLATION",
  "message": "Column 'salary' is not in active policy scope"
}
```

**Frontend Action:**
- Show error with explanation
- Suggest allowed tables/columns
- Offer to refactor the question

---

#### `IMMUTABLE_TOGGLE` (403)

**When:** Trying to toggle a flag marked immutable in current environment.

**Response:**
```json
{
  "error_code": "IMMUTABLE_TOGGLE",
  "message": "Feature flag AUTH_ENABLED is immutable in production",
  "details": {
    "feature": "AUTH_ENABLED",
    "reason": "Cannot disable authentication in production",
    "environment": "production"
  }
}
```

**Frontend Action:**
- Disable toggle UI (show lock icon)
- Explain why it's immutable
- No retry needed

---

### Validation Errors (400)

#### `INVALID_REQUEST` (400)

**When:** Malformed request (missing required fields, wrong types).

**Response:**
```json
{
  "error_code": "INVALID_REQUEST",
  "message": "Question field is required and must be a string",
  "details": {
    "field": "question",
    "error": "string expected"
  }
}
```

**Frontend Action:**
- Show validation error near the field
- Let user correct and retry

---

#### `INVALID_QUESTION` (400)

**When:** Question is empty, too long, or nonsensical.

**Response:**
```json
{
  "error_code": "INVALID_QUESTION",
  "message": "Question must be between 5 and 500 characters",
  "details": {
    "min_length": 5,
    "max_length": 500,
    "provided_length": 2
  }
}
```

**Frontend Action:**
- Show character count
- Highlight min/max constraints
- Allow retry

---

### Rate Limiting (429)

#### `RATE_LIMIT_EXCEEDED` (429)

**When:** User exceeds 60 requests/minute.

**Response:**
```json
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded: 60 requests per minute",
  "details": {
    "limit_per_minute": 60,
    "requests_so_far": 61
  }
}
```

**HTTP Header:**
```
Retry-After: 45
```

**Frontend Action:**
1. Show: "Too many requests. Try again in 45 seconds."
2. Implement exponential backoff:
   ```typescript
   const retryAfter = parseInt(response.headers['Retry-After'] || '60');
   const delay = Math.min(retryAfter * 1000, 60000); // Cap at 60s
   setTimeout(() => retryRequest(), delay);
   ```
3. Disable submit button during cooldown
4. Show countdown timer

---

### SQL & Query Execution Errors (500)

#### `SQL_EXECUTION_FAILED` (500)

**When:** SQL execution fails on the database.

**Response:**
```json
{
  "error_code": "SQL_EXECUTION_FAILED",
  "message": "ORA-00942: table or view does not exist",
  "details": {
    "sql_executed": "SELECT * FROM invalid_table",
    "database_error": "ORA-00942",
    "table_name": "invalid_table"
  }
}
```

**In-stream version:**
```json
{
  "type": "error",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "error_code": "SQL_EXECUTION_FAILED",
  "message": "ORA-00942: table or view does not exist",
  "details": {
    "database": "oracle",
    "error_code": "ORA-00942"
  }
}
```

**Frontend Action:**
- Display error message
- Show generated SQL (for debugging)
- Suggest: "This might be a temporary database issue. Try again?"
- **Do NOT** show full exception stack in production
- Log error with trace_id for support

---

#### `SQL_GENERATION_FAILED` (500)

**When:** LLM couldn't generate valid SQL from the question.

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
- Show error with context
- Provide suggestion if available
- Offer: "Try rephrasing your question"
- Link to help docs on phrasing

---

### External Service Errors (5xx)

#### `SERVICE_UNAVAILABLE` (503)

**When:** LLM provider, vector store, or database is down.

**Response:**
```json
{
  "error_code": "SERVICE_UNAVAILABLE",
  "message": "One or more backend services are unavailable",
  "details": {
    "unavailable_services": ["llm_provider", "vector_store"],
    "estimated_recovery": "2025-01-01T12:15:00Z"
  }
}
```

**Frontend Action:**
1. Show: "Services are temporarily unavailable. We're working on it."
2. Implement retry with exponential backoff
3. Show `estimated_recovery` time if available
4. Disable query submission temporarily

---

#### `STREAMING_INTERRUPTED` (500)

**When:** Connection lost during NDJSON stream.

**In-stream response:**
```json
{
  "type": "error",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "error_code": "STREAMING_INTERRUPTED",
  "message": "Connection lost during streaming",
  "details": {
    "last_chunk_type": "technical_view",
    "recovery_possible": true
  }
}
```

**Frontend Action:**
- Show: "Connection interrupted. Would you like to retry?"
- If `recovery_possible=true`, use same `trace_id` for retry
- If `recovery_possible=false`, restart fresh query

---

### Admin & Governance Errors (400/403)

#### `MISSING_REASON` (400)

**When:** Admin tries to toggle a feature without required reason.

**Response:**
```json
{
  "error_code": "MISSING_REASON",
  "message": "Reason required for feature toggle (min 10 characters)",
  "details": {
    "min_reason_length": 10,
    "provided_length": 0
  }
}
```

**Frontend Action:**
- Show validation error on form
- Require user to enter reason before submitting

---

#### `TRAINING_ALREADY_PROCESSED` (400)

**When:** Trying to approve/reject a training item that's already processed.

**Response:**
```json
{
  "error_code": "TRAINING_ALREADY_PROCESSED",
  "message": "Training item is already approved; cannot be modified",
  "details": {
    "item_id": "uuid",
    "current_status": "approved",
    "approved_at": "2025-01-01T10:00:00Z",
    "approved_by": "admin@example.com"
  }
}
```

**Frontend Action:**
- Show warning: "This item was already approved on [date]"
- Prevent further modifications
- Show who approved it

---

## Error Handling Strategy

### In Components

```typescript
async function submitQuery(question: string) {
  try {
    const response = await fetch('/api/v1/ask', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ question, stream: true })
    });

    if (!response.ok) {
      // Pre-stream error (HTTP)
      const error = await response.json();
      handlePreStreamError(error);
      return;
    }

    // Stream response
    for await (const chunk of consumeStream(response)) {
      if (chunk.type === 'error') {
        // In-stream error
        handleInStreamError(chunk);
        break;
      }
      // Handle other chunk types
    }
  } catch (err) {
    // Network error or parse error
    handleNetworkError(err);
  }
}

function handlePreStreamError(error: ErrorResponse) {
  switch (error.error_code) {
    case 'POLICY_VIOLATION':
      showError(`Question out of scope: ${error.details.tables_requested.join(', ')}`);
      break;
    case 'RATE_LIMIT_EXCEEDED':
      showError(`Too many requests. Retry in ${error.details.retry_after}s`);
      disableSubmitButton(error.details.retry_after * 1000);
      break;
    case 'UNAUTHORIZED':
      redirectToLogin();
      break;
    default:
      showError(error.message);
  }
}

function handleInStreamError(chunk: ErrorChunk) {
  showError(`Query failed: ${chunk.message}`);
  logError({ trace_id: chunk.trace_id, code: chunk.error_code });
}
```

---

## Retry Logic

### Retryable Errors

| Code | Should Retry | Strategy |
|------|--------------|----------|
| `SQL_EXECUTION_FAILED` | Maybe | Exponential backoff, max 3x |
| `SERVICE_UNAVAILABLE` | Yes | Exponential backoff, max 5x |
| `STREAMING_INTERRUPTED` | Yes | Resume with same trace_id |
| `RATE_LIMIT_EXCEEDED` | Yes | Wait `Retry-After` seconds |
| `POLICY_VIOLATION` | No | Refactor question |
| `INVALID_CREDENTIALS` | No | Re-authenticate |
| `SQL_GENERATION_FAILED` | No | Rephrase question |

### Backoff Formula

```typescript
const maxRetries = 5;
const baseDelay = 1000; // 1s

for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    return await executeQuery();
  } catch (error) {
    if (!isRetryable(error)) throw error;
    
    const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential
    const jitter = Math.random() * 1000; // Random jitter
    
    await sleep(delay + jitter);
  }
}
```

---

## Logging & Monitoring

**Always log with trace_id:**

```typescript
logger.error('Query failed', {
  trace_id: chunk.trace_id,
  error_code: chunk.error_code,
  message: chunk.message,
  timestamp: new Date().toISOString(),
  user_id: currentUser.id
});
```

**Send to monitoring (e.g., Sentry):**

```typescript
Sentry.captureException(error, {
  contexts: {
    api: {
      trace_id: response.headers.get('X-Trace-ID'),
      error_code: errorResponse.error_code
    }
  }
});
```

---

## Summary

**Frontend must:**
1. ✅ Parse both HTTP and in-stream errors
2. ✅ Handle errors appropriately (retry, retry-after, redirect, etc.)
3. ✅ Display user-friendly messages (no stack traces in prod)
4. ✅ Log errors with trace_id for support
5. ✅ Implement exponential backoff for retryable errors
6. ✅ Never assume error structure (validate before accessing fields)

