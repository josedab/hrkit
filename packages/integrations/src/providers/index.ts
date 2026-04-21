import { getLogger, HRKitError, type Session, ValidationError } from '@hrkit/core';
import { base64EncodeString } from '../base64.js';
import { type FitEncodeOptions, sessionToFIT } from '../fit.js';
import { SDK_VERSION } from '../version.js';

/**
 * @hrkit/integrations upload providers.
 *
 * Module structure (organized into logical sections):
 *   1. Types & Interfaces  — FetchLike, SessionUploader, UploadResult (line ~12)
 *   2. Auth Middleware      — withAuth, withUserAgent, staticTokenProvider (line ~110)
 *   3. Retry Middleware     — withRetry, parseRetryAfter, RetryPolicy (line ~185)
 *   4. Strava Uploader      (line ~395)
 *   5. Intervals.icu         (line ~470)
 *   6. Garmin Connect        (line ~530)
 *   7. TrainingPeaks         (line ~600)
 *   8. Multipart Helper      (line ~650)
 *   9. Summary Utilities     (line ~720)
 */

/**
 * Minimal fetch-compatible signature so consumers can inject their HTTP layer
 * (browser fetch, undici, node-fetch, edge runtime fetch).
 */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | string | Uint8Array;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText?: string;
  /** Optional headers accessor — used by retry middleware to read `Retry-After`. */
  headers?: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface SessionUploader {
  readonly name: string;
  upload(session: Session, options?: UploadOptions): Promise<UploadResult>;
}

export interface UploadOptions {
  name?: string;
  description?: string;
  sport?: FitEncodeOptions['sport'];
  private?: boolean;
  /** Cancel the upload mid-flight. Resulting upload returns `{status:'failed', error:'aborted'}`. */
  signal?: AbortSignal;
  /**
   * Per-call timeout in milliseconds. If the upload doesn't complete in time
   * the request is aborted and `{status:'failed', error:'timeout'}` is returned.
   * Combined with any `signal` the caller passes via OR (whichever fires first).
   * Default: no timeout.
   */
  timeoutMs?: number;
  /**
   * Opaque request identifier. Sent as `Idempotency-Key` header so providers
   * (and well-behaved proxies) can deduplicate retries. If omitted, a random
   * UUID-shaped key is generated per call. Pass an explicit value to make
   * the upload idempotent across process restarts (recommended for retries).
   */
  idempotencyKey?: string;
}

export interface UploadResult {
  provider: string;
  id?: string;
  status: 'uploaded' | 'queued' | 'duplicate' | 'failed';
  url?: string;
  raw?: unknown;
  /** Human-readable error message (legacy field, kept for back-compat). */
  error?: string;
  /**
   * Stable error code. One of: `'auth'` (401/403), `'rate_limited'` (429),
   * `'server_error'` (5xx), `'client_error'` (other 4xx), `'timeout'`,
   * `'aborted'`, `'network'`, or a provider-specific string.
   * Always set when `status === 'failed'`.
   */
  code?: 'auth' | 'rate_limited' | 'server_error' | 'client_error' | 'timeout' | 'aborted' | 'network' | (string & {});
  /** HTTP status from the upstream response, when one was received. */
  httpStatus?: number;
  /** Upstream request id (from `x-request-id`, `x-amzn-request-id`, etc.). */
  requestId?: string;
  /**
   * For `code === 'rate_limited'`, the seconds the caller should wait before
   * retrying (parsed from `Retry-After`). Undefined if header not present or
   * unparseable.
   */
  retryAfterSeconds?: number;
}

interface BaseConfig {
  /**
   * Static bearer token. Ignored if {@link BaseConfig.tokens} is provided.
   * @deprecated Prefer `tokens: staticTokenProvider(yourToken)` so the uploader can
   * transparently refresh on 401. Static `accessToken` will be removed in a future
   * major version.
   */
  accessToken?: string;
  /** Pluggable token source — preferred over `accessToken`. Refreshes once on 401. */
  tokens?: TokenProvider;
  fetch?: FetchLike;
  /**
   * Retry policy for transient HTTP failures (429/502/503/504). Set to `false` or
   * `{ maxRetries: 0 }` to disable. Defaults to 3 retries with exponential backoff
   * and `Retry-After` honoring.
   */
  retry?: RetryPolicy | false;
}

