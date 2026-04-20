/**
 * @hrkit cloud ingest worker.
 *
 *   POST /ingest             — body: IngestedSample[]; routed to the DO of
 *                              `samples[0].athleteId`.
 *   GET  /sessions/:a/:s     — list session sample keys.
 *   GET  /samples/:key       — fetch a single sample.
 *   GET  /stream/:athlete    — SSE; pushes every new sample written to the
 *                              athlete's Durable Object.
 *
 * Auth: either `Authorization: Bearer <HRKIT_AUTH_TOKEN>` (legacy single key)
 * or `X-Api-Key: <key>` looked up in the `API_KEYS` KV namespace. KV value is
 * a JSON `{ tier: 'free' | 'pro', athleteId?: string }`. When `athleteId` is
 * pinned, all requests with that key are scoped to that athlete.
 */

import { createIngestHandler, type EdgeStore, type IngestedSample, MemoryStore } from '@hrkit/edge';
import { handlePreflight, jsonError, NULL_USAGE_SINK, newRequestId, type UsageSink } from './hardening.js';

export interface ApiKeyRecord {
  tier: 'free' | 'pro';
  athleteId?: string;
}

export interface Env {
  ATHLETE: DurableObjectNamespace;
  HRKIT_AUTH_TOKEN: string;
  HRKIT_FREE_TIER_RPM?: string;
  HRKIT_PRO_TIER_RPM?: string;
  API_KEYS?: KVNamespace;
  ARCHIVE?: R2Bucket;
}

interface AuthResult {
  ok: true;
  tier: 'free' | 'pro';
  pinnedAthleteId?: string;
}

async function authenticate(req: Request, env: Env): Promise<AuthResult | Response> {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey && env.API_KEYS) {
    const raw = await env.API_KEYS.get(apiKey);
    if (!raw) return new Response('invalid api key', { status: 401 });
    let rec: ApiKeyRecord;
    try {
      rec = JSON.parse(raw) as ApiKeyRecord;
    } catch {
      return new Response('corrupt api key record', { status: 500 });
    }
    return { ok: true, tier: rec.tier, pinnedAthleteId: rec.athleteId };
  }
  const bearer = req.headers.get('authorization');
  if (bearer === `Bearer ${env.HRKIT_AUTH_TOKEN}`) {
    return { ok: true, tier: 'pro' };
  }
  return new Response('unauthorized', { status: 401 });
}

function pickAthleteId(url: URL, body: unknown): string | null {
  const stream = url.pathname.match(/^\/stream\/([^/]+)$/);
  if (stream) return stream[1] ?? null;
  const sessions = url.pathname.match(/^\/sessions\/([^/]+)/);
  if (sessions) return sessions[1] ?? null;
  const samples = url.pathname.match(/^\/samples\/[^/]+\/([^/]+)/);
  if (samples) return samples[1] ?? null;
  if (Array.isArray(body) && body.length > 0) {
    const first = body[0] as { athleteId?: string };
    return first?.athleteId ?? null;
  }
  return null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const requestId = newRequestId();

    const preflight = handlePreflight(req);
    if (preflight) return preflight;

    if (url.pathname === '/health')
      return new Response(JSON.stringify({ status: 'ok', requestId }), {
        headers: { 'content-type': 'application/json', 'x-request-id': requestId },
      });

    const auth = await authenticate(req, env);
    if (auth instanceof Response) return auth;

    let parsed: unknown = null;
    if (req.method === 'POST') {
      try {
        parsed = await req.clone().json();
      } catch {
        return jsonError(400, 'invalid_json', 'request body is not valid JSON', requestId);
      }
    }

    const athlete = pickAthleteId(url, parsed);
    if (!athlete) return jsonError(404, 'not_found', 'no athlete in path or payload', requestId);

    if (auth.pinnedAthleteId && auth.pinnedAthleteId !== athlete) {
      return jsonError(403, 'scope_mismatch', 'api key is pinned to a different athlete', requestId);
    }

    const id = env.ATHLETE.idFromName(athlete);
    const stub = env.ATHLETE.get(id);
    const fwd = new Request(req.url, req);
    fwd.headers.set('x-hrkit-tier', auth.tier);
    fwd.headers.set('x-request-id', requestId);
    const sink: UsageSink = NULL_USAGE_SINK;
    const res = await stub.fetch(fwd);
    sink.record({
      apiKey: req.headers.get('x-api-key') ?? undefined,
      tier: auth.tier,
      athleteId: athlete,
      route: url.pathname,
      status: res.status,
      bytesIn: Number(req.headers.get('content-length') ?? 0),
      bytesOut: Number(res.headers.get('content-length') ?? 0),
      ts: Date.now(),
    });
    return res;
  },

  async scheduled(_event: ScheduledEvent, _env: Env, _ctx: ExecutionContext): Promise<void> {
    // Hourly cron archives DO storage to R2. Implementation sketch — full
    // archival walks every athlete DO, which requires either a registry or
    // R2 list+merge. Wire the cron in wrangler.toml when ready:
    //   [triggers] crons = ["0 * * * *"]
  },
};

