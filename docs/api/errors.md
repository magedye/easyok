# Error Codes & Handling Specification

**Target Audience:** Frontend Developers  
**Last Updated:** 2025-12-31  
**Version:** Phase 4 Documentation  

## 📋 Overview

This document provides comprehensive guidance on handling all documented backend error codes. The **[`ErrorHandler`](../frontend/src/api/errorHandler.ts:212)** implements standardized retry logic, user-friendly messaging, and recovery strategies for each error type.

## 🎯 Error Handling Philosophy

1. **Complete Coverage:** Handle all 25+ documented error codes
2. **User-Friendly Messages:** Never show technical stack traces
3. **Smart Retry Logic:** Exponential backoff with jitter
4. **Trace ID Correlation:** Always include trace_id for debugging
5. **Recovery Guidance:** Provide actionable next steps

## 📊 Error Response Schema

### Standard Error Format
All backend endpoints return consistent error structure:

```json
{
  "message": "Human-readable error description",
  "error_code": "MACHINE_READABLE_CODE",
  "trace_id": "req_1704067200_abcd1234",
  "details": {
    "field_name": "Additional context",
    "suggested_action": "What user should do"
  },
  "retry_after": 30
}
```

### Error Interface
```typescript
interface ErrorResponse {
  message: string;
  error_code: string;
  trace_id?: string;
  details?: Record<string, unknown>;
  retry_after?: number; // Seconds to wait before retry
}
```

## 🚨 Complete Error Code Reference

### Authentication & Authorization Errors

#### INVALID_CREDENTIALS
**Description:** Login failed due to wrong username/password  
**Retryable:** No  
**HTTP Status:** 401  
**Frontend Action:** Stay on login page, clear password field

```json
{
  "message": "Invalid username or password",
  "error_code": "INVALID_CREDENTIALS",
  "trace_id": "req_1704067200_auth001"
}
```

**Frontend Handling:**
```typescript
case ErrorCode.INVALID_CREDENTIALS:
  return {
    shouldRetry: false,
    userMessage: 'Invalid username or password. Please check your credentials and try again.',
    requiresAction: 'none' // Stay on login page
  };
```

#### UNAUTHORIZED  
**Description:** No valid authentication token provided  
**Retryable:** No  
**HTTP Status:** 401  
**Frontend Action:** Clear token, redirect to login

```json
{
  "message": "Authentication required",
  "error_code": "UNAUTHORIZED", 
  "trace_id": "req_1704067200_auth002"
}
```

**Frontend Handling:**
```typescript
case ErrorCode.UNAUTHORIZED:
  this.tokenManager.clearToken();
  return {
    shouldRetry: false,
    userMessage: 'You are not authorized to access this resource. Please log in.',
    requiresAction: 'login'
  };
```

#### FORBIDDEN
**Description:** Authenticated but insufficient permissions  
**Retryable:** No  
**HTTP Status:** 403  
**Frontend Action:** Show permission error, contact support

```json
{
  "message": "Insufficient permissions for this operation",
  "error_code": "FORBIDDEN",
  "trace_id": "req_1704067200_auth003",
  "details": {
    "required_role": "admin",
    "user_role": "viewer"
  }
}
```

#### TOKEN_EXPIRED
**Description:** JWT token has expired  
**Retryable:** Yes (auto-refresh)  
**HTTP Status:** 401  
**Frontend Action:** Attempt token refresh, then retry

```json
{
  "message": "Token has expired",
  "error_code": "TOKEN_EXPIRED",
  "trace_id": "req_1704067200_auth004"
}
```

**Frontend Handling:**
```typescript
case ErrorCode.TOKEN_EXPIRED:
  try {
    await this.tokenManager.ensureValidToken();
    return {
      shouldRetry: true,
      retryAfterMs: 100,
      userMessage: 'Session refreshed. Retrying your request...',
      requiresAction: 'none'
    };
  } catch {
    this.tokenManager.clearToken();
    return {
      shouldRetry: false,
      userMessage: 'Your session has expired. Please log in again.',
      requiresAction: 'login'
    };
  }
```