/**
 * Pluggable access-token source. Returning `null` means "no auth available";
 * the SDK will still issue the request (some endpoints are public).
 *
 * Implementors are expected to cache and refresh internally — the SDK will
 * call {@link getToken} on every request and {@link refresh} once on 401.
 */
export interface TokenProvider {
  /** Return a current bearer token, or null if none is available. */
  getToken(): Promise<string | null> | string | null;
  /**
   * Force a token refresh. Called once after a 401 response before the SDK
   * gives up. Returning `null` signals the refresh failed.
   */
  refresh?(): Promise<string | null> | string | null;
}

/**
 * Convert a static access-token (string) into a no-op {@link TokenProvider}.
 * Internal helper — exposed so consumers can build their own providers atop it.
 */
export function staticTokenProvider(token: string): TokenProvider {
  return { getToken: () => token };
}

/**
 * Wrap a {@link FetchLike} so every request gets `Authorization: Bearer <token>`
 * and a single retry on 401 after calling {@link TokenProvider.refresh}.
 */
export function withAuth(inner: FetchLike, tokens: TokenProvider): FetchLike {
  return async (input, init) => {
    let token = await tokens.getToken();
    const send = (t: string | null) =>
      inner(input, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
      });
    let res = await send(token);
    if (res.status === 401 && tokens.refresh) {
      const next = await tokens.refresh();
      if (next && next !== token) {
        token = next;
        res = await send(token);
      }
    }
    return res;
  };
}

function defaultFetch(): FetchLike {
  if (typeof globalThis.fetch !== 'function') {
    throw new HRKitError(
      '@hrkit/integrations: no global fetch found. Pass `fetch` in the provider config (e.g., undici, node-fetch).',
      'MISSING_DEPENDENCY',
    );
  }
  return globalThis.fetch as unknown as FetchLike;
}

/** SDK identifier sent on every outbound request. Bumped via package.json. */
export const HRKIT_USER_AGENT = `hrkit-integrations/${SDK_VERSION} (+https://github.com/josedab/hrkit)`;

/**
 * Wrap a {@link FetchLike} so every request carries a `User-Agent` header
 * identifying the SDK. Existing `User-Agent` values in the per-call init
 * win — callers can always override.
 */
export function withUserAgent(inner: FetchLike, ua: string = HRKIT_USER_AGENT): FetchLike {
  return (input, init) => {
    const headers = { ...(init?.headers ?? {}) };
    if (!Object.keys(headers).some((k) => k.toLowerCase() === 'user-agent')) {
      headers['User-Agent'] = ua;
    }
    return inner(input, { ...init, headers });
  };
}

// ── Retry / backoff ─────────────────────────────────────────────────────

/**
 * Retry policy applied to transient HTTP failures (429 / 502 / 503 / 504) and
 * network errors. Honors a `Retry-After` response header when present.
 */
export interface RetryPolicy {
  /** Maximum retry attempts after the initial request. Default: 3. */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff. Default: 500. */
  baseDelayMs?: number;
  /** Cap on a single backoff delay in ms. Default: 30_000. */
  maxDelayMs?: number;
  /** HTTP status codes that should be retried. Default: [429, 502, 503, 504]. */
  retryStatuses?: readonly number[];
  /** Inject custom sleep (test seam). Default: setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_RETRY: Required<Omit<RetryPolicy, 'sleep'>> = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  retryStatuses: [429, 502, 503, 504],
};

/**
 * Parse a `Retry-After` header value, accepting either delta-seconds or an
 * HTTP-date. Returns `null` when the header is missing or unparseable.
 */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10) * 1000;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

/**
 * Wrap a {@link FetchLike} so transient failures (429/5xx and network errors)
 * are retried with exponential backoff + jitter. Honors `Retry-After`. Aborts
 * propagate immediately. Wraps the *inner* fetch — compose with `withAuth` /
 * `withUserAgent` as desired.
 */
