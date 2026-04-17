import { SESSION_SCHEMA_VERSION, type Session } from '@hrkit/core';
import { describe, expect, it, vi } from 'vitest';
import {
  type FetchLike,
  GarminUploader,
  IntervalsIcuUploader,
  StravaUploader,
  TrainingPeaksUploader,
  uploadToAll,
} from '../providers/index.js';

const session: Session = {
  schemaVersion: SESSION_SCHEMA_VERSION,
  startTime: 1700000000000,
  endTime: 1700000060000,
  samples: [{ timestamp: 1700000000000, hr: 100 }],
  rrIntervals: [600],
  rounds: [],
  config: { maxHR: 185 },
};

const okJson = (body: unknown, status = 200): ReturnType<FetchLike> =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });

describe('StravaUploader', () => {
  it('posts FIT file and returns queued status with upload id', async () => {
    const fetch = vi.fn(() =>
      okJson({ id: 12345, id_str: '12345', status: 'Your activity is still being processed.' }),
    );
    const uploader = new StravaUploader({ accessToken: 'xyz', fetch: fetch as FetchLike });
    const result = await uploader.upload(session, { name: 'Morning ride', sport: 'cycling' });
    expect(result.provider).toBe('strava');
    expect(result.status).toBe('queued');
    expect(result.id).toBe('12345');
    const call = fetch.mock.calls[0]!;
    expect(call[0]).toBe('https://www.strava.com/api/v3/uploads');
    expect(call[1]?.headers?.Authorization).toBe('Bearer xyz');
  });

  it('returns activity id and url when upload completes', async () => {
    const fetch = vi.fn(() => okJson({ id: 1, activity_id: 9876 }));
    const uploader = new StravaUploader({ accessToken: 'k', fetch: fetch as FetchLike });
    const r = await uploader.upload(session);
    expect(r.status).toBe('uploaded');
    expect(r.id).toBe('9876');
    expect(r.url).toContain('/9876');
  });

  it('detects duplicates from error message', async () => {
    const fetch = vi.fn(() => okJson({ error: 'duplicate of 555' }));
    const uploader = new StravaUploader({ accessToken: 'k', fetch: fetch as FetchLike });
    const r = await uploader.upload(session);
    expect(r.status).toBe('duplicate');
  });

  it('reports failure on non-2xx', async () => {
    const fetch = vi.fn(() => okJson({ error: 'unauthorized' }, 401));
    const uploader = new StravaUploader({ accessToken: 'k', fetch: fetch as FetchLike });
    const r = await uploader.upload(session);
    expect(r.status).toBe('failed');
    expect(r.error).toContain('unauthorized');
  });

  it('reports failure on network exception', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('boom')));
    const uploader = new StravaUploader({ accessToken: 'k', fetch: fetch as unknown as FetchLike });
    const r = await uploader.upload(session);
    expect(r.status).toBe('failed');
    expect(r.error).toBe('boom');
  });
});

describe('IntervalsIcuUploader', () => {
  it('uses Basic auth with athlete id and api key', async () => {
    const fetch = vi.fn(() => okJson({ id: 'i1' }));
    const uploader = new IntervalsIcuUploader({
      apiKey: 'secret',
      athleteId: 'a1',
      fetch: fetch as FetchLike,
    });
    const r = await uploader.upload(session);
    expect(r.status).toBe('uploaded');
    expect(r.id).toBe('i1');
    expect(fetch.mock.calls[0]![1]?.headers?.Authorization).toMatch(/^Basic /);
  });
});

describe('GarminUploader', () => {
  it('calls signHeaders for OAuth1 and returns activity id', async () => {
    const fetch = vi.fn(() => okJson({ activityId: 'g1' }));
    const sign = vi.fn(async () => ({ Authorization: 'OAuth oauth_signature="..."' }));
    const uploader = new GarminUploader({ signHeaders: sign, fetch: fetch as FetchLike });
    const r = await uploader.upload(session);
    expect(sign).toHaveBeenCalled();
    expect(r.status).toBe('uploaded');
    expect(r.id).toBe('g1');
    expect(r.url).toContain('g1');
  });

  it('flags 409 as duplicate via static helper', () => {
    expect(GarminUploader.isDuplicateResponse(409)).toBe(true);
    expect(GarminUploader.isDuplicateResponse(200)).toBe(false);
  });
});

describe('TrainingPeaksUploader', () => {
  it('uploads with bearer token', async () => {
    const fetch = vi.fn(() => okJson({ workoutId: 'tp1' }));
    const uploader = new TrainingPeaksUploader({ accessToken: 'tok', fetch: fetch as FetchLike });
    const r = await uploader.upload(session, { name: 'Run' });
    expect(r.status).toBe('uploaded');
    expect(r.id).toBe('tp1');
    expect(fetch.mock.calls[0]![1]?.headers?.['X-File-Name']).toBe('Run');
  });
});

describe('uploadToAll', () => {
  it('runs uploaders in parallel and returns all results', async () => {
    const f1 = vi.fn(() => okJson({ id: 1, activity_id: 1 }));
    const f2 = vi.fn(() => okJson({ id: 'i' }));
    const u1 = new StravaUploader({ accessToken: 't', fetch: f1 as FetchLike });
    const u2 = new IntervalsIcuUploader({ apiKey: 'k', athleteId: 'a', fetch: f2 as FetchLike });
    const results = await uploadToAll([u1, u2], session);
    expect(results.map((r) => r.provider)).toEqual(['strava', 'intervals.icu']);
    expect(results.every((r) => r.status === 'uploaded')).toBe(true);
  });
});
