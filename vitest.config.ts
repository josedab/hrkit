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
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/fixtures/**', '**/dist/**'],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        // Global minimums.
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
        // Per-package overrides (require higher coverage where the code is most critical).
        // See vitest docs: https://vitest.dev/config/#coverage-thresholds
        'packages/core/src/**': {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
        'packages/polar/src/**': {
          lines: 75,
          functions: 75,
          branches: 65,
          statements: 75,
        },
      },
    },
  },
});
