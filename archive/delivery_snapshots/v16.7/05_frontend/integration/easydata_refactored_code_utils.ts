/**
 * EasyData Frontend: Streaming Utilities
 * Files:
 *   - src/utils/ndjsonParser.ts
 *   - src/utils/streamingFetch.ts
 */

// ============================================================================
// FILE 1: src/utils/ndjsonParser.ts
// ============================================================================

import type { StreamChunk, ChunkType, ChunkPayload } from '@/types/streaming'

/**
 * Parses a single NDJSON line into a typed StreamChunk
 * Throws on invalid JSON or unknown chunk type
 */
export function parseChunk(line: string): StreamChunk {
  if (!line.trim()) {
    throw new Error('Empty line in stream')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch (e) {
    throw new Error(`Invalid JSON in stream: ${line}`)
  }

  const chunk = parsed as Record<string, unknown>
  const type = chunk.type as ChunkType | undefined

  // Validate chunk type
  const validTypes: ChunkType[] = [
    'technical_view',
    'data',
    'chart',
    'summary',
    'error',
  ]

  if (!type || !validTypes.includes(type)) {
    throw new Error(`Unknown chunk type: ${type}`)
  }

  // Validate payload exists
  if (!chunk.payload || typeof chunk.payload !== 'object') {
    throw new Error(`Missing or invalid payload for type: ${type}`)
  }

  return {
    type,
    payload: chunk.payload as ChunkPayload,
    timestamp: chunk.timestamp as number | undefined,
    sequenceId: chunk.sequenceId as number | undefined,
  }
}

/**
 * Transforms raw response text into an async iterable of StreamChunks
 * Handles line buffering and incomplete final chunks
 */
export async function* ndjsonStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<StreamChunk> {
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        buffer += decoder.decode(value, { stream: true })
      }

      // Process complete lines (ending with \n)
      const lines = buffer.split('\n')

      // Last element might be incomplete, keep it in buffer
      buffer = lines.pop() || ''

      // Yield all complete chunks
      for (const line of lines) {
        if (line.trim()) {
          yield parseChunk(line)
        }
      }

      if (done) {
        // Process any remaining buffer content
        if (buffer.trim()) {
          yield parseChunk(buffer)
        }
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Type guard for technical_view chunk
 */
export function isTechnicalViewChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'technical_view' } {
  return chunk.type === 'technical_view'
}

/**
 * Type guard for data chunk
 */
export function isDataChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'data' } {
  return chunk.type === 'data'
}

/**
 * Type guard for chart chunk
 */
export function isChartChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'chart' } {
  return chunk.type === 'chart'
}

/**
 * Type guard for summary chunk
 */
export function isSummaryChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'summary' } {
  return chunk.type === 'summary'
}

/**
 * Type guard for error chunk
 */
export function isErrorChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'error' } {
  return chunk.type === 'error'
}

// ============================================================================
// FILE 2: src/utils/streamingFetch.ts
// ============================================================================

interface StreamingFetchOptions extends RequestInit {
  signal?: AbortSignal
  retryAttempts?: number
  retryDelayMs?: number
}

export class StreamingFetchError extends Error {
  constructor(
    message: string,
    public status?: number,
    public correlationId?: string,
  ) {
    super(message)
    this.name = 'StreamingFetchError'
  }
}

/**
 * Generate correlation ID for request tracing
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get access token from AuthContext (null if auth disabled)
 * TODO: Import from @/context/AuthContext when available
 */
function getAccessToken(): string | null {
  // Auth disabled in current spec
  return null
}

/**
 * Fetch a streaming endpoint and return the response reader
 * Respects VITE_API_BASE_URL and adds auth headers
 */
export async function streamingFetch(
  endpoint: string,
  options: StreamingFetchOptions = {},
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
  const url = new URL(endpoint, baseUrl).href

  const headers: HeadersInit = {
    'Accept': 'application/x-ndjson',
    'Accept-Language': document.documentElement.lang || 'en',
    'X-Correlation-ID': generateCorrelationId(),
    ...(options.headers || {}),
  }

  // Add auth token if available
  const token = getAccessToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    method: options.method ?? 'POST',
  }

  let lastError: Error | null = null
  const retryAttempts = options.retryAttempts ?? 3
  const retryDelayMs = options.retryDelayMs ?? 1000

  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      const response = await fetch(url, fetchOptions)

      if (!response.ok) {
        const body = await response.text()
        const correlationId = response.headers.get('X-Correlation-ID') ?? undefined
        throw new StreamingFetchError(
          `HTTP ${response.status}: ${body}`,
          response.status,
          correlationId,
        )
      }

      if (!response.body) {
        throw new StreamingFetchError('Response body is null')
      }

      // Return the reader - caller manages the streaming loop
      return response.body.getReader()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on 4xx errors (auth, validation, etc.)
      if (error instanceof StreamingFetchError && error.status && error.status < 500) {
        throw error
      }

      // Wait before retry (exponential backoff)
      if (attempt < retryAttempts - 1) {
        const delayMs = retryDelayMs * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError ?? new StreamingFetchError('Fetch failed after retries')
}
