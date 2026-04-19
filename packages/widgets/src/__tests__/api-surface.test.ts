// @vitest-environment happy-dom
/**
 * Public API surface snapshot for @hrkit/widgets.
 * Separated from api-surface.test.ts because widgets requires a DOM env.
 */
import { describe, expect, it } from 'vitest';

describe('public API surface (DOM)', () => {
  it('@hrkit/widgets exports', async () => {
    const mod = await import('@hrkit/widgets');
    const symbols = Object.keys(mod)
      .filter((k) => k !== 'default')
      .sort();
    expect(symbols).toMatchSnapshot();
  });
});
