import { defineConfig } from 'vitest/config';
import { buildAliases } from './scripts/vitest-aliases.mjs';

export default defineConfig({
  resolve: {
    alias: buildAliases(__dirname),
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.bench.ts', '**/*.d.ts', '**/fixtures/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        // Global minimums.
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
        // Per-package overrides (require higher coverage where the code is most critical).
        // See vitest docs: https://vitest.dev/config/#coverage-thresholds
        'packages/core/src/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'packages/coach/src/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'packages/polar/src/**': {
          lines: 85,
          functions: 85,
          branches: 70,
          statements: 85,
        },
        'packages/web/src/**': {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
        'packages/react-native/src/**': {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
        'packages/server/src/**': {
          lines: 85,
          functions: 90,
          branches: 85,
          statements: 85,
        },
        'packages/sync/src/**': {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  },
});
