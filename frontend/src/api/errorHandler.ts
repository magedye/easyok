/**
 * Error Handler - Comprehensive error handling for all documented backend error codes
 * 
 * This module implements standardized error handling with:
 * - Retry logic with exponential backoff
 * - Error code-specific handling strategies  
 * - User-friendly message translation
 * - Trace ID correlation for debugging
 * - Recovery mechanisms for recoverable errors
 * 
 * Based on docs/api/errors.md from the backend handoff specification
 */

import { getTokenManager } from './tokenManager';

/**
 * Standard error response from backend
 */
export interface ErrorResponse {
  message: string;
  error_code: string;
  trace_id?: string;
  details?: Record<string, unknown>;
  retry_after?: number; // Seconds to wait before retry (for rate limiting)
}

/**
 * Error handling strategy result
 */
export interface ErrorHandlingResult {
  shouldRetry: boolean;
  retryAfterMs?: number;
  userMessage: string;
  requiresAction?: 'login' | 'logout' | 'contact_support' | 'wait' | 'none';
  showDetails?: boolean;
}

/**
 * Retry configuration for different error types
 */
interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  exponential: boolean;
  jitterMs: number;
}

/**
 * All documented backend error codes with retry policies
 * Based on the complete error specification from handoff
 */
export enum ErrorCode {
  // Authentication & Authorization
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  UNAUTHORIZED = 'UNAUTHORIZED', 
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // Policy & Governance
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  SCHEMA_POLICY_VIOLATION = 'SCHEMA_POLICY_VIOLATION',
  TABLE_ACCESS_DENIED = 'TABLE_ACCESS_DENIED',
  COLUMN_ACCESS_DENIED = 'COLUMN_ACCESS_DENIED',

  // Rate Limiting & Quotas
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CONCURRENT_REQUEST_LIMIT = 'CONCURRENT_REQUEST_LIMIT',

  // Query Execution
  SQL_EXECUTION_FAILED = 'SQL_EXECUTION_FAILED',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',
  INVALID_QUERY = 'INVALID_QUERY',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',

  // LLM & AI Services
  LLM_SERVICE_UNAVAILABLE = 'LLM_SERVICE_UNAVAILABLE',
  LLM_QUOTA_EXCEEDED = 'LLM_QUOTA_EXCEEDED',
  LLM_GENERATION_FAILED = 'LLM_GENERATION_FAILED', 
  CONTEXT_TOO_LARGE = 'CONTEXT_TOO_LARGE',

  // Streaming
  STREAMING_INTERRUPTED = 'STREAMING_INTERRUPTED',
  STREAMING_TIMEOUT = 'STREAMING_TIMEOUT',
  CHUNK_ORDER_VIOLATION = 'CHUNK_ORDER_VIOLATION',

  // Infrastructure 
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  GATEWAY_TIMEOUT = 'GATEWAY_TIMEOUT',
  DEPENDENCY_FAILURE = 'DEPENDENCY_FAILURE',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST_FORMAT = 'INVALID_REQUEST_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Training & Admin
  TRAINING_ITEM_NOT_FOUND = 'TRAINING_ITEM_NOT_FOUND',
  TRAINING_VALIDATION_FAILED = 'TRAINING_VALIDATION_FAILED',
  FEATURE_TOGGLE_IMMUTABLE = 'FEATURE_TOGGLE_IMMUTABLE'
}

/**
 * Retry configurations for each error type
 */
