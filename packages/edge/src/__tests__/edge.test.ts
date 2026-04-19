import { describe, expect, it } from 'vitest';
import { createIngestHandler, MemoryStore, validateSample } from '../index.js';

function makeReq(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://test${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : null,
  });
}

describe('validateSample', () => {
  it('accepts a valid sample', () => {
    expect(validateSample({ athleteId: 'a', timestamp: 1, hr: 80, rrIntervals: [], contactDetected: true })).toBeNull();
  });
  it('rejects missing athleteId', () => {
    expect(validateSample({ timestamp: 1, hr: 80, rrIntervals: [] })).toMatch(/athleteId/);
  });
  it('rejects out-of-range hr', () => {
    expect(validateSample({ athleteId: 'a', timestamp: 1, hr: 999, rrIntervals: [] })).toMatch(/hr/);
  });
  it('rejects non-array rrIntervals', () => {
    expect(validateSample({ athleteId: 'a', timestamp: 1, hr: 80, rrIntervals: 'no' })).toMatch(/rr/i);
  });
});

describe('ingest handler', () => {
  it('responds to /health without auth', async () => {
    const handler = createIngestHandler({ store: new MemoryStore(), authToken: 'secret' });
    const res = await handler(makeReq('GET', '/health'));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });

  it('rejects requests without auth token', async () => {
    const handler = createIngestHandler({ store: new MemoryStore(), authToken: 'secret' });
    const res = await handler(makeReq('POST', '/ingest', []));
    expect(res.status).toBe(401);
  });

  it('accepts authed requests', async () => {
    const handler = createIngestHandler({ store: new MemoryStore(), authToken: 'secret' });
    const res = await handler(
      makeReq(
        'POST',
        '/ingest',
        [{ athleteId: 'jose', timestamp: 1, hr: 100, rrIntervals: [600], contactDetected: true }],
        { authorization: 'Bearer secret' },
      ),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ingested).toBe(1);
  });

  it('persists samples and lists them', async () => {
    const store = new MemoryStore();
    const handler = createIngestHandler({ store });
    await handler(
      makeReq('POST', '/ingest', [
        { athleteId: 'jose', sessionId: 's1', timestamp: 100, hr: 100, rrIntervals: [], contactDetected: true },
        { athleteId: 'jose', sessionId: 's1', timestamp: 200, hr: 110, rrIntervals: [], contactDetected: true },
      ]),
    );
    const list = await handler(makeReq('GET', '/sessions/jose/s1'));
    const body = await list.json();
    expect(body.count).toBe(2);
    expect(body.keys[0]).toContain('samples/jose/s1/');
  });

  it('returns 207 for partially valid batch', async () => {
    const handler = createIngestHandler({ store: new MemoryStore() });
    const res = await handler(
      makeReq('POST', '/ingest', [
        { athleteId: 'jose', timestamp: 1, hr: 100, rrIntervals: [], contactDetected: true },
        { athleteId: 'jose', timestamp: 2, hr: 999, rrIntervals: [] },
      ]),
    );
    expect(res.status).toBe(207);
    const body = await res.json();
    expect(body.ingested).toBe(1);
    expect(body.errors).toHaveLength(1);
  });

  it('rejects oversized batches', async () => {
    const handler = createIngestHandler({ store: new MemoryStore(), maxBatchSize: 2 });
    const res = await handler(
      makeReq('POST', '/ingest', [
        { athleteId: 'a', timestamp: 1, hr: 80, rrIntervals: [], contactDetected: true },
        { athleteId: 'a', timestamp: 2, hr: 80, rrIntervals: [], contactDetected: true },
        { athleteId: 'a', timestamp: 3, hr: 80, rrIntervals: [], contactDetected: true },
      ]),
    );
    expect(res.status).toBe(413);
  });

  it('handles CORS preflight', async () => {
    const handler = createIngestHandler({ store: new MemoryStore() });
    const res = await handler(new Request('http://test/ingest', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('returns 404 for unknown route', async () => {
    const handler = createIngestHandler({ store: new MemoryStore() });
    const res = await handler(makeReq('GET', '/nope'));
    expect(res.status).toBe(404);
  });

  it('reads back individual sample', async () => {
    const store = new MemoryStore();
    const handler = createIngestHandler({ store });
    await handler(
      makeReq('POST', '/ingest', [
        { athleteId: 'jose', sessionId: 's1', timestamp: 100, hr: 100, rrIntervals: [600], contactDetected: true },
      ]),
    );
    const res = await handler(makeReq('GET', '/samples/jose/s1/100'));
    expect(res.status).toBe(200);
    expect((await res.json()).hr).toBe(100);
  });

  it('returns 400 on malformed json', async () => {
    const handler = createIngestHandler({ store: new MemoryStore() });
    const res = await handler(
      new Request('http://test/ingest', {
        method: 'POST',
        body: '{not json',
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe('MemoryStore', () => {
  it('supports put/get/list/delete', async () => {
    const s = new MemoryStore();
    await s.put('a/1', 'one');
    await s.put('a/2', 'two');
    await s.put('b/1', 'three');
    expect(await s.get('a/1')).toBe('one');
    expect(await s.list('a/')).toEqual(['a/1', 'a/2']);
    await s.delete('a/1');
    expect(await s.get('a/1')).toBeNull();
    expect(await s.list('a/')).toEqual(['a/2']);
    // Deleting a missing key is a no-op.
    await expect(s.delete('does-not-exist')).resolves.toBeUndefined();
  });
});
