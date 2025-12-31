# NDJSON Streaming Protocol Specification

**Target Audience:** Frontend Developers  
**Last Updated:** 2025-12-31  
**Version:** Phase 4 Documentation  

## 📋 Overview

This document defines the NDJSON (Newline Delimited JSON) streaming protocol used for real-time query responses. The protocol ensures predictable chunk ordering, trace ID correlation, and graceful error handling.

## 🎯 Core Principles

1. **Strict Chunk Order:** Chunks must arrive in predefined sequence
2. **Trace ID Consistency:** All chunks share the same trace_id for correlation  
3. **Type Safety:** Use **[`ChunkType`](../frontend/src/types/streaming.ts:8)** enum, never string literals
4. **Contract Enforcement:** **[`StreamValidator`](../frontend/src/utils/streamingValidator.ts:25)** validates all chunks
5. **Graceful Recovery:** Handle interruptions with restart strategy

## 📡 Stream Format

### NDJSON Structure
Each line contains a complete JSON object (chunk) followed by a newline:

```
{"type": "thinking", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:00.000Z", "payload": {...}}
{"type": "technical_view", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:01.000Z", "payload": {...}}
{"type": "data", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:02.000Z", "payload": {...}}
{"type": "business_view", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:03.000Z", "payload": {...}}
{"type": "end", "trace_id": "trace_abc123", "timestamp": "2025-12-31T01:00:04.000Z", "payload": {...}}
```

### Base Chunk Schema
All chunks inherit from this base structure:

```typescript
interface BaseChunk {
  type: ChunkType;           // Enum value (never string literal)
  trace_id: string;          // Correlation ID (consistent across stream)
  timestamp: string;         // ISO 8601 timestamp
  payload: ChunkPayload;     // Type-specific data
}
```

## 🔄 Chunk Types & Order

### The 6 Chunk Types

#### 1. THINKING Chunk
**Purpose:** Shows reasoning process to user  
**Required:** Yes (always first)  
**Order Position:** 1st

```typescript
interface ThinkingChunk extends BaseChunk {
  type: ChunkType.THINKING;
  payload: {
    content: string;         // Reasoning text
    step?: string;           // Optional step identifier
  };
}
```

**Example:**
```json
{
  "type": "thinking",
  "trace_id": "trace_abc123",
  "timestamp": "2025-12-31T01:00:00.000Z",
  "payload": {
    "content": "Analyzing the request for top customers by revenue. I'll need to aggregate order data and rank by total revenue.",
    "step": "analysis"
  }
}
```

#### 2. TECHNICAL_VIEW Chunk
**Purpose:** SQL query and assumptions (READ-ONLY display)  
**Required:** No  
**Order Position:** 2nd (after THINKING)

```typescript
interface TechnicalViewChunk extends BaseChunk {
  type: ChunkType.TECHNICAL_VIEW;
  payload: {
    sql: string;             // Generated SQL (DISPLAY ONLY)
    assumptions: string[];   // List of assumptions (READ ONLY)
    is_safe: boolean;        // Safety validation result
    policy_hash?: string;    // Policy compliance hash
  };
}
```

**Example:**
```json
{
  "type": "technical_view",
  "trace_id": "trace_abc123", 
  "timestamp": "2025-12-31T01:00:01.000Z",
  "payload": {
    "sql": "SELECT customer_name, SUM(order_value) as total_revenue FROM orders WHERE status = 'completed' GROUP BY customer_name ORDER BY total_revenue DESC LIMIT 5",
    "assumptions": [
      "Using 'orders' table for revenue calculation",
      "Excluding cancelled/refunded orders",
      "Customer names are normalized"
    ],
    "is_safe": true,
    "policy_hash": "policy_v1_abc123def456"
  }
}
```

**⚠️ Governance Compliance:**
- **Rule #1:** Frontend MUST NOT parse, modify, or validate SQL
- **Rule #5:** Frontend MUST NOT modify assumptions
- Display only in read-only components like **[`TechnicalViewPanel`](../frontend/src/components/TechnicalViewPanel.tsx:30)**

#### 3. DATA Chunk
**Purpose:** Query results in tabular format  
**Required:** No  
**Order Position:** 3rd (after TECHNICAL_VIEW)

```typescript
interface DataChunk extends BaseChunk {
  type: ChunkType.DATA;
  payload: Array<Record<string, unknown>> | {
    rows: Array<Record<string, unknown>>;
    columns?: string[];      // Column names for display
    row_count?: number;      // Total row count
  };
}
```