#### TOKEN_INVALID
**Description:** Malformed or corrupted JWT token  
**Retryable:** No  
**HTTP Status:** 401  
**Frontend Action:** Clear token, redirect to login

```json
{
  "message": "Invalid token format",
  "error_code": "TOKEN_INVALID",
  "trace_id": "req_1704067200_auth005"
}
```

### Policy & Governance Errors

#### POLICY_VIOLATION
**Description:** Query violates data access policies  
**Retryable:** No  
**HTTP Status:** 403  
**Frontend Action:** Show policy details, suggest alternatives

```json
{
  "message": "Query violates data access policies",
  "error_code": "POLICY_VIOLATION",
  "trace_id": "req_1704067200_policy001",
  "details": {
    "violated_policies": ["no_pii_access", "department_restriction"],
    "allowed_tables": ["orders", "products"],
    "blocked_tables": ["customers", "employees"]
  }
}
```

**Frontend Handling:**
```typescript
case ErrorCode.POLICY_VIOLATION:
  return {
    shouldRetry: false,
    userMessage: 'Your query violates data access policies. Please review allowed tables and try again.',
    requiresAction: 'none',
    showDetails: true // Show details.allowed_tables
  };
```

#### SCHEMA_POLICY_VIOLATION
**Description:** Access to schema restricted by policy  
**Retryable:** No  
**HTTP Status:** 403

```json
{
  "message": "Access to schema 'finance' is restricted",
  "error_code": "SCHEMA_POLICY_VIOLATION", 
  "trace_id": "req_1704067200_policy002",
  "details": {
    "schema": "finance", 
    "required_clearance": "level_3"
  }
}
```

#### TABLE_ACCESS_DENIED
**Description:** Specific table access denied  
**Retryable:** No  
**HTTP Status:** 403

```json
{
  "message": "Access denied to table 'employee_salaries'",
  "error_code": "TABLE_ACCESS_DENIED",
  "trace_id": "req_1704067200_policy003",
  "details": {
    "table": "employee_salaries",
    "required_permission": "READ_SENSITIVE"
  }
}
```

#### COLUMN_ACCESS_DENIED
**Description:** Specific column restrictions  
**Retryable:** No  
**HTTP Status:** 403

```json
{
  "message": "Access denied to columns: ssn, salary",
  "error_code": "COLUMN_ACCESS_DENIED",
  "trace_id": "req_1704067200_policy004",
  "details": {
    "blocked_columns": ["ssn", "salary"],
    "allowed_columns": ["name", "department", "hire_date"]
  }
}
```

### Rate Limiting & Quota Errors

#### RATE_LIMIT_EXCEEDED
**Description:** Too many requests in time window  
**Retryable:** Yes (with backoff)  
**HTTP Status:** 429  
**Frontend Action:** Wait for retry_after period, show countdown

```json
{
  "message": "Rate limit exceeded",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "trace_id": "req_1704067200_rate001",
  "retry_after": 30,
  "details": {
    "limit": 100,
    "window": "1 hour",
    "current_usage": 105
  }
}
```

**Frontend Handling:**
```typescript
case ErrorCode.RATE_LIMIT_EXCEEDED:
  const retryAfterMs = error.retry_after ? error.retry_after * 1000 : 2000;
  return {
    shouldRetry: true,
    retryAfterMs,
    userMessage: 'Too many requests. Please wait a moment before trying again.',
    requiresAction: 'wait'
  };
```

#### QUOTA_EXCEEDED
**Description:** Monthly/daily usage quota exceeded  
**Retryable:** No  
**HTTP Status:** 429

