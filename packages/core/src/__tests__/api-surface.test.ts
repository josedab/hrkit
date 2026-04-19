/**
 * Public API surface snapshot.
 *
 * Imports every published package's barrel and snapshots the sorted list of
 * exported symbol names. A failing snapshot signals that the public surface
 * changed — accept the diff intentionally and add a Changeset entry under
 * `Added`, `Changed`, or `Removed` (see docs/CHANGELOG-CONVENTIONS.md).
 *
 * This guard prevents accidental:
 *   - Removal/rename of public symbols (breaking change without a major)
 *   - Leakage of internal helpers through the package root
 *
 * Note: `@hrkit/widgets` requires a DOM and is snapshotted in
 * `widgets-api-surface.test.ts` (happy-dom env).
 */

import { describe, expect, it } from 'vitest';

const PACKAGES = [
  '@hrkit/ai',
  '@hrkit/ant',
  '@hrkit/bundle',
  '@hrkit/capacitor',
  '@hrkit/capacitor-native',
  '@hrkit/cli',
  '@hrkit/coach',
  '@hrkit/core',
  '@hrkit/edge',
  '@hrkit/integrations',
  '@hrkit/ml',
  '@hrkit/otel',
  '@hrkit/polar',
  '@hrkit/react-native',
  '@hrkit/readiness',
  '@hrkit/server',
  '@hrkit/sync',
  '@hrkit/web',
] as const;

function symbolsOf(mod: Record<string, unknown>): string[] {
  return Object.keys(mod)
    .filter((k) => k !== 'default')
    .sort();
}

describe('public API surface', () => {
  for (const pkg of PACKAGES) {
    it(`${pkg} exports`, async () => {
      const mod = await import(pkg);
      expect(symbolsOf(mod)).toMatchSnapshot();
    });
  }
});
