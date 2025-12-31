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

    // Submit query that should trigger policy violation
    const policyViolationQuery = 'SELECT password, credit_card FROM users WHERE 1=1';
    await page.locator('input[name="question"]').fill(policyViolationQuery);
    await page.locator('button:has-text("Ask")').click();

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
    
    // Should suggest rephrasing query instead
    await expect(errorDisplay).toContainText(/rephrase|reword|try different|policy/i);
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

    // Mock 429 response
    await page.route('/api/v1/ask', async (route) => {
      const callCount = networkCalls.length;
      
      if (callCount < 3) {
        // Return 429 for first few calls
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
      } else {
        // Allow success after retries
        await route.continue();
      }
    });

    await page.locator('input[name="question"]').fill('trigger rate limit');
    await page.locator('button:has-text("Ask")').click();

    // Should show rate limit error
    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="error-display"]')).toContainText(/rate limit|too many requests/i);

    // Should show countdown or retry indicator
    await expect(page.locator('[data-testid="retry-countdown"], [data-testid="retrying"]')).toBeVisible();

    // Wait for automatic retry (should happen after 2 seconds + exponential backoff)
    await page.waitForTimeout(5000);

    // Verify exponential backoff timing
    if (networkCalls.length >= 2) {
      const timeDiff = networkCalls[1].timestamp - networkCalls[0].timestamp;
      expect(timeDiff).toBeGreaterThan(2000); // Should respect Retry-After
    }
  });

  test('should handle network timeout errors (408)', async ({ page }) => {
    // Mock timeout response
    await page.route('/api/v1/ask', async (route) => {
      await route.fulfill({
        status: 408,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error_code: 'REQUEST_TIMEOUT',
          message: 'Request timeout'
        })
      });
    });

    await page.locator('input[name="question"]').fill('test timeout');
    await page.locator('button:has-text("Ask")').click();

    // Should show timeout error with retry option
    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="error-display"]')).toContainText(/timeout|timed out/i);
    
    // Should have retry button for timeout errors
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    
    // Test manual retry
    await page.locator('[data-testid="retry-button"]').click();
    
    // Should make another request
    await expect(page.locator('[data-testid="loading"], .loading')).toBeVisible();
  });

  test('should handle server errors (500) with retry option', async ({ page }) => {
    let callCount = 0;
    
    await page.route('/api/v1/ask', async (route) => {
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
        await route.continue();
      }
    });

    await page.locator('input[name="question"]').fill('test server error');
    await page.locator('button:has-text("Ask")').click();

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
    
    await page.route('/api/v1/ask', async (route) => {
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
        await route.continue();
      }
    });

    await page.locator('input[name="question"]').fill('test token expiration');
    await page.locator('button:has-text("Ask")').click();

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
    await page.route('/api/v1/ask', async (route) => {
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

    await page.locator('input[name="question"]').fill('test malformed chunks');
    await page.locator('button:has-text("Ask")').click();

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
      await page.route('/api/v1/ask', async (route) => {
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
      await page.locator('input[name="question"]').fill(`test ${errorCode}`);
      await page.locator('button:has-text("Ask")').click();

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
    await page.route('/api/v1/ask', async (route) => {
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

    await page.locator('input[name="question"]').fill('اختبار رسالة خطأ بالعربية');
    await page.locator('button:has-text("Ask")').click();

    await expect(page.locator('[data-testid="error-display"]')).toBeVisible({ timeout: 10000 });
    
    // Should show Arabic error message
    await expect(page.locator('[data-testid="error-display"]')).toContainText('خطأ في الخادم الداخلي');
    
    // Should display trace_id regardless of language
    await expect(page.locator('[data-testid="error-display"]')).toContainText('test-ar-error');
  });

  test('should handle concurrent error scenarios', async ({ page }) => {
    // Test rapid successive clicks that might cause race conditions
    await page.locator('input[name="question"]').fill('concurrent error test');
    
    // Click multiple times rapidly
    const askButton = page.locator('button:has-text("Ask")');
    await askButton.click();
    await askButton.click();
    await askButton.click();
    
    // Should handle gracefully without duplicate errors
    const errorDisplays = page.locator('[data-testid="error-display"]');
    await expect(errorDisplays).toHaveCount(1, { timeout: 10000 });
  });

  test('should maintain error state during navigation', async ({ page }) => {
    // Trigger error
    await page.route('/api/v1/ask', async (route) => {
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

    await page.locator('input[name="question"]').fill('navigation test');
    await page.locator('button:has-text("Ask")').click();

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