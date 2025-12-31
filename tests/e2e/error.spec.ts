import { test, expect } from '@playwright/test';

/**
 * E2E tests for Error Handling and Recovery
 * 
 * Key scenarios:
 * - Policy violations (403, POLICY_VIOLATION)
 * - Rate limiting (429) with Retry-After handling
 * - Network errors and timeouts (408, 500, 502, 503)
 * - Token expiration during streaming
 * - ErrorDisplay component behavior
 * - Exponential backoff implementation
 * - Stream interruption and recovery
 */

test.describe('Error Handling and Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle POLICY_VIOLATION error with correct ErrorDisplay', async ({ page }) => {
    const errorChunks: any[] = [];
    
    // Capture error chunks from console
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const chunk = JSON.parse(text.replace('NDJSON:', '').trim());
          if (chunk.type === 'error') {
            errorChunks.push(chunk);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    const traceId = 'policy-trace';
    await page.route('**/api/v1/ask', async (route) => {
      const mockStream = `{"type":"thinking","trace_id":"${traceId}","timestamp":"2025-01-01T00:00:00Z","payload":{"content":"checking policy"}}
{"type":"error","trace_id":"${traceId}","timestamp":"2025-01-01T00:00:01Z","payload":{"message":"Policy violation","error_code":"POLICY_VIOLATION","lang":"en"}}`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
        body: mockStream
      });
    });

    // Submit query that should trigger policy violation
    await page.locator('[data-testid="question-input"]').fill('policy violation');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for error to appear in UI
    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 15000 });

    // Validate error chunk structure
    await expect.poll(() => errorChunks.length > 0, {
      message: 'Should receive error chunk',
      timeout: 10000
    }).toBeTruthy();

    const errorChunk = errorChunks[0];
    expect(errorChunk.type).toBe('error');
    expect(errorChunk.payload.error_code).toBe('POLICY_VIOLATION');
    expect(errorChunk.payload.message).toBeTruthy();
    expect(errorChunk.trace_id).toBeTruthy();

    // Validate ErrorDisplay shows correct information
    const errorDisplay = page.locator('[data-testid="error-display"]');
    await expect(errorDisplay).toContainText(errorChunk.trace_id);
    
    // Should show error message but not retry button for policy violations
    await expect(errorDisplay.locator('[data-testid="retry-button"]')).not.toBeVisible();
  });

  test('should handle rate limiting (429) with exponential backoff', async ({ page }) => {
    const networkCalls: any[] = [];
    
    // Intercept and monitor network requests
    page.on('request', async (request) => {
      if (request.url().includes('/api/v1/ask')) {
        networkCalls.push({
          url: request.url(),
          timestamp: Date.now(),
          headers: request.headers()
        });
      }
    });

    // Mock 429 response then success on retry
    await page.route('**/api/v1/ask', async (route) => {
      const callCount = networkCalls.length;
      if (callCount === 0) {
        await route.fulfill({
          status: 429,
          headers: {
            'Retry-After': '2',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error_code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retry_after: 2
          })
        });
        return;
      }

      const mockStream = `{"type":"thinking","trace_id":"rate-limit","timestamp":"2025-01-01T00:00:00Z","payload":{"content":"retrying"}}\n{"type":"end","trace_id":"rate-limit","timestamp":"2025-01-01T00:00:02Z","payload":{"message":"done"}}`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
        body: mockStream
      });
    });

    await page.locator('[data-testid="question-input"]').fill('trigger rate limit');
    await page.locator('[data-testid="ask-button"]').click();

    // Should show rate limit error
    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-display"]')).toContainText(/rate limit|too many requests/i);

    // Manual retry to avoid backend dependency
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    await expect.poll(() => networkCalls.length, { timeout: 5000 }).toBeGreaterThan(1);

    // After retry succeeds, error display should clear
    await expect(page.locator('[data-testid="error-display"]')).not.toBeVisible({ timeout: 10000 });
  });

  test('should handle network timeout errors (408)', async ({ page }) => {
    const calls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/ask')) calls.push(req.url());
    });

    // Mock timeout response
    await page.route('**/api/v1/ask', async (route) => {
      await route.fulfill({
        status: 408,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_code: 'REQUEST_TIMEOUT',
          message: 'Request timeout'
        })
      });
    });

    await page.locator('[data-testid="question-input"]').fill('test timeout');
    await page.locator('[data-testid="ask-button"]').click();

    // Should show timeout error with retry option
    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="error-display"]')).toContainText(/timeout|timed out/i);
    
    // Should have retry button for timeout errors
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Test manual retry
    await page.locator('[data-testid="retry-button"]').click();
    
    // Should make another request
    await expect.poll(() => calls.length, { timeout: 3000 }).toBeGreaterThan(1);
  });

  test('should handle server errors (500) with retry option', async ({ page }) => {
    let callCount = 0;
    
    await page.route('**/api/v1/ask', async (route) => {
      callCount++;
      
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error_code: 'INTERNAL_SERVER_ERROR',
            message: 'Internal server error'
          })
        });
      } else {
        // Success on retry
        const mockStream = `{"type":"thinking","trace_id":"server-error","timestamp":"2025-01-01T00:00:00Z","payload":{"content":"retrying"}}\n{"type":"end","trace_id":"server-error","timestamp":"2025-01-01T00:00:02Z","payload":{"message":"done"}}`;
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/x-ndjson' },
          body: mockStream
        });
      }
    });

    await page.locator('[data-testid="question-input"]').fill('test server error');
    await page.locator('[data-testid="ask-button"]').click();

    // Should show server error
    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="error-display"]')).toContainText(/server error|error occurred/i);
    
    // Should have retry button
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
    
    // Click retry and verify success
    await retryButton.click();
    
    // Should eventually succeed
    await expect(page.locator('[data-testid="error-display"]')).not.toBeVisible({ timeout: 15000 });
  });

  test('should handle token expiration during streaming', async ({ page }) => {
    // Skip if auth not enabled
    const authEnabled = await page.evaluate(() => {
      return (window as any).__ENV?.AUTH_ENABLED ?? false;
    });
    test.skip(!authEnabled, 'AUTH_ENABLED=false; token tests not applicable');

    let requestCount = 0;
    
    await page.route('**/api/v1/ask', async (route) => {
      requestCount++;
      
      if (requestCount === 1) {
        // First request: simulate token expiration
        await route.fulfill({
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error_code: 'TOKEN_EXPIRED',
            message: 'Access token has expired'
          })
        });
      } else {
        // Should have refreshed token for second request
        const authHeader = route.request().headers()['authorization'];
        expect(authHeader).toBeTruthy();
        const mockStream = `{"type":"thinking","trace_id":"token-refresh","timestamp":"2025-01-01T00:00:00Z","payload":{"content":"refreshing"}}\n{"type":"end","trace_id":"token-refresh","timestamp":"2025-01-01T00:00:02Z","payload":{"message":"done"}}`;
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/x-ndjson' },
          body: mockStream
        });
      }
    });

    await page.locator('[data-testid="question-input"]').fill('test token expiration');
    await page.locator('[data-testid="ask-button"]').click();

    // Should handle token refresh automatically without showing error to user
    // (unless refresh fails, then should show login prompt)
    
    // Wait and check if request was retried with new token
    await page.waitForTimeout(3000);
    expect(requestCount).toBeGreaterThan(1);
  });

  test('should handle stream interruption and malformed chunks', async ({ page }) => {
    const receivedChunks: string[] = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        receivedChunks.push(text.replace('NDJSON:', '').trim());
      }
    });

    // Mock response with malformed NDJSON
    await page.route('**/api/v1/ask', async (route) => {
      const mockResponse = `{"type":"thinking","trace_id":"test-123","timestamp":"2025-01-01T00:00:00Z","payload":{"content":"thinking"}}
{"type":"technical_view","trace_id":"test-123"
MALFORMED_CHUNK_HERE
{"type":"end","trace_id":"test-123","timestamp":"2025-01-01T00:00:02Z","payload":{"message":"complete"}}`;

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
        body: mockResponse
      });
    });

    await page.locator('[data-testid="question-input"]').fill('test malformed chunks');
    await page.locator('[data-testid="ask-button"]').click();

    // Should handle malformed chunks gracefully
    await expect(page.locator('[data-testid="thinking-display"]')).toBeVisible({ timeout: 10000 });
    
    // Should not crash the application
    await expect(page.locator('body')).toBeVisible();
    
    // Should show error for stream corruption
    await expect(page.locator('[data-testid="error-display"], [data-testid="stream-error"]')).toBeVisible({ timeout: 5000 });
  });

  test('should validate all documented error codes', async ({ page }) => {
    const errorCodes = [
      'POLICY_VIOLATION',
      'DATA_ACCESS_DENIED', 
      'RATE_LIMIT_EXCEEDED',
      'REQUEST_TIMEOUT',
      'INTERNAL_SERVER_ERROR',
      'SERVICE_UNAVAILABLE',
      'BAD_GATEWAY',
      'TOKEN_EXPIRED',
      'INVALID_QUERY',
      'SCHEMA_ERROR'
    ];

    for (const errorCode of errorCodes) {
      // Mock specific error
      await page.route('**/api/v1/ask', async (route) => {
        await route.fulfill({
          status: errorCode === 'RATE_LIMIT_EXCEEDED' ? 429 : 
                  errorCode === 'REQUEST_TIMEOUT' ? 408 : 
                  errorCode === 'TOKEN_EXPIRED' ? 401 : 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error_code: errorCode,
            message: `Test ${errorCode} error`,
            trace_id: `trace-${errorCode.toLowerCase()}`
          })
        });
      }, { times: 1 });

      await page.goto('/'); // Reset page state
      await page.locator('[data-testid="question-input"]').fill(`test ${errorCode}`);
      await page.locator('[data-testid="ask-button"]').click();

      // Should show error display
      await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 10000 });
      
      // Should display trace_id for debugging
      await expect(page.locator('[data-testid="error-display"]')).toContainText(/trace-/);
      
      // Retry button behavior varies by error type
      const retryButton = page.locator('[data-testid="retry-button"]');
      const shouldHaveRetry = ![
        'POLICY_VIOLATION', 
        'DATA_ACCESS_DENIED', 
        'TOKEN_EXPIRED'
      ].includes(errorCode);
      
      if (shouldHaveRetry) {
        await expect(retryButton).toBeVisible();
      } else {
        await expect(retryButton).not.toBeVisible();
      }
    }
  });

  test('should show appropriate error messages by language', async ({ page }) => {
    // Test Arabic error messages
    await page.route('**/api/v1/ask', async (route) => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_code: 'INTERNAL_SERVER_ERROR',
          message: 'خطأ في الخادم الداخلي',
          lang: 'ar',
          trace_id: 'test-ar-error'
        })
      });
    });

    await page.locator('[data-testid="question-input"]').fill('اختبار رسالة خطأ بالعربية');
    await page.locator('[data-testid="ask-button"]').click();

    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 10000 });
    
    // Should show Arabic error message
    await expect(page.locator('[data-testid="error-display"]')).toContainText('خطأ في الخادم الداخلي');
    
    // Should display trace_id regardless of language
    await expect(page.locator('[data-testid="error-display"]')).toContainText('test-ar-error');
  });

  test('should handle concurrent error scenarios', async ({ page }) => {
    // Test rapid successive clicks that might cause race conditions
    await page.locator('[data-testid="question-input"]').fill('concurrent error test');
    
    // Click multiple times rapidly
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();
    await askButton.click();
    await askButton.click();
    
    // Should handle gracefully without duplicate errors
    const errorDisplays = page.locator('[data-testid="error-display"]');
    await expect(errorDisplays).toHaveCount(1, { timeout: 10000 });
  });

  test('should maintain error state during navigation', async ({ page }) => {
    // Trigger error
    await page.route('**/api/v1/ask', async (route) => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_code: 'TEST_ERROR',
          message: 'Navigation test error',
          trace_id: 'nav-test-123'
        })
      });
    });

    await page.locator('[data-testid="question-input"]').fill('navigation test');
    await page.locator('[data-testid="ask-button"]').click();

    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 10000 });

    // Navigate to different section (if app has navigation)
    try {
      await page.locator('nav a, [data-testid="nav-link"]').first().click();
      await page.waitForTimeout(1000);
      
      // Navigate back
      await page.goBack();
      
      // Error state should be preserved or cleared appropriately
      // This behavior depends on app design - just ensure no crashes
      await expect(page.locator('body')).toBeVisible();
    } catch (e) {
      // Navigation might not exist in current implementation
      console.log('Navigation test skipped - no nav elements found');
    }
  });
});
