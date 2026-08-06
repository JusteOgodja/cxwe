import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config.
 * - Public E2E run against BASE_URL (Deploy Preview or a local `vite preview`).
 *   READ-ONLY: they never submit forms against a preview (which uses prod Supabase).
 * - Security-regression tests run at API level against a LOCAL Supabase stack only
 *   (SUPABASE_URL/SUPABASE_ANON_KEY env); they self-skip when not configured.
 */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
