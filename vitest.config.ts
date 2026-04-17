import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@hrkit/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@hrkit/polar': path.resolve(__dirname, 'packages/polar/src/index.ts'),
      '@hrkit/react-native': path.resolve(__dirname, 'packages/react-native/src/index.ts'),
      '@hrkit/web': path.resolve(__dirname, 'packages/web/src/index.ts'),
      '@hrkit/server': path.resolve(__dirname, 'packages/server/src/index.ts'),
      '@hrkit/widgets': path.resolve(__dirname, 'packages/widgets/src/index.ts'),
      '@hrkit/integrations': path.resolve(__dirname, 'packages/integrations/src/index.ts'),
      '@hrkit/coach': path.resolve(__dirname, 'packages/coach/src/index.ts'),
      '@hrkit/capacitor': path.resolve(__dirname, 'packages/capacitor/src/index.ts'),
      '@hrkit/edge': path.resolve(__dirname, 'packages/edge/src/index.ts'),
      '@hrkit/ai': path.resolve(__dirname, 'packages/ai/src/index.ts'),
      '@hrkit/ant': path.resolve(__dirname, 'packages/ant/src/index.ts'),
      '@hrkit/cli': path.resolve(__dirname, 'packages/cli/src/index.ts'),
      '@hrkit/capacitor-native': path.resolve(__dirname, 'packages/capacitor-native/src/index.ts'),
      '@hrkit/bundle': path.resolve(__dirname, 'packages/bundle/src/index.ts'),
      '@hrkit/readiness': path.resolve(__dirname, 'packages/readiness/src/index.ts'),
      '@hrkit/sync': path.resolve(__dirname, 'packages/sync/src/index.ts'),
      '@hrkit/otel': path.resolve(__dirname, 'packages/otel/src/index.ts'),
    },
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
        branches: 60,
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
