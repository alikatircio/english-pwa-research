import { defineConfig } from 'vitest/config';

// Unit tests only: domain rules, content scripts, storage (fake-indexeddb).
// UI flows are covered by Playwright (tests/e2e), so no jsdom here (07 §1, §7).
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __BUILD_DATE__: JSON.stringify('2026-01-02'),
    __GIT_SHA__: JSON.stringify('abc1234'),
    __CONTENT_VERSION__: JSON.stringify('contentv1'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Every layer with unit tests (review 09 #13); .tsx UI is covered by Playwright.
      include: ['src/domain/**/*.ts', 'src/storage/**/*.ts', 'src/app/**/*.ts', 'src/pwa/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
