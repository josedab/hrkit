import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLogger, getLogger, NoopLogger, REDACTED, redact, setLogger } from '../logger.js';

afterEach(() => {
  setLogger(NoopLogger);
});

describe('logger registry', () => {
  it('defaults to NoopLogger', () => {
    expect(getLogger()).toBe(NoopLogger);
  });

  it('setLogger swaps the active logger', () => {
    const custom = { ...NoopLogger };
    setLogger(custom);
    expect(getLogger()).toBe(custom);
  });

  it('ConsoleLogger redacts metadata before forwarding', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    setLogger(ConsoleLogger);
    getLogger().info('upload', { token: 'abc123', user: 'alice' });
    expect(spy).toHaveBeenCalledWith('upload', { token: REDACTED, user: 'alice' });
    spy.mockRestore();
  });
});

describe('redact', () => {
  it('replaces values for sensitive keys', () => {
    const out = redact({
      apiKey: 'secret',
      api_key: 'secret',
      authorization: 'Bearer abc',
      password: 'hunter2',
      refresh_token: 'rt',
      user: 'alice',
    });
    expect(out).toEqual({
      apiKey: REDACTED,
      api_key: REDACTED,
      authorization: REDACTED,
      password: REDACTED,
      refresh_token: REDACTED,
      user: 'alice',
    });
  });

  it('redacts bearer-shaped header values regardless of key name', () => {
    const out = redact({ headerX: 'Bearer xyz' });
    expect(out).toEqual({ headerX: REDACTED });
  });

  it('redacts inline secrets in free-form strings', () => {
    const out = redact('failed: Authorization=Bearer abc and api_key=xyz123');
    expect(out).toContain(REDACTED);
    expect(out).not.toContain('Bearer abc');
    expect(out).not.toContain('xyz123');
  });

  it('handles cyclic objects without infinite loops', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    const out = redact(a) as Record<string, unknown>;
    expect(out.name).toBe('a');
    expect(out.self).toBe(REDACTED);
  });

  it('passes through primitives unchanged', () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
    expect(redact(true)).toBe(true);
  });

  it('redacts inside arrays', () => {
    const out = redact([{ token: 'x' }, { ok: 1 }]);
    expect(out).toEqual([{ token: REDACTED }, { ok: 1 }]);
  });

  it('handles Date objects', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    const out = redact({ created: d });
    expect(out.created).toBe('2024-01-01T00:00:00.000Z');
  });

  it('handles RegExp objects', () => {
    const out = redact({ pattern: /abc/gi });
    expect(out.pattern).toBe('/abc/gi');
  });

  it('handles Map objects', () => {
    const out = redact({ data: new Map([['a', 1]]) });
    expect(out.data).toBe('[Map(1)]');
  });

  it('handles Set objects', () => {
    const out = redact({ items: new Set([1, 2, 3]) });
    expect(out.items).toBe('[Set(3)]');
  });
});

describe('setLogger validation', () => {
  it('throws TypeError for null', () => {
    expect(() => setLogger(null as never)).toThrow(TypeError);
  });

  it('throws TypeError for non-object', () => {
    expect(() => setLogger('string' as never)).toThrow(TypeError);
  });

  it('throws TypeError for object missing methods', () => {
    expect(() => setLogger({ debug: () => {} } as never)).toThrow(TypeError);
  });

  it('accepts valid Logger implementation', () => {
    expect(() => setLogger(ConsoleLogger)).not.toThrow();
  });
});
