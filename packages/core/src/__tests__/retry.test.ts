import { describe, expect, it, vi } from 'vitest';
import { TimeoutError } from '../errors.js';
import { retry, sleep, timeout } from '../retry.js';

describe('retry', () => {
  it('returns on first success without delay', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    expect(await retry(op)).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts then throws the last error', async () => {
    const op = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(retry(op, { maxAttempts: 3, initialDelayMs: 1, jitter: 'none' })).rejects.toThrow('boom');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('honors shouldRetry to abort early', async () => {
    const op = vi.fn().mockRejectedValue(new Error('non-retryable'));
    await expect(retry(op, { maxAttempts: 5, shouldRetry: () => false, initialDelayMs: 1 })).rejects.toThrow(
      'non-retryable',
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry between attempts', async () => {
    const op = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok');
    const onRetry = vi.fn();
    expect(await retry(op, { initialDelayMs: 1, jitter: 'none', onRetry })).toBe('ok');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[0]).toMatchObject({ attempt: 1, delayMs: 1 });
  });

  it('aborts mid-sleep when signal fires', async () => {
    const op = vi.fn().mockRejectedValue(new Error('x'));
    const ac = new AbortController();
    const p = retry(op, { maxAttempts: 5, initialDelayMs: 5_000, signal: ac.signal });
    setTimeout(() => ac.abort(), 5);
    await expect(p).rejects.toThrow();
  });

  it('jitter=full produces values within [0, base]', async () => {
    const op = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok');
    let captured = -1;
    await retry(op, {
      initialDelayMs: 100,
      jitter: 'full',
      random: () => 0.5,
      onRetry: (info) => {
        captured = info.delayMs;
      },
    });
    expect(captured).toBe(50);
  });

  it('rejects when maxAttempts < 1', async () => {
    await expect(retry(async () => 1, { maxAttempts: 0 })).rejects.toThrow(RangeError);
  });
});

describe('timeout', () => {
  it('resolves the inner value when fast enough', async () => {
    const v = await timeout(async () => 'ok', 50);
    expect(v).toBe('ok');
  });

  it('rejects with TimeoutError after deadline', async () => {
    await expect(timeout(() => new Promise((r) => setTimeout(() => r('late'), 50)), 5)).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it('clears timer on success (no leaked handles)', async () => {
    const start = Date.now();
    await timeout(async () => 'ok', 1_000);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('rejects when ms <= 0', async () => {
    await expect(timeout(async () => 1, 0)).rejects.toThrow(RangeError);
  });
});

describe('sleep', () => {
  it('resolves after the requested delay', async () => {
    const t0 = Date.now();
    await sleep(20);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(15);
  });

  it('rejects when signal aborts mid-sleep', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 5);
    await expect(sleep(1_000, ac.signal)).rejects.toThrow();
  });

  it('rejects immediately when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(sleep(50, ac.signal)).rejects.toThrow();
  });
});
