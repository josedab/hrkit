# @hrkit/edge

Runtime-portable HR ingestion for fetch-based environments — Cloudflare Workers, Deno Deploy, Bun, Vercel Edge, and Node 18+. Zero Node-only deps.

Part of the [@hrkit](https://github.com/josedab/hrkit) monorepo.

## Install

```bash
npm install @hrkit/edge
```

## Quick Start (Cloudflare Worker)

```ts
import { createIngestHandler, type EdgeStore } from '@hrkit/edge';

// Adapt Cloudflare KV to the EdgeStore interface
const store: EdgeStore = {
  put: (k, v) => env.SAMPLES.put(k, v),
  get: (k) => env.SAMPLES.get(k),
  list: async (prefix) => (await env.SAMPLES.list({ prefix })).keys.map((k) => k.name),
  delete: (k) => env.SAMPLES.delete(k),
};

const handler = createIngestHandler({
  store,
  authToken: env.INGEST_TOKEN,        // shared secret — Authorization: Bearer …
  corsOrigin: 'https://app.example',  // or '*' (default), or null to disable CORS
  maxBatchSize: 1000,                 // default 1000
});

export default { fetch: handler };
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ingest` | Body: JSON array of `IngestedSample`. Returns `{ ingested }` (200), `{ ingested, errors }` (207 partial), or `{ error }`. |
| `GET`  | `/sessions/:athleteId/:sessionId` | List sample keys. |
| `GET`  | `/samples/:key` | Fetch a single stored sample (the `key` is the path returned by `/sessions/`). |
| `GET`  | `/health` | Liveness probe — auth-free. |
| `OPTIONS` | * | CORS preflight. |

## Sample shape

```ts
interface IngestedSample extends HRPacket {
  athleteId: string;       // required
  sessionId?: string;      // optional, defaults to 'default'
  // …plus HRPacket fields: hr (0–300), timestamp, rrIntervals[]
}
```

`validateSample(s)` is exported so you can reuse the same checks at the producer side and avoid round-trips for malformed batches.

## API

| Symbol | Description |
|--------|-------------|
| `createIngestHandler(cfg)` | Build a `(req: Request) => Promise<Response>` handler. Works in any fetch-based runtime. |
| `EdgeStore` | Interface with `put` / `get` / `list(prefix)` / `delete`. Maps cleanly onto Cloudflare KV, Deno KV, Vercel KV / Upstash Redis, and Durable Object Storage. |
| `MemoryStore` | In-memory `EdgeStore` implementation for tests and local dev. |
| `IngestConfig` | `{ store, authToken?, corsOrigin?, maxBatchSize? }`. |
| `IngestedSample` | `HRPacket & { athleteId, sessionId? }`. |
| `validateSample(s)` | Returns an error message string, or `null` if valid. |

## Deployment notes

- **Auth.** If `authToken` is omitted, the handler accepts anonymous writes — fine for local dev, never appropriate for production. Wire up Workers Secrets / `Deno.env` / Vercel env vars.
- **CORS.** Default is `*`. Set `corsOrigin: null` if you front the handler with another reverse proxy that handles CORS, or set a specific origin in production.
- **Batch sizing.** `maxBatchSize` rejects payloads larger than the cap with HTTP 413. Tune to your runtime's body-size limits (Workers: 100 MB; Vercel Edge: 4.5 MB).
- **Partial failures.** A 207 response means *some* samples were stored and *some* were rejected — clients should not retry the whole batch.

## Docs

See the [API reference](https://josedab.github.io/hrkit/api/edge/) and the [main README](../../README.md) for the full integrator guide.

## License

MIT
