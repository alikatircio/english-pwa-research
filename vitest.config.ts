import { defineConfig } from 'vitest/config';

// Unit tests only: domain rules, content scripts, storage (fake-indexeddb).
// UI flows are covered by Playwright (tests/e2e), so no jsdom here (07 §1, §7).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts'],
    },
  },
});
