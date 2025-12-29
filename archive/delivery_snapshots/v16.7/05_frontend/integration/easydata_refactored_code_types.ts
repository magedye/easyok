/**
 * EasyData Frontend: Type Definitions for NDJSON Streaming
 * File: src/types/streaming.ts
 * 
 * Core type definitions for the streaming contract.
 * These are the source of truth for all streaming operations.
 */

// ============================================================================
// CHUNK TYPE UNION (Source of Truth)
// ============================================================================

export type ChunkType = 'technical_view' | 'data' | 'chart' | 'summary' | 'error'

// ============================================================================
// PAYLOAD INTERFACES (Discriminated by chunk.type)
// ============================================================================

/**
 * Technical metadata about query execution
 * Includes SQL, execution plan, confidence, warnings
 */
export interface TechnicalViewPayload {
  sql: string
  executionPlan?: string
  confidence?: number
  warnings?: string[]
  generatedAt?: string
}

/**
 * Query result rows (can arrive in multiple data chunks)
 * Rows accumulate as more data chunks arrive
 */
export interface DataPayload {
  rows: Record<string, unknown>[]
  columns?: string[]
  rowCount?: number
}

/**
 * Chart.js compatible configuration
 * Supports all Chart.js chart types
 */
export interface ChartPayload {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'bubble' | 'radar'
  labels?: string[]
  datasets: Array<{
    label: string
    data: unknown[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    [key: string]: unknown
  }>
  options?: Record<string, unknown>
}

/**
 * Text summary of query results
 * Optional metrics about execution
 */
export interface SummaryPayload {
  text: string
  metrics?: {
    totalRows?: number
    executionTimeMs?: number
    queriesCount?: number
  }
}

/**
 * Error chunk - stops processing immediately
 */
export interface ErrorPayload {
  message: string
  code?: string
  correlationId?: string
}

// ============================================================================
// DISCRIMINATED UNION (Main StreamChunk type)
// ============================================================================

export type ChunkPayload =
  | TechnicalViewPayload
  | DataPayload
  | ChartPayload
  | SummaryPayload
  | ErrorPayload

/**
 * Main streaming chunk format
 * Validated by parseChunk() before creating
 */
export interface StreamChunk {
  type: ChunkType
  payload: ChunkPayload
  timestamp?: number
  sequenceId?: number
}

// ============================================================================
// STREAM STATE (Accumulated Results)
// ============================================================================

/**
 * Complete state of a streaming operation
 * Accumulates all chunks until error or EOF
 */
export interface StreamState {
  technicalView?: TechnicalViewPayload
  dataRows: Record<string, unknown>[]
  columns: string[]
  chartConfig?: ChartPayload
  summary?: SummaryPayload
  error?: ErrorPayload
  isLoading: boolean
  totalChunksReceived: number
}

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

export interface UseEasyStreamResult {
  state: StreamState
  isStreaming: boolean
  error: Error | null
  abort: () => void
  reset: () => void
}

// ============================================================================
// TYPE GUARD SIGNATURES
// ============================================================================

export function isTechnicalViewChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'technical_view'; payload: TechnicalViewPayload }

export function isDataChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'data'; payload: DataPayload }

export function isChartChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'chart'; payload: ChartPayload }

export function isSummaryChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'summary'; payload: SummaryPayload }

export function isErrorChunk(
  chunk: StreamChunk,
): chunk is StreamChunk & { type: 'error'; payload: ErrorPayload }
