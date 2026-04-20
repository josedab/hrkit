import { defineWorkspace } from 'vitest/config';
import { buildAliases } from './scripts/vitest-aliases.mjs';

const aliases = buildAliases(__dirname);

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
  {
    test: {
      name: 'ml',
      include: ['packages/ml/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
  {
    test: {
      name: 'cloud-api',
      include: ['apps/cloud-api/src/**/*.test.ts'],
      environment: 'node',
    },
    resolve: { alias: aliases },
  },
]);