export function withRetry(inner: FetchLike, policy: RetryPolicy = {}): FetchLike {
  const cfg = { ...DEFAULT_RETRY, ...policy };
  const sleep = policy.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  return async (input, init) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt += 1) {
      if (init?.signal?.aborted) throw new HRKitError('aborted', 'ABORTED');
      try {
        const res = await inner(input, init);
        if (!cfg.retryStatuses.includes(res.status) || attempt === cfg.maxRetries) {
          return res;
        }
        const retryAfterMs = parseRetryAfter(res.headers?.get('retry-after') ?? null);
        const backoff = retryAfterMs ?? expoBackoff(attempt, cfg.baseDelayMs, cfg.maxDelayMs);
        await sleep(backoff);
      } catch (err) {
        lastErr = err;
        // Network/transport errors: retry unless we're out of attempts.
        if (attempt === cfg.maxRetries) throw err;
        if (init?.signal?.aborted) throw err;
        await sleep(expoBackoff(attempt, cfg.baseDelayMs, cfg.maxDelayMs));
      }
    }
    throw lastErr ?? new Error('withRetry: exhausted attempts');
  };
}

function expoBackoff(attempt: number, base: number, cap: number): number {
  const exp = Math.min(cap, base * 2 ** attempt);
  // Full jitter (AWS architecture blog "Exponential Backoff And Jitter").
  return Math.floor(Math.random() * exp);
}

function resolveIdempotencyKey(opts?: UploadOptions): string {
  if (opts?.idempotencyKey) return opts.idempotencyKey;
  // Crypto-grade UUID when available; fall back to non-crypto for legacy runtimes.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `hrkit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Combine an optional caller signal with an optional timeout into a single
 * AbortSignal. Returns `{ signal, dispose }` so callers can clear the timer
 * once the request settles. `signal` is `undefined` when neither input is set,
 * keeping the wire-call free of allocation when not needed.
 */
type FetchResponse = Awaited<ReturnType<FetchLike>>;

function codeFromStatus(status: number): UploadResult['code'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  return 'client_error';
}

function pickRequestId(res: FetchResponse): string | undefined {
  const h = res.headers;
  if (!h) return undefined;
  return h.get('x-request-id') ?? h.get('x-amzn-requestid') ?? h.get('request-id') ?? undefined;
}

function failureFromResponse(
  provider: string,
  res: FetchResponse,
  body: string | object | undefined,
  fallbackMsg?: string,
): UploadResult {
  // 409 Conflict → activity already exists upstream. Surface as 'duplicate'
  // (success-shaped) instead of 'failed' so consumers can dedupe naturally.
  if (res.status === 409) {
    const result: UploadResult = {
      provider,
      status: 'duplicate',
      httpStatus: 409,
      requestId: pickRequestId(res),
      raw: body,
    };
    getLogger().info('hrkit.upload.duplicate', { provider, requestId: result.requestId });
    return result;
  }
  const code = codeFromStatus(res.status);
  const retryAfterMs = code === 'rate_limited' ? parseRetryAfter(res.headers?.get('retry-after') ?? null) : null;
  const result: UploadResult = {
    provider,
    status: 'failed',
    error: fallbackMsg ?? `HTTP ${res.status}${res.statusText ? `: ${res.statusText}` : ''}`,
    code,
    httpStatus: res.status,
    requestId: pickRequestId(res),
    retryAfterSeconds: retryAfterMs != null ? Math.round(retryAfterMs / 1000) : undefined,
    raw: body,
  };
  getLogger().warn('hrkit.upload.failed', {
    provider,
    code: result.code,
    httpStatus: result.httpStatus,
    requestId: result.requestId,
    retryAfterSeconds: result.retryAfterSeconds,
  });
  return result;
}

function failureFromException(provider: string, err: unknown, timedOut: boolean): UploadResult {
  if (timedOut) {
    getLogger().warn('hrkit.upload.failed', { provider, code: 'timeout' });
    return { provider, status: 'failed', error: 'timeout', code: 'timeout' };
  }
  const e = err as { message?: string; name?: string };
  const msg = e?.message ?? 'aborted';
  if (msg === 'aborted' || e?.name === 'AbortError') {
    getLogger().warn('hrkit.upload.failed', { provider, code: 'aborted' });
    return { provider, status: 'failed', error: 'aborted', code: 'aborted' };
  }
  getLogger().warn('hrkit.upload.failed', { provider, code: 'network', error: msg });
  return { provider, status: 'failed', error: msg, code: 'network' };
}

function withTimeoutSignal(
  callerSignal?: AbortSignal,
  timeoutMs?: number,
): { signal: AbortSignal | undefined; dispose: () => void; timedOut: () => boolean } {
  const hasTimeout = timeoutMs !== undefined && timeoutMs > 0;
  if (!callerSignal && !hasTimeout) {
    return { signal: undefined, dispose: () => undefined, timedOut: () => false };
  }
  if (!hasTimeout) {
    return { signal: callerSignal, dispose: () => undefined, timedOut: () => false };
  }
  const ctrl = new AbortController();
  let timedOutFlag = false;
  const onAbort = () => ctrl.abort(callerSignal?.reason ?? new Error('aborted'));
  if (callerSignal) {
    if (callerSignal.aborted) ctrl.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOutFlag = true;
    ctrl.abort(new Error('timeout'));
  }, timeoutMs);
  return {
    signal: ctrl.signal,
    dispose: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onAbort);
    },
    timedOut: () => timedOutFlag,
  };
}

