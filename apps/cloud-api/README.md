# @hrkit/cloud-api

A drop-in Cloudflare Workers ingest endpoint for `@hrkit`. Each athlete gets a Durable Object that owns:

- Append-only sample storage (JSONL-style, per session)
- A live SSE fan-out stream (`/stream/:athlete`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ingest` | Body: `{ athleteId, sessionId, hr, ts, rrIntervals?, ... }` (single sample or array). Auth via `Authorization: Bearer $HRKIT_AUTH_TOKEN`. |
| `GET` | `/sessions/:athlete` | List session IDs. |
| `GET` | `/sessions/:athlete/:session` | NDJSON of samples. |
| `GET` | `/stream/:athlete` | SSE — every new sample written to the athlete is broadcast immediately. |

## Develop

```bash
pnpm --filter @hrkit/cloud-api dev
# in another terminal:
curl -H "Authorization: Bearer change-me-in-production" \
     -d '{"athleteId":"u1","sessionId":"s1","hr":142,"ts":'$(date +%s%3N)'}' \
     http://127.0.0.1:8787/ingest
```

## Deploy

```bash
wrangler login
wrangler secret put HRKIT_AUTH_TOKEN     # rotate this
pnpm --filter @hrkit/cloud-api deploy
```

## Why a Durable Object per athlete?

- Strong consistency — all writes for an athlete serialize.
- Cheap live fan-out — subscribers attach to the same DO that holds the writer.
- Free per-DO sandbox isolation — no noisy-neighbor risk between athletes.

## Limits

- DO storage is currently 50 GB per DO; for long-term archival, schedule a daily flush to R2 (left as a TODO; see `worker.ts`).
- SSE keeps DOs warm; consider using WebSockets + hibernation for >100 concurrent live viewers per athlete.
