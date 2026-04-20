import { describe, expect, it } from 'vitest';
import {
  corsHeaders,
  handlePreflight,
  InMemoryUsageSink,
  jsonError,
  jsonOk,
  NULL_USAGE_SINK,
  newRequestId,
  type UsageEvent,
} from '../hardening.js';

describe('jsonError', () => {
  it('returns a Response with the correct status and body', async () => {
    const res = jsonError(400, 'bad_input', 'missing field', 'req-1');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'bad_input', message: 'missing field', requestId: 'req-1' },
    });
  });

  it('includes CORS and content-type headers', () => {
    const res = jsonError(500, 'err', 'fail', 'req-2');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('x-request-id')).toBe('req-2');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('jsonOk', () => {
  it('returns a 200 with JSON body', async () => {
    const res = jsonOk({ status: 'ok' }, 'req-3');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('supports custom status code', async () => {
    const res = jsonOk({ id: 1 }, 'req-4', 201);
    expect(res.status).toBe(201);
  });

  it('includes CORS headers', () => {
    const res = jsonOk({}, 'req-5');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('corsHeaders', () => {
  it('returns standard CORS headers', () => {
    const h = corsHeaders();
    expect(h['Access-Control-Allow-Origin']).toBe('*');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
    expect(h['Access-Control-Allow-Headers']).toContain('X-Api-Key');
    expect(h['Access-Control-Max-Age']).toBe('86400');
  });
});

describe('handlePreflight', () => {
  it('returns 204 for OPTIONS requests', () => {
    const req = new Request('https://api.test/ingest', { method: 'OPTIONS' });
    const res = handlePreflight(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(204);
  });

  it('returns null for non-OPTIONS requests', () => {
    const req = new Request('https://api.test/ingest', { method: 'POST' });
    expect(handlePreflight(req)).toBeNull();
  });

  it('returns null for GET requests', () => {
    const req = new Request('https://api.test/health', { method: 'GET' });
    expect(handlePreflight(req)).toBeNull();
  });
});

describe('newRequestId', () => {
  it('returns a non-empty string', () => {
    const id = newRequestId();
    expect(id.length).toBeGreaterThan(5);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newRequestId()));
    expect(ids.size).toBe(100);
  });

  it('contains a hyphen separator', () => {
    expect(newRequestId()).toContain('-');
  });
});

describe('NULL_USAGE_SINK', () => {
  it('accepts events without throwing', () => {
    const event: UsageEvent = {
      tier: 'free',
      route: '/ingest',
      status: 200,
      bytesIn: 100,
      bytesOut: 50,
      ts: Date.now(),
    };
    expect(() => NULL_USAGE_SINK.record(event)).not.toThrow();
  });
});

describe('InMemoryUsageSink', () => {
  it('records and retrieves events', () => {
    const sink = new InMemoryUsageSink();
    sink.record({ tier: 'free', route: '/ingest', status: 200, bytesIn: 100, bytesOut: 50, ts: 1 });
    sink.record({ tier: 'pro', route: '/ingest', status: 200, bytesIn: 200, bytesOut: 100, ts: 2 });
    expect(sink.events).toHaveLength(2);
  });

  it('summarise aggregates by apiKey + route', () => {
    const sink = new InMemoryUsageSink();
    sink.record({ apiKey: 'k1', tier: 'free', route: '/ingest', status: 200, bytesIn: 100, bytesOut: 50, ts: 1 });
    sink.record({ apiKey: 'k1', tier: 'free', route: '/ingest', status: 200, bytesIn: 200, bytesOut: 100, ts: 2 });
    sink.record({ apiKey: 'k2', tier: 'pro', route: '/health', status: 200, bytesIn: 0, bytesOut: 10, ts: 3 });

    const summary = sink.summarise();
    expect(summary.size).toBe(2);

    const k1 = summary.get('k1::/ingest');
    expect(k1?.count).toBe(2);
    expect(k1?.bytesIn).toBe(300);
    expect(k1?.bytesOut).toBe(150);

    const k2 = summary.get('k2::/health');
    expect(k2?.count).toBe(1);
  });

  it('summarise uses * for events without apiKey', () => {
    const sink = new InMemoryUsageSink();
    sink.record({ tier: 'free', route: '/ingest', status: 200, bytesIn: 10, bytesOut: 5, ts: 1 });
    const summary = sink.summarise();
    expect(summary.has('*::/ingest')).toBe(true);
  });

  it('summarise returns empty map for no events', () => {
    const sink = new InMemoryUsageSink();
    expect(sink.summarise().size).toBe(0);
  });
});