/**
 * Compose the fetch pipeline shared by every uploader: user-agent → retry → auth.
 * Auth wraps the outer call so a refreshed token is still subject to retries.
 */
function buildFetchPipeline(config: {
  fetch?: FetchLike;
  tokens?: TokenProvider;
  retry?: RetryPolicy | false;
}): FetchLike {
  let fn = withUserAgent(config.fetch ?? defaultFetch());
  if (config.retry !== false) {
    fn = withRetry(fn, config.retry === undefined ? {} : config.retry);
  }
  if (config.tokens) fn = withAuth(fn, config.tokens);
  return fn;
}

// ── Strava ──────────────────────────────────────────────────────────────

/**
 * Strava uploader: posts FIT to `POST /api/v3/uploads`.
 * @see https://developers.strava.com/docs/uploads/
 */
export class StravaUploader implements SessionUploader {
  readonly name = 'strava';
  private fetchFn: FetchLike;

  constructor(private config: BaseConfig) {
    if (!config.tokens && !config.accessToken) {
      throw new ValidationError('StravaUploader: provide either `accessToken` or `tokens`.');
    }
    this.fetchFn = buildFetchPipeline(config);
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const boundary = `----hrkit${Math.random().toString(16).slice(2)}`;
    const body = buildMultipart(boundary, [
      { name: 'data_type', value: 'fit' },
      ...(options?.name ? [{ name: 'name', value: options.name }] : []),
      ...(options?.description ? [{ name: 'description', value: options.description }] : []),
      ...(options?.private ? [{ name: 'private', value: '1' }] : []),
      { name: 'file', filename: 'activity.fit', contentType: 'application/octet-stream', value: fitBytes },
    ]);

    const t = withTimeoutSignal(options?.signal, options?.timeoutMs);
    try {
      const res = await this.fetchFn('https://www.strava.com/api/v3/uploads', {
        method: 'POST',
        headers: {
          ...(this.config.tokens ? {} : { Authorization: `Bearer ${this.config.accessToken}` }),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Idempotency-Key': resolveIdempotencyKey(options),
        },
        body,
        signal: t.signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: number;
        id_str?: string;
        status?: string;
        error?: string;
        activity_id?: number;
      };
      if (!res.ok) {
        return failureFromResponse(this.name, res, json, json.error ?? `HTTP ${res.status}`);
      }
      if (json.error) {
        const dup = json.error.toLowerCase().includes('duplicate');
        return { provider: this.name, status: dup ? 'duplicate' : 'failed', error: json.error, raw: json };
      }
      const uploadId = json.id_str ?? (json.id !== undefined ? String(json.id) : undefined);
      const activityId = json.activity_id !== undefined ? String(json.activity_id) : undefined;
      return {
        provider: this.name,
        status: activityId ? 'uploaded' : 'queued',
        id: activityId ?? uploadId,
        url: activityId ? `https://www.strava.com/activities/${activityId}` : undefined,
        raw: json,
      };
    } catch (err) {
      return failureFromException(this.name, err, t.timedOut());
    } finally {
      t.dispose();
    }
  }
}

// ── Intervals.icu ───────────────────────────────────────────────────────

export class IntervalsIcuUploader implements SessionUploader {
  readonly name = 'intervals.icu';
  private fetchFn: FetchLike;