const RETRY_CONFIGS: Record<ErrorCode, RetryConfig> = {
  // No retry for auth errors - require user action
  [ErrorCode.INVALID_CREDENTIALS]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.UNAUTHORIZED]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.FORBIDDEN]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.TOKEN_EXPIRED]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.TOKEN_INVALID]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },

  // No retry for policy violations - user needs to fix query
  [ErrorCode.POLICY_VIOLATION]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.SCHEMA_POLICY_VIOLATION]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.TABLE_ACCESS_DENIED]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.COLUMN_ACCESS_DENIED]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },

  // Retry with backoff for rate limits
  [ErrorCode.RATE_LIMIT_EXCEEDED]: { enabled: true, maxAttempts: 5, baseDelayMs: 2000, exponential: true, jitterMs: 1000 },
  [ErrorCode.QUOTA_EXCEEDED]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.CONCURRENT_REQUEST_LIMIT]: { enabled: true, maxAttempts: 3, baseDelayMs: 1000, exponential: false, jitterMs: 500 },

  // Retry transient execution errors
  [ErrorCode.SQL_EXECUTION_FAILED]: { enabled: true, maxAttempts: 3, baseDelayMs: 1500, exponential: true, jitterMs: 500 },
  [ErrorCode.QUERY_TIMEOUT]: { enabled: true, maxAttempts: 2, baseDelayMs: 2000, exponential: false, jitterMs: 1000 },
  [ErrorCode.INVALID_QUERY]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.DATABASE_CONNECTION_FAILED]: { enabled: true, maxAttempts: 4, baseDelayMs: 2000, exponential: true, jitterMs: 1000 },

  // Retry LLM service issues
  [ErrorCode.LLM_SERVICE_UNAVAILABLE]: { enabled: true, maxAttempts: 3, baseDelayMs: 3000, exponential: true, jitterMs: 1500 },
  [ErrorCode.LLM_QUOTA_EXCEEDED]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.LLM_GENERATION_FAILED]: { enabled: true, maxAttempts: 2, baseDelayMs: 2000, exponential: false, jitterMs: 1000 },
  [ErrorCode.CONTEXT_TOO_LARGE]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },

  // Retry streaming interruptions
  [ErrorCode.STREAMING_INTERRUPTED]: { enabled: true, maxAttempts: 3, baseDelayMs: 1000, exponential: false, jitterMs: 500 },
  [ErrorCode.STREAMING_TIMEOUT]: { enabled: true, maxAttempts: 2, baseDelayMs: 2000, exponential: false, jitterMs: 1000 },
  [ErrorCode.CHUNK_ORDER_VIOLATION]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },

  // Retry infrastructure issues
  [ErrorCode.SERVICE_UNAVAILABLE]: { enabled: true, maxAttempts: 4, baseDelayMs: 3000, exponential: true, jitterMs: 2000 },
  [ErrorCode.INTERNAL_SERVER_ERROR]: { enabled: true, maxAttempts: 2, baseDelayMs: 2000, exponential: false, jitterMs: 1000 },
  [ErrorCode.GATEWAY_TIMEOUT]: { enabled: true, maxAttempts: 3, baseDelayMs: 4000, exponential: true, jitterMs: 2000 },
  [ErrorCode.DEPENDENCY_FAILURE]: { enabled: true, maxAttempts: 3, baseDelayMs: 2500, exponential: true, jitterMs: 1500 },

  // No retry for validation errors
  [ErrorCode.VALIDATION_ERROR]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.INVALID_REQUEST_FORMAT]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.MISSING_REQUIRED_FIELD]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },

  // No retry for training/admin errors  
  [ErrorCode.TRAINING_ITEM_NOT_FOUND]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.TRAINING_VALIDATION_FAILED]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 },
  [ErrorCode.FEATURE_TOGGLE_IMMUTABLE]: { enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 }
};

/**
 * User-friendly error messages for each error code
 */
const USER_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid username or password. Please check your credentials and try again.',
  [ErrorCode.UNAUTHORIZED]: 'You are not authorized to access this resource. Please log in.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.TOKEN_INVALID]: 'Authentication error. Please log in again.',

  [ErrorCode.POLICY_VIOLATION]: 'Your query violates data access policies. Please review allowed tables and try again.',
  [ErrorCode.SCHEMA_POLICY_VIOLATION]: 'Access to this schema is restricted by policy.',
  [ErrorCode.TABLE_ACCESS_DENIED]: 'You do not have permission to access this table.',
  [ErrorCode.COLUMN_ACCESS_DENIED]: 'You do not have permission to access these columns.',

  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment before trying again.',
  [ErrorCode.QUOTA_EXCEEDED]: 'Your usage quota has been exceeded. Please contact your administrator.',
  [ErrorCode.CONCURRENT_REQUEST_LIMIT]: 'Too many concurrent requests. Please wait for previous requests to complete.',

  [ErrorCode.SQL_EXECUTION_FAILED]: 'Query execution failed. Please check your query and try again.',
  [ErrorCode.QUERY_TIMEOUT]: 'Query took too long to execute. Please try a simpler query.',
  [ErrorCode.INVALID_QUERY]: 'The generated query is invalid. Please rephrase your question.',
  [ErrorCode.DATABASE_CONNECTION_FAILED]: 'Database connection failed. Please try again in a moment.',

  [ErrorCode.LLM_SERVICE_UNAVAILABLE]: 'AI service is temporarily unavailable. Please try again later.',
  [ErrorCode.LLM_QUOTA_EXCEEDED]: 'AI service quota exceeded. Please try again later or contact your administrator.',
  [ErrorCode.LLM_GENERATION_FAILED]: 'AI response generation failed. Please try rephrasing your question.',
  [ErrorCode.CONTEXT_TOO_LARGE]: 'Your question is too complex. Please try breaking it into smaller parts.',

  [ErrorCode.STREAMING_INTERRUPTED]: 'Connection interrupted. Retrying your request...',
  [ErrorCode.STREAMING_TIMEOUT]: 'Response timed out. Please try again.',
  [ErrorCode.CHUNK_ORDER_VIOLATION]: 'Response format error. Please refresh and try again.',

  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'An internal error occurred. Please try again.',
  [ErrorCode.GATEWAY_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.DEPENDENCY_FAILURE]: 'A required service is unavailable. Please try again later.',

  [ErrorCode.VALIDATION_ERROR]: 'Invalid request. Please check your input and try again.',
  [ErrorCode.INVALID_REQUEST_FORMAT]: 'Request format is invalid. Please refresh and try again.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: 'Required information is missing. Please complete all fields.',

  [ErrorCode.TRAINING_ITEM_NOT_FOUND]: 'Training item not found.',
  [ErrorCode.TRAINING_VALIDATION_FAILED]: 'Training data validation failed. Please check the format.',
  [ErrorCode.FEATURE_TOGGLE_IMMUTABLE]: 'This feature setting cannot be changed.'
};

