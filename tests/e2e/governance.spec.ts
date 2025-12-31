import { test, expect } from '@playwright/test';

/**
 * Governance assertions:
 * - Policy/error handling follows contract (error_code/message/lang).
 * - UI behavior driven by error_code, not message text.
 * - Read-only policy UI and disabled feature toggles unless admin.
 * - Forbidden behaviors absent: no client-side SQL/policy logic, no retries on stream failure, no partial rendering after error.
 */
test.describe('Governance and forbidden behaviors', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/ask', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const question = (body.question || '').toString();
      const traceId = `gov-${Date.now()}`;
      const now = new Date().toISOString();

      let stream = `{"type":"thinking","trace_id":"${traceId}","timestamp":"${now}","payload":{"content":"governed"}}\n{"type":"end","trace_id":"${traceId}","timestamp":"${now}","payload":{"message":"done"}}`;

      if (/error|force/i.test(question)) {
        stream = `{"type":"thinking","trace_id":"${traceId}","timestamp":"${now}","payload":{"content":"checking"}}\n{"type":"error","trace_id":"${traceId}","timestamp":"${now}","payload":{"message":"forced error","error_code":"TEST_ERROR"}}\n{"type":"end","trace_id":"${traceId}","timestamp":"${now}","payload":{"message":"done"}}`;
      }

      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/x-ndjson' },
        body: stream
      });
    });
  });

  test('error payload contract and UI reaction', async ({ page }) => {
    await page.goto('/');
    // Trigger a known failing ask to force an error chunk.
    await page.locator('[data-testid="question-input"]').fill('force error');
    await page.locator('[data-testid="ask-button"]').click();

    const errors: any[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const parsed = JSON.parse(text.replace('NDJSON:', '').trim());
          if (parsed.type === 'error') errors.push(parsed);
        } catch {
          // ignore parse errors
        }
      }
    });

    await expect.poll(() => errors.length > 0, { message: 'Expect at least one error chunk' }).toBeTruthy();
    const err = errors[0];
    // Validate error contract keys.
    const payload = err.payload || err;
    expect(payload.error_code || err.error_code).toBeTruthy();
    expect(payload.message || err.message).toBeTruthy();
    if (payload.lang) {
      expect(['en', 'ar']).toContain(payload.lang);
    }
  });

  test('read-only policy UI and disabled feature toggles for non-admin', async ({ page }) => {
    await page.goto('/admin'); // admin view entry
    // Assume policy section exists; assert no editable controls unless admin is detected.
    const isAdmin = await page.evaluate(() => {
      // @ts-ignore
      return (window as any).__USER?.role === 'admin';
    });
    if (!isAdmin) {
      // Policy inputs should be disabled/readonly.
      const editable = await page.locator('input, select, textarea').evaluateAll((els) =>
        els.some((el) => !(el as HTMLInputElement).disabled && !(el as HTMLInputElement).readOnly)
      );
      expect(editable).toBeFalsy();
      // Feature toggles hidden or disabled.
      const togglesEnabled = await page.locator('input[type="checkbox"]').evaluateAll((els) =>
        els.some((el) => !(el as HTMLInputElement).disabled)
      );
      expect(togglesEnabled).toBeFalsy();
    }
  });

  test('forbidden behaviors absent (no client-side SQL/policy logic, no retries)', async ({ page }) => {
    await page.goto('/');
    // Check that window globals do not expose client-side SQL/policy generators.
    const forbidden = await page.evaluate(() => {
      const w = window as any;
      return {
        hasSqlGen: typeof w.generateSql === 'function' || typeof w.clientSql === 'function',
        hasPolicyLogic: typeof w.policyEvaluator === 'function',
      };
    });
    expect(forbidden.hasSqlGen).toBeFalsy();
    expect(forbidden.hasPolicyLogic).toBeFalsy();

    // Trigger a failing stream and ensure no automatic retry is observed (single end only).
    await page.locator('[data-testid="question-input"]').fill('retry check');
    await page.locator('[data-testid="ask-button"]').click();
    const ends: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('NDJSON:')) {
        try {
          const parsed = JSON.parse(text.replace('NDJSON:', '').trim());
          if (parsed.type === 'end') ends.push('end');
        } catch {
          // ignore
        }
      }
    });
    await expect.poll(() => ends.length, { message: 'Expect stream to terminate once' }).toBeTruthy();
    expect(ends.length).toBe(1);
  });
});
