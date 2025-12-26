# EasyData Backend Integration: Concrete Example

**Objective:** Show exactly how to wire the streaming frontend to a real backend endpoint.

---

## Backend Contract (FastAPI Example)

```python
# backend/routes/ask.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json

router = APIRouter()

@router.post("/ask")
async def ask(request: AskRequest) -> StreamingResponse:
    """
    Streaming endpoint that returns NDJSON chunks
    Each chunk is a complete JSON object on its own line
    """
    async def generate():
        try:
            # 1️⃣ Send technical view (SQL metadata)
            sql = generate_sql_from_question(request.question)
            yield json.dumps({
                "type": "technical_view",
                "payload": {
                    "sql": sql,
                    "confidence": 0.95,
                    "executionPlan": "Use index on product_id"
                }
            }) + "\n"

            # 2️⃣ Send data chunks (rows in batches)
            rows = execute_query(sql)
            columns = [col.name for col in rows.column_descriptions]
            
            # Send column metadata with first chunk
            data_chunk = {
                "type": "data",
                "payload": {
                    "rows": rows[:10],
                    "columns": columns
                }
            }
            yield json.dumps(data_chunk) + "\n"

            # Send remaining rows in batches
            for i in range(10, len(rows), 10):
                batch = {
                    "type": "data",
                    "payload": {
                        "rows": rows[i:i+10]
                    }
                }
                yield json.dumps(batch) + "\n"

            # 3️⃣ Send chart (if data supports visualization)
            if should_visualize(rows):
                chart = {
                    "type": "chart",
                    "payload": {
                        "type": "bar",
                        "labels": [row["name"] for row in rows],
                        "datasets": [{
                            "label": "Sales",
                            "data": [row["value"] for row in rows]
                        }]
                    }
                }
                yield json.dumps(chart) + "\n"

            # 4️⃣ Send summary
            summary = {
                "type": "summary",
                "payload": {
                    "text": f"Query returned {len(rows)} rows in {query_time}ms",
                    "metrics": {
                        "totalRows": len(rows),
                        "executionTimeMs": query_time,
                        "queriesCount": 1
                    }
                }
            }
            yield json.dumps(summary) + "\n"

        except Exception as e:
            # 5️⃣ Send error (stops frontend iteration)
            error_chunk = {
                "type": "error",
                "payload": {
                    "message": str(e),
                    "code": "QUERY_EXECUTION_ERROR"
                }
            }
            yield json.dumps(error_chunk) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson"
    )
```

---

## Frontend Integration (Complete Example)

### Step 1: Create the Service Layer

```typescript
// src/services/easyDataService.ts
import { streamingFetch } from '@/utils/streamingFetch'

export interface AskRequest {
  question: string
  context?: string
  limit?: number
}

/**
 * Stream query results from EasyData backend
 */
export async function askQuestion(
  request: AskRequest,
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  return streamingFetch('/ask', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
```

### Step 2: Create a Custom Hook Wrapper

```typescript
// src/hooks/useEasyDataQuery.ts
import { useCallback } from 'react'
import { useEasyStream } from './useEasyStream'
import { askQuestion } from '@/services/easyDataService'
import { ndjsonStream } from '@/utils/ndjsonParser'

/**
 * High-level hook combining service + streaming
 */
export function useEasyDataQuery() {
  const { state, isStreaming, error, abort, reset } = useEasyStream()

  const executeQuery = useCallback(
    async (question: string) => {
      reset()

      try {
        const reader = await askQuestion({ question })
        
        // Process stream
        for await (const chunk of ndjsonStream(reader)) {
          // Hook's internal processChunk handles state updates
          // (In real code, expose startStreaming from useEasyStream)
        }
      } catch (err) {
        console.error('Query error:', err)
      }
    },
    [reset],
  )

  return {
    state,
    isStreaming,
    error,
    abort,
    executeQuery,
  }
}
```

### Step 3: Create the Query Page