  constructor(private config: { apiKey: string; athleteId: string; fetch?: FetchLike; retry?: RetryPolicy | false }) {
    this.fetchFn = buildFetchPipeline({ fetch: config.fetch, retry: config.retry });
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const boundary = `----hrkit${Math.random().toString(16).slice(2)}`;
    const body = buildMultipart(boundary, [
      ...(options?.name ? [{ name: 'name', value: options.name }] : []),
      ...(options?.description ? [{ name: 'description', value: options.description }] : []),
      { name: 'file', filename: 'activity.fit', contentType: 'application/octet-stream', value: fitBytes },
    ]);

    const auth =
      typeof globalThis.btoa === 'function'
        ? globalThis.btoa(`API_KEY:${this.config.apiKey}`)
        : base64EncodeString(`API_KEY:${this.config.apiKey}`);

    const t = withTimeoutSignal(options?.signal, options?.timeoutMs);
    try {
      const res = await this.fetchFn(
        `https://intervals.icu/api/v1/athlete/${encodeURIComponent(this.config.athleteId)}/activities`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Idempotency-Key': resolveIdempotencyKey(options),
          },
          body,
          signal: t.signal,
        },
      );
      const text = await res.text();
      let json: { id?: string; error?: string } = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = {};
      }
      if (!res.ok) {
        return failureFromResponse(this.name, res, text, json.error ?? `HTTP ${res.status}`);
      }
      return {
        provider: this.name,
        status: 'uploaded',
        id: json.id,
        url: json.id ? `https://intervals.icu/activities/${json.id}` : undefined,
        raw: json,
      };
    } catch (err) {
      return failureFromException(this.name, err, t.timedOut());
    } finally {
      t.dispose();
    }
  }
}

// ── Garmin Connect ─────────────────────────────────────────────────────

/**
 * Garmin Connect uploader. Requires OAuth1-signed headers — inject via `signHeaders`.
 * @see https://developer.garmin.com/gc-developer-program/activity-api/
 */
export class GarminUploader implements SessionUploader {
  readonly name = 'garmin';
  private fetchFn: FetchLike;

  constructor(
    private config: {
      signHeaders: (url: string, method: string) => Record<string, string> | Promise<Record<string, string>>;
      baseUrl?: string;
      fetch?: FetchLike;
      retry?: RetryPolicy | false;
    },
  ) {
    this.fetchFn = buildFetchPipeline({ fetch: config.fetch, retry: config.retry });
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const url = `${this.config.baseUrl ?? 'https://connectapi.garmin.com'}/activity-service/activity/fit`;
    const t = withTimeoutSignal(options?.signal, options?.timeoutMs);
    try {
      const headers = await this.config.signHeaders(url, 'POST');
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Idempotency-Key': resolveIdempotencyKey(options),
          ...headers,
        },
        body: fitBytes,
        signal: t.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        return failureFromResponse(this.name, res, text, `HTTP ${res.status}: ${text}`);
      }
      let json: { activityId?: string; detailedImportResult?: { uploadId?: string } } = {};
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON */
      }
      const id = json.activityId ?? json.detailedImportResult?.uploadId;
      return {
        provider: this.name,
        status: id ? 'uploaded' : 'queued',
        id,
        url: id ? `https://connect.garmin.com/modern/activity/${id}` : undefined,
        raw: json,
      };
    } catch (err) {
      return failureFromException(this.name, err, t.timedOut());
    } finally {
      t.dispose();
    }
  }

  static isDuplicateResponse(status: number): boolean {
    return status === 409;
  }
}

// ── TrainingPeaks ──────────────────────────────────────────────────────

export class TrainingPeaksUploader implements SessionUploader {
  readonly name = 'trainingpeaks';
  private fetchFn: FetchLike;

  constructor(private config: BaseConfig & { baseUrl?: string }) {
    if (!config.tokens && !config.accessToken) {
      throw new ValidationError('TrainingPeaksUploader: provide either `accessToken` or `tokens`.');
    }
    this.fetchFn = buildFetchPipeline(config);
  }

  async upload(session: Session, options?: UploadOptions): Promise<UploadResult> {
    const fitBytes = sessionToFIT(session, { sport: options?.sport });
    const url = `${this.config.baseUrl ?? 'https://api.trainingpeaks.com'}/v2/file`;
    const t = withTimeoutSignal(options?.signal, options?.timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          ...(this.config.tokens ? {} : { Authorization: `Bearer ${this.config.accessToken}` }),
          'Content-Type': 'application/octet-stream',
          'Idempotency-Key': resolveIdempotencyKey(options),
          ...(options?.name ? { 'X-File-Name': options.name } : {}),
        },
        body: fitBytes,
        signal: t.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        return failureFromResponse(this.name, res, text, `HTTP ${res.status}: ${text}`);
      }
      let json: { workoutId?: string; id?: string } = {};
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON */
      }
      const id = json.workoutId ?? json.id;
      return { provider: this.name, status: 'uploaded', id, raw: json };
    } catch (err) {
      return failureFromException(this.name, err, t.timedOut());
    } finally {
      t.dispose();
    }
  }
}