```json
{
  "message": "Monthly query quota exceeded",
  "error_code": "QUOTA_EXCEEDED",
  "trace_id": "req_1704067200_quota001",
  "details": {
    "quota_type": "monthly_queries",
    "limit": 10000,
    "used": 10000,
    "reset_date": "2025-02-01T00:00:00.000Z"
  }
}
```

#### CONCURRENT_REQUEST_LIMIT
**Description:** Too many simultaneous requests  
**Retryable:** Yes (brief wait)  
**HTTP Status:** 429

```json
{
  "message": "Too many concurrent requests",
  "error_code": "CONCURRENT_REQUEST_LIMIT",
  "trace_id": "req_1704067200_conc001",
  "details": {
    "max_concurrent": 5,
    "current_active": 7
  }
}
```

### Query Execution Errors

#### SQL_EXECUTION_FAILED
**Description:** Database execution error  
**Retryable:** Yes (transient issues)  
**HTTP Status:** 500

```json
{
  "message": "Query execution failed",
  "error_code": "SQL_EXECUTION_FAILED",
  "trace_id": "req_1704067200_exec001",
  "details": {
    "database_error": "Connection timeout",
    "suggestion": "Try simplifying the query"
  }
}
```

#### QUERY_TIMEOUT
**Description:** Query took too long to execute  
**Retryable:** Yes (with optimization)  
**HTTP Status:** 408

```json
{
  "message": "Query execution timed out",
  "error_code": "QUERY_TIMEOUT",
  "trace_id": "req_1704067200_timeout001",
  "details": {
    "timeout_seconds": 30,
    "suggestion": "Try limiting results or adding filters"
  }
}
```

#### INVALID_QUERY
**Description:** Generated SQL is invalid  
**Retryable:** No  
**HTTP Status:** 400

```json
{
  "message": "Generated query is invalid",
  "error_code": "INVALID_QUERY",
  "trace_id": "req_1704067200_invalid001",
  "details": {
    "sql_error": "Syntax error near 'FORM'",
    "suggestion": "Please rephrase your question"
  }
}
```

#### DATABASE_CONNECTION_FAILED
**Description:** Cannot connect to database  
**Retryable:** Yes (infrastructure issue)  
**HTTP Status:** 503

```json
{
  "message": "Database connection failed",
  "error_code": "DATABASE_CONNECTION_FAILED",
  "trace_id": "req_1704067200_db001"
}
```

### LLM & AI Service Errors

#### LLM_SERVICE_UNAVAILABLE
**Description:** AI service is down  
**Retryable:** Yes (with backoff)  
**HTTP Status:** 503

```json
{
  "message": "AI service temporarily unavailable", 
  "error_code": "LLM_SERVICE_UNAVAILABLE",
  "trace_id": "req_1704067200_llm001"
}
```

#### LLM_QUOTA_EXCEEDED
**Description:** AI service quota exhausted  
**Retryable:** No  
**HTTP Status:** 429

```json
{
  "message": "AI service quota exceeded",
  "error_code": "LLM_QUOTA_EXCEEDED",
  "trace_id": "req_1704067200_llm002",
  "details": {
    "quota_type": "monthly_tokens",
    "reset_date": "2025-02-01T00:00:00.000Z"
  }
}
```

#### LLM_GENERATION_FAILED
**Description:** AI failed to generate response  
**Retryable:** Yes (different prompt)  
**HTTP Status:** 500

```json
{
  "message": "AI response generation failed",
  "error_code": "LLM_GENERATION_FAILED",
  "trace_id": "req_1704067200_llm003",
  "details": {
    "reason": "Context too complex",
    "suggestion": "Try breaking into smaller questions"
  }
}
```

#### CONTEXT_TOO_LARGE
**Description:** Input exceeds context limits  
**Retryable:** No  
**HTTP Status:** 400

```json
{
  "message": "Question is too complex",
  "error_code": "CONTEXT_TOO_LARGE",
  "trace_id": "req_1704067200_llm004",
  "details": {
    "max_tokens": 4000,
    "actual_tokens": 5200
  }
}
```

