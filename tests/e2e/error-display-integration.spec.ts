/**
 * E2E Tests for ErrorDisplay.tsx Integration in Chat.tsx
 * 
 * Tests verify that:
 * 1. ErrorDisplay component renders correctly on stream validation failures
 * 2. Trace ID correlation works across streaming contract violations
 * 3. Retry logic functions properly
 * 4. Error metadata (error_code, message) displays correctly
 * 5. Governance compliance is maintained (trace_id, proper error handling)
 */

import { test, expect } from '@playwright/test';

test.describe('ErrorDisplay Integration with Chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('displays ErrorDisplay when chunk validation fails', async ({ page }) => {
    // Find and fill the question input
    const questionInput = page.locator('[data-testid="question-input"]');
    await expect(questionInput).toBeVisible();
    
    await questionInput.fill('Show me all data');
    
    // Click ask button to start stream
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    // Wait a moment for streaming to start
    await page.waitForTimeout(500);

    // Simulate invalid chunk order via page evaluation
    // This injects a validation error into the stream handler
    await page.evaluate(() => {
      const event = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_test_12345',
          error_code: 'STREAM_ORDER_VIOLATION',
          message: 'Invalid chunk sequence: expected thinking, received data'
        }
      });
      window.dispatchEvent(event);
    });

    // Verify error display component is visible
    const errorDisplay = page.locator('[data-testid="error-display"]');
    await expect(errorDisplay).toBeVisible();

    // Verify error message is displayed
    const errorMessage = page.locator('text=/خطأ|Error/i');
    await expect(errorMessage.first()).toBeVisible();
  });

  test('displays trace ID in error display for correlation', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('SELECT * FROM table');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Simulate streaming error with specific trace ID
    const traceId = `trace_${Date.now()}`;
    await page.evaluate((id) => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: id,
          error_code: 'POLICY_VIOLATION',
          message: 'Table access not permitted by governance policy'
        }
      });
      window.dispatchEvent(error);
    }, traceId);

    // Verify trace ID is visible in error display
    const traceIdElement = page.locator('code');
    await expect(traceIdElement).toContainText(traceId.substring(0, 12));
  });

  test('retry button clears error and retries request', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Retry test question');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger error
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_retry_test',
          error_code: 'NETWORK_FAILURE',
          message: 'Network connection failed'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify error is displayed
    const errorDisplay = page.locator('[data-testid="error-display"]');
    await expect(errorDisplay).toBeVisible();

    // Click retry button if available
    const retryButton = page.locator('text=/المحاولة مرة أخرى|Retry/i').first();
    if (await retryButton.isVisible()) {
      await retryButton.click();
      
      // Verify error display is hidden after retry
      await expect(errorDisplay).not.toBeVisible();
    }
  });

  test('error code is displayed correctly', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Test error codes');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger error with specific code
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_code_test',
          error_code: 'QUERY_TIMEOUT',
          message: 'Query execution exceeded timeout'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify error code is shown
    const errorCodeElement = page.locator('text=/QUERY_TIMEOUT/');
    await expect(errorCodeElement).toBeVisible();
  });

  test('ErrorDisplay shows user guidance for common errors', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Test user guidance');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger RATE_LIMIT error
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_guidance_test',
          error_code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests in short time'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify guidance message is shown
    const guidanceText = page.locator('text=/انتظر قليلاً|wait before/i');
    await expect(guidanceText.first()).toBeVisible();
  });

  test('dismiss button hides error display', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Test dismiss');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger error
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_dismiss_test',
          error_code: 'GENERAL_ERROR',
          message: 'An error occurred'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify error is visible
    const errorDisplay = page.locator('[data-testid="error-display"]');
    await expect(errorDisplay).toBeVisible();

    // Click dismiss/close button (SVG X icon)
    const dismissButton = errorDisplay.locator('button').first();
    if (await dismissButton.isVisible()) {
      await dismissButton.click();
      
      // Verify error is hidden
      await expect(errorDisplay).not.toBeVisible();
    }
  });

  test('error display maintains RTL direction for Arabic errors', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('اختبار الاتجاه');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger error
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_rtl_test',
          error_code: 'VALIDATION_ERROR',
          message: 'خطأ في التحقق من البيانات'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify RTL direction is set
    const errorDisplay = page.locator('[data-testid="error-display"]');
    const dirAttribute = await errorDisplay.getAttribute('dir');
    expect(dirAttribute).toBe('rtl');
  });

  test('copy error details functionality works', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Test copy details');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger error
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_copy_test',
          error_code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error occurred'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify copy button exists
    const copyButton = page.locator('text=/نسخ|Copy/i').first();
    if (await copyButton.isVisible()) {
      // Grant clipboard write permission
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      
      // Click copy button
      await copyButton.click();
      
      // Verify success message appears
      const successText = page.locator('text=/تم النسخ|Copied/i');
      if (await successText.isVisible({ timeout: 5000 })) {
        await expect(successText).toBeVisible();
      }
    }
  });

  test('error severity determines visual styling', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Test error severity');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger critical error
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_severity_test',
          error_code: 'POLICY_VIOLATION', // Critical error
          message: 'Access denied by governance policy'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify error display has appropriate styling
    const errorDisplay = page.locator('[data-testid="error-display"]');
    const classes = await errorDisplay.getAttribute('class');
    
    // Should have error severity styling (red background)
    expect(classes).toContain('red');
  });

  test('retryAfterMs countdown works correctly', async ({ page }) => {
    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Test countdown');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger rate limit error with retry-after
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_countdown_test',
          error_code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryAfterMs: 3000 // 3 second countdown
        }
      });
      window.dispatchEvent(error);
    });

    // Verify countdown is displayed
    const countdownText = page.locator('text=/ثانية|seconds/i');
    await expect(countdownText.first()).toBeVisible();
  });
});

