import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal, deterministic Playwright config targeting headless Chromium.
 * No retries or timeouts beyond defaults to avoid masking contract issues.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
