import type { HRPacket } from '@hrkit/core';

/**
 * Minimal storage interface that maps cleanly onto:
 *   - Cloudflare KV / Durable Object Storage
 *   - Deno KV
 *   - Vercel KV / Upstash Redis
 *   - In-memory (for testing)
 */
export interface EdgeStore {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  list(prefix: string): Promise<string[]>;
}

/** Simple in-memory store useful for tests and dev. */
export class MemoryStore implements EdgeStore {
  private readonly map = new Map<string, string>();

  async put(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }
  async list(prefix: string): Promise<string[]> {
    return Array.from(this.map.keys())
      .filter((k) => k.startsWith(prefix))
      .sort();
  }
}

/** A single HR sample record persisted in the edge store. */
export interface IngestedSample extends HRPacket {
  /** Athlete or session identifier supplied by the client. */
  athleteId: string;
  /** Optional session/workout identifier. */
  sessionId?: string;
}

/** Configuration for the edge ingestion handler. */
export interface IngestConfig {
  store: EdgeStore;
  /** Shared-secret token clients must send via `Authorization: Bearer …`. */
  authToken?: string;
  /**
   * Optional CORS origin (e.g., `https://app.example.com`). Defaults to `*`.
   * Set to `null` to disable CORS headers entirely.
   */
  corsOrigin?: string | null;
  /** Maximum samples per request body. Default 1000. */
  maxBatchSize?: number;
}

/**
 * Build a runtime-portable `(req: Request) => Promise<Response>` handler.
 * Works in any fetch-based environment (Workers, Deno, Bun, Node 18+).
 *
 * Supported routes:
 *   POST  /ingest            — accept an array of HR packets
 *   GET   /sessions/:id      — list sample keys for a session
 *   GET   /samples/:key      — fetch a single sample
 *   GET   /health            — liveness probe
 */
export function createIngestHandler(cfg: IngestConfig): (req: Request) => Promise<Response> {
  const corsOrigin = cfg.corsOrigin === undefined ? '*' : cfg.corsOrigin;
  const maxBatch = cfg.maxBatchSize ?? 1000;

  const cors = (res: Response): Response => {
    if (corsOrigin === null) return res;
    const headers = new Headers(res.headers);
    headers.set('Access-Control-Allow-Origin', corsOrigin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return new Response(res.body, { status: res.status, headers });
  };

  const json = (status: number, body: unknown): Response =>
    cors(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    if (url.pathname === '/health') return json(200, { status: 'ok' });

    // Auth gate for everything below
    if (cfg.authToken) {
      const auth = req.headers.get('authorization') ?? '';
      const expected = `Bearer ${cfg.authToken}`;
      if (auth !== expected) return json(401, { error: 'unauthorized' });
    }

    if (req.method === 'POST' && url.pathname === '/ingest') {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json(400, { error: 'invalid json' });
      }
      const samples = Array.isArray(body) ? (body as IngestedSample[]) : null;
      if (!samples) return json(400, { error: 'expected array of samples' });
      if (samples.length === 0) return json(200, { ingested: 0 });
      if (samples.length > maxBatch) return json(413, { error: 'batch too large', max: maxBatch });

      const errs: string[] = [];
      for (const s of samples) {
        const v = validateSample(s);
        if (v) {
          errs.push(v);
          continue;
        }
        const sid = s.sessionId ?? 'default';
        const key = `samples/${s.athleteId}/${sid}/${s.timestamp}`;
        await cfg.store.put(key, JSON.stringify(s));
      }
      if (errs.length > 0) return json(207, { ingested: samples.length - errs.length, errors: errs });
      return json(200, { ingested: samples.length });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/sessions/')) {
      const parts = url.pathname.split('/').filter(Boolean);
      // /sessions/:athleteId/:sessionId
      if (parts.length === 3) {
        const [, athleteId, sessionId] = parts;
        const keys = await cfg.store.list(`samples/${athleteId}/${sessionId}/`);
        return json(200, { count: keys.length, keys });
      }
      return json(400, { error: 'expected /sessions/:athleteId/:sessionId' });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/samples/')) {
      const key = url.pathname.slice('/samples/'.length);
      const v = await cfg.store.get(`samples/${key}`);
      if (v === null) return json(404, { error: 'not found' });
      return cors(new Response(v, { status: 200, headers: { 'content-type': 'application/json' } }));
    }

    return json(404, { error: 'not found' });
  };
}

/** Returns an error message if invalid, or null if valid. */
export function validateSample(s: unknown): string | null {
  if (typeof s !== 'object' || s === null) return 'sample is not an object';
  const o = s as Record<string, unknown>;
  if (typeof o.athleteId !== 'string' || o.athleteId.length === 0) return 'missing athleteId';
  if (typeof o.timestamp !== 'number' || !Number.isFinite(o.timestamp)) return 'invalid timestamp';
  if (typeof o.hr !== 'number' || o.hr < 0 || o.hr > 300) return 'invalid hr';
  if (!Array.isArray(o.rrIntervals)) return 'rrIntervals must be array';
  return null;
}