### Streaming Errors

#### STREAMING_INTERRUPTED
**Description:** Stream connection lost  
**Retryable:** Yes (restart)  
**HTTP Status:** 500

```json
{
  "message": "Stream connection interrupted",
  "error_code": "STREAMING_INTERRUPTED",
  "trace_id": "req_1704067200_stream001"
}
```

#### STREAMING_TIMEOUT
**Description:** Stream took too long  
**Retryable:** Yes  
**HTTP Status:** 408

```json
{
  "message": "Stream response timed out",
  "error_code": "STREAMING_TIMEOUT",
  "trace_id": "req_1704067200_stream002"
}
```

#### CHUNK_ORDER_VIOLATION
**Description:** Invalid chunk sequence  
**Retryable:** No  
**HTTP Status:** 500

```json
{
  "message": "Response format error",
  "error_code": "CHUNK_ORDER_VIOLATION",
  "trace_id": "req_1704067200_stream003",
  "details": {
    "expected": "technical_view",
    "received": "data"
  }
}
```

### Infrastructure Errors

#### SERVICE_UNAVAILABLE
**Description:** Service temporarily down  
**Retryable:** Yes (with backoff)  
**HTTP Status:** 503

```json
{
  "message": "Service temporarily unavailable",
  "error_code": "SERVICE_UNAVAILABLE",
  "trace_id": "req_1704067200_infra001"
}
```

#### INTERNAL_SERVER_ERROR
**Description:** Unexpected server error  
**Retryable:** Yes (limited attempts)  
**HTTP Status:** 500

```json
{
  "message": "Internal server error",
  "error_code": "INTERNAL_SERVER_ERROR",
  "trace_id": "req_1704067200_infra002"
}
```

#### GATEWAY_TIMEOUT
**Description:** Upstream service timeout  
**Retryable:** Yes  
**HTTP Status:** 504

```json
{
  "message": "Gateway timeout",
  "error_code": "GATEWAY_TIMEOUT",
  "trace_id": "req_1704067200_infra003"
}
```

#### DEPENDENCY_FAILURE
**Description:** Required service failed  
**Retryable:** Yes  
**HTTP Status:** 503

```json
{
  "message": "Required service unavailable",
  "error_code": "DEPENDENCY_FAILURE",
  "trace_id": "req_1704067200_infra004",
  "details": {
    "failed_service": "user_directory"
  }
}
```

### Validation Errors

#### VALIDATION_ERROR
**Description:** Request validation failed  
**Retryable:** No  
**HTTP Status:** 400

```json
{
  "message": "Request validation failed",
  "error_code": "VALIDATION_ERROR",
  "trace_id": "req_1704067200_valid001",
  "details": {
    "field": "question",
    "error": "Question cannot be empty"
  }
}
```

#### INVALID_REQUEST_FORMAT
**Description:** Malformed request  
**Retryable:** No  
**HTTP Status:** 400

```json
{
  "message": "Invalid request format",
  "error_code": "INVALID_REQUEST_FORMAT",
  "trace_id": "req_1704067200_valid002"
}
```

#### MISSING_REQUIRED_FIELD
**Description:** Required field missing  
**Retryable:** No  
**HTTP Status:** 400

```json
{
  "message": "Required field missing: question",
  "error_code": "MISSING_REQUIRED_FIELD",
  "trace_id": "req_1704067200_valid003",
  "details": {
    "field": "question"
  }
}
```

### Training & Admin Errors

#### TRAINING_ITEM_NOT_FOUND
**Description:** Training item doesn't exist  
**Retryable:** No  
**HTTP Status:** 404

```json
{
  "message": "Training item not found",
  "error_code": "TRAINING_ITEM_NOT_FOUND",
  "trace_id": "req_1704067200_train001",
  "details": {
    "item_id": "training_123"
  }
}
```