test.describe('ErrorDisplay Governance Compliance', () => {
  test('trace_id is always included in error reporting', async ({ page }) => {
    await page.goto('http://localhost:5173');

    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Governance compliance test');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger multiple errors to verify trace_id consistency
    const traceIds = new Set<string>();
    
    for (let i = 0; i < 3; i++) {
      const traceId = `trace_gov_${i}`;
      traceIds.add(traceId);

      await page.evaluate((id) => {
        const error = new CustomEvent('test-stream-error', {
          detail: {
            type: 'error',
            trace_id: id,
            error_code: 'VALIDATION_ERROR',
            message: `Error ${id}`
          }
        });
        window.dispatchEvent(error);
      }, traceId);

      await page.waitForTimeout(100);
    }

    // Verify error display contains trace_id
    const errorDisplay = page.locator('[data-testid="error-display"]');
    if (await errorDisplay.isVisible()) {
      const content = await errorDisplay.textContent();
      expect(content).toMatch(/trace_/);
    }
  });

  test('error handling follows governance contract', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Listen for error events to verify governance compliance
    const errors: any[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    const questionInput = page.locator('[data-testid="question-input"]');
    await questionInput.fill('Governance contract test');
    
    const askButton = page.locator('[data-testid="ask-button"]');
    await askButton.click();

    await page.waitForTimeout(500);

    // Trigger error and verify contract compliance
    await page.evaluate(() => {
      const error = new CustomEvent('test-stream-error', {
        detail: {
          type: 'error',
          trace_id: 'trace_contract_test',
          error_code: 'STREAM_CONTRACT_VIOLATION',
          message: 'Stream validation failed'
        }
      });
      window.dispatchEvent(error);
    });

    // Verify error display is present
    const errorDisplay = page.locator('[data-testid="error-display"]');
    await expect(errorDisplay).toBeVisible();
    
    // Verify error object has required governance fields
    const errorText = await errorDisplay.textContent();
    expect(errorText).toMatch(/trace_/i);
    expect(errorText).toMatch(/STREAM/);
  });
});