**Example (Simple Array):**
```json
{
  "type": "data",
  "trace_id": "trace_abc123",
  "timestamp": "2025-12-31T01:00:02.000Z",
  "payload": [
    {
      "customer_name": "ACME Corporation",
      "total_revenue": 150000.50
    },
    {
      "customer_name": "Tech Solutions Ltd",
      "total_revenue": 125000.00
    }
  ]
}
```

**Example (Structured Format):**
```json
{
  "type": "data", 
  "trace_id": "trace_abc123",
  "timestamp": "2025-12-31T01:00:02.000Z",
  "payload": {
    "rows": [
      {"customer_name": "ACME Corp", "total_revenue": 150000.50},
      {"customer_name": "Tech Solutions", "total_revenue": 125000.00}
    ],
    "columns": ["customer_name", "total_revenue"],
    "row_count": 2
  }
}
```

#### 4. BUSINESS_VIEW Chunk
**Purpose:** User-friendly summary and insights  
**Required:** No  
**Order Position:** 4th (after DATA)

```typescript
interface BusinessViewChunk extends BaseChunk {
  type: ChunkType.BUSINESS_VIEW;
  payload: {
    text: string;            // Human-readable summary
    metrics?: Record<string, unknown>;  // Key metrics
    chart?: {                // Optional chart configuration
      chart_type: 'bar' | 'line' | 'pie' | string;
      x?: string;
      y?: string;
      [key: string]: unknown;
    };
  };
}
```

**Example:**
```json
{
  "type": "business_view",
  "trace_id": "trace_abc123",
  "timestamp": "2025-12-31T01:00:03.000Z",
  "payload": {
    "text": "Based on completed orders, your top 5 customers by revenue are led by ACME Corporation with $150,050 in total revenue. The top 5 customers represent 65% of your total revenue base.",
    "metrics": {
      "total_customers": 5,
      "total_revenue": 550000.50,
      "revenue_concentration": 0.65
    },
    "chart": {
      "chart_type": "bar",
      "x": "customer_name",
      "y": "total_revenue",
      "title": "Top 5 Customers by Revenue"
    }
  }
}
```

#### 5. ERROR Chunk
**Purpose:** Error information and recovery guidance  
**Required:** Only when errors occur  
**Order Position:** Any position, followed by END

```typescript
interface ErrorChunk extends BaseChunk {
  type: ChunkType.ERROR;
  payload: {
    message: string;         // User-friendly error message
    error_code: string;      // Machine-readable error code
    details?: Record<string, unknown>;  // Additional context
  };
}
```

**Example:**
```json
{
  "type": "error",
  "trace_id": "trace_abc123",
  "timestamp": "2025-12-31T01:00:05.000Z",
  "payload": {
    "message": "Access denied to table 'sensitive_data'. Please contact your administrator.",
    "error_code": "TABLE_ACCESS_DENIED",
    "details": {
      "table": "sensitive_data",
      "required_permission": "READ",
      "user_permissions": ["orders:READ", "customers:READ"]
    }
  }
}
```

#### 6. END Chunk
**Purpose:** Signals stream completion  
**Required:** Yes (always last)  
**Order Position:** Final

```typescript
interface EndChunk extends BaseChunk {
  type: ChunkType.END;
  payload: {
    message?: string;        // Completion message
    total_chunks?: number;   // Total chunks sent
  };
}
```

**Example (Success):**
```json
{
  "type": "end",
  "trace_id": "trace_abc123",
  "timestamp": "2025-12-31T01:00:04.000Z",
  "payload": {
    "message": "Query completed successfully",
    "total_chunks": 5
  }
}
```

**Example (After Error):**
```json
{
  "type": "end",
  "trace_id": "trace_abc123",
  "timestamp": "2025-12-31T01:00:06.000Z",
  "payload": {
    "message": "Query failed due to access restrictions",
    "total_chunks": 2
  }
}
```

## 📏 Chunk Order Rules

### Valid Transitions
The **[`VALID_NEXT_CHUNKS`](../frontend/src/types/streaming.ts:26)** map defines all valid transitions:

```typescript
export const VALID_NEXT_CHUNKS: Record<ChunkType, ChunkType[]> = {
  [ChunkType.THINKING]: [ChunkType.TECHNICAL_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.TECHNICAL_VIEW]: [ChunkType.DATA, ChunkType.BUSINESS_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.DATA]: [ChunkType.BUSINESS_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.BUSINESS_VIEW]: [ChunkType.ERROR, ChunkType.END],
  [ChunkType.ERROR]: [ChunkType.END],
  [ChunkType.END]: [] // No chunks after end
};
```

### Common Flow Patterns

#### 1. Complete Success Flow
```
thinking → technical_view → data → business_view → end
```

#### 2. Early Error Flow
```
thinking → error → end
```