#### TRAINING_VALIDATION_FAILED
**Description:** Training data invalid  
**Retryable:** No  
**HTTP Status:** 400

```json
{
  "message": "Training data validation failed",
  "error_code": "TRAINING_VALIDATION_FAILED",
  "trace_id": "req_1704067200_train002",
  "details": {
    "errors": ["SQL syntax error", "Missing question text"]
  }
}
```

#### FEATURE_TOGGLE_IMMUTABLE
**Description:** Cannot modify immutable toggle  
**Retryable:** No  
**HTTP Status:** 400

```json
{
  "message": "Feature toggle cannot be modified",
  "error_code": "FEATURE_TOGGLE_IMMUTABLE",
  "trace_id": "req_1704067200_toggle001",
  "details": {
    "toggle_name": "AUTH_ENABLED",
    "reason": "Security-critical setting"
  }
}
```

## 🔄 Retry Logic Configuration

### Retry Configurations by Error Type
The **[`ErrorHandler`](../frontend/src/api/errorHandler.ts:212)** uses specific retry configs:

```typescript
interface RetryConfig {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  exponential: boolean;
  jitterMs: number;
}

const RETRY_CONFIGS: Record<ErrorCode, RetryConfig> = {
  // Authentication - No retry
  [ErrorCode.INVALID_CREDENTIALS]: { 
    enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 
  },
  
  // Rate limiting - Exponential backoff
  [ErrorCode.RATE_LIMIT_EXCEEDED]: { 
    enabled: true, maxAttempts: 5, baseDelayMs: 2000, exponential: true, jitterMs: 1000 
  },
  
  // Infrastructure - Aggressive retry
  [ErrorCode.SERVICE_UNAVAILABLE]: { 
    enabled: true, maxAttempts: 4, baseDelayMs: 3000, exponential: true, jitterMs: 2000 
  },
  
  // Policy violations - No retry
  [ErrorCode.POLICY_VIOLATION]: { 
    enabled: false, maxAttempts: 0, baseDelayMs: 0, exponential: false, jitterMs: 0 
  }
};
```

### Exponential Backoff Formula
```typescript
const calculateRetryDelay = (attempt: number, config: RetryConfig): number => {
  let delay = config.baseDelayMs;
  
  if (config.exponential) {
    delay = config.baseDelayMs * Math.pow(2, attempt);
  }
  
  const jitter = Math.random() * config.jitterMs;
  return delay + jitter;
};

// Example for RATE_LIMIT_EXCEEDED:
// Attempt 1: 2000ms + (0-1000ms jitter) = 2000-3000ms
// Attempt 2: 4000ms + (0-1000ms jitter) = 4000-5000ms  
// Attempt 3: 8000ms + (0-1000ms jitter) = 8000-9000ms
```

## 🎨 Frontend Implementation

### Error Handler Usage
```typescript
import { getErrorHandler, ErrorCode } from '../api/errorHandler';

const handleApiCall = async (apiCall: () => Promise<Response>) => {
  const requestId = `req_${Date.now()}`;
  const errorHandler = getErrorHandler();
  
  let attempt = 0;
  const maxAttempts = 5;
  
  while (attempt < maxAttempts) {
    try {
      const response = await apiCall();
      
      if (response.ok) {
        // Success - clear retry attempts
        errorHandler.clearRetryAttempts(requestId);
        return await response.json();
      }
      
      // Handle error response
      const error = await ErrorHandler.parseErrorFromResponse(response);
      const handling = await errorHandler.handleError(error, requestId);
      
      if (handling.shouldRetry && attempt < maxAttempts - 1) {
        // Wait before retry
        await new Promise(resolve => 
          setTimeout(resolve, handling.retryAfterMs || 1000)
        );
        attempt++;
        continue;
      }
      
      // No more retries or non-retryable error
      throw new Error(handling.userMessage);
      
    } catch (error) {
      if (attempt >= maxAttempts - 1) {
        throw error;
      }
      attempt++;
    }
  }
};
```

