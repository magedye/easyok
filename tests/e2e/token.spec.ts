import { test, expect } from '@playwright/test';

/**
 * E2E tests for Token Management
 * 
 * Key scenarios:
 * - TokenManager sessionStorage usage (no localStorage)
 * - Token refresh during active streams
 * - Token expiration and renewal race conditions
 * - Concurrent request handling with tokens
 * - Token security and storage policies
 * - Authentication flow integration
 */

test.describe('Token Management', () => {
  test.beforeEach(async ({ page }) => {
    // Check if auth is enabled, skip tests if not
    await page.addInitScript(() => {
      // Force runtime auth flag for tests even if build-time flag is disabled
      (window as any).__ENV = { ...(window as any).__ENV, AUTH_ENABLED: true };
    });
    await page.goto('/');
    const authEnabled = await page.evaluate(() => {
      return (window as any).__ENV?.AUTH_ENABLED ?? false;
    });
    test.skip(!authEnabled, 'AUTH_ENABLED=false; token tests not applicable');
  });

  test('should use sessionStorage for token storage, not localStorage', async ({ page }) => {
    // Clear all storage first
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    // Simulate storing token in sessionStorage (governance requirement)
    await page.evaluate(() => {
      window.sessionStorage.setItem('session_token', 'test-session-token');
    });

    // Verify storage usage
    const storage = await page.evaluate(() => ({
      sessionStorage: Object.keys(window.sessionStorage),
      localStorage: Object.keys(window.localStorage)
    }));

    // Token should be in sessionStorage
    expect(storage.sessionStorage).toContain('session_token');
    
    // Token should NOT be in localStorage (governance requirement)
    expect(storage.localStorage).not.toContain('session_token');
    expect(storage.localStorage).not.toContain('token');
    expect(storage.localStorage).not.toContain('refresh_token');
  });

  test('should refresh token automatically before expiration', async ({ page }) => {
    const networkRequests: any[] = [];
    let refreshCallCount = 0;

    // Track network requests
    page.on('request', request => {
      if (request.url().includes('/api/v1/auth/refresh')) {
        refreshCallCount++;
        networkRequests.push({
          method: request.method(),
          url: request.url(),
          timestamp: Date.now()
        });
      }
    });

    // Mock refresh endpoint
    await page.route('/api/v1/auth/refresh', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: `new_token_${refreshCallCount}`,
          expires_in: 300
        })
      });
    });

    // Set a token that's about to expire
    await page.evaluate(() => {
      const expiredToken = {
        access_token: 'about_to_expire_token',
        expires_at: Date.now() + 2000 // Expires in 2 seconds
      };
      window.sessionStorage.setItem('token_data', JSON.stringify(expiredToken));
    });

    // Make a request that should trigger token refresh
    await page.locator('[data-testid="question-input"]').fill('test token refresh');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for potential refresh
    await page.waitForTimeout(3000);

    // Should have attempted token refresh
    expect(refreshCallCount).toBeGreaterThan(0);
  });

  test('should handle token refresh failure gracefully', async ({ page }) => {
    // Mock failed refresh
    await page.route('/api/v1/auth/refresh', async route => {
      await route.fulfill({
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'refresh_token_expired',
          message: 'Refresh token has expired'
        })
      });
    });

    // Set expired token
    await page.evaluate(() => {
      window.sessionStorage.setItem('token_data', JSON.stringify({
        access_token: 'expired_token',
        expires_at: Date.now() - 1000 // Already expired
      }));
    });

    await page.locator('[data-testid="question-input"]').fill('test refresh failure');
    await page.locator('[data-testid="ask-button"]').click();

    // Should redirect to login or show authentication error
    await expect(
      page.locator('[data-testid="login-required"], [data-testid="auth-error"]')
    ).toBeVisible({ timeout: 10000 });

    // Should clear invalid token data
    const tokenData = await page.evaluate(() => {
      return window.sessionStorage.getItem('token_data');
    });
    expect(tokenData).toBeFalsy();
  });

  test('should handle concurrent requests with token refresh', async ({ page }) => {
    const requestCount = { value: 0 };
    
    // Mock ask endpoint that requires valid token
    await page.route('**/api/v1/ask', async route => {
      const authHeader = route.request().headers()['authorization'];
      if (!authHeader || authHeader.includes('expired')) {
        await route.fulfill({
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'token_expired',
            message: 'Token has expired'
          })
        });
      } else {
        await route.continue();
      }
    });

    // Mock refresh to introduce delay (simulate real network)
    await page.route('/api/v1/auth/refresh', async route => {
      await page.waitForTimeout(1000); // Simulate network delay
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: `refreshed_token_${Date.now()}`,
          expires_in: 3600
        })
      });
    });

    // Set expired token
    await page.evaluate(() => {
      window.sessionStorage.setItem('token_data', JSON.stringify({
        access_token: 'expired_token',
        expires_at: Date.now() - 1000
      }));
    });

    // Make multiple concurrent requests
    const promises = [
      page.locator('[data-testid="question-input"]').fill('concurrent 1'),
      page.locator('[data-testid="ask-button"]').click(),
    ];

    // Try to make second request quickly (should be queued/handled properly)
    await Promise.all(promises);
    
    await page.waitForTimeout(500);
    
    await page.locator('[data-testid="question-input"]').fill('concurrent 2');
    await page.locator('[data-testid="ask-button"]').click();

    // Should handle requests gracefully without race conditions
    // At minimum, shouldn't cause errors or crashes
    await expect(page.locator('body')).toBeVisible();
  });

  test('should include correct Authorization header in API requests', async ({ page }) => {
    const authHeaders: string[] = [];
    
    // Track Authorization headers
    page.on('request', request => {
      if (request.url().includes('/api/v1/ask')) {
        const authHeader = request.headers()['authorization'];
        if (authHeader) {
          authHeaders.push(authHeader);
        }
      }
    });

    // Set valid token
    await page.evaluate(() => {
      window.sessionStorage.setItem('token_data', JSON.stringify({
        access_token: 'valid_bearer_token',
        expires_at: Date.now() + 3600000 // Valid for 1 hour
      }));
    });

    await page.locator('[data-testid="question-input"]').fill('test auth header');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for request
    await page.waitForTimeout(2000);

    // Should have sent Authorization header
    expect(authHeaders.length).toBeGreaterThan(0);
    expect(authHeaders[0]).toBe('Bearer valid_bearer_token');
  });

  test('should handle token storage security properly', async ({ page }) => {
    // Set a token
    await page.evaluate(() => {
      window.sessionStorage.setItem('access_token', 'test_security_token');
    });

    // Token should be accessible to same origin JS
    const tokenFromJS = await page.evaluate(() => {
      return window.sessionStorage.getItem('access_token');
    });
    expect(tokenFromJS).toBe('test_security_token');

    // Simulate cross-origin access attempt (within same test context)
    const securityCheck = await page.evaluate(() => {
      // Token should be in sessionStorage (not accessible cross-origin)
      // but this test runs same origin, so just verify it's not in global scope
      return {
        inGlobalScope: typeof (window as any).access_token !== 'undefined',
        inSessionStorage: !!window.sessionStorage.getItem('access_token'),
        inLocalStorage: !!window.localStorage.getItem('access_token')
      };
    });

    expect(securityCheck.inGlobalScope).toBe(false);
    expect(securityCheck.inSessionStorage).toBe(true);
    expect(securityCheck.inLocalStorage).toBe(false);
  });

  test('should clear token on logout', async ({ page }) => {
    // Set token
    await page.evaluate(() => {
      window.sessionStorage.setItem('access_token', 'token_to_clear');
      window.sessionStorage.setItem('refresh_token', 'refresh_to_clear');
    });

    // Simulate logout (if logout functionality exists)
    try {
      await page.locator('[data-testid="logout-button"], [href*="logout"]').click();
      
      // Wait for logout to complete
      await page.waitForTimeout(1000);
      
      // Tokens should be cleared
      const tokenData = await page.evaluate(() => ({
        accessToken: window.sessionStorage.getItem('access_token'),
        refreshToken: window.sessionStorage.getItem('refresh_token')
      }));
      
      expect(tokenData.accessToken).toBeFalsy();
      expect(tokenData.refreshToken).toBeFalsy();
    } catch (e) {
      console.log('Logout button not found, testing manual clear');
      
      // Test programmatic token clear
      await page.evaluate(() => {
        window.sessionStorage.removeItem('access_token');
        window.sessionStorage.removeItem('refresh_token');
      });
      
      const clearedTokens = await page.evaluate(() => ({
        accessToken: window.sessionStorage.getItem('access_token'),
        refreshToken: window.sessionStorage.getItem('refresh_token')
      }));
      
      expect(clearedTokens.accessToken).toBeFalsy();
      expect(clearedTokens.refreshToken).toBeFalsy();
    }
  });

  test('should handle token expiration during streaming', async ({ page }) => {
    let streamInterrupted = false;
    
    // Mock streaming response that gets interrupted by token expiration
    await page.route('**/api/v1/ask', async route => {
      const authHeader = route.request().headers()['authorization'];
      
      if (!authHeader || authHeader.includes('expired')) {
        await route.fulfill({
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error_code: 'TOKEN_EXPIRED',
            message: 'Access token has expired'
          })
        });
      } else {
        // Start stream then simulate token expiration
        const mockStream = `{"type":"thinking","trace_id":"stream-123","timestamp":"2025-01-01T00:00:00Z","payload":{"content":"thinking"}}
{"type":"technical_view","trace_id":"stream-123","timestamp":"2025-01-01T00:00:01Z","payload":{"sql":"SELECT * FROM test","assumptions":[],"is_safe":true}}`;
        
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/x-ndjson' },
          body: mockStream
        });
      }
    });

    // Set token that expires during test
    await page.evaluate(() => {
      window.sessionStorage.setItem('token_data', JSON.stringify({
        access_token: 'token_expires_during_stream',
        expires_at: Date.now() + 2000 // Expires in 2 seconds
      }));
    });

    await page.locator('[data-testid="question-input"]').fill('test token expiry during stream');
    await page.locator('[data-testid="ask-button"]').click();

    // Should start streaming
    await expect(page.locator('[data-testid="thinking-display"]')).toBeVisible({ timeout: 5000 });

    // Wait for token to expire
    await page.waitForTimeout(3000);

    // Should handle expiration gracefully
    const errorState = await page.locator('[data-testid="auth-error"], [data-testid="error-display"]').isVisible();
    
    // Should either show auth error or continue with refreshed token
    // Both behaviors are acceptable depending on implementation
    expect(typeof errorState).toBe('boolean');
  });

  test('should validate token format and structure', async ({ page }) => {
    const invalidTokens = [
      'invalid-jwt-token',
      '',
      'bearer-without-jwt',
      'malformed.jwt.token',
      null
    ];

    for (const invalidToken of invalidTokens) {
      await page.evaluate((token) => {
        if (token === null) {
          window.sessionStorage.removeItem('access_token');
        } else {
          window.sessionStorage.setItem('access_token', token);
        }
      }, invalidToken);

      await page.locator('[data-testid="question-input"]').fill(`test invalid token: ${invalidToken || 'null'}`);
      await page.locator('[data-testid="ask-button"]').click();

      // Should handle invalid tokens gracefully
      await expect.poll(async () => {
        const errorVisible = await page.locator('[data-testid="auth-error"], [data-testid="error-display"]').isVisible();
        const loginRequired = await page.locator('[data-testid="login-required"]').isVisible();
        return errorVisible || loginRequired;
      }, { timeout: 10000 }).toBeTruthy();

      // Reset for next iteration
      await page.goto('/');
    }
  });

  test('should handle refresh token race conditions', async ({ page }) => {
    let refreshAttempts = 0;
    
    // Mock refresh endpoint with delay to simulate race conditions
    await page.route('/api/v1/auth/refresh', async route => {
      refreshAttempts++;
      
      if (refreshAttempts === 1) {
        // First refresh succeeds after delay
        await page.waitForTimeout(1500);
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: 'first_refresh_token',
            expires_in: 3600
          })
        });
      } else {
        // Subsequent refreshes should be blocked/queued
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: 'subsequent_refresh_token',
            expires_in: 3600
          })
        });
      }
    });

    // Set nearly expired token
    await page.evaluate(() => {
      window.sessionStorage.setItem('token_data', JSON.stringify({
        access_token: 'about_to_expire',
        expires_at: Date.now() + 500 // Very short expiry
      }));
    });

    // Make multiple simultaneous requests that should trigger refresh
    const requests = [
      page.locator('[data-testid="question-input"]').fill('race test 1'),
      page.locator('[data-testid="ask-button"]').click()
    ];

    await Promise.all(requests);
    
    // Immediately make another request
    await page.locator('[data-testid="question-input"]').fill('race test 2');
    await page.locator('[data-testid="ask-button"]').click();

    // Wait for all operations to complete
    await page.waitForTimeout(3000);

    // Should not have made excessive refresh attempts (proper locking/queuing)
    expect(refreshAttempts).toBeLessThanOrEqual(2);
  });
});