#### 3. Technical Error Flow
```
thinking → technical_view → error → end
```

#### 4. Data Error Flow 
```
thinking → technical_view → data → error → end
```

#### 5. Minimal Success Flow
```
thinking → business_view → end
```

### Validation Rules

1. **First Chunk:** Must be `ChunkType.THINKING`
2. **Last Chunk:** Must be `ChunkType.END`
3. **After ERROR:** Only `ChunkType.END` allowed
4. **After END:** No further chunks allowed
5. **Trace ID:** Must be identical across all chunks
6. **Timestamp:** Should be chronologically increasing

## 🛡️ Frontend Implementation

### Type-Safe Processing
Use **[`ChunkType`](../frontend/src/types/streaming.ts:8)** enum for type safety:

```typescript
// ✅ Correct: Type-safe enum usage
const handleChunk = (chunk: StreamChunk) => {
  switch (chunk.type) {
    case ChunkType.THINKING:
      setThinking(chunk.payload.content);
      break;
    case ChunkType.TECHNICAL_VIEW:
      setTechnicalView(chunk.payload);
      break;
    case ChunkType.DATA:
      setData(chunk.payload);
      break;
    case ChunkType.BUSINESS_VIEW:
      setSummary(chunk.payload);
      break;
    case ChunkType.ERROR:
      setError(chunk.payload);
      break;
    case ChunkType.END:
      setIsComplete(true);
      break;
  }
};

// ❌ Wrong: String literals (governance violation)
if (chunk.type === "thinking") { ... }
```

### Stream Validation
Use **[`StreamValidator`](../frontend/src/utils/streamingValidator.ts:25)** for contract enforcement:

```typescript
import { StreamValidator } from '../utils/streamingValidator';

const validator = new StreamValidator();

const processChunk = (rawChunk: any) => {
  // Convert to typed chunk
  const chunk = rawChunk as StreamChunk;
  
  // Validate order
  const validation = validator.validateChunkOrder(chunk);
  if (!validation.valid) {
    console.error('Stream contract violation:', validation.error);
    throw new Error(`Chunk order violation: ${validation.error}`);
  }
  
  // Process valid chunk
  handleChunk(chunk);
};
```

### Stream Consumer Implementation
```typescript
async function* consumeNDJSONStream(response: Response): AsyncGenerator<StreamChunk> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Validate stream completion
        if (!validator.isComplete()) {
          throw new Error('Stream ended without END chunk');
        }
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep partial line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const chunk = JSON.parse(line) as StreamChunk;
        
        // Validate before yielding
        const validation = validator.validateChunkOrder(chunk);
        if (!validation.valid) {
          throw new Error(`Stream validation failed: ${validation.error}`);
        }
        
        yield chunk;
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Stream processing error:', error);
      throw error;
    }
  }
}
```

## 🔄 Stream Recovery Strategy

### Interruption Handling
NDJSON streams cannot resume from arbitrary positions. Recovery requires full restart:

```typescript
class StreamRecovery {
  async handleInterruption(
    lastReceivedChunk: StreamChunk | null,
    originalQuestion: string
  ): Promise<void> {
    // Check if stream was complete
    if (lastReceivedChunk?.type === ChunkType.END) {
      return; // Stream completed successfully
    }
    
    // Show recovery UI
    this.showRecoveryNotification({
      message: 'Connection interrupted during response',
      lastChunk: lastReceivedChunk?.type || 'none',
      action: 'restart_query'
    });
    
    // Reset validator for new stream
    validator.reset();
    
    // Restart query with new trace_id
    await this.restartQuery(originalQuestion);
  }
}
```

### Error Recovery Patterns
```typescript
const handleStreamError = (error: Error) => {
  if (error.message.includes('Stream validation failed')) {
    // Contract violation - likely backend issue
    setError({
      message: 'Response format error. Please refresh and try again.',
      error_code: 'CHUNK_ORDER_VIOLATION',
      trace_id: validator.getTraceId()
    });
    return;
  }
  
  if (error.message.includes('Stream ended without END chunk')) {
    // Incomplete stream - offer retry
    setError({
      message: 'Response was interrupted. Would you like to retry?',
      error_code: 'STREAMING_INTERRUPTED', 
      trace_id: validator.getTraceId()
    });
    return;
  }
  
  // Generic stream error
  setError({
    message: 'Connection error. Please try again.',
    error_code: 'STREAMING_TIMEOUT',
    trace_id: validator.getTraceId()
  });
};
```

## 📊 Stream Progress Indicators

### Progress Tracking
Use validator state for progress indicators:

```typescript
const StreamProgress: React.FC = () => {
  const [progress, setProgress] = useState({
    phase: null as ChunkType | null,
    chunksReceived: 0,
    expectedNext: [] as ChunkType[],
    isValidating: false
  });
  
  const updateProgress = () => {
    setProgress({
      phase: validator.getCurrentPhase(),
      chunksReceived: validator.getChunks().length,
      expectedNext: validator.getExpectedNextChunks(),
      isValidating: false
    });
  };
  
  const getPhaseDisplayName = (phase: ChunkType | null): string => {
    switch (phase) {
      case ChunkType.THINKING: return 'Analyzing question...';
      case ChunkType.TECHNICAL_VIEW: return 'Generating SQL...';
      case ChunkType.DATA: return 'Fetching data...';
      case ChunkType.BUSINESS_VIEW: return 'Creating summary...';
      case ChunkType.END: return 'Complete';
      default: return 'Waiting...';
    }
  };
  
  return (
    <div className="stream-progress">
      <div className="phase">{getPhaseDisplayName(progress.phase)}</div>
      <div className="chunks">Chunks received: {progress.chunksReceived}</div>
    </div>
  );
};
```

## 🐛 Debug & Troubleshooting

### Validation Diagnostics
```typescript
// Get comprehensive stream state for debugging
const getStreamDiagnostics = () => {
  const stats = validator.getStreamStats();
  const state = validator.exportState();
  
  return {
    // Stream statistics
    totalChunks: stats.totalChunks,
    chunkCounts: stats.chunkCounts,
    duration: stats.duration,
    
    // Validation state
    currentPhase: state.currentPhase,
    isComplete: state.isComplete,
    hasError: state.hasError,
    traceId: state.traceId,
    
    // Missing chunks analysis
    missingChunks: validator.getMissingChunks(),
    
    // Order validation
    traceIdConsistency: validator.validateTraceIdConsistency()
  };
};

console.log('Stream diagnostics:', getStreamDiagnostics());
```

### Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Chunk Order Violation** | `StreamValidator` throws error | Check backend chunking logic |
| **Trace ID Mismatch** | Different trace_id values | Backend coordination issue |
| **Missing END Chunk** | Stream never completes | Check backend streaming completion |
| **Early Termination** | Stream stops before END | Network issue - implement recovery |
| **Invalid JSON** | Parse error in chunks | Backend NDJSON formatting issue |

### Debug Logging
```typescript
// Enable detailed logging for stream debugging
const enableStreamLogging = () => {
  const originalMethod = validator.validateChunkOrder;
  validator.validateChunkOrder = function(chunk: StreamChunk) {
    console.log(`[Stream] Processing chunk:`, {
      type: chunk.type,
      traceId: chunk.trace_id,
      timestamp: chunk.timestamp,
      payloadKeys: Object.keys(chunk.payload)
    });
    
    const result = originalMethod.call(this, chunk);
    
    if (!result.valid) {
      console.error(`[Stream] Validation failed:`, result.error);
    }
    
    return result;
  };
};
```

## 🔗 Related Documentation

- **[`../frontend/src/types/streaming.ts`](../frontend/src/types/streaming.ts)** - TypeScript interfaces
- **[`../frontend/src/utils/streamingValidator.ts`](../frontend/src/utils/streamingValidator.ts)** - Validation implementation
- **[`endpoints.md`](endpoints.md)** - `/chat/ask` endpoint details
- **[`errors.md`](errors.md)** - Stream error handling
- **[`../governance/frontend-rules.md`](../governance/frontend-rules.md)** - Rule #7 (no reordering)

## 📝 Contract Testing

### Validation Test Cases
```typescript
describe('Streaming Contract', () => {
  let validator: StreamValidator;
  
  beforeEach(() => {
    validator = new StreamValidator();
  });
  
  test('first chunk must be THINKING', () => {
    const invalidChunk = createChunk(ChunkType.DATA);
    const result = validator.validateChunkOrder(invalidChunk);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('First chunk must be THINKING');
  });
  
  test('END chunk must be final', () => {
    validator.validateChunkOrder(createChunk(ChunkType.THINKING));
    validator.validateChunkOrder(createChunk(ChunkType.END));
    
    const invalidChunk = createChunk(ChunkType.DATA);
    const result = validator.validateChunkOrder(invalidChunk);
    expect(result.valid).toBe(false);
  });
  
  test('trace_id must be consistent', () => {
    const chunk1 = createChunk(ChunkType.THINKING, 'trace_123');
    const chunk2 = createChunk(ChunkType.DATA, 'trace_456'); // Different trace_id
    
    validator.validateChunkOrder(chunk1);
    const result = validator.validateChunkOrder(chunk2);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Trace ID mismatch');
  });
});
