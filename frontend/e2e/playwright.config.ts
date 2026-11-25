import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive a real browser against a running app backed by Postgres. Locally that's
 * the usual dev setup (backend + `npm run dev`, see "Running tests" in the README); CI builds the
 * jar with the client inside and sets E2E_BASE_URL to it.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry in CI so a slow runner doesn't fail the build; the report still flags it as flaky.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
