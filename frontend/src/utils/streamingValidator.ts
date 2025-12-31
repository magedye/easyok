import { 
  ChunkType, 
  VALID_NEXT_CHUNKS, 
  BaseChunk, 
  StreamChunk, 
  ValidationResult,
  StreamState 
} from '../types/streaming';

/**
 * StreamValidator - Enforces backend streaming contract
 * 
 * Key responsibilities:
 * 1. Validate chunk order (thinking → technical_view → data → business_view → end)
 * 2. Ensure trace_id consistency across all chunks
 * 3. Detect missing or unexpected chunks
 * 4. Handle error chunks gracefully
 * 5. Track stream completion state
 * 
 * Governance compliance:
 * - No response reordering (Rule #7)
 * - Strict contract enforcement
 * - No assumptions about backend behavior
 */
export class StreamValidator {
  private state: StreamState;

  constructor() {
    this.state = {
      chunks: [],
      currentPhase: null,
      isComplete: false,
      hasError: false,
      traceId: null
    };
  }

  /**
   * Validates chunk order using ChunkType enum
   * Returns validation result with details for debugging
   */
  validateChunkOrder(chunk: StreamChunk): ValidationResult {
    // First chunk MUST be THINKING
    if (this.state.chunks.length === 0) {
      if (chunk.type !== ChunkType.THINKING) {
        return {
          valid: false,
          error: `First chunk must be ${ChunkType.THINKING}, got ${chunk.type}`,
          expectedNext: [ChunkType.THINKING]
        };
      }
      
      // Initialize trace_id from first chunk
      this.state.traceId = chunk.trace_id;
    }

    // Validate trace_id consistency (critical for correlation)
    if (chunk.trace_id !== this.state.traceId) {
      return {
        valid: false,
        error: `Trace ID mismatch. Expected: ${this.state.traceId}, got: ${chunk.trace_id}`
      };
    }

    // Check if we can accept this chunk type after current phase
    if (this.state.currentPhase) {
      const allowedNext = VALID_NEXT_CHUNKS[this.state.currentPhase];
      if (!allowedNext.includes(chunk.type)) {
        return {
          valid: false,
          error: `Invalid transition: ${this.state.currentPhase} → ${chunk.type}`,
          expectedNext: allowedNext
        };
      }
    }

    // Special validation for END chunk
    if (chunk.type === ChunkType.END) {
      this.state.isComplete = true;
    }

    // Special handling for ERROR chunk
    if (chunk.type === ChunkType.ERROR) {
      this.state.hasError = true;
    }

    // Update state
    this.state.chunks.push(chunk);
    this.state.currentPhase = chunk.type;

    return { valid: true };
  }

  /**
   * Validates trace_id consistency across all chunks
   * Returns false if any chunk has different trace_id
   */
  validateTraceIdConsistency(): boolean {
    if (this.state.chunks.length === 0) return true;
    
    const firstTraceId = this.state.chunks[0].trace_id;
    return this.state.chunks.every(chunk => chunk.trace_id === firstTraceId);
  }

  /**
   * Gets expected next chunks for UI hints
   * Useful for showing "waiting for..." indicators
   */
  getExpectedNextChunks(): ChunkType[] {
    if (!this.state.currentPhase) {
      return [ChunkType.THINKING];
    }
    
    return VALID_NEXT_CHUNKS[this.state.currentPhase];
  }

  /**
   * Checks if stream is complete (received END chunk)
   */
  isComplete(): boolean {
    return this.state.isComplete;
  }

  /**
   * Checks if stream encountered an error
   */
  hasError(): boolean {
    return this.state.hasError;
  }

  /**
   * Gets current trace_id for correlation
   */
  getTraceId(): string | null {
    return this.state.traceId;
  }

  /**
   * Gets all received chunks (for debugging/replay)
   */
  getChunks(): StreamChunk[] {
    return [...this.state.chunks];
  }

  /**
   * Gets current stream phase
   */
  getCurrentPhase(): ChunkType | null {
    return this.state.currentPhase;
  }

  /**
   * Gets summary of missing expected chunks
   * Useful for detecting incomplete streams
   */
  getMissingChunks(): ChunkType[] {
    const received = new Set(this.state.chunks.map(chunk => chunk.type));
    const expected = [
      ChunkType.THINKING,
      ChunkType.TECHNICAL_VIEW, 
      ChunkType.DATA,
      ChunkType.BUSINESS_VIEW,
      ChunkType.END
    ];
    
    return expected.filter(type => !received.has(type));
  }

  /**
   * Validates that stream ended properly
   * Returns true if END chunk was received, false otherwise
   */
  validateStreamCompletion(): ValidationResult {
    if (!this.state.isComplete) {
      return {
        valid: false,
        error: 'Stream ended without receiving END chunk',
        expectedNext: [ChunkType.END]
      };
    }

    // Check if we received minimum required chunks
    const hasThinking = this.state.chunks.some(c => c.type === ChunkType.THINKING);
    const hasEnd = this.state.chunks.some(c => c.type === ChunkType.END);
    
    if (!hasThinking || !hasEnd) {
      return {
        valid: false,
        error: 'Stream missing required chunks (THINKING and/or END)'
      };
    }

    return { valid: true };
  }

  /**
   * Reset validator for new stream
   * Call this before starting a new question
   */
  reset(): void {
    this.state = {
      chunks: [],
      currentPhase: null,
      isComplete: false,
      hasError: false,
      traceId: null
    };
  }

  /**
   * Get stream statistics for debugging
   */
  getStreamStats() {
    const chunkCounts: Record<string, number> = {};
    this.state.chunks.forEach(chunk => {
      chunkCounts[chunk.type] = (chunkCounts[chunk.type] || 0) + 1;
    });

    return {
      totalChunks: this.state.chunks.length,
      chunkCounts,
      traceId: this.state.traceId,
      currentPhase: this.state.currentPhase,
      isComplete: this.state.isComplete,
      hasError: this.state.hasError,
      duration: this.calculateDuration()
    };
  }

  /**
   * Calculate stream duration from first to last chunk
   */
  private calculateDuration(): number | null {
    if (this.state.chunks.length < 2) return null;
    
    const first = new Date(this.state.chunks[0].timestamp);
    const last = new Date(this.state.chunks[this.state.chunks.length - 1].timestamp);
    
    return last.getTime() - first.getTime();
  }

  /**
   * Export state for persistence/debugging
   */
  exportState(): StreamState {
    return { ...this.state };
  }

  /**
   * Import state for recovery/testing
   */
  importState(state: StreamState): void {
    this.state = { ...state };
  }
}