// ── Multipart helper ───────────────────────────────────────────────────

interface FormPart {
  name: string;
  value: string | Uint8Array;
  filename?: string;
  contentType?: string;
}

function buildMultipart(boundary: string, parts: FormPart[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    let header = `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"`;
    if (part.filename) header += `; filename="${part.filename}"`;
    header += '\r\n';
    if (part.contentType) header += `Content-Type: ${part.contentType}\r\n`;
    header += '\r\n';
    chunks.push(enc.encode(header));
    chunks.push(typeof part.value === 'string' ? enc.encode(part.value) : part.value);
    chunks.push(enc.encode('\r\n'));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/**
 * Upload to multiple providers, optionally bounding parallelism.
 *
 * @param uploaders - Configured uploader instances.
 * @param session - Session to upload.
 * @param options - Per-call upload options. `concurrency` (default `Infinity`)
 *   limits the number of in-flight uploads; useful when callers are rate-limited
 *   or want to preserve a stable provider order in logs.
 *
 * Results are returned in the **same order** as `uploaders`, regardless of
 * completion order.
 */
export async function uploadToAll(
  uploaders: SessionUploader[],
  session: Session,
  options?: UploadOptions & { concurrency?: number },
): Promise<UploadResult[]> {
  const concurrency = Math.max(1, options?.concurrency ?? Number.POSITIVE_INFINITY);
  if (!Number.isFinite(concurrency) || concurrency >= uploaders.length) {
    return Promise.all(uploaders.map((u) => u.upload(session, options)));
  }
  const results: UploadResult[] = new Array(uploaders.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, uploaders.length) }, async () => {
    while (true) {
      const i = next++;
      const u = uploaders[i];
      if (!u) return;
      results[i] = await u.upload(session, options);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Aggregate summary returned by {@link summarizeUploads}. Counts each
 * terminal status across providers and exposes the worst `retryAfterSeconds`
 * across rate-limited providers (so a caller can sleep once before retrying
 * the whole batch).
 */
export interface UploadSummary {
  total: number;
  uploaded: number;
  queued: number;
  duplicate: number;
  failed: number;
  /** Providers that succeeded outright (`status === 'uploaded'`). */
  successProviders: string[];
  /** Providers that returned `status === 'failed'`. */
  failedProviders: string[];
  /**
   * Maximum `retryAfterSeconds` across rate-limited providers, or `undefined`
   * if none were rate-limited or no Retry-After was provided.
   */
  worstRetryAfterSeconds?: number;
  /** Map of provider name → its result. Useful for `byProvider['strava']`. */
  byProvider: Record<string, UploadResult>;
}

/**
 * Reduce an array of {@link UploadResult} into a single {@link UploadSummary}.
 * Pure function — does not mutate inputs. Safe to call on partial batches.
 *
 * @example
 * ```ts
 * const results = await uploadToAll(uploaders, session);
 * const sum = summarizeUploads(results);
 * if (sum.failed > 0) console.warn('partial upload', sum.failedProviders);
 * if (sum.worstRetryAfterSeconds) await sleep(sum.worstRetryAfterSeconds * 1000);
 * ```
 */
export function summarizeUploads(results: readonly UploadResult[]): UploadSummary {
  const summary: UploadSummary = {
    total: results.length,
    uploaded: 0,
    queued: 0,
    duplicate: 0,
    failed: 0,
    successProviders: [],
    failedProviders: [],
    byProvider: {},
  };
  let worst: number | undefined;
  for (const r of results) {
    summary.byProvider[r.provider] = r;
    switch (r.status) {
      case 'uploaded':
        summary.uploaded++;
        summary.successProviders.push(r.provider);
        break;
      case 'queued':
        summary.queued++;
        break;
      case 'duplicate':
        summary.duplicate++;
        break;
      case 'failed':
        summary.failed++;
        summary.failedProviders.push(r.provider);
        if (r.code === 'rate_limited' && typeof r.retryAfterSeconds === 'number') {
          worst = worst === undefined ? r.retryAfterSeconds : Math.max(worst, r.retryAfterSeconds);
        }
        break;
    }
  }
  if (worst !== undefined) summary.worstRetryAfterSeconds = worst;
  return summary;
}
