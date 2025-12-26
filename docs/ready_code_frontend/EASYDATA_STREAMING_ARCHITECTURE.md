# EasyData Frontend: NDJSON Streaming Architecture

## Section 1: Architectural Mapping (Legacy vs. EasyData v16)

### 1.1 Current Architecture (Vanna Insight Frontend)

| Layer | Technology | Pattern | Limitation |
|-------|-----------|---------|-----------|
| **Data Fetching** | Axios | Request-Response | No real-time streaming |
| **State Management** | React Query | Polling + Cache | Inefficient for live data |
| **Type Safety** | TypeScript (Partial) | Interfaces at service level | No streaming contract types |
| **API Base** | `VITE_API_BASE_URL` | Axios config | Requires refactoring for fetch |
| **Error Handling** | Mutation/Query errors | React Query callbacks | No streaming-specific handlers |
| **RTL Support** | CSS + Tailwind | Document-level config | Limited component-level support |

**Key Limitation:** No streaming support. All API calls are request-response, which doesn't scale for large result sets or long-running operations like AI query generation.

---

### 1.2 Target Architecture (EasyData v16)

| Layer | Technology | Pattern | Advantage |
|-------|-----------|---------|-----------|
| **Data Fetching** | Fetch API | HTTP ReadableStream | True streaming, low memory footprint |
| **Protocol** | NDJSON | Line-by-line JSON parsing | Single HTTP connection, incremental updates |
| **Type Safety** | TypeScript (Strict) | Union types for chunks | Type-based routing + exhaustiveness checking |
| **Custom Hook** | `useEasyStream` | Event-driven accumulation | React state updates per chunk |
| **Component** | `StreamRenderer` | Type dispatch logic | Modular, testable chunk handling |
| **RTL Support** | Component-level props | `dir="rtl"` + CSS cascade | Arabic layout at component boundaries |
| **Error Handling** | Streaming-aware | Stop on `error` chunk | Graceful degradation per chunk type |

---

### 1.3 NDJSON Contract

```typescript
/**
 * Valid streaming chunk types:
 * - technical_view: SQL analysis, execution plan, metadata
 * - data: Query result rows (accumulated in table)
 * - chart: Chart configuration (Chart.js compatible)
 * - summary: Text summary of results
 * - error: Stop processing, display error message
 */

interface StreamChunk {
  type: 'technical_view' | 'data' | 'chart' | 'summary' | 'error'
  payload: Record<string, unknown> // Type-specific structure
  timestamp?: number
  sequenceId?: number
}

// Example NDJSON response (each line is a valid JSON object):
// {"type":"technical_view","payload":{"sql":"SELECT...","executionPlan":"..."}}
// {"type":"data","payload":{"rows":[{"id":1,"name":"Alice"}]}}
// {"type":"data","payload":{"rows":[{"id":2,"name":"Bob"}]}}
// {"type":"chart","payload":{"type":"bar","labels":["A","B"],"datasets":[...]}}
// {"type":"summary","payload":{"text":"2 rows returned in 234ms"}}
```

---

### 1.4 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ User submits question (e.g., "Top 5 products by sales") │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────────┐
          │  useEasyStream(endpoint)   │
          │  - Fetches /api/v1/ask     │
          │  - Gets ReadableStream     │
          │  - Reads lines until EOF   │
          └────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │  NDJSON Line Parser (parseChunk) │
        │  - Splits \n-delimited JSON      │
        │  - Validates chunk.type          │
        │  - Returns ChunkPayload          │
        └────────────┬─────────────────────┘
                     │
      ┌──────────────┼──────────────┬──────────────┐
      │              │              │              │
      ▼              ▼              ▼              ▼
  technical_view   data           chart        summary/error
      │              │              │              │
      ▼              ▼              ▼              ▼
   Display        Accumulate     Render       Final message
   Query Meta     Rows in Table  Chart.js     or Error
      │              │              │              │
      └──────────────┴──────────────┴──────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │   <StreamRenderer>       │
          │   - Shows all 4 chunks   │
          │   - RTL layout support   │
          │   - Error recovery       │
          └──────────────────────────┘
```

---

## Key Differences: Migration Path

### Old Pattern (Vanna)
```typescript
export const executeQuery = async (payload: QueryExecuteRequest) => {
  const { data } = await apiClient.post<QueryExecuteResponse>('/sql/execute', payload)
  return data
}

// In component:
const { data, isLoading } = useQuery(
  ['execute', payload],
  () => executeQuery(payload)
)
```

### New Pattern (EasyData)
```typescript
export const executeQueryStream = async (
  payload: { question: string },
): Promise<ReadableStreamDefaultReader<Uint8Array>> => {
  return streamingFetch('/ask', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// In component:
const { state, isStreaming, error } = useEasyStream()
const handleSubmit = async (question: string) => {
  const reader = await executeQueryStream({ question })
  // Pass reader to streaming processor
}
```

### Key Differences
| Aspect | Axios Pattern | Streaming Pattern |
|--------|--------------|------------------|
| Response Time | Wait for full response | Stream in real-time |
| Memory | Load entire result in memory | Process incrementally |
| Error Handling | HTTP-level only | Can error mid-stream |
| UI Updates | Single state update | Multiple state updates |
| Type Safety | Response interface | Discriminated union types |
| Backend Latency | High (wait for all chunks) | Low (show results ASAP) |

---

## Integration Strategy

### Phase 1: Core Infrastructure (4-6 hours)
- Create `types/streaming.ts` with discriminated union types
- Create `utils/ndjsonParser.ts` with line-by-line parsing
- Create `utils/streamingFetch.ts` with fetch wrapper
- Add type guards for all chunk types

### Phase 2: React Integration (2-3 hours)
- Create `hooks/useEasyStream.ts` custom hook
- Implement chunk accumulation logic
- Add abort/reset functionality

### Phase 3: Components (3-4 hours)
- Create `StreamRenderer.tsx` main dispatcher
- Create sub-components: TechnicalView, DataTable, ChartContainer, Summary, ErrorAlert
- Add RTL support via component props

### Phase 4: Integration & Testing (4-6 hours)
- Wire up to real endpoints
- Create example pages
- Unit tests for parser + hook
- E2E tests with Playwright

**Total Estimated Effort:** 13-19 hours (~2-3 days for experienced developer)

---

## Validation Checklist

- [ ] All chunk types defined in types/streaming.ts
- [ ] Type guards cover all union members
- [ ] NDJSON parser handles incomplete lines
- [ ] streamingFetch respects VITE_API_BASE_URL
- [ ] useEasyStream properly accumulates data chunks
- [ ] StreamRenderer type-checks all payloads
- [ ] RTL components use dir prop
- [ ] Error chunks stop iteration gracefully
- [ ] AbortController prevents memory leaks
- [ ] Chart.js integration works with streaming data
