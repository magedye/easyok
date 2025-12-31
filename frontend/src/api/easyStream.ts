import { ChunkType, StreamChunk, ValidationResult } from '../types/streaming';
import { StreamValidator } from '../utils/streamingValidator';
import { getTokenManager } from './tokenManager';
import { getErrorHandler, ErrorHandler, ErrorCode } from './errorHandler';
import { getApiBaseUrl as getConfigApiBaseUrl } from '../utils/environmentDetection';
import type { AskChunk, AskQuestionPayload } from '../types/api';

/**
 * Enhanced Streaming Client with:
 * - ChunkType enum validation
 * - Stream recovery mechanism
 * - Race-safe token management
 * - Comprehensive error handling
 * - Governance compliance
 */

/**
 * Stream recovery UI interface
 */
interface StreamRecoveryUI {
  message: string;
  lastChunk: ChunkType | null;
  action: 'retry_from_start' | 'contact_support' | 'cancel';
  canRetry: boolean;
}

/**
 * Enhanced streaming options
 */
interface StreamingOptions {
  signal?: AbortSignal;
  enableRecovery?: boolean;
  maxRecoveryAttempts?: number;
  onRecoveryUI?: (ui: StreamRecoveryUI) => void;
  onProgress?: (phase: ChunkType, progress: number) => void;
  requestId?: string;
}

/**
 * Streaming result for tracking
 */
interface StreamingResult {
  completed: boolean;
  error: string | null;
  chunks: StreamChunk[];
  traceId: string | null;
  duration: number;
}

function getApiBaseUrl(): string {
  // Simplified approach - use build-time config directly
  // Environment detection will be handled by the environment detection utility
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('VITE_API_BASE_URL is not set');
  }
  return String(baseUrl).replace(/\/$/, '');
}

/**
 * Enhanced NDJSON envelope validation with ChunkType support
 */
function isValidChunkEnvelope(value: unknown): value is StreamChunk {
  if (typeof value !== 'object' || value === null) return false;
  
  const v = value as Record<string, unknown>;
  
  // Check required fields
  if (typeof v.type !== 'string' || !v.payload || typeof v.trace_id !== 'string') {
    return false;
  }
  
  // Validate chunk type using enum
  const validTypes = Object.values(ChunkType);
  return validTypes.includes(v.type as ChunkType);
}

/**
 * Enhanced streaming client class
 */
export class StreamingClient {
  private validator = new StreamValidator();
  private errorHandler = getErrorHandler();
  private tokenManager = getTokenManager();
  private recoveryAttempts = new Map<string, number>();
  
  constructor(private baseUrl: string = getApiBaseUrl()) {}

  /**
   * Execute streaming request with full error handling and recovery
   */
  async askQuestion(
    payload: AskQuestionPayload,
    onChunk: (chunk: AskChunk) => void,
    options: StreamingOptions = {}
  ): Promise<StreamingResult> {
    const startTime = Date.now();
    const requestId = options.requestId || `stream_${startTime}`;
    
    // Reset validator for new stream
    this.validator.reset();
    
    // Track recovery attempts
    const currentAttempts = this.recoveryAttempts.get(requestId) || 0;
    const maxAttempts = options.maxRecoveryAttempts || 3;
    
    try {
      return await this.executeStreamingRequest(payload, onChunk, options, requestId);
    } catch (error) {
      const shouldRecovery = options.enableRecovery && currentAttempts < maxAttempts;
      
      if (shouldRecovery && this.isRecoverableError(error)) {
        return await this.handleStreamRecovery(payload, onChunk, options, requestId, error);
      }
      
      // Not recoverable or max attempts reached
      const duration = Date.now() - startTime;
      return {
        completed: false,
        error: error instanceof Error ? error.message : String(error),
        chunks: this.validator.getChunks(),
        traceId: this.validator.getTraceId(),
        duration
      };
    }
  }

