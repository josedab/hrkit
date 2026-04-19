import { describe, expect, it, vi } from 'vitest';
import { type FetchLike, parseRetryAfter, withRetry } from '../providers/index.js';

const okResponse = (status = 200, headers?: Record<string, string>) => ({
  ok: status < 400,
  status,
  headers: { get: (n: string) => headers?.[n.toLowerCase()] ?? null },
  text: async () => '',
  json: async () => ({}),
});

describe('parseRetryAfter', () => {
  it('parses delta-seconds', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter('  10  ')).toBe(10_000);
  });

  it('parses HTTP-date', () => {
    const future = new Date(Date.now() + 2_000).toUTCString();
    const v = parseRetryAfter(future);
    expect(v).not.toBeNull();
    expect(v ?? 0).toBeGreaterThan(0);
    expect(v ?? 0).toBeLessThanOrEqual(2_500);
  });

  it('returns null for missing/garbage', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('not-a-date')).toBeNull();
  });
});

describe('withRetry', () => {
  it('passes through 200 immediately', async () => {
    const inner = vi.fn(async () => okResponse(200)) as unknown as FetchLike;
    const wrapped = withRetry(inner, { sleep: async () => {} });
    const res = await wrapped('https://example.com');
    expect(res.status).toBe(200);
    expect((inner as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
  });

  it('retries 503 then succeeds', async () => {
    const seq = [503, 503, 200];
    let i = 0;
    const inner = vi.fn(async () => okResponse(seq[i++])) as unknown as FetchLike;
    const wrapped = withRetry(inner, { maxRetries: 3, baseDelayMs: 1, sleep: async () => {} });
    const res = await wrapped('https://example.com');
    expect(res.status).toBe(200);
    expect((inner as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(3);
  });

  it('honors Retry-After header', async () => {
    const seq = [okResponse(429, { 'retry-after': '1' }), okResponse(200)];
    let i = 0;
    const inner = vi.fn(async () => seq[i++]) as unknown as FetchLike;
    const sleeps: number[] = [];
    const wrapped = withRetry(inner, {
      maxRetries: 1,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    const res = await wrapped('https://example.com');
    expect(res.status).toBe(200);
    expect(sleeps).toEqual([1000]);
  });

  it('gives up after maxRetries', async () => {
    const inner = vi.fn(async () => okResponse(503)) as unknown as FetchLike;
    const wrapped = withRetry(inner, { maxRetries: 2, baseDelayMs: 1, sleep: async () => {} });
    const res = await wrapped('https://example.com');
    expect(res.status).toBe(503);
    expect((inner as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(3);
  });

  it('does not retry non-retryable status (e.g. 400)', async () => {
    const inner = vi.fn(async () => okResponse(400)) as unknown as FetchLike;
    const wrapped = withRetry(inner, { maxRetries: 3, sleep: async () => {} });
    const res = await wrapped('https://example.com');
    expect(res.status).toBe(400);
    expect((inner as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
  });

  it('aborts immediately when signal is already aborted', async () => {
    const inner = vi.fn(async () => okResponse(200)) as unknown as FetchLike;
    const ctrl = new AbortController();
    ctrl.abort();
    const wrapped = withRetry(inner, { sleep: async () => {} });
    await expect(wrapped('https://example.com', { signal: ctrl.signal })).rejects.toThrow('aborted');
  });
});