/**
 * Main error handler class
 */
export class ErrorHandler {
  private retryAttempts = new Map<string, number>();
  private readonly tokenManager = getTokenManager();

  /**
   * Handle error response and determine appropriate action
   */
  async handleError(
    error: ErrorResponse, 
    requestId: string = `req_${Date.now()}`
  ): Promise<ErrorHandlingResult> {
    
    // Log error with trace ID for correlation
    console.error(`Error [${error.trace_id || 'no-trace'}]:`, {
      code: error.error_code,
      message: error.message,
      details: error.details,
      requestId
    });

    const errorCode = error.error_code as ErrorCode;
    const retryConfig = RETRY_CONFIGS[errorCode];
    const currentAttempts = this.retryAttempts.get(requestId) || 0;

    // Handle authentication errors specially
    if (this.isAuthError(errorCode)) {
      return await this.handleAuthError(errorCode);
    }

    // Check if we should retry
    const shouldRetry = retryConfig.enabled && currentAttempts < retryConfig.maxAttempts;
    
    if (shouldRetry) {
      this.retryAttempts.set(requestId, currentAttempts + 1);
    }

    // Calculate retry delay
    let retryAfterMs: number | undefined;
    if (shouldRetry) {
      if (error.retry_after) {
        // Use server-specified delay (for rate limiting)
        retryAfterMs = error.retry_after * 1000;
      } else {
        // Calculate exponential backoff with jitter
        const baseDelay = retryConfig.baseDelayMs;
        const exponentialDelay = retryConfig.exponential 
          ? baseDelay * Math.pow(2, currentAttempts)
          : baseDelay;
        const jitter = Math.random() * retryConfig.jitterMs;
        retryAfterMs = exponentialDelay + jitter;
      }
    }

    return {
      shouldRetry,
      retryAfterMs,
      userMessage: USER_MESSAGES[errorCode] || error.message || 'An unexpected error occurred.',
      requiresAction: this.getRequiredAction(errorCode),
      showDetails: this.shouldShowErrorDetails(errorCode)
    };
  }

  /**
   * Handle authentication-related errors
   */
  private async handleAuthError(errorCode: ErrorCode): Promise<ErrorHandlingResult> {
    switch (errorCode) {
      case ErrorCode.TOKEN_EXPIRED:
        // Try to refresh token automatically
        try {
          await this.tokenManager.ensureValidToken();
          return {
            shouldRetry: true,
            retryAfterMs: 100, // Retry immediately after token refresh
            userMessage: 'Session refreshed. Retrying your request...',
            requiresAction: 'none'
          };
        } catch {
          // Refresh failed - need to login
          this.tokenManager.clearToken();
          return {
            shouldRetry: false,
            userMessage: USER_MESSAGES[ErrorCode.TOKEN_EXPIRED],
            requiresAction: 'login'
          };
        }

      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.TOKEN_INVALID:
        this.tokenManager.clearToken();
        return {
          shouldRetry: false,
          userMessage: USER_MESSAGES[errorCode],
          requiresAction: 'login'
        };

      case ErrorCode.INVALID_CREDENTIALS:
        return {
          shouldRetry: false,
          userMessage: USER_MESSAGES[errorCode],
          requiresAction: 'none' // Stay on login page
        };

      case ErrorCode.FORBIDDEN:
        return {
          shouldRetry: false,
          userMessage: USER_MESSAGES[errorCode],
          requiresAction: 'contact_support'
        };

      default:
        return {
          shouldRetry: false,
          userMessage: 'Authentication error occurred.',
          requiresAction: 'login'
        };
    }
  }

