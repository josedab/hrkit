import { SESSION_SCHEMA_VERSION, type Session } from '@hrkit/core';
import { describe, expect, it } from 'vitest';
import { StravaUploader, summarizeUploads, type TokenProvider, TrainingPeaksUploader } from '../providers/index.js';
import { MockFetch } from '../testing/index.js';

const session: Session = {
  schemaVersion: SESSION_SCHEMA_VERSION,
  startTime: 1700000000000,
  endTime: 1700000060000,
  samples: [{ timestamp: 1700000000000, hr: 100 }],
  rrIntervals: [600],
  rounds: [],
  config: { maxHR: 185 },
};

describe('uploader TokenProvider integration', () => {
  it('Strava: tokens override accessToken and trigger refresh on 401', async () => {
    const mock = new MockFetch();
    let n = 0;
    // First call → 401, second call → 201.
    mock.fetch = async (_url, init) => {
      n++;
      if (n === 1) {
        return { ok: false, status: 401, text: async () => '', json: async () => ({}) };
      }
      const auth = init?.headers?.Authorization;
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ id: 7, status: 'ok', _auth: auth }),
        json: async () => ({ id: 7, status: 'ok', _auth: auth }),
      };
    };
    let calls = 0;
    const tokens: TokenProvider = {
      getToken: () => 'old',
      refresh: () => {
        calls++;
        return 'new-token';
      },
    };
    const u = new StravaUploader({ tokens, fetch: mock.fetch });
    const res = await u.upload(session);
    expect(res.status).toBe('queued');
    expect(calls).toBe(1);
    expect(n).toBe(2); // refresh + retry
  });

  it('Strava: forwards UploadOptions.signal to fetch', async () => {
    const mock = new MockFetch();
    let seenSignal: AbortSignal | undefined;
    mock.fetch = async (_url, init) => {
      seenSignal = init?.signal;
      return {
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ id_str: '1' }),
        json: async () => ({ id_str: '1' }),
      };
    };
    const u = new StravaUploader({ accessToken: 't', fetch: mock.fetch });
    const ctrl = new AbortController();
    await u.upload(session, { signal: ctrl.signal });
    expect(seenSignal).toBe(ctrl.signal);
  });

  it('Strava: throws if neither tokens nor accessToken provided', () => {
    expect(() => new StravaUploader({} as unknown as { accessToken: string })).toThrow();
  });

  it('TrainingPeaks: tokens path skips manual Authorization header', async () => {
    const mock = new MockFetch();
    const seen: Record<string, string>[] = [];
    mock.fetch = async (_url, init) => {
      seen.push((init?.headers ?? {}) as Record<string, string>);
      return { ok: true, status: 200, text: async () => '{"id":"1"}', json: async () => ({ id: '1' }) };
    };
    const u = new TrainingPeaksUploader({ tokens: { getToken: () => 'tp' }, fetch: mock.fetch });
    await u.upload(session);
    expect(seen[0]?.Authorization).toBe('Bearer tp');
  });
});

describe('UploadOptions.timeoutMs', () => {
  it('Strava: aborts the fetch and returns timeout error', async () => {
    const mock = new MockFetch();
    let aborted = false;
    mock.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const sig = init?.signal as AbortSignal | undefined;
        sig?.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        });
        // Never resolve unless aborted.
      });
    const u = new StravaUploader({ accessToken: 'a', fetch: mock.fetch, retry: false });
    const result = await u.upload(session, { timeoutMs: 20 });
    expect(aborted).toBe(true);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('timeout');
  });

  it('Strava: caller-signal abort still wins (user error, not timeout)', async () => {
    const mock = new MockFetch();
    mock.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const sig = init?.signal as AbortSignal | undefined;
        sig?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const u = new StravaUploader({ accessToken: 'a', fetch: mock.fetch, retry: false });
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5);
    const result = await u.upload(session, { signal: ctrl.signal, timeoutMs: 5000 });
    expect(result.status).toBe('failed');
    expect(result.error).toBe('aborted');
  });

  it('Strava: no timeoutMs → no abort, request completes normally', async () => {
    const mock = new MockFetch();
    mock.fetch = async () => ({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 1, activity_id: 99 }),
      json: async () => ({ id: 1, activity_id: 99 }),
    });
    const u = new StravaUploader({ accessToken: 'a', fetch: mock.fetch, retry: false });
    const result = await u.upload(session);
    expect(result.status).toBe('uploaded');
  });
});

