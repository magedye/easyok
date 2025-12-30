# Streaming Contract — NDJSON Protocol Specification

**Audience:** Frontend Engineers  
**Protocol:** NDJSON (Newline-Delimited JSON)  
**Content-Type:** `application/x-ndjson`  
**Status:** Binding (Post-Stage-6)

---

## Overview

The `/ask` endpoint returns streaming responses in **NDJSON format**.

Each line is a **complete JSON object** representing a distinct **chunk** of the response lifecycle.

**Key Rule:** Chunks arrive in a **strict, immutable order**. Frontend MUST NOT reorder or skip chunks.

---

## Chunk Types & Sequence

### 1. `thinking` (ALWAYS FIRST)

**Purpose:** Signal that backend is processing.

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
| `trace_id` | UUID | ✅ | Unique request identifier (same for all chunks in stream) |
| `timestamp` | ISO8601 | ✅ | When backend emitted this chunk |
| `status` | string | ✅ | Human-readable progress message |

**Behavior:**
- Frontend should display this to indicate "processing started"
- Can be used for a spinner or progress indicator
- Exactly 1 per stream (always first)

**Example UI**: "Analyzing question and preparing SQL..."

---

### 2. `technical_view` (ALWAYS BEFORE DATA)

**Purpose:** Show the generated SQL, assumptions, and policy validation.

**Schema:**
```json
{
  "type": "technical_view",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:01.456789Z",
  "sql": "SELECT COUNT(*) AS user_count FROM users WHERE created_at >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)",
  "assumptions": [
    "Column 'created_at' represents user registration timestamp",
    "Table 'users' contains all user records",
    "Only active users are included (no soft-delete filtering)"
  ],
  "policy_hash": "sha256:abc123def456..."
}
```

**Fields:**
| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | string | ✅ | Always `"technical_view"` |
| `trace_id` | UUID | ✅ | Same as thinking chunk |
| `timestamp` | ISO8601 | ✅ | When SQL was generated |
| `sql` | string | ✅ | Generated SQL (database-dialect specific) |
| `assumptions` | string[] | ✅ | List of assumptions made (can be empty) |
| `policy_hash` | string | ✅ | Hash of the active schema policy that validated this SQL |

**Behavior:**
- MUST appear before `data` chunk
- MUST appear even if SQL execution fails
- SQL is **read-only** (SELECT, aggregates, CTEs only)
- Assumptions are commitments to the user about interpretation
- Policy hash ties the query to a specific access control version

**Frontend Responsibilities:**
- Display SQL in a read-only code block
- Display assumptions in a separate panel
- Allow user to mark assumptions as incorrect (→ feedback)
- Store `policy_hash` for audit linkage

**Example UI:**
```
Generated SQL:
  SELECT COUNT(*) AS user_count FROM users WHERE created_at >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -1)

Assumptions:
  ☑ Column 'created_at' represents user registration timestamp
  ☑ Table 'users' contains all user records
  ☑ Only active users are included (no soft-delete filtering)

[Mark Incorrect] [Copy SQL]
```

---

### 3. `data` (OPTIONAL, IF DATA EXISTS)

**Purpose:** Return actual query results.

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
| `trace_id` | UUID | ✅ | Same as thinking chunk |
| `timestamp` | ISO8601 | ✅ | When data was fetched |
| `columns` | string[] | ✅ | Column names (in order) |
| `rows` | any[][] | ✅ | Data rows (can be empty array if 0 rows) |
| `row_count` | int | ✅ | Number of rows returned |

**Behavior:**
- ABSENT if query returns 0 rows (no data chunk sent)
- ABSENT if query execution failed (error chunk sent instead)
- Rows are always in the order matching `columns`
- Row limit is set by `DEFAULT_ROW_LIMIT` (default 100)
- If result exceeds limit, frontend shows truncation notice

**Frontend Responsibilities:**
- Render data in dynamic table (columns are not pre-defined)
- Show "No data" message if data chunk absent
- Show row count to user
- Make table exportable (CSV, copy)

**Example UI:**
```
Results (1 row):
  USER_COUNT
  -----------
  150

[Copy] [Export as CSV]
```

---

### 4. `business_view` (OPTIONAL, AFTER DATA)

**Purpose:** Provide human-readable summary and optional chart config.

**Schema:**
```json
{
  "type": "business_view",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:03.012345Z",
  "summary": "150 users registered during the past month. This represents a 23% increase compared to the previous month.",
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
| `trace_id` | UUID | ✅ | Same as thinking chunk |
| `timestamp` | ISO8601 | ✅ | When summary was generated |
| `summary` | string | ✅ | Human-readable interpretation |
| `chart_config` | object | ❌ | Chart specification (optional) |

**Chart Config Schema:**
```json
{
  "type": "bar" | "line" | "pie",
  "x_axis": "column_name",
  "y_axis": "column_name",
  "title": "optional title",
  "data": [
    {"column1": "value1", "column2": 123, ...}
  ]
}
```

**Behavior:**
- ABSENT if no business interpretation available
- ABSENT if error during query execution
- Summary is always in English (or user's language per localization)
- Chart config uses data from the `data` chunk (must match columns)

**Frontend Responsibilities:**
- Display summary prominently below results
- If `chart_config` present: render chart using Chart.js, D3.js, or similar
- Make chart responsive and exportable (PNG)
- Fallback gracefully if charting library unavailable

**Example UI:**
```
Summary:
  150 users registered during the past month. This represents a 23%
  increase compared to the previous month.