### Error Display Component
```typescript
interface ErrorDisplayProps {
  error: ErrorResponse;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onRetry, 
  onDismiss 
}) => {
  const errorHandler = getErrorHandler();
  const [retryCountdown, setRetryCountdown] = useState(0);
  
  useEffect(() => {
    if (error.error_code === ErrorCode.RATE_LIMIT_EXCEEDED && error.retry_after) {
      let remaining = error.retry_after;
      setRetryCountdown(remaining);
      
      const timer = setInterval(() => {
        remaining--;
        setRetryCountdown(remaining);
        
        if (remaining <= 0) {
          clearInterval(timer);
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [error]);
  
  const getErrorIcon = (errorCode: string) => {
    switch (errorCode) {
      case ErrorCode.UNAUTHORIZED:
      case ErrorCode.TOKEN_EXPIRED:
        return '🔒';
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return '⏱️';
      case ErrorCode.POLICY_VIOLATION:
        return '🛡️';
      default:
        return '⚠️';
    }
  };
  
  const shouldShowRetry = () => {
    const retryableErrors = [
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.STREAMING_INTERRUPTED,
      ErrorCode.SQL_EXECUTION_FAILED
    ];
    
    return retryableErrors.includes(error.error_code as ErrorCode) && onRetry;
  };
  
  const getActionButton = () => {
    if (retryCountdown > 0) {
      return (
        <button disabled className="btn btn-disabled">
          Retry in {retryCountdown}s
        </button>
      );
    }
    
    if (shouldShowRetry()) {
      return (
        <button onClick={onRetry} className="btn btn-primary">
          Try Again
        </button>
      );
    }
    
    if (error.error_code === ErrorCode.UNAUTHORIZED) {
      return (
        <button onClick={() => window.location.href = '/login'} className="btn btn-primary">
          Log In
        </button>
      );
    }
    
    return null;
  };
  
  return (
    <div className="error-display bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{getErrorIcon(error.error_code)}</span>
        
        <div className="flex-1">
          <h3 className="font-semibold text-red-800">
            {ErrorHandler.formatUserError(error)}
          </h3>
          
          {error.trace_id && (
            <p className="text-sm text-red-600 mt-1">
              Reference ID: {error.trace_id}
            </p>
          )}
          
          {error.details && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-red-700">
                Technical Details
              </summary>
              <pre className="text-xs bg-red-100 p-2 mt-1 rounded overflow-auto">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}
          
          <div className="flex gap-2 mt-3">
            {getActionButton()}
            
            {onDismiss && (
              <button onClick={onDismiss} className="btn btn-secondary">
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Global Error Boundary
```typescript
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught error:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      timestamp: new Date().toISOString()
    });
    
    // Report to monitoring service
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: { react: errorInfo }
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={{
            message: 'An unexpected error occurred. Please refresh the page.',
            error_code: 'INTERNAL_CLIENT_ERROR',
            trace_id: `client_${Date.now()}`
          }}
          onRetry={() => window.location.reload()}
        />
      );
    }
    
    return this.props.children;
  }
}
```

## 🔍 Debugging & Monitoring

### Error Correlation
```typescript
// Always log errors with trace_id for backend correlation
const logError = (error: ErrorResponse, context: string) => {
  console.error(`[${context}] Error occurred:`, {
    error_code: error.error_code,
    message: error.message,
    trace_id: error.trace_id,
    timestamp: new Date().toISOString(),
    user_agent: navigator.userAgent,
    url: window.location.href
  });
  
  // Send to monitoring service
  if (window.gtag) {
    window.gtag('event', 'exception', {
      description: error.error_code,
      fatal: false,
      custom_map: {
        trace_id: error.trace_id
      }
    });
  }
};
```

### Error Metrics Collection
```typescript
// Track error frequency for monitoring
const trackErrorMetrics = (error: ErrorResponse) => {
  const metrics = {
    error_code: error.error_code,
    timestamp: Date.now(),
    trace_id: error.trace_id,
    user_id: getCurrentUser()?.id
  };
  
  // Local storage for debugging
  const errorLog = JSON.parse(localStorage.getItem('error_log') || '[]');
  errorLog.push(metrics);
  
  // Keep only last 100 errors
  if (errorLog.length > 100) {
    errorLog.splice(0, errorLog.length - 100);
  }
  
  localStorage.setItem('error_log', JSON.stringify(errorLog));
  
  // Send to analytics
  if (window.analytics) {
    window.analytics.track('Error Occurred', metrics);
  }
};
```

## 🧪 Testing Error Scenarios

### Unit Tests for Error Handler
```typescript
describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  
  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });
  
  it('should handle rate limit with exponential backoff', async () => {
    const error: ErrorResponse = {
      message: 'Rate limit exceeded',
      error_code: 'RATE_LIMIT_EXCEEDED',
      trace_id: 'test_trace',
      retry_after: 2
    };
    
    const handling = await errorHandler.handleError(error, 'test_req');
    
    expect(handling.shouldRetry).toBe(true);
    expect(handling.retryAfterMs).toBe(2000);
    expect(handling.userMessage).toContain('Too many requests');
  });
  
  it('should not retry policy violations', async () => {
    const error: ErrorResponse = {
      message: 'Policy violation',
      error_code: 'POLICY_VIOLATION',
      trace_id: 'test_trace'
    };
    
    const handling = await errorHandler.handleError(error, 'test_req');
    
    expect(handling.shouldRetry).toBe(false);
    expect(handling.showDetails).toBe(true);
  });
});
```

### E2E Error Testing
```typescript
// Playwright test for error scenarios
test('should handle authentication error gracefully', async ({ page }) => {
  // Mock 401 response
  await page.route('/api/v1/chat/ask', route => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Authentication required',
        error_code: 'UNAUTHORIZED',
        trace_id: 'test_trace_401'
      })
    });
  });
  
  // Trigger request
  await page.fill('#question', 'test question');
  await page.click('#submit');
  
  // Verify error handling
  const errorDisplay = page.locator('.error-display');
  await expect(errorDisplay).toBeVisible();
  await expect(errorDisplay).toContainText('log in');
  
  // Verify login redirect
  await page.click('text=Log In');
  await expect(page).toHaveURL(/\/login/);
});
```

## 📚 Related Documentation

- **[`../frontend/src/api/errorHandler.ts`](../frontend/src/api/errorHandler.ts)** - Error handler implementation
- **[`endpoints.md`](endpoints.md)** - API endpoints and error responses
- **[`../frontend/src/components/ErrorDisplay.tsx`](../frontend/src/components/ErrorDisplay.tsx)** - Error UI component
- **[`../governance/frontend-rules.md`](../governance/frontend-rules.md)** - Error handling governance rules

---

## 📋 Error Handling Checklist

### Implementation Checklist
- [ ] All 25+ error codes handled with specific logic
- [ ] Retry configurations defined for each error type
- [ ] User-friendly messages (no technical jargon)
- [ ] Trace ID included in all error logs
- [ ] Exponential backoff with jitter implemented
- [ ] Auth errors clear token and redirect appropriately
- [ ] Policy errors show actionable details
- [ ] Rate limit errors show countdown timer
- [ ] Stream errors trigger recovery flow

### Testing Checklist
- [ ] Unit tests for all error codes
- [ ] E2E tests for critical error flows
- [ ] Manual testing of retry logic
- [ ] Monitoring dashboards set up
- [ ] Error correlation with backend traces verified

### Monitoring Checklist
- [ ] Error rate alerts configured
- [ ] Retry success rate tracking
- [ ] User experience impact measurement
- [ ] Trace ID correlation working
- [ ] Performance impact of retries monitored