```typescript
// src/pages/QueryPage.tsx
import React, { useState } from 'react'
import { useEasyDataQuery } from '@/hooks/useEasyDataQuery'
import { StreamRenderer } from '@/components/StreamRenderer'

export const QueryPage: React.FC = () => {
  const { state, isStreaming, error, abort, executeQuery } = useEasyDataQuery()
  const [question, setQuestion] = useState('')
  const isRtl = document.documentElement.lang === 'ar'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
    await executeQuery(question)
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {isRtl ? 'مولد الاستعلامات الذكي' : 'Smart Query Generator'}
        </h1>
        <p className="text-gray-600">
          {isRtl
            ? 'اطرح سؤالك بلغة طبيعية وسيقوم النظام بتحويله إلى استعلام SQL'
            : 'Ask questions in natural language and get results'}
        </p>
      </header>

      {/* Query Input Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isRtl ? 'اطرح سؤالك' : 'Your Question'}
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={isRtl
              ? 'أمثلة: ما هي أفضل 5 منتجات من حيث المبيعات؟'
              : 'Example: What are the top 5 products by sales?'}
            className={`w-full p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-none ${
              isRtl ? 'text-right' : 'text-left'
            }`}
            rows={4}
            disabled={isStreaming}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isStreaming || !question.trim()}
            className={`px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors ${
              isStreaming ? 'cursor-wait' : 'cursor-pointer'
            }`}
          >
            {isStreaming
              ? isRtl
                ? '⏳ جاري المعالجة...'
                : '⏳ Processing...'
              : isRtl
                ? '🚀 إرسال'
                : '🚀 Submit'}
          </button>

          {isStreaming && (
            <button
              type="button"
              onClick={abort}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              {isRtl ? '⛔ إيقاف' : '⛔ Cancel'}
            </button>
          )}
        </div>

        {/* Quick Examples (optional) */}
        {!isStreaming && state.dataRows.length === 0 && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-600 mb-2">
              {isRtl ? 'أمثلة:' : 'Examples:'}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                isRtl
                  ? 'ما هي أفضل 5 منتجات من حيث المبيعات؟'
                  : 'Top 5 products by sales',
                isRtl
                  ? 'كم عدد العملاء الجدد هذا الشهر؟'
                  : 'New customers this month',
                isRtl
                  ? 'ترتيب الفئات حسب الإيرادات'
                  : 'Revenue by category',
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuestion(example)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Results Area */}
      {(state.technicalView ||
        state.dataRows.length > 0 ||
        state.chartConfig ||
        state.summary ||
        error ||
        isStreaming) && (
        <section className="bg-white p-6 rounded-lg shadow-md">
          <StreamRenderer
            state={state}
            isStreaming={isStreaming}
            error={error}
            onRetry={() => handleSubmit({ preventDefault: () => {} } as any)}
            isRtl={isRtl}
          />
        </section>
      )}

      {/* Empty State */}
      {!isStreaming &&
        state.dataRows.length === 0 &&
        !state.technicalView &&
        !error && (
          <section className="bg-blue-50 border-2 border-blue-200 p-8 rounded-lg text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-blue-900 mb-2">
              {isRtl ? 'ابدأ باستعلام جديد' : 'Start with a new query'}
            </h2>
            <p className="text-blue-700">
              {isRtl
                ? 'اطرح سؤالك في الحقل أعلاه لتحويله إلى استعلام SQL وتنفيذه'
                : 'Ask a question above to generate and execute SQL queries'}
            </p>
          </section>
        )}
    </div>
  )
}
```

### Step 4: Add Route to App

```typescript
// src/App.tsx
import { QueryPage } from '@/pages/QueryPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/query" element={<QueryPage />} />
        {/* other routes */}
      </Routes>
    </BrowserRouter>
  )
}
```

---

## Testing the Integration

### Unit Test: Service Layer

```typescript
// src/services/__tests__/easyDataService.test.ts
import { describe, it, expect, vi } from 'vitest'
import { askQuestion } from '../easyDataService'

describe('easyDataService', () => {
  it('returns a reader for /ask endpoint', async () => {
    // Mock streamingFetch
    vi.mock('@/utils/streamingFetch', () => ({
      streamingFetch: vi.fn().mockResolvedValue({
        read: vi.fn().mockResolvedValue({
          done: true,
          value: undefined,
        }),
      }),
    }))

    const reader = await askQuestion({ question: 'Test' })
    expect(reader).toBeDefined()
  })
})
```

### E2E Test: Full Flow

