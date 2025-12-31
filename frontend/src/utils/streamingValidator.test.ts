import { describe, it, expect, beforeEach } from 'vitest';
import { StreamValidator } from './streamingValidator';
import {
  ChunkType,
  ThinkingChunk,
  TechnicalViewChunk,
  DataChunk,
  BusinessViewChunk,
  ErrorChunk,
  EndChunk,
  StreamState,
  VALID_NEXT_CHUNKS
} from '../types/streaming';

describe('StreamValidator', () => {
  let validator: StreamValidator;
  const TRACE_ID = 'test-trace-123';
  const TIMESTAMP = '2025-01-01T00:00:00.000Z';

  // Helper functions to create test chunks
  const createThinkingChunk = (traceId = TRACE_ID): ThinkingChunk => ({
    type: ChunkType.THINKING,
    trace_id: traceId,
    timestamp: TIMESTAMP,
    payload: { content: 'Thinking about the question...' }
  });

  const createTechnicalViewChunk = (traceId = TRACE_ID): TechnicalViewChunk => ({
    type: ChunkType.TECHNICAL_VIEW,
    trace_id: traceId,
    timestamp: TIMESTAMP,
    payload: {
      sql: 'SELECT * FROM test',
      assumptions: ['test assumption'],
      is_safe: true
    }
  });

  const createDataChunk = (traceId = TRACE_ID): DataChunk => ({
    type: ChunkType.DATA,
    trace_id: traceId,
    timestamp: TIMESTAMP,
    payload: [{ id: 1, name: 'test' }]
  });

  const createBusinessViewChunk = (traceId = TRACE_ID): BusinessViewChunk => ({
    type: ChunkType.BUSINESS_VIEW,
    trace_id: traceId,
    timestamp: TIMESTAMP,
    payload: { text: 'Business summary' }
  });

  const createErrorChunk = (traceId = TRACE_ID): ErrorChunk => ({
    type: ChunkType.ERROR,
    trace_id: traceId,
    timestamp: TIMESTAMP,
    payload: {
      message: 'Test error',
      error_code: 'TEST_ERROR'
    }
  });

  const createEndChunk = (traceId = TRACE_ID): EndChunk => ({
    type: ChunkType.END,
    trace_id: traceId,
    timestamp: TIMESTAMP,
    payload: { message: 'Stream complete' }
  });

  beforeEach(() => {
    validator = new StreamValidator();
  });

  describe('Constructor and Initial State', () => {
    it('should initialize with empty state', () => {
      expect(validator.isComplete()).toBe(false);
      expect(validator.hasError()).toBe(false);
      expect(validator.getTraceId()).toBeNull();
      expect(validator.getCurrentPhase()).toBeNull();
      expect(validator.getChunks()).toHaveLength(0);
    });

    it('should return THINKING as expected first chunk', () => {
      const expected = validator.getExpectedNextChunks();
      expect(expected).toEqual([ChunkType.THINKING]);
    });
  });

  describe('First Chunk Validation', () => {
    it('should accept THINKING as first chunk', () => {
      const chunk = createThinkingChunk();
      const result = validator.validateChunkOrder(chunk);
      
      expect(result.valid).toBe(true);
      expect(validator.getTraceId()).toBe(TRACE_ID);
      expect(validator.getCurrentPhase()).toBe(ChunkType.THINKING);
    });

    it('should reject non-THINKING first chunk', () => {
      const chunk = createTechnicalViewChunk();
      const result = validator.validateChunkOrder(chunk);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('First chunk must be thinking');
      expect(result.expectedNext).toEqual([ChunkType.THINKING]);
    });

    it('should set trace_id from first chunk', () => {
      const customTraceId = 'custom-trace-456';
      const chunk = createThinkingChunk(customTraceId);
      validator.validateChunkOrder(chunk);
      
      expect(validator.getTraceId()).toBe(customTraceId);
    });
  });

  describe('Trace ID Consistency', () => {
    it('should reject chunks with different trace_id', () => {
      const firstChunk = createThinkingChunk(TRACE_ID);
      const secondChunk = createTechnicalViewChunk('different-trace');
      
      validator.validateChunkOrder(firstChunk);
      const result = validator.validateChunkOrder(secondChunk);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Trace ID mismatch');
      expect(result.error).toContain(TRACE_ID);
      expect(result.error).toContain('different-trace');
    });

    it('should validate trace consistency across all chunks', () => {
      validator.validateChunkOrder(createThinkingChunk(TRACE_ID));
      validator.validateChunkOrder(createTechnicalViewChunk(TRACE_ID));
      
      expect(validator.validateTraceIdConsistency()).toBe(true);
      
      // Add chunk with different trace_id directly to chunks (simulating external corruption)
      const badChunk = createDataChunk('bad-trace');
      validator['state'].chunks.push(badChunk);
      
      expect(validator.validateTraceIdConsistency()).toBe(false);
    });

    it('should return true for empty chunks in trace consistency check', () => {
      expect(validator.validateTraceIdConsistency()).toBe(true);
    });
  });

  describe('Chunk Order Validation', () => {
    it('should validate correct sequence: thinking → technical_view → data → business_view → end', () => {
      const chunks = [
        createThinkingChunk(),
        createTechnicalViewChunk(),
        createDataChunk(),
        createBusinessViewChunk(),
        createEndChunk()
      ];

      chunks.forEach((chunk, index) => {
        const result = validator.validateChunkOrder(chunk);
        expect(result.valid).toBe(true);
        expect(validator.getCurrentPhase()).toBe(chunk.type);
      });

      expect(validator.isComplete()).toBe(true);
    });

    it('should allow thinking → end (minimal valid sequence)', () => {
      validator.validateChunkOrder(createThinkingChunk());
      const result = validator.validateChunkOrder(createEndChunk());
      
      expect(result.valid).toBe(true);
      expect(validator.isComplete()).toBe(true);
    });

    it('should reject invalid transitions', () => {
      validator.validateChunkOrder(createThinkingChunk());
      const result = validator.validateChunkOrder(createDataChunk());
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition: thinking → data');
      expect(result.expectedNext).toEqual([
        ChunkType.TECHNICAL_VIEW,
        ChunkType.ERROR,
        ChunkType.END
      ]);
    });

    it('should reject chunks after END', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createEndChunk());
      
      const result = validator.validateChunkOrder(createTechnicalViewChunk());
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition: end →');
    });

    it('should allow error at any point in sequence', () => {
      // Error after thinking
      validator.validateChunkOrder(createThinkingChunk());
      let result = validator.validateChunkOrder(createErrorChunk());
      expect(result.valid).toBe(true);
      
      // Reset and test error after technical_view
      validator.reset();
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createTechnicalViewChunk());
      result = validator.validateChunkOrder(createErrorChunk());
      expect(result.valid).toBe(true);
    });

    it('should only allow END after ERROR', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createErrorChunk());
      
      const result = validator.validateChunkOrder(createEndChunk());
      expect(result.valid).toBe(true);
      
      // Try invalid chunk after error
      validator.reset();
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createErrorChunk());
      
      const badResult = validator.validateChunkOrder(createTechnicalViewChunk());
      expect(badResult.valid).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should track error state', () => {
      validator.validateChunkOrder(createThinkingChunk());
      expect(validator.hasError()).toBe(false);
      
      validator.validateChunkOrder(createErrorChunk());
      expect(validator.hasError()).toBe(true);
    });

    it('should handle error → end sequence', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createErrorChunk());
      validator.validateChunkOrder(createEndChunk());
      
      expect(validator.hasError()).toBe(true);
      expect(validator.isComplete()).toBe(true);
    });
  });

  describe('Expected Next Chunks', () => {
    it('should return correct expected chunks for each phase', () => {
      // Initial state
      expect(validator.getExpectedNextChunks()).toEqual([ChunkType.THINKING]);
      
      // After thinking
      validator.validateChunkOrder(createThinkingChunk());
      expect(validator.getExpectedNextChunks()).toEqual([
        ChunkType.TECHNICAL_VIEW,
        ChunkType.ERROR,
        ChunkType.END
      ]);
      
      // After technical_view
      validator.validateChunkOrder(createTechnicalViewChunk());
      expect(validator.getExpectedNextChunks()).toEqual([
        ChunkType.DATA,
        ChunkType.BUSINESS_VIEW,
        ChunkType.ERROR,
        ChunkType.END
      ]);
      
      // After data
      validator.validateChunkOrder(createDataChunk());
      expect(validator.getExpectedNextChunks()).toEqual([
        ChunkType.BUSINESS_VIEW,
        ChunkType.ERROR,
        ChunkType.END
      ]);
      
      // After business_view
      validator.validateChunkOrder(createBusinessViewChunk());
      expect(validator.getExpectedNextChunks()).toEqual([
        ChunkType.ERROR,
        ChunkType.END
      ]);
      
      // After error
      validator.reset();
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createErrorChunk());
      expect(validator.getExpectedNextChunks()).toEqual([ChunkType.END]);
      
      // After end
      validator.validateChunkOrder(createEndChunk());
      expect(validator.getExpectedNextChunks()).toEqual([]);
    });
  });

  describe('Missing Chunks Detection', () => {
    it('should detect all missing chunks for incomplete stream', () => {
      validator.validateChunkOrder(createThinkingChunk());
      
      const missing = validator.getMissingChunks();
      expect(missing).toEqual([
        ChunkType.TECHNICAL_VIEW,
        ChunkType.DATA,
        ChunkType.BUSINESS_VIEW,
        ChunkType.END
      ]);
    });

    it('should detect no missing chunks for complete stream', () => {
      const chunks = [
        createThinkingChunk(),
        createTechnicalViewChunk(),
        createDataChunk(),
        createBusinessViewChunk(),
        createEndChunk()
      ];

      chunks.forEach(chunk => validator.validateChunkOrder(chunk));
      
      const missing = validator.getMissingChunks();
      expect(missing).toEqual([]);
    });

    it('should handle minimal valid stream (thinking → end)', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createEndChunk());
      
      const missing = validator.getMissingChunks();
      expect(missing).toEqual([
        ChunkType.TECHNICAL_VIEW,
        ChunkType.DATA,
        ChunkType.BUSINESS_VIEW
      ]);
    });
  });

  describe('Stream Completion Validation', () => {
    it('should validate successful completion', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createEndChunk());
      
      const result = validator.validateStreamCompletion();
      expect(result.valid).toBe(true);
    });

    it('should reject incomplete stream - no END chunk', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createTechnicalViewChunk());
      
      const result = validator.validateStreamCompletion();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Stream ended without receiving END chunk');
      expect(result.expectedNext).toEqual([ChunkType.END]);
    });

    it('should reject stream missing required chunks', () => {
      // Only END without THINKING
      const endChunk = createEndChunk();
      validator['state'].chunks = [endChunk];
      validator['state'].isComplete = true;
      
      const result = validator.validateStreamCompletion();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Stream missing required chunks');
    });
  });

  describe('Stream Statistics', () => {
    it('should calculate correct stream stats', () => {
      const chunks = [
        createThinkingChunk(),
        createTechnicalViewChunk(),
        createDataChunk(),
        createEndChunk()
      ];

      chunks.forEach(chunk => validator.validateChunkOrder(chunk));
      
      const stats = validator.getStreamStats();
      expect(stats.totalChunks).toBe(4);
      expect(stats.chunkCounts).toEqual({
        thinking: 1,
        technical_view: 1,
        data: 1,
        end: 1
      });
      expect(stats.traceId).toBe(TRACE_ID);
      expect(stats.currentPhase).toBe(ChunkType.END);
      expect(stats.isComplete).toBe(true);
      expect(stats.hasError).toBe(false);
    });

    it('should calculate duration between chunks', () => {
      const firstTime = '2025-01-01T00:00:00.000Z';
      const secondTime = '2025-01-01T00:00:01.000Z';
      
      const firstChunk = { ...createThinkingChunk(), timestamp: firstTime };
      const secondChunk = { ...createEndChunk(), timestamp: secondTime };
      
      validator.validateChunkOrder(firstChunk);
      validator.validateChunkOrder(secondChunk);
      
      const stats = validator.getStreamStats();
      expect(stats.duration).toBe(1000); // 1 second in milliseconds
    });

    it('should return null duration for insufficient chunks', () => {
      validator.validateChunkOrder(createThinkingChunk());
      
      const stats = validator.getStreamStats();
      expect(stats.duration).toBeNull();
    });
  });

  describe('State Management', () => {
    it('should reset state correctly', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createErrorChunk());
      
      expect(validator.hasError()).toBe(true);
      expect(validator.getChunks()).toHaveLength(2);
      
      validator.reset();
      
      expect(validator.hasError()).toBe(false);
      expect(validator.isComplete()).toBe(false);
      expect(validator.getTraceId()).toBeNull();
      expect(validator.getCurrentPhase()).toBeNull();
      expect(validator.getChunks()).toHaveLength(0);
    });

    it('should export and import state correctly', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createTechnicalViewChunk());
      
      const exportedState = validator.exportState();
      expect(exportedState.chunks).toHaveLength(2);
      expect(exportedState.currentPhase).toBe(ChunkType.TECHNICAL_VIEW);
      expect(exportedState.traceId).toBe(TRACE_ID);
      
      const newValidator = new StreamValidator();
      newValidator.importState(exportedState);
      
      expect(newValidator.getCurrentPhase()).toBe(ChunkType.TECHNICAL_VIEW);
      expect(newValidator.getTraceId()).toBe(TRACE_ID);
      expect(newValidator.getChunks()).toHaveLength(2);
    });

    it('should return defensive copy of chunks', () => {
      const chunk = createThinkingChunk();
      validator.validateChunkOrder(chunk);
      
      const chunks = validator.getChunks();
      chunks.push(createEndChunk()); // Attempt to modify returned array
      
      expect(validator.getChunks()).toHaveLength(1); // Should not be modified
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle chunks with missing optional fields', () => {
      const minimalThinking: ThinkingChunk = {
        type: ChunkType.THINKING,
        trace_id: TRACE_ID,
        timestamp: TIMESTAMP,
        payload: { content: 'test' }
      };
      
      const result = validator.validateChunkOrder(minimalThinking);
      expect(result.valid).toBe(true);
    });

    it('should handle multiple error chunks', () => {
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createErrorChunk());
      
      // Second error should be rejected (only END allowed after ERROR)
      const result = validator.validateChunkOrder(createErrorChunk());
      expect(result.valid).toBe(false);
    });

    it('should handle duplicate chunk types', () => {
      validator.validateChunkOrder(createThinkingChunk());
      
      // Multiple thinking chunks should be rejected
      const result = validator.validateChunkOrder(createThinkingChunk());
      expect(result.valid).toBe(false);
    });

    it('should maintain immutability of VALID_NEXT_CHUNKS through validator usage', () => {
      // Ensure the validator doesn't modify the global chunk transition rules
      const originalRules = JSON.parse(JSON.stringify(VALID_NEXT_CHUNKS));
      
      // Run through complete validation sequence
      validator.validateChunkOrder(createThinkingChunk());
      validator.validateChunkOrder(createTechnicalViewChunk());
      validator.validateChunkOrder(createDataChunk());
      validator.validateChunkOrder(createBusinessViewChunk());
      validator.validateChunkOrder(createEndChunk());
      
      expect(VALID_NEXT_CHUNKS).toEqual(originalRules);
    });

    it('should handle timestamp parsing for duration calculation', () => {
      const invalidTimestamp = 'invalid-date';
      const firstChunk = { ...createThinkingChunk(), timestamp: invalidTimestamp };
      const secondChunk = createEndChunk();
      
      validator.validateChunkOrder(firstChunk);
      validator.validateChunkOrder(secondChunk);
      
      const stats = validator.getStreamStats();
      // Should handle invalid date gracefully (NaN becomes a number)
      expect(typeof stats.duration).toBe('number');
    });
  });

  describe('Governance Compliance Validation', () => {
    it('should enforce Rule #7 - No response reordering', () => {
      // Attempt to process chunks out of order should be rejected
      validator.validateChunkOrder(createThinkingChunk());
      
      const outOfOrderResult = validator.validateChunkOrder(createBusinessViewChunk());
      expect(outOfOrderResult.valid).toBe(false);
      expect(outOfOrderResult.error).toContain('Invalid transition');
    });

    it('should enforce strict contract with no assumptions', () => {
      // Should not make assumptions about what comes next
      validator.validateChunkOrder(createThinkingChunk());
      
      const expectedNext = validator.getExpectedNextChunks();
      expect(expectedNext).toContain(ChunkType.TECHNICAL_VIEW);
      expect(expectedNext).toContain(ChunkType.ERROR);
      expect(expectedNext).toContain(ChunkType.END);
      // Should allow multiple valid transitions, not assume specific flow
    });
  });
});