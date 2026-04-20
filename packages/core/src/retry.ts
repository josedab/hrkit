/**
 * Generic retry / backoff / timeout primitives shared by BLE and HTTP layers.
 *
 * Design goals:
 *   - Zero deps, runs anywhere (browser, Node, Deno, Bun, Workers, RN).
 *   - Composable: `retry(timeout(op, 5_000), { ... })` is the canonical pattern.
 *   - Cancellable via `AbortSignal`; aborts skip the next sleep and re-throw.
 *   - Predictable: full jitter is the default per AWS Architecture Blog
 *     ("Exponential Backoff And Jitter", Mar 2015).
 */

import { HRKitError, TimeoutError } from './errors.js';

/** Configuration for {@link retry}. */
export interface RetryOptions {
  /** Maximum total attempts (including the first). Default: 5. */
  maxAttempts?: number;
  /** Initial delay before the first retry, in ms. Default: 1000. */
  initialDelayMs?: number;
  /** Cap for any single delay after backoff. Default: 30_000. */
  maxDelayMs?: number;
  /** Backoff multiplier applied per attempt. Default: 2. */
  backoffMultiplier?: number;
  /**
   * Jitter mode. `'full'` randomizes in `[0, computedDelay]`,
   * `'equal'` randomizes in `[d/2, d]`, `'none'` disables.
   * Default: `'full'`.
   */
  jitter?: 'none' | 'full' | 'equal';
  /**
   * Predicate to decide if a given error should be retried.
   * Default: retry every error.
   */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  /** Optional notification hook called before each sleep. */
  onRetry?: (info: { error: unknown; attempt: number; delayMs: number }) => void;
  /** Cancel any pending retry sleep. */
  signal?: AbortSignal;
  /** Override the random source (mainly for tests). */
  random?: () => number;
}

/**
 * Run {@link op} with exponential backoff. Resolves with the first successful
 * value; rejects with the last error after `maxAttempts` attempts or when
 * `shouldRetry` returns false.
 *
 * @example
 * ```ts
 * await retry(() => fetch(url), { maxAttempts: 3, signal: ac.signal });
 * ```
 */
export async function retry<T>(op: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 5,
    initialDelayMs = 1000,
    maxDelayMs = 30_000,
    backoffMultiplier = 2,
    jitter = 'full',
    shouldRetry = () => true,
    onRetry,
    signal,
    random = Math.random,
  } = options;

  if (maxAttempts < 1) throw new RangeError('retry: maxAttempts must be >= 1');

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw signalAbortError(signal);
    try {
      return await op();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) {
        throw err;
      }
      const base = Math.min(initialDelayMs * backoffMultiplier ** (attempt - 1), maxDelayMs);
      const delay = applyJitter(base, jitter, random);
      onRetry?.({ error: err, attempt, delayMs: delay });
      await sleep(delay, signal);
    }
  }
  // Unreachable — loop either returns or throws — but TS needs it.
  throw lastError;
}

/**
 * Race {@link op} against a deadline. Resolves/rejects with the inner result
 * if it finishes first; otherwise rejects with a typed timeout error.
 *
 * The inner operation is **not** automatically cancelled — pass an
 * `AbortSignal` into your op to wire actual cancellation.
 */
export async function timeout<T>(
  op: () => Promise<T>,
  ms: number,
  message = `operation timed out after ${ms}ms`,
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) throw new RangeError('timeout: ms must be a positive number');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      op(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(message)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Sleep for {@link ms} milliseconds. Resolves early (rejecting) when
 * {@link signal} aborts.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return signal?.aborted ? Promise.reject(signalAbortError(signal)) : Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signalAbortError(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signalAbortError(signal!));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function applyJitter(base: number, mode: 'none' | 'full' | 'equal', random: () => number): number {
  switch (mode) {
    case 'none':
      return base;
    case 'equal':
      return base / 2 + random() * (base / 2);
    default:
      return random() * base;
  }
}

function signalAbortError(signal: AbortSignal): Error {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) return reason;
  return new HRKitError('aborted', 'ABORTED');
}