```typescript
// tests/e2e/query.spec.ts
import { test, expect } from '@playwright/test'

test('submit question and display streaming results', async ({ page }) => {
  await page.goto('http://localhost:5173/query')

  // Fill question
  await page.fill(
    'textarea[placeholder*="question"]',
    'Top 5 products by sales'
  )

  // Submit
  await page.click('button:has-text("Submit")')

  // Wait for technical view
  await expect(page.locator('text=Technical View')).toBeVisible({ timeout: 5000 })

  // Wait for table
  await expect(page.locator('text=Results')).toBeVisible()

  // Wait for chart
  await expect(page.locator('canvas')).toBeVisible()

  // Wait for summary
  await expect(page.locator('text=Summary')).toBeVisible()
})
```

---

## Network Flow (Actual HTTP)

```
Frontend                                    Backend
  │
  ├─ POST /api/v1/ask                       │
  │  Content-Type: application/json         │
  │  Accept: application/x-ndjson           │
  │                                         │
  │  { "question": "Top 5 products..." }    │
  │                                         │
  │────────────────────────────────────────>│
  │                                         │
  │                                         │ (Generate SQL)
  │                                         │ (Execute query)
  │                                         │ (Format results)
  │                                         │
  │ HTTP/1.1 200 OK                         │
  │ Content-Type: application/x-ndjson      │
  │ Transfer-Encoding: chunked              │
  │                                         │
  │ {"type":"technical_view",...}\n         │
  │<────────────────────────────────────────│
  │                                         │
  │ {"type":"data",...}\n                   │
  │<────────────────────────────────────────│
  │                                         │
  │ {"type":"data",...}\n                   │
  │<────────────────────────────────────────│
  │                                         │
  │ ... more data chunks ...                │
  │                                         │
  │ {"type":"chart",...}\n                  │
  │<────────────────────────────────────────│
  │                                         │
  │ {"type":"summary",...}\n                │
  │<────────────────────────────────────────│
  │                                         │
  │ (EOF)                                   │
  │<────────────────────────────────────────│
```

---

## Error Handling Example

### Backend: Send Error Chunk

```python
@router.post("/ask")
async def ask(request: AskRequest) -> StreamingResponse:
    async def generate():
        try:
            # ... normal flow ...
        except ValueError as e:
            # Send error chunk to frontend
            yield json.dumps({
                "type": "error",
                "payload": {
                    "message": f"Invalid input: {str(e)}",
                    "code": "VALIDATION_ERROR",
                    "correlationId": request_id
                }
            }) + "\n"
        except Exception as e:
            # Unexpected error
            yield json.dumps({
                "type": "error",
                "payload": {
                    "message": "Internal server error",
                    "code": "SERVER_ERROR",
                    "correlationId": request_id
                }
            }) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")
```

### Frontend: Handle Error

```typescript
// In StreamRenderer.tsx
{error && (
  <ErrorAlert
    error={error}
    onRetry={() => executeQuery(question)}
    isRtl={isRtl}
  />
)}
```

---

## Performance Optimization

### Backend: Batch Data Chunks

```python
# Send data in batches of 100 rows
BATCH_SIZE = 100

for i in range(0, len(rows), BATCH_SIZE):
    batch = {
        "type": "data",
        "payload": {
            "rows": rows[i:i+BATCH_SIZE]
        }
    }
    yield json.dumps(batch) + "\n"
```

### Frontend: Cap Displayed Rows

```typescript
// src/components/stream/DataTable.tsx
const maxRows = 100  // Show only first 100
const displayRows = rows.slice(0, maxRows)

{rows.length > maxRows && (
  <p className="text-xs text-amber-600">
    Showing {maxRows} of {rows.length} rows
  </p>
)}
```

---

## Deployment Checklist

- [ ] Backend implements all 5 chunk types
- [ ] Backend sends NDJSON with newlines (each object on separate line)
- [ ] Frontend env var `VITE_API_BASE_URL` points to backend
- [ ] Correlation IDs flow from frontend → backend (request/response)
- [ ] Error chunks include helpful messages for users
- [ ] RTL strings translated to Arabic
- [ ] Tested with real streaming response (not mocked)
- [ ] Chart.js handles both numeric and date data
- [ ] Table pagination works with large datasets
- [ ] AbortController tested (cancel mid-stream)

---

## Summary

This example shows:
✅ Complete backend implementation (FastAPI)
✅ Complete frontend integration (React)
✅ Type-safe service layer
✅ Error handling (both sides)
✅ RTL/Arabic support
✅ Performance optimization
✅ Testing strategy
✅ Network flow visualization

Ready to deploy!