[Chart View] [Table View]

📊 (Bar chart showing monthly trends)
```

---

### 5. `end` (ALWAYS LAST)

**Purpose:** Signal successful stream completion.

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
| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `type` | string | ✅ | Always `"end"` |
| `trace_id` | UUID | ✅ | Same as thinking chunk |
| `timestamp` | ISO8601 | ✅ | When stream ended |
| `duration_ms` | int | ✅ | Total time (milliseconds) |

**Behavior:**
- Signals normal stream completion
- Exactly 1 per successful request
- No chunks sent after `end`
- If stream breaks before `end`, client should treat as failure

**Frontend Responsibilities:**
- Hide processing spinner
- Log duration for metrics
- Enable "Export" and "Save as Asset" buttons
- Clear loading state

---

## Error Scenarios

### Error During Stream (After Thinking Started)

If error occurs **after** stream starts, return error chunk instead of raising HTTP error.

**Example:**
```
{"type":"thinking","trace_id":"550e8400-e29b-41d4-a716-446655440000","timestamp":"2025-01-01T12:00:00.123456Z","status":"Validating SQL..."}
{"type":"error","trace_id":"550e8400-e29b-41d4-a716-446655440000","timestamp":"2025-01-01T12:00:01.234567Z","error_code":"POLICY_VIOLATION","message":"Table 'users' not found in active policy scope"}
{"type":"end","trace_id":"550e8400-e29b-41d4-a716-446655440000","timestamp":"2025-01-01T12:00:01.345678Z","duration_ms":1345}
```

### Error Chunk Schema

```json
{
  "type": "error",
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:01.234567Z",
  "error_code": "POLICY_VIOLATION",
  "message": "Table 'users' not found in active policy scope",
  "details": {
    "tables_requested": ["users"],
    "tables_allowed": ["customers", "orders"],
    "policy_version": 5
  }
}
```

**Common Error Codes:**
| Code | Meaning | Retry |
|------|---------|-------|
| `POLICY_VIOLATION` | Question out-of-scope | No |
| `SQL_EXECUTION_FAILED` | Database error | Depends |
| `SQL_GENERATION_FAILED` | LLM couldn't generate SQL | No |
| `STREAMING_INTERRUPTED` | Connection lost mid-stream | Yes |
| `SERVICE_UNAVAILABLE` | Backend degraded | Yes |

---

### Error Before Stream (HTTP Error)

If error detected **before** stream starts, return HTTP error (not NDJSON).

**Example:**
```bash
curl -X POST http://localhost:8000/api/v1/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How many users?"}'

HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error_code": "POLICY_VIOLATION",
  "message": "Question references out-of-scope tables: [users]"
}
```

---

## Stream Consumption Example (TypeScript)

```typescript
async function* consumeAskStream(question: string): AsyncGenerator<Chunk> {
  const response = await fetch('/api/v1/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ question, stream: true })
  });

  if (!response.ok) {
    // Pre-stream error (HTTP)
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
    
    // Keep last incomplete line in buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        const chunk = JSON.parse(line);
        yield chunk;
        
        // Type-check chunk
        validateChunkOrder(chunk);
      }
    }
  }
}
```

---

## Contract Validation Rules (Frontend)

### Order Enforcement

```typescript
const validSequences: Record<string, string[]> = {
  'thinking': ['technical_view', 'error', 'end'],
  'technical_view': ['data', 'business_view', 'error', 'end'],
  'data': ['business_view', 'error', 'end'],
  'business_view': ['error', 'end'],
  'error': ['end'],
  'end': [] // No chunks after end
};

function validateChunkOrder(chunk: Chunk, lastChunk: Chunk | null): boolean {
  if (!lastChunk) {
    return chunk.type === 'thinking'; // First chunk MUST be thinking
  }

  const allowed = validSequences[lastChunk.type];
  return allowed.includes(chunk.type);
}
```

### Trace ID Consistency

All chunks in a single stream MUST have the same `trace_id`:

```typescript
function validateTraceIdConsistency(firstChunk: Chunk, currentChunk: Chunk): boolean {
  return firstChunk.trace_id === currentChunk.trace_id;
}
```

---

## Performance & Limits

| Parameter | Default | Configurable |
|-----------|---------|--------------|
| Response timeout | 60s | Via `LLM_REQUEST_TIMEOUT` |
| Max data rows | 100 | Via `DEFAULT_ROW_LIMIT` |
| Max SQL length | 2000 | Via `MAX_SQL_TOKENS` |

**Frontend Strategy:**
- Show spinner while waiting for first chunk (max 5s before timeout warning)
- Show incremental progress as chunks arrive
- Close stream if no chunk received for 60s

---

## Summary Table

| Chunk | Required | First | Before Data | Multiple | Error Safe |
|-------|----------|-------|-------------|----------|-----------|
| `thinking` | ✅ | ✅ | N/A | ❌ | ✅ |
| `technical_view` | ✅ | ❌ | ✅ | ❌ | ✅ |
| `data` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `business_view` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `error` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `end` | ✅ | ❌ | ❌ | ❌ | ✅ |

