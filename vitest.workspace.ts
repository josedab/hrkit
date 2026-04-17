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
  {
    test: {
      name: 'integrations',
      include: ['packages/integrations/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'coach',
      include: ['packages/coach/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'capacitor',
      include: ['packages/capacitor/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'edge',
      include: ['packages/edge/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'ai',
      include: ['packages/ai/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'ant',
      include: ['packages/ant/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'cli',
      include: ['packages/cli/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'capacitor-native',
      include: ['packages/capacitor-native/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'bundle',
      include: ['packages/bundle/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'dashboard',
      include: ['apps/dashboard/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'readiness',
      include: ['packages/readiness/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'sync',
      include: ['packages/sync/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'otel',
      include: ['packages/otel/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
]);
