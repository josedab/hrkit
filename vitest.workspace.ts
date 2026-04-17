import path from 'node:path';
import { defineWorkspace } from 'vitest/config';

const aliases = {
  '@hrkit/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
  '@hrkit/core/profiles': path.resolve(__dirname, 'packages/core/src/profiles/index.ts'),
  '@hrkit/polar': path.resolve(__dirname, 'packages/polar/src/index.ts'),
  '@hrkit/react-native': path.resolve(__dirname, 'packages/react-native/src/index.ts'),
  '@hrkit/web': path.resolve(__dirname, 'packages/web/src/index.ts'),
  '@hrkit/server': path.resolve(__dirname, 'packages/server/src/index.ts'),
  '@hrkit/widgets': path.resolve(__dirname, 'packages/widgets/src/index.ts'),
};

/**
 * Vitest workspace — one project per package.
 *
 * Run a single project: `pnpm test --project core` or `pnpm test --project widgets`.
 *
 * Coverage is collected at the root via the main vitest.config.ts. Per-package
 * thresholds are configured there using glob keys under `coverage.thresholds`.
 */
export default defineWorkspace([
  {
    test: {
      name: 'core',
      include: ['packages/core/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'polar',
      include: ['packages/polar/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'react-native',
      include: ['packages/react-native/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'web',
      include: ['packages/web/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'server',
      include: ['packages/server/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'widgets',
      include: ['packages/widgets/src/**/*.test.ts'],
      // Widgets test files opt into happy-dom via `// @vitest-environment happy-dom`.
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
]);