  /**
   * Execute the actual streaming request
   */
  private async executeStreamingRequest(
    payload: AskQuestionPayload,
    onChunk: (chunk: AskChunk) => void,
    options: StreamingOptions,
    requestId: string
  ): Promise<StreamingResult> {
    const startTime = Date.now();
    const url = `${this.baseUrl}/api/v1/ask`;
    
    // Get valid token
    const token = await this.tokenManager.ensureValidToken();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Request-ID': requestId
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });

    if (!response.ok) {
      const errorResult = await this.errorHandler.handleError(
        await ErrorHandler.parseErrorFromResponse(response),
        requestId
      );
      
      if (errorResult.shouldRetry && errorResult.retryAfterMs) {
        // Wait for retry delay
        await new Promise(resolve => setTimeout(resolve, errorResult.retryAfterMs));
        return await this.executeStreamingRequest(payload, onChunk, options, requestId);
      }
      
      throw new Error(errorResult.userMessage);
    }

    if (!response.body) {
      throw new Error('Response body is not a readable stream');
    }

    // Process streaming response
    const chunks: StreamChunk[] = [];
    let traceId: string | null = null;
    
    try {
      for await (const chunk of this.consumeNDJSONStream(response)) {
        // Validate chunk order
        const validation = this.validator.validateChunkOrder(chunk);
        if (!validation.valid) {
          throw new Error(`Stream validation failed: ${validation.error}`);
        }
        
        chunks.push(chunk);
        traceId = chunk.trace_id;
        
        // Report progress
        if (options.onProgress) {
          const progress = this.calculateProgress(chunk.type);
          options.onProgress(chunk.type, progress);
        }
        
        // Convert to legacy format for compatibility
        const legacyChunk = this.convertToLegacyChunk(chunk);
        onChunk(legacyChunk);
        
        // Stop on error chunk
        if (chunk.type === ChunkType.ERROR) {
          break;
        }
        
        // Stop on end chunk
        if (chunk.type === ChunkType.END) {
          break;
        }
      }
      
      // Validate stream completion
      const completionValidation = this.validator.validateStreamCompletion();
      if (!completionValidation.valid) {
        throw new Error(`Stream incomplete: ${completionValidation.error}`);
      }
      
      const duration = Date.now() - startTime;
      this.errorHandler.clearRetryAttempts(requestId);
      
      return {
        completed: true,
        error: null,
        chunks,
        traceId,
        duration
      };
      
    } catch (error) {
      // Check if this is an aborted request
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request was cancelled');
      }
      
      throw error;
    }
  }

  /**
   * Enhanced NDJSON stream consumption with validation
   */
  private async *consumeNDJSONStream(response: Response): AsyncGenerator<StreamChunk> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // Process any remaining content in buffer
          const tail = buffer.trim();
          if (tail) {
            const chunk = this.parseChunk(tail);
            if (chunk) {
              this.logNdjsonChunk(chunk);
              yield chunk;
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const rawLine = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          const line = rawLine.trim().replace(/\r$/, '');
          if (!line) continue;

          const chunk = this.parseChunk(line);
          if (chunk) {
            this.logNdjsonChunk(chunk);
            yield chunk;
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  /**
   * Parse and validate individual chunk
   */
  private parseChunk(line: string): StreamChunk | null {
    try {
      const parsed: unknown = JSON.parse(line);
      
      if (!isValidChunkEnvelope(parsed)) {
        throw new Error('Invalid chunk envelope format');
      }
      
      return parsed as StreamChunk;
    } catch (error) {
      console.warn('Failed to parse chunk:', error, 'Line:', line);
      return null;
    }
  }

  /**
   * Convert new StreamChunk format to legacy AskChunk for compatibility
   */
  private convertToLegacyChunk(chunk: StreamChunk): AskChunk {
    // Map ChunkType enum to legacy string format
    switch (chunk.type) {
      case ChunkType.THINKING:
        return { type: 'thinking', payload: chunk.payload, trace_id: chunk.trace_id };
      case ChunkType.TECHNICAL_VIEW:
        return { type: 'technical_view', payload: chunk.payload, trace_id: chunk.trace_id };
      case ChunkType.DATA:
        return { type: 'data', payload: chunk.payload, trace_id: chunk.trace_id };
      case ChunkType.BUSINESS_VIEW:
        return { type: 'summary', payload: chunk.payload, trace_id: chunk.trace_id }; // Map business_view to summary
      case ChunkType.ERROR:
        return { type: 'error', payload: chunk.payload, trace_id: chunk.trace_id };
      case ChunkType.END:
        return { type: 'end', payload: chunk.payload, trace_id: chunk.trace_id };
      default:
        // For thinking and end chunks, create appropriate legacy format
        return { type: 'summary', payload: { text: 'Processing...' }, trace_id: chunk.trace_id };
    }
  }

  /**
   * Calculate progress percentage based on current chunk type
   */
  private calculateProgress(chunkType: ChunkType): number {
    const progressMap = {
      [ChunkType.THINKING]: 20,
      [ChunkType.TECHNICAL_VIEW]: 40,
      [ChunkType.DATA]: 70,
      [ChunkType.BUSINESS_VIEW]: 90,
      [ChunkType.END]: 100,
      [ChunkType.ERROR]: 0
    };
    
    return progressMap[chunkType] || 0;
  }

  /**
   * Emit NDJSON chunks to console for observability/testing
   */
  private logNdjsonChunk(chunk: StreamChunk) {
    if (typeof console === 'undefined') return;
    // Avoid spamming production logs unless explicitly enabled
    const allowLogging = !import.meta.env.PROD || import.meta.env.VITE_LOG_STREAM === 'true';
    if (!allowLogging) return;
    try {
      console.log('NDJSON:', JSON.stringify(chunk));
    } catch {
      // Fallback to best-effort logging
      console.log('NDJSON:', chunk);
    }
  }

  /**
   * Check if error is recoverable through retry
   */
  private isRecoverableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    const recoverablePatterns = [
      /connection/i,
      /network/i,
      /timeout/i,
      /interrupted/i,
      /stream.*failed/i
    ];
    
    return recoverablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Handle stream recovery after interruption
   */
  private async handleStreamRecovery(
    payload: AskQuestionPayload,
    onChunk: (chunk: AskChunk) => void,
    options: StreamingOptions,
    requestId: string,
    error: unknown
  ): Promise<StreamingResult> {
    const currentAttempts = this.recoveryAttempts.get(requestId) || 0;
    this.recoveryAttempts.set(requestId, currentAttempts + 1);
    
    const lastChunk = this.validator.getCurrentPhase();
    
    // Show recovery UI if callback provided
    if (options.onRecoveryUI) {
      options.onRecoveryUI({
        message: 'Connection interrupted during streaming',
        lastChunk,
        action: 'retry_from_start', // NDJSON doesn't support resume
        canRetry: currentAttempts < (options.maxRecoveryAttempts || 3)
      });
    }
    
    // Wait a bit before retry
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start fresh stream (NDJSON doesn't support seeking/resuming)
    return await this.askQuestion(payload, onChunk, {
      ...options,
      requestId // Keep same request ID to track total attempts
    });
  }

  /**
   * Cancel ongoing stream
   */
  cancel(): void {
    this.validator.reset();
  }

  /**
   * Get stream statistics for debugging
   */
  getStreamStats() {
    return this.validator.getStreamStats();
  }
}

/**
 * Default streaming client instance
 */
let globalStreamingClient: StreamingClient | null = null;

/**
 * Get or create global streaming client
 */
export function getStreamingClient(): StreamingClient {
  if (!globalStreamingClient) {
    globalStreamingClient = new StreamingClient();
  }
  return globalStreamingClient;
}

/**
 * Legacy compatibility function - enhanced with new features
 */
export async function askQuestion(
  payload: AskQuestionPayload,
  onChunk: (chunk: AskChunk) => void,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const client = getStreamingClient();
  
  const result = await client.askQuestion(payload, onChunk, {
    signal: options?.signal,
    enableRecovery: true,
    maxRecoveryAttempts: 2
  });
  
  if (!result.completed && result.error) {
    throw new Error(result.error);
  }
}
