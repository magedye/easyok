import { test, expect } from '@playwright/test';

/**
 * Flow A — Query Execution (/api/v1/ask)
 * Validates NDJSON streaming order, error termination, and absence of post-error rendering.
 */
test.describe('Flow A — /api/v1/ask NDJSON streaming', () => {
  test('streams thinking → (optional) → end OR thinking → error → end with no post-end renders', async ({ page }) => {
    // Read runtime config from window/__env or process; default AUTH_DISABLED path.
    await page.goto('/');
    const authEnabled = await page.evaluate(() => {
      // Assumes frontend exposes runtime env via global or similar; fallback to false.
      // This is read-only: no mutation of app state.
      // @ts-ignore
      return (window as any).__ENV?.AUTH_ENABLED ?? false;
    });

    // Optional login when AUTH is enabled.
    let token: string | undefined;
    if (authEnabled) {
      const loginResp = await page.request.post('/api/v1/auth/login', {
        data: { username: process.env.E2E_USER || 'admin', password: process.env.E2E_PASS || 'changeme' },
      });
      expect(loginResp.status()).toBe(200);
      const body = await loginResp.json();
      token = body.access_token;
      expect(token).toBeTruthy();
    }

    // Invoke /ask via frontend UI (preferred) or direct request as fallback.
    // Here we exercise the UI to validate incremental rendering and termination behavior.
    const question = 'اختبار التدفق';
    await page.locator('input[name="question"]').fill(question);
    await page.locator('button:has-text("Ask")').click();

    // Collect NDJSON chunks by observing frontend log hook.
    const received: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        received.push(text.replace('NDJSON:', '').trim());
      }
    });

    // Wait for stream to terminate on "end" chunk; avoid arbitrary sleeps.
    await expect.poll(async () => received.some((c) => c.includes('"type":"end"')), {
      message: 'Stream should terminate with an end chunk',
    }).toBeTruthy();

    // Validate ordering rules.
    const types = received
      .map((line) => {
        try {
          return JSON.parse(line).type;
        } catch {
          return '';
        }
      })
      .filter(Boolean);

    // Must start with thinking.
    expect(types[0]).toBe('thinking');
    // Must contain end as last.
    expect(types[types.length - 1]).toBe('end');

    // If an error occurs, it must be before end and no data after error.
    const errorIdx = types.indexOf('error');
    if (errorIdx !== -1) {
      expect(errorIdx).toBeLessThan(types.length - 1);
      const postError = types.slice(errorIdx + 1, types.length - 1);
      expect(postError).toHaveLength(0);
    }

    // No retry logic: ensure only a single stream terminates with one end.
    expect(types.filter((t) => t === 'end')).toHaveLength(1);
  });
});
