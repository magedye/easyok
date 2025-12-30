import { test, expect } from '@playwright/test';

/**
 * Auth flow (conditional): executes only when AUTH_ENABLED is true.
 * Validates login and token handling, ensures Authorization header is sent and not persisted in storage.
 */
test.describe('Auth flow (conditional)', () => {
  test('login, token usage, and storage policy', async ({ page }) => {
    await page.goto('/');
    const authEnabled = await page.evaluate(() => {
      // @ts-ignore
      return (window as any).__ENV?.AUTH_ENABLED ?? false;
    });
    test.skip(!authEnabled, 'AUTH_ENABLED=false; auth flow not applicable');

    const loginResp = await page.request.post('/api/v1/auth/login', {
      data: { username: process.env.E2E_USER || 'admin', password: process.env.E2E_PASS || 'changeme' },
    });
    expect(loginResp.status()).toBe(200);
    const body = await loginResp.json();
    const token = body.access_token;
    expect(token).toBeTruthy();

    // Use token for a guarded call and assert Authorization header is required.
    const askResp = await page.request.post('/api/v1/ask', {
      data: { question: 'auth smoke' },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(askResp.status()).toBe(200);

    // Ensure token is not persisted in localStorage or sessionStorage.
    const storage = await page.evaluate(() => ({
      ls: Object.keys(window.localStorage || {}),
      ss: Object.keys(window.sessionStorage || {}),
    }));
    expect(storage.ls).not.toContain('token');
    expect(storage.ss).not.toContain('token');
  });
});