describe('UploadResult structured errors', () => {
  it('rate-limit (429) → code:rate_limited with retryAfterSeconds + httpStatus', async () => {
    const mock = new MockFetch();
    mock.fetch = async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: {
        get: (n: string) =>
          n.toLowerCase() === 'retry-after' ? '7' : n.toLowerCase() === 'x-request-id' ? 'req-abc' : null,
      },
      text: async () => 'slow down',
      json: async () => ({}),
    });
    const u = new StravaUploader({ accessToken: 'a', fetch: mock.fetch, retry: false });
    const r = await u.upload(session);
    expect(r.status).toBe('failed');
    expect(r.code).toBe('rate_limited');
    expect(r.httpStatus).toBe(429);
    expect(r.retryAfterSeconds).toBe(7);
    expect(r.requestId).toBe('req-abc');
  });

  it('auth (401) → code:auth', async () => {
    const mock = new MockFetch();
    mock.fetch = async () => ({
      ok: false,
      status: 401,
      headers: { get: () => null },
      text: async () => 'bad token',
      json: async () => ({}),
    });
    const u = new StravaUploader({ accessToken: 'a', fetch: mock.fetch, retry: false });
    const r = await u.upload(session);
    expect(r.code).toBe('auth');
    expect(r.httpStatus).toBe(401);
  });

  it('server error (503) → code:server_error', async () => {
    const mock = new MockFetch();
    mock.fetch = async () => ({
      ok: false,
      status: 503,
      headers: { get: () => null },
      text: async () => 'down',
      json: async () => ({}),
    });
    const u = new TrainingPeaksUploader({ accessToken: 'tp', fetch: mock.fetch, retry: false });
    const r = await u.upload(session);
    expect(r.code).toBe('server_error');
    expect(r.httpStatus).toBe(503);
  });

  it('timeout exception → code:timeout', async () => {
    const mock = new MockFetch();
    mock.fetch = (_url, init) =>
      new Promise((_res, rej) => {
        const sig = init?.signal as AbortSignal | undefined;
        sig?.addEventListener('abort', () => rej(new Error('aborted')));
      });
    const u = new StravaUploader({ accessToken: 'a', fetch: mock.fetch, retry: false });
    const r = await u.upload(session, { timeoutMs: 10 });
    expect(r.code).toBe('timeout');
    expect(r.httpStatus).toBeUndefined();
  });

  it('network error → code:network', async () => {
    const mock = new MockFetch();
    mock.fetch = async () => {
      throw new Error('ECONNRESET');
    };
    const u = new StravaUploader({ accessToken: 'a', fetch: mock.fetch, retry: false });
    const r = await u.upload(session);
    expect(r.code).toBe('network');
    expect(r.error).toBe('ECONNRESET');
  });
});

describe('HTTP 409 → status:duplicate', () => {
  it('Garmin 409 returns duplicate (not failed)', async () => {
    const mock = new MockFetch();
    mock.fetch = async () => ({
      ok: false,
      status: 409,
      headers: { get: () => null },
      text: async () => 'already uploaded',
      json: async () => ({}),
    });
    const { GarminUploader } = await import('../providers/index.js');
    const u = new GarminUploader({ signHeaders: () => ({}), fetch: mock.fetch, retry: false });
    const r = await u.upload(session);
    expect(r.status).toBe('duplicate');
    expect(r.httpStatus).toBe(409);
    expect(r.code).toBeUndefined();
  });
});

describe('summarizeUploads', () => {
  it('counts and groups by status', () => {
    const s = summarizeUploads([
      { provider: 'strava', status: 'uploaded', id: '1' },
      { provider: 'garmin', status: 'duplicate', httpStatus: 409 },
      {
        provider: 'tp',
        status: 'failed',
        code: 'rate_limited',
        retryAfterSeconds: 5,
        httpStatus: 429,
      },
      { provider: 'icu', status: 'failed', code: 'rate_limited', retryAfterSeconds: 12, httpStatus: 429 },
      { provider: 'aux', status: 'queued' },
    ]);
    expect(s.total).toBe(5);
    expect(s.uploaded).toBe(1);
    expect(s.duplicate).toBe(1);
    expect(s.failed).toBe(2);
    expect(s.queued).toBe(1);
    expect(s.successProviders).toEqual(['strava']);
    expect(s.failedProviders).toEqual(['tp', 'icu']);
    expect(s.worstRetryAfterSeconds).toBe(12);
    expect(s.byProvider.garmin?.status).toBe('duplicate');
  });

  it('empty input', () => {
    const s = summarizeUploads([]);
    expect(s.total).toBe(0);
    expect(s.worstRetryAfterSeconds).toBeUndefined();
  });
});