  /**
   * Check if error code is authentication-related
   */
  private isAuthError(errorCode: ErrorCode): boolean {
    const authErrors = [
      ErrorCode.INVALID_CREDENTIALS,
      ErrorCode.UNAUTHORIZED,
      ErrorCode.FORBIDDEN,
      ErrorCode.TOKEN_EXPIRED,
      ErrorCode.TOKEN_INVALID
    ];
    return authErrors.includes(errorCode);
  }

  /**
   * Determine what action user needs to take
   */
  private getRequiredAction(errorCode: ErrorCode): ErrorHandlingResult['requiresAction'] {
    switch (errorCode) {
      case ErrorCode.INVALID_CREDENTIALS:
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.TOKEN_INVALID:
        return 'login';

      case ErrorCode.QUOTA_EXCEEDED:
      case ErrorCode.LLM_QUOTA_EXCEEDED:
      case ErrorCode.FORBIDDEN:
        return 'contact_support';

      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 'wait';

      case ErrorCode.STREAMING_INTERRUPTED:
      case ErrorCode.SQL_EXECUTION_FAILED:
      case ErrorCode.LLM_SERVICE_UNAVAILABLE:
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 'none'; // Automatic retry

      default:
        return 'none';
    }
  }

  /**
   * Determine if error details should be shown to user
   */
  private shouldShowErrorDetails(errorCode: ErrorCode): boolean {
    // Show details for user errors that can be fixed
    const showDetailsFor = [
      ErrorCode.POLICY_VIOLATION,
      ErrorCode.SCHEMA_POLICY_VIOLATION,
      ErrorCode.TABLE_ACCESS_DENIED, 
      ErrorCode.COLUMN_ACCESS_DENIED,
      ErrorCode.INVALID_QUERY,
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.CONTEXT_TOO_LARGE
    ];
    
    return showDetailsFor.includes(errorCode);
  }

  /**
   * Clear retry attempts for a request (call when request succeeds)
   */
  clearRetryAttempts(requestId: string): void {
    this.retryAttempts.delete(requestId);
  }

  /**
   * Get retry statistics for debugging
   */
  getRetryStats(requestId: string): { attempts: number; maxAttempts: number } {
    const attempts = this.retryAttempts.get(requestId) || 0;
    // Return max attempts for the last error code (approximation)
    return { attempts, maxAttempts: 5 };
  }

  /**
   * Parse error from fetch response
   */
  static async parseErrorFromResponse(response: Response): Promise<ErrorResponse> {
    const traceId = response.headers.get('X-Trace-ID') || response.headers.get('X-Request-ID');
    
    try {
      const body = await response.json();
      return {
        message: body.message || response.statusText || 'Unknown error',
        error_code: body.error_code || `HTTP_${response.status}`,
        trace_id: body.trace_id || traceId || undefined,
        details: body.details,
        retry_after: body.retry_after || (response.headers.get('Retry-After') ? 
          parseInt(response.headers.get('Retry-After')!, 10) : undefined)
      };
    } catch {
      // Fallback for non-JSON error responses
      return {
        message: response.statusText || 'Request failed',
        error_code: `HTTP_${response.status}`,
        trace_id: traceId || undefined
      };
    }
  }

  /**
   * Create user-friendly error message with optional trace ID
   */
  static formatUserError(error: ErrorResponse, includeTraceId = false): string {
    const errorCode = error.error_code as ErrorCode;
    const userMessage = USER_MESSAGES[errorCode] || error.message || 'An unexpected error occurred.';
    
    if (includeTraceId && error.trace_id) {
      return `${userMessage} (Reference: ${error.trace_id})`;
    }
    
    return userMessage;
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler | null = null;

/**
 * Get global error handler instance
 */
export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}

/**
 * Convenience function for handling fetch errors
 */
export async function handleFetchError(
  response: Response, 
  requestId?: string
): Promise<ErrorHandlingResult> {
  const errorHandler = getErrorHandler();
  const error = await ErrorHandler.parseErrorFromResponse(response);
  return await errorHandler.handleError(error, requestId);
}

/**
 * Convenience function for creating user error messages
 */
export function formatError(error: ErrorResponse, includeTrace = false): string {
  return ErrorHandler.formatUserError(error, includeTrace);
}