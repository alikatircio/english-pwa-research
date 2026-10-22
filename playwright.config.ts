import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets parallel checkouts (agent worktrees) run the suite side by side.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_PATH = '/english-pwa-research/';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Default target: every spec runs here.
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
    // Required gate for offline/SW specs; second browser for the rest.
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build:e2e && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
