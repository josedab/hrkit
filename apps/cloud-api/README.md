# @hrkit/cloud-api

A drop-in Cloudflare Workers ingest endpoint for `@hrkit`. Each athlete gets a Durable Object that owns:

- Append-only sample storage (Durable Object key/value, `samples/:athleteId/:sessionId/:ts`)
- A live SSE fan-out stream (`/stream/:athleteId`)
- Tier-based token-bucket rate limiting (`free` vs `pro`)
- Best-effort archival to R2 when the `ARCHIVE` binding is configured

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Liveness probe — returns `{ status: "ok", requestId }`. Unauthenticated. |
| `POST` | `/ingest` | Body: `IngestedSample[]` (an array — even for a single sample). Routed to the Durable Object of `samples[0].athleteId`. |
| `GET`  | `/sessions/:athleteId/:sessionId` | List sample keys recorded under that session. |
| `GET`  | `/samples/:athleteId/:sessionId/:ts` | Fetch a single stored sample by its key. |
| `GET`  | `/stream/:athleteId` | SSE — every new sample written to the athlete is broadcast immediately. |

`OPTIONS` preflight is handled for every route with permissive CORS headers.

## Authentication

Two schemes are supported, in priority order:

1. **`X-Api-Key: <key>`** — looked up in the `API_KEYS` KV namespace. Each key resolves to a JSON record `{ tier: 'free' | 'pro', athleteId?: string }`. When `athleteId` is set, all requests with that key are scoped to that athlete (a request for a different athlete returns `403 scope_mismatch`).
2. **`Authorization: Bearer <HRKIT_AUTH_TOKEN>`** — single-key fallback, treated as the `pro` tier with no athlete pinning.

Every response carries an `x-request-id` header for correlation; failed JSON bodies follow `{ error, code, requestId }`.

## Develop

```bash
pnpm --filter @hrkit/cloud-api dev
# in another terminal:
curl -H "Authorization: Bearer change-me-in-production" \
     -H "Content-Type: application/json" \
     -d '[{"athleteId":"u1","sessionId":"s1","hr":142,"timestamp":'$(date +%s%3N)'}]' \
     http://127.0.0.1:8787/ingest
```

## Deploy

```bash
wrangler login
wrangler secret put HRKIT_AUTH_TOKEN     # rotate this
# Optional bindings (configure in wrangler.toml):
#   ATHLETE   — Durable Object namespace (required)
#   API_KEYS  — KV namespace for X-Api-Key auth
#   ARCHIVE   — R2 bucket for sample archival
pnpm --filter @hrkit/cloud-api deploy
```

### Tunable env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `HRKIT_AUTH_TOKEN` | — | Bearer-token fallback secret. Rotate via `wrangler secret put`. |
| `HRKIT_FREE_TIER_RPM` | (built-in default) | Token-bucket refill rate for `tier: 'free'` keys, in requests per minute. |
| `HRKIT_PRO_TIER_RPM`  | (built-in default) | Token-bucket refill rate for `tier: 'pro'` keys. |

## Why a Durable Object per athlete?

- Strong consistency — all writes for an athlete serialize.
- Cheap live fan-out — subscribers attach to the same DO that holds the writer.
- Free per-DO sandbox isolation — no noisy-neighbor risk between athletes.
- Per-athlete rate limiting falls out for free.

## Limits

- DO storage is currently 50 GB per DO; for long-term archival, bind an R2 bucket as `ARCHIVE` (the worker writes every sample best-effort and never blocks ingest on archive failure).
- A scheduled handler is wired in `worker.ts` for hourly cron archival; enable it in `wrangler.toml` once you have an athlete registry to walk.
- SSE keeps DOs warm; consider WebSockets + DO hibernation for >100 concurrent live viewers per athlete.