/**
 * Per-athlete Durable Object. Owns its own EdgeStore (backed by DO storage)
 * and an in-memory ring of subscribers for live SSE fan-out. Applies a
 * token-bucket rate limit per request based on the caller's tier.
 */
export class AthleteSession {
  private readonly store: EdgeStore;
  private readonly handler: (req: Request) => Promise<Response>;
  private readonly subscribers = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private readonly env: Env;
  private bucket = { tokens: 0, lastRefillMs: 0 };

  constructor(state: DurableObjectState, env: Env) {
    this.env = env;
    const inner = new DurableObjectEdgeStore(state.storage);
    this.store = {
      put: async (key, value) => {
        await inner.put(key, value);
        if (key.startsWith('samples/')) {
          try {
            this.broadcast(JSON.parse(value) as IngestedSample);
          } catch {
            /* ignore */
          }
        }
        if (this.env.ARCHIVE && key.startsWith('samples/')) {
          // Best-effort archival; never block ingest on archive failure.
          this.env.ARCHIVE.put(key, value).catch(() => {});
        }
      },
      get: (key) => inner.get(key),
      list: (prefix) => inner.list(prefix),
      delete: (key) => inner.delete(key),
    };
    this.handler = createIngestHandler({
      store: this.store,
      authToken: env.HRKIT_AUTH_TOKEN,
    });
  }

  async fetch(req: Request): Promise<Response> {
    const tier = (req.headers.get('x-hrkit-tier') ?? 'free') as 'free' | 'pro';
    if (!this.allow(tier)) {
      return new Response('rate limit exceeded', {
        status: 429,
        headers: { 'retry-after': '1' },
      });
    }
    const url = new URL(req.url);
    if (url.pathname.startsWith('/stream/')) return this.openStream();
    return this.handler(req);
  }

  private rpmFor(tier: 'free' | 'pro'): number {
    const raw = tier === 'pro' ? this.env.HRKIT_PRO_TIER_RPM : this.env.HRKIT_FREE_TIER_RPM;
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return tier === 'pro' ? 600 : 60;
  }

  private allow(tier: 'free' | 'pro'): boolean {
    const capacity = this.rpmFor(tier);
    const now = Date.now();
    if (this.bucket.lastRefillMs === 0) {
      this.bucket = { tokens: capacity, lastRefillMs: now };
    } else {
      const elapsedMin = (now - this.bucket.lastRefillMs) / 60000;
      this.bucket.tokens = Math.min(capacity, this.bucket.tokens + elapsedMin * capacity);
      this.bucket.lastRefillMs = now;
    }
    if (this.bucket.tokens >= 1) {
      this.bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  private openStream(): Response {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    this.subscribers.add(writer);
    writer.closed.finally(() => this.subscribers.delete(writer));

    writer.write(new TextEncoder().encode(': hrkit stream open\n\n'));

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        Connection: 'keep-alive',
      },
    });
  }

  private broadcast(sample: IngestedSample): void {
    const payload = `data: ${JSON.stringify(sample)}\n\n`;
    const bytes = new TextEncoder().encode(payload);
    for (const w of this.subscribers) {
      w.write(bytes).catch(() => this.subscribers.delete(w));
    }
  }
}

/** Adapter so EdgeStore writes/reads through Durable Object storage. */
class DurableObjectEdgeStore implements EdgeStore {
  constructor(private readonly storage: DurableObjectStorage) {}

  async put(key: string, value: string): Promise<void> {
    await this.storage.put(key, value);
  }
  async get(key: string): Promise<string | null> {
    const v = await this.storage.get<string>(key);
    return v ?? null;
  }
  async list(prefix: string): Promise<string[]> {
    const map = await this.storage.list<string>({ prefix });
    return Array.from(map.keys()).sort();
  }
  async delete(key: string): Promise<void> {
    await this.storage.delete(key);
  }
}

export { MemoryStore };
