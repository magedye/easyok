/**
 * Strict NDJSON chunk types per backend contract
 * See: docs/api/streaming.md
 * 
 * This enum enforces type safety and prevents string literal errors
 * during chunk processing. Backend contract requires specific chunk order.
 */
export enum ChunkType {
  THINKING = 'thinking',
  TECHNICAL_VIEW = 'technical_view', 
  DATA = 'data',
  BUSINESS_VIEW = 'business_view',
  ERROR = 'error',
  END = 'end'
}

/**
 * Chunk order validation map
 * Key: current chunk type
 * Value: allowed next chunk types
 * 
 * Backend contract enforces this specific flow:
 * thinking → technical_view → data → business_view → end
 * (error can occur at any point, end must be final)
 */
export const VALID_NEXT_CHUNKS: Record<ChunkType, ChunkType[]> = {
  [ChunkType.THINKING]: [ChunkType.TECHNICAL_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.TECHNICAL_VIEW]: [ChunkType.DATA, ChunkType.BUSINESS_VIEW, ChunkType.ERROR, ChunkType.END], 
  [ChunkType.DATA]: [ChunkType.BUSINESS_VIEW, ChunkType.ERROR, ChunkType.END],
  [ChunkType.BUSINESS_VIEW]: [ChunkType.ERROR, ChunkType.END],
  [ChunkType.ERROR]: [ChunkType.END],
  [ChunkType.END]: [] // No chunks after end
};

/**
 * Base chunk interface with strict typing
 * All chunks must include trace_id for correlation and timestamp for ordering
 */
export interface BaseChunk {
  type: ChunkType;
  trace_id: string;
  timestamp: string;
}

/**
 * Thinking chunk - contains reasoning process
 */
export interface ThinkingChunk extends BaseChunk {
  type: ChunkType.THINKING;
  payload: {
    content: string;
    step?: string;
  };
}

/**
 * Technical view chunk - contains SQL and assumptions
 * Must be read-only display only (Governance Rule #1)
 */
export interface TechnicalViewChunk extends BaseChunk {
  type: ChunkType.TECHNICAL_VIEW;
  payload: {
    sql: string;
    assumptions: string[];
    is_safe: boolean;
    policy_hash?: string;
  };
}

/**
 * Data chunk - contains query results
 */
export interface DataChunk extends BaseChunk {
  type: ChunkType.DATA;
  payload: Array<Record<string, unknown>> | {
    rows: Array<Record<string, unknown>>;
    columns?: string[];
    row_count?: number;
  };
}

/**
 * Business view chunk - contains user-friendly summary
 */
export interface BusinessViewChunk extends BaseChunk {
  type: ChunkType.BUSINESS_VIEW;
  payload: {
    text: string;
    metrics?: Record<string, unknown>;
    chart?: {
      chart_type: 'bar' | 'line' | 'pie' | string;
      x?: string;
      y?: string;
      [key: string]: unknown;
    };
  };
}

/**
 * Error chunk - contains error information 
 */
export interface ErrorChunk extends BaseChunk {
  type: ChunkType.ERROR;
  payload: {
    message: string;
    error_code: string;
    details?: Record<string, unknown>;
  };
}

/**
 * End chunk - signals stream completion
 */
export interface EndChunk extends BaseChunk {
  type: ChunkType.END;
  payload: {
    message?: string;
    total_chunks?: number;
  };
}

/**
 * Union type for all possible chunks
 * Use this for type-safe chunk processing
 */
export type StreamChunk = 
  | ThinkingChunk
  | TechnicalViewChunk  
  | DataChunk
  | BusinessViewChunk
  | ErrorChunk
  | EndChunk;

/**
 * Validation result for chunk order checking
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  expectedNext?: ChunkType[];
}

/**
 * Stream state for tracking progress
 */
export interface StreamState {
  chunks: StreamChunk[];
  currentPhase: ChunkType | null;
  isComplete: boolean;
  hasError: boolean;
  traceId: string | null;
}