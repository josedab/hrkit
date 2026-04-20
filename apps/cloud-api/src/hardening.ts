/**
 * Hardening primitives for the hrkit cloud-api worker. Kept as pure helpers
 * (no Workers globals) so they are unit-testable and reusable across edge
 * runtimes (Cloudflare Workers, Deno Deploy, Vercel Edge, Bun).
 */

export interface ErrorEnvelope {
  error: { code: string; message: string; requestId: string };
}

export function jsonError(status: number, code: string, message: string, requestId: string): Response {
  const body: ErrorEnvelope = { error: { code, message, requestId } };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      ...corsHeaders(),
    },
  });
}

export function jsonOk(value: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      ...corsHeaders(),
    },
  });
}

/** Standard CORS headers — allows browser SDK clients to call the API directly. */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Api-Key',
    'Access-Control-Max-Age': '86400',
  };
}

export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/** Cheap monotonically-unique-ish request id. Adequate for log correlation. */
export function newRequestId(): string {
  const rand = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return `${Date.now().toString(36)}-${rand}`;
}

// ── Usage metering ─────────────────────────────────────────────────────

/**
 * Pluggable usage sink. Implementations may write to KV counters, an
 * analytics-engine dataset, or a downstream billing service. Calls are
 * fire-and-forget — never block the request path on metering.
 */
export interface UsageSink {
  record(event: UsageEvent): void | Promise<void>;
}

export interface UsageEvent {
  apiKey?: string;
  tier: 'free' | 'pro';
  athleteId?: string;
  route: string;
  status: number;
  bytesIn: number;
  bytesOut: number;
  ts: number;
}

/** No-op sink — used when metering is disabled or in tests. */
export const NULL_USAGE_SINK: UsageSink = { record() {} };

/** In-memory aggregator — useful for tests and dev mode. */
export class InMemoryUsageSink implements UsageSink {
  readonly events: UsageEvent[] = [];
  record(event: UsageEvent): void {
    this.events.push(event);
  }
  /** Aggregate bytes per (apiKey, route) pair. */
  summarise(): Map<string, { count: number; bytesIn: number; bytesOut: number }> {
    const out = new Map<string, { count: number; bytesIn: number; bytesOut: number }>();
    for (const e of this.events) {
      const key = `${e.apiKey ?? '*'}::${e.route}`;
      const cur = out.get(key) ?? { count: 0, bytesIn: 0, bytesOut: 0 };
      cur.count += 1;
      cur.bytesIn += e.bytesIn;
      cur.bytesOut += e.bytesOut;
      out.set(key, cur);
    }
    return out;
  }
}